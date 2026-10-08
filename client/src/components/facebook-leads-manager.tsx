import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClearableDateInput } from "@/components/ui/clearable-date-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Download, Calendar, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FacebookPage = {
  id: string;
  name: string;
  category?: string;
};

type FacebookForm = {
  id: string;
  name: string;
  status: string;
  leads_count?: number;
};

type FacebookLead = {
  id: string;
  created_time: string;
  form_id: string;
  form_name?: string;
  page_id?: string;
  page_name?: string;
  field_data?: Array<{
    name?: string;
    values?: string[] | string;
  }>;
};

type FacebookLeadsManagerProps = {
  integrationId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function FacebookLeadsManager({ integrationId, isOpen, onClose }: FacebookLeadsManagerProps) {
  const { toast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [syncedLeads, setSyncedLeads] = useState<FacebookLead[]>([]);

  // Fetch Facebook pages
  const { data: pagesData, isLoading: isLoadingPages, refetch: refetchPages } = useQuery<{
    success: boolean;
    pages: FacebookPage[];
    count: number;
  }>({
    queryKey: ["/api/integrations/facebook-lead-ads/pages"],
    enabled: isOpen,
  });

  // Fetch lead forms for selected page
  const { data: formsData, isLoading: isLoadingForms, refetch: refetchForms } = useQuery<{
    success: boolean;
    forms: FacebookForm[];
    count: number;
  }>({
    queryKey: ["/api/integrations/facebook-lead-ads/forms", selectedPageId],
    enabled: isOpen && !!selectedPageId,
  });

  // Sync leads mutation
  const syncLeadsMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (integrationId) body.integrationId = integrationId;
      if (selectedPageId) body.pageId = selectedPageId;
      if (selectedFormId) body.formId = selectedFormId;
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;

      try {
        const res = await apiRequest("POST", "/api/integrations/facebook-lead-ads/sync-leads", body);
        const data = await res.json();
        
        // Ensure leads have proper structure
        if (data.leads && Array.isArray(data.leads)) {
          data.leads = data.leads.map((lead: any) => ({
            ...lead,
            field_data: Array.isArray(lead.field_data) 
              ? lead.field_data.map((field: any) => ({
                  name: field.name || "Unknown",
                  values: Array.isArray(field.values) ? field.values : (field.values ? [String(field.values)] : []),
                }))
              : [],
          }));
        }
        
        return data;
      } catch (error: any) {
        // Handle 401 specifically
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
          throw new Error("Session expired. Please refresh the page and try again.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      setSyncedLeads(data.leads || []);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook-lead-ads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      const createdCount = data.syncedContactsCount || 0;
      const updatedCount = data.updatedContactsCount || 0;
      const skippedCount = data.skippedContactsCount || 0;
      const totalProcessed = createdCount + updatedCount;
      
      let description = `Processed ${data.count || 0} leads. `;
      if (totalProcessed > 0) {
        description += `${createdCount} contacts created`;
        if (updatedCount > 0) {
          description += `, ${updatedCount} updated`;
        }
      }
      if (skippedCount > 0) {
        description += `. ${skippedCount} skipped (no phone/email or errors)`;
      }
      
      toast({
        title: "Leads synced successfully",
        description,
        duration: 6000,
      });
      
      // Log errors if any
      if (data.errorDetails && data.errorDetails.length > 0) {
        console.warn(`[Facebook Leads] ${data.errorDetails.length} leads had errors:`, data.errorDetails);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to sync leads. Please try again.",
      });
    },
  });

  // Reset form when page changes
  useEffect(() => {
    if (selectedPageId) {
      setSelectedFormId("");
      setSyncedLeads([]);
    }
  }, [selectedPageId]);

  // Reset form when form changes
  useEffect(() => {
    if (selectedFormId) {
      setSyncedLeads([]);
    }
  }, [selectedFormId]);

  const handleSyncLeads = () => {
    if (!selectedPageId) {
      toast({
        variant: "destructive",
        title: "Page required",
        description: "Please select a Facebook page first.",
      });
      return;
    }

    if (!selectedFormId) {
      toast({
        variant: "destructive",
        title: "Form required",
        description: "Please select a lead form to sync leads from.",
      });
      return;
    }

    syncLeadsMutation.mutate();
  };

  const pages = pagesData?.pages || [];
  const forms = formsData?.forms || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Facebook Lead Ads</DialogTitle>
          <DialogDescription>
            Select a page and form to sync leads from your Facebook Lead Ads campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Page */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Select Facebook Page</CardTitle>
              <CardDescription>Choose the page that contains your lead forms</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No Facebook pages found.</p>
                  <p className="text-sm mt-1">Make sure you have admin access to at least one page.</p>
                </div>
              ) : (
                <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Facebook page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.name} {page.category && `(${page.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedPageId && (
                <div className="mt-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    Page selected: {pages.find((p) => p.id === selectedPageId)?.name}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Select Form */}
          {selectedPageId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 2: Select Lead Form</CardTitle>
                <CardDescription>Choose the lead form to sync leads from</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingForms ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : forms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p>No lead forms found for this page.</p>
                    <p className="text-sm mt-1">Create a lead form in Facebook Ads Manager first.</p>
                  </div>
                ) : (
                  <>
                    <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lead form" />
                      </SelectTrigger>
                      <SelectContent>
                        {forms
                          .filter((form) => form.status === "ACTIVE")
                          .map((form) => (
                            <SelectItem key={form.id} value={form.id}>
                              {form.name} {form.leads_count !== undefined && `(${form.leads_count} leads)`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {selectedFormId && (
                      <div className="mt-4 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">
                          Form selected: {forms.find((f) => f.id === selectedFormId)?.name}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Date Range (Optional) */}
          {selectedFormId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 3: Set Date Range (Optional)</CardTitle>
                <CardDescription>Filter leads by date range. Leave empty to sync all leads.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <ClearableDateInput
                      id="start-date"
                      showCalendarIcon={false}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <ClearableDateInput
                      id="end-date"
                      showCalendarIcon={false}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Sync Leads */}
          {selectedFormId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 4: Sync Leads</CardTitle>
                <CardDescription>Click the button below to sync leads from the selected form</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleSyncLeads}
                  disabled={syncLeadsMutation.isPending || !selectedFormId}
                  className="w-full"
                  size="lg"
                >
                  {syncLeadsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing leads...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Sync Leads
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Synced Leads Results */}
          {syncedLeads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Synced Leads</span>
                  <Badge variant="secondary">{syncedLeads.length} leads</Badge>
                </CardTitle>
                <CardDescription>Leads successfully synced from the selected form</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {syncedLeads.map((lead) => (
                    <Card key={lead.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">Lead ID: {lead.id}</p>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(lead.created_time).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline">Synced</Badge>
                        </div>
                        {lead.field_data && lead.field_data.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {lead.field_data.map((field, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium">{field.name || "Unknown Field"}:</span>{" "}
                                <span className="text-muted-foreground">
                                  {field.values && Array.isArray(field.values) 
                                    ? field.values.join(", ") 
                                    : field.values || "N/A"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

