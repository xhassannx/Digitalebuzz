import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { createDripCampaignSchema, updateDripCampaignSchema, getCampaignLeadStatusTriggerSlugs } from "@shared/drip-campaigns";
import {
  createDripCampaign,
  deleteDripCampaign,
  getDripCampaign,
  listDripCampaigns,
  updateDripCampaign,
} from "./repo";
import { backfillCampaignLeadStatusEnrollments, enrollContactManually } from "./enrollment";

function getUserId(req: { user?: { claims?: { sub?: string }; userId?: string } }): string {
  return req.user?.claims?.sub || req.user?.userId || "";
}

function sameLeadStatusSlugs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((s) => set.has(s));
}

/** Enroll leads already in matching status columns when a campaign becomes active. */
async function maybeBackfillLeadStatusTriggers(
  campaign: Awaited<ReturnType<typeof createDripCampaign>>,
  previous?: { status?: string | null; slugs?: string[] } | null,
  opts?: { force?: boolean },
): Promise<void> {
  if (campaign.status !== "active") return;
  const slugs = getCampaignLeadStatusTriggerSlugs(campaign);
  if (slugs.length === 0) return;

  const becameActive = previous?.status !== "active";
  const triggersChanged =
    previous?.slugs != null ? !sameLeadStatusSlugs(previous.slugs, slugs) : false;

  // Backfill when activating, force (Activate button), or lead-status triggers change
  if (!opts?.force && !becameActive && !triggersChanged) return;

  try {
    await backfillCampaignLeadStatusEnrollments(campaign);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Drip] Lead-status backfill failed:", msg);
  }
}

export function registerDripCampaignRoutes(app: Express) {
  const withOrg = [isAuthenticated, resolveOrganizationContext] as const;

  app.get(
    "/api/drip-campaigns",
    ...withOrg,
    requirePermission("manage_campaigns.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const rows = await listDripCampaigns(organizationId);
        res.json(rows);
      } catch (error: any) {
        console.error("[Drip] List error:", error);
        res.status(500).json({ message: error.message || "Failed to list drip campaigns" });
      }
    },
  );

  app.get(
    "/api/drip-campaigns/:id",
    ...withOrg,
    requirePermission("manage_campaigns.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const row = await getDripCampaign(req.params.id, organizationId);
        if (!row) return res.status(404).json({ message: "Not found" });
        res.json(row);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to load drip campaign" });
      }
    },
  );

  app.post(
    "/api/drip-campaigns",
    ...withOrg,
    requirePermission("manage_campaigns.create"),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const parsed = createDripCampaignSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
        }
        const row = await createDripCampaign(userId, organizationId, parsed.data);
        void maybeBackfillLeadStatusTriggers(row, { status: "draft" });
        res.status(201).json(row);
      } catch (error: any) {
        console.error("[Drip] Create error:", error);
        res.status(500).json({ message: error.message || "Failed to create drip campaign" });
      }
    },
  );

  app.patch(
    "/api/drip-campaigns/:id",
    ...withOrg,
    requirePermission("manage_campaigns.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const parsed = updateDripCampaignSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
        }
        const existing = await getDripCampaign(req.params.id, organizationId);
        const row = await updateDripCampaign(req.params.id, organizationId, parsed.data);
        if (!row) return res.status(404).json({ message: "Not found" });
        void maybeBackfillLeadStatusTriggers(row, existing
          ? { status: existing.status, slugs: getCampaignLeadStatusTriggerSlugs(existing) }
          : null);
        res.json(row);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to update drip campaign" });
      }
    },
  );

  app.delete(
    "/api/drip-campaigns/:id",
    ...withOrg,
    requirePermission("manage_campaigns.delete"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const ok = await deleteDripCampaign(req.params.id, organizationId);
        if (!ok) return res.status(404).json({ message: "Not found" });
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to delete drip campaign" });
      }
    },
  );

  app.post(
    "/api/drip-campaigns/:id/activate",
    ...withOrg,
    requirePermission("manage_campaigns.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const existing = await getDripCampaign(req.params.id, organizationId);
        const row = await updateDripCampaign(req.params.id, organizationId, { status: "active" });
        if (!row) return res.status(404).json({ message: "Not found" });
        void maybeBackfillLeadStatusTriggers(
          row,
          existing
            ? { status: existing.status, slugs: getCampaignLeadStatusTriggerSlugs(existing) }
            : null,
          { force: true },
        );
        res.json(row);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to activate" });
      }
    },
  );

  app.post(
    "/api/drip-campaigns/:id/pause",
    ...withOrg,
    requirePermission("manage_campaigns.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const row = await updateDripCampaign(req.params.id, organizationId, { status: "paused" });
        if (!row) return res.status(404).json({ message: "Not found" });
        res.json(row);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to pause" });
      }
    },
  );

  app.post(
    "/api/drip-campaigns/:id/enroll",
    ...withOrg,
    requirePermission("manage_campaigns.edit"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const contactId = z.string().min(1).parse(req.body?.contactId);
        const campaign = await getDripCampaign(req.params.id, organizationId);
        if (!campaign) return res.status(404).json({ message: "Not found" });
        const result = await enrollContactManually({ campaign, contactId });
        if (!result.ok) return res.status(400).json({ message: result.message });
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to enroll" });
      }
    },
  );

  app.post(
    "/api/drip-campaigns/import",
    ...withOrg,
    requirePermission("manage_campaigns.create"),
    async (req: any, res) => {
      try {
        const userId = getUserId(req);
        const organizationId = req.context?.organizationId;
        if (!organizationId) return res.status(400).json({ message: "Organization required" });
        const payload = req.body?.campaign || req.body;
        const parsed = createDripCampaignSchema.safeParse({
          ...payload,
          name: payload?.name || "Imported Campaign",
          status: payload?.status === "active" ? "active" : "draft",
        });
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid import data", errors: parsed.error.errors });
        }
        const row = await createDripCampaign(userId, organizationId, parsed.data);
        res.status(201).json(row);
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to import" });
      }
    },
  );
}
