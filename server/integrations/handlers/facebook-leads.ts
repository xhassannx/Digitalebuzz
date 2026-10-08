import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import { triggerWebhooks } from "../../webhooks/delivery";

const FACEBOOK_GRAPH_API_VERSION = "v18.0";
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

export function registerFacebookLeadsRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Sync leads from Facebook Lead Ads
  app.post("/api/integrations/facebook-lead-ads/sync-leads", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { integrationId, pageId, formId, startDate, endDate } = req.body;

      // Get Facebook Lead Ads integration
      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
      } else {
        integration = await storage.getIntegrationByName("facebook-lead-ads", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Facebook Lead Ads integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      if (!accessToken) {
        return res.status(400).json({ message: "Facebook access token not configured" });
      }

      // Check if token is expired
      if (credentials.expires_at && credentials.expires_at < Date.now()) {
        return res.status(401).json({ message: "Facebook access token has expired. Please reconnect the integration." });
      }

      let allLeads: any[] = [];

      try {
        // Step 1: Get user's pages (if pageId not provided)
        let pages: any[] = [];
        if (pageId) {
          // Get specific page info
          const pageResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/${pageId}?fields=id,name,access_token&access_token=${accessToken}`
          );
          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            pages = [pageData];
          }
        } else {
          // Get all pages the user manages
          const pagesResponse = await fetch(
            `${FACEBOOK_GRAPH_API_BASE}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
          );
          if (pagesResponse.ok) {
            const pagesData = await pagesResponse.json();
            pages = pagesData.data || [];
          } else {
            const errorData = await pagesResponse.json().catch(() => ({}));
            throw new Error(errorData.error?.message || "Failed to fetch pages");
          }
        }

        if (pages.length === 0) {
          return res.status(404).json({ message: "No Facebook pages found. Ensure you have admin access to at least one page." });
        }

        // Step 2: Get lead forms for each page
        for (const page of pages) {
          const pageAccessToken = page.access_token || accessToken;

          // Get lead forms for this page
          let forms: any[] = [];
          if (formId) {
            // Get specific form
            const formResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${formId}?fields=id,name,status&access_token=${pageAccessToken}`
            );
            if (formResponse.ok) {
              const formData = await formResponse.json();
              forms = [formData];
            }
          } else {
            // Get all lead forms for the page
            const formsResponse = await fetch(
              `${FACEBOOK_GRAPH_API_BASE}/${page.id}/leadgen_forms?fields=id,name,status&access_token=${pageAccessToken}`
            );
            if (formsResponse.ok) {
              const formsData = await formsResponse.json();
              forms = formsData.data || [];
            }
          }

          // Step 3: Get leads from each form
          for (const form of forms) {
            if (form.status !== "ACTIVE") {
              continue; // Skip inactive forms
            }

            // Build query parameters
            const params = new URLSearchParams({
              access_token: pageAccessToken,
            });

            if (startDate) {
              params.append("time_created[gte]", new Date(startDate).getTime().toString());
            }
            if (endDate) {
              params.append("time_created[lte]", new Date(endDate).getTime().toString());
            }

            // Get leads for this form (include field_data to get form field values)
            // Handle pagination to get ALL leads
            let leadsUrl = `${FACEBOOK_GRAPH_API_BASE}/${form.id}/leads?fields=id,created_time,field_data&${params.toString()}`;
            let formLeads: any[] = [];

            while (leadsUrl) {
              const leadsResponse = await fetch(leadsUrl);

              if (leadsResponse.ok) {
                const leadsData = await leadsResponse.json();
                const leads = leadsData.data || [];

                // Enrich leads with form and page info
                const enrichedLeads = leads.map((lead: any) => ({
                  ...lead,
                  form_id: form.id,
                  form_name: form.name,
                  page_id: page.id,
                  page_name: page.name,
                }));

                formLeads = formLeads.concat(enrichedLeads);

                // Check for next page
                const paging = leadsData.paging;
                if (paging && paging.next) {
                  leadsUrl = paging.next;
                  console.log(`[Facebook Leads] Fetching next page for form ${form.id}, total so far: ${formLeads.length}`);
                } else {
                  leadsUrl = ''; // No more pages
                }
              } else {
                const errorData = await leadsResponse.json().catch(() => ({}));
                console.error(`Failed to fetch leads for form ${form.id}:`, errorData);
                leadsUrl = ''; // Stop pagination on error
              }
            }

            console.log(`[Facebook Leads] Fetched ${formLeads.length} total leads from form ${form.id}`);
            allLeads = allLeads.concat(formLeads);
          }
        }

        // Sync leads to managed contacts
        console.log(`[Facebook Leads] Starting sync of ${allLeads.length} leads to contacts...`);
        
        // Pre-fetch all existing contacts once (more efficient than checking for each lead)
        const existingContacts = await storage.getManagedContactsByUser(userId, organizationId || '');
        const contactsByPhone = new Map<string, typeof existingContacts[0]>();
        const contactsByEmail = new Map<string, typeof existingContacts[0]>();
        
        for (const contact of existingContacts) {
          if (contact.phoneNumber) {
            contactsByPhone.set(contact.phoneNumber, contact);
          }
          if (contact.email) {
            contactsByEmail.set(contact.email.toLowerCase(), contact);
          }
        }
        
        console.log(`[Facebook Leads] Found ${existingContacts.length} existing contacts`);

        let syncedContactsCount = 0;
        let skippedContactsCount = 0;
        let updatedContactsCount = 0;
        const syncedContactIds: string[] = [];
        const errorDetails: Array<{ leadId: string; error: string }> = [];

        for (let i = 0; i < allLeads.length; i++) {
          const lead = allLeads[i];
          
          // Log progress every 50 leads
          if (i % 50 === 0 && i > 0) {
            console.log(`[Facebook Leads] Processing lead ${i + 1}/${allLeads.length}...`);
          }

          try {
            // Extract lead data from field_data
            const fieldData = lead.field_data || [];
            const leadFields: Record<string, string> = {};
            let phoneNumber: string | null = null;
            let email: string | null = null;
            let name: string | null = null;

            // Parse field_data array into a map
            for (const field of fieldData) {
              const fieldName = field.name?.toLowerCase() || '';
              const fieldValue = field.values?.[0] || '';
              
              if (field.name) {
                leadFields[field.name] = fieldValue;
              }

              // Extract common fields
              if (fieldName.includes('phone') || fieldName.includes('mobile') || fieldName.includes('tel')) {
                phoneNumber = fieldValue;
              } else if (fieldName.includes('email') || fieldName === 'email') {
                email = fieldValue;
              } else if (fieldName.includes('name') || fieldName.includes('full_name') || fieldName === 'first_name' || fieldName === 'last_name') {
                if (!name) {
                  name = fieldValue;
                } else {
                  name = `${name} ${fieldValue}`.trim();
                }
              }
            }

            // Skip if no phone number or email
            if (!phoneNumber && !email) {
              skippedContactsCount++;
              continue;
            }

            // Use lead ID as fallback name if no name found
            if (!name) {
              name = `Facebook Lead ${lead.id}`;
            }

            // Get form and page info from enriched lead data
            const formId = lead.form_id || '';
            const formName = lead.form_name || '';
            const pageId = lead.page_id || '';
            const pageName = lead.page_name || '';

            // Check if contact already exists (by phone or email) - use Map for O(1) lookup
            const existingContact = 
              (phoneNumber && contactsByPhone.get(phoneNumber)) ||
              (email && contactsByEmail.get(email.toLowerCase()));

            if (existingContact) {
              // Update existing contact with new lead data
              const updatedCustomFields = {
                ...(existingContact.customFields || {}),
                ...leadFields,
                facebook_lead_id: lead.id,
                facebook_form_id: formId,
                facebook_form_name: formName,
                facebook_page_id: pageId,
                facebook_page_name: pageName,
                last_synced_at: new Date().toISOString(),
              };

              await storage.updateManagedContact(
                existingContact.id,
                userId,
                organizationId || "",
                {
                  name: name || existingContact.name,
                  phoneNumber: phoneNumber || existingContact.phoneNumber,
                  email: email || existingContact.email,
                  source: "facebook",
                  customFields: updatedCustomFields,
                  notes: existingContact.notes
                    ? `${existingContact.notes}\n\nFacebook Lead synced: ${new Date().toISOString()}`
                    : `Facebook Lead synced: ${new Date().toISOString()}`,
                }
              );
              
              // Update maps to reflect changes
              if (phoneNumber && !contactsByPhone.has(phoneNumber)) {
                contactsByPhone.set(phoneNumber, existingContact);
              }
              if (email && !contactsByEmail.has(email.toLowerCase())) {
                contactsByEmail.set(email.toLowerCase(), existingContact);
              }
              
              syncedContactIds.push(existingContact.id);
              updatedContactsCount++;
            } else {
              // Create new managed contact
              const customFields: Record<string, string> = {
                ...leadFields,
                facebook_lead_id: lead.id,
                facebook_form_id: formId,
                facebook_form_name: formName,
                facebook_page_id: pageId,
                facebook_page_name: pageName,
                synced_at: new Date().toISOString(),
              };

              const newContact = await storage.createManagedContact(
                {
                  userId,
                  organizationId: organizationId || undefined,
                  name,
                  phoneNumber: phoneNumber || email || "N/A",
                  email: email || undefined,
                  source: "facebook",
                  customFields,
                  notes: `Synced from Facebook Lead Ads - Form: ${formName}, Page: ${pageName}`,
                }
              );
              
              // Add to maps for future lookups
              if (phoneNumber) {
                contactsByPhone.set(phoneNumber, newContact);
              }
              if (email) {
                contactsByEmail.set(email.toLowerCase(), newContact);
              }
              
              syncedContactIds.push(newContact.id);
              syncedContactsCount++;
            }
          } catch (contactError: any) {
            const errorMsg = contactError.message || String(contactError);
            console.error(`[Facebook Leads] Error syncing lead ${lead.id} to contacts:`, errorMsg);
            errorDetails.push({ leadId: lead.id, error: errorMsg });
            skippedContactsCount++;
          }
        }

        console.log(`[Facebook Leads] Sync completed: ${syncedContactsCount} created, ${updatedContactsCount} updated, ${skippedContactsCount} skipped`);

        // Update last sync time
        await storage.updateIntegration(integration.id!, userId, {
          lastSyncAt: new Date(),
        });

        res.json({
          success: true,
          leads: allLeads,
          count: allLeads.length,
          syncedContactsCount,
          updatedContactsCount,
          skippedContactsCount,
          syncedContactIds,
          errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
          syncedAt: new Date().toISOString(),
          pagesProcessed: pages.length,
        });
      } catch (error: any) {
        console.error("Facebook Lead Ads sync error:", error);
        throw error;
      }
    } catch (error: any) {
      console.error("Facebook Lead Ads sync error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to sync leads from Facebook Lead Ads",
        error: error.message 
      });
    }
  });

  // Get user's Facebook pages
  app.get("/api/integrations/facebook-lead-ads/pages", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const integrationId = req.query.integrationId as string | undefined;

      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
        if (!integration || integration.name !== "facebook-lead-ads") integration = undefined;
      }
      if (!integration) {
        integration = await storage.getIntegrationByName("facebook-lead-ads", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Facebook Lead Ads integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      if (!accessToken) {
        return res.status(400).json({ message: "Facebook access token not configured" });
      }

      // Get user's pages
      const pagesResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/me/accounts?fields=id,name,category,access_token&access_token=${accessToken}`
      );

      if (!pagesResponse.ok) {
        const errorData = await pagesResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to fetch pages");
      }

      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];

      res.json({
        success: true,
        pages,
        count: pages.length,
      });
    } catch (error: any) {
      console.error("Error fetching Facebook pages:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch Facebook pages",
        error: error.message 
      });
    }
  });

  // Get lead forms for a page
  app.get("/api/integrations/facebook-lead-ads/forms/:pageId", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { pageId } = req.params;
      const integrationId = req.query.integrationId as string | undefined;

      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
        if (!integration || integration.name !== "facebook-lead-ads") integration = undefined;
      }
      if (!integration) {
        integration = await storage.getIntegrationByName("facebook-lead-ads", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "Facebook Lead Ads integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const accessToken = credentials.access_token;

      if (!accessToken) {
        return res.status(400).json({ message: "Facebook access token not configured" });
      }

      // Get page access token
      const pageResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${accessToken}`
      );

      if (!pageResponse.ok) {
        const errorData = await pageResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to fetch page");
      }

      const pageData = await pageResponse.json();
      const pageAccessToken = pageData.access_token || accessToken;

      // Get lead forms for the page
      const formsResponse = await fetch(
        `${FACEBOOK_GRAPH_API_BASE}/${pageId}/leadgen_forms?fields=id,name,status,leads_count&access_token=${pageAccessToken}`
      );

      if (!formsResponse.ok) {
        const errorData = await formsResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to fetch lead forms");
      }

      const formsData = await formsResponse.json();
      const forms = formsData.data || [];

      res.json({
        success: true,
        forms,
        count: forms.length,
      });
    } catch (error: any) {
      console.error("Error fetching Facebook lead forms:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch lead forms",
        error: error.message 
      });
    }
  });

  // Webhook endpoint for Facebook Lead Ads (for real-time lead notifications)
  app.get("/api/integrations/facebook-lead-ads/webhook", async (req: any, res) => {
    try {
      // Facebook webhook verification
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      // Verify the webhook token (set this in your Facebook App settings)
      const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "your_webhook_verify_token";

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Facebook webhook verified");
        res.status(200).send(challenge);
      } else {
        res.status(403).json({ message: "Forbidden" });
      }
    } catch (error: any) {
      console.error("Facebook webhook verification error:", error);
      res.status(500).json({ message: "Failed to verify webhook" });
    }
  });

  // Handle incoming lead webhook events (configure in Facebook App > Webhooks)
  app.post("/api/integrations/facebook-lead-ads/webhook", async (req: any, res) => {
    try {
      const body = req.body;

      // Facebook sends webhook data in a specific format
      if (body.object === "page") {
        const entries = body.entry || [];

        for (const entry of entries) {
          const changes = entry.changes || [];

          for (const change of changes) {
            if (change.field === "leadgen") {
              const leadId = change.value.leadgen_id;
              const formId = change.value.form_id;
              const pageId = change.value.page_id;
              const adgroupId = change.value.adgroup_id;
              const adId = change.value.ad_id;
              const createdAt = change.value.created_time;

              console.log(`New lead received: ${leadId} from form ${formId} on page ${pageId}`);

              // Trigger webhooks for all users with Facebook Lead Ads integration
              const fbIntegrations = await storage.getAllIntegrationsByName("facebook-lead-ads");
              for (const int of fbIntegrations) {
                if (int.userId) {
                  await triggerWebhooks(int.userId, "facebook_lead_ads.lead_received", {
                    leadId,
                    formId,
                    pageId,
                    adgroupId,
                    adId,
                    createdAt,
                    change: change.value,
                  }).catch(() => {});
                }
              }
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Facebook webhook processing error:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}

