import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useListPaginationState, parsePaginatedListResponse } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { convertToWhatsAppFlowFormat, convertFromWhatsAppFlowFormat } from "@/lib/flow-converter";
import { Link } from "wouter";
import { Loader2, Plus, RefreshCw, FileText, MoreVertical, Lock, Upload, Download, Eye, Copy, X, Settings, RefreshCw as RefreshCwIcon, ExternalLink, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type WhatsAppFlow = {
  id: string;
  flowId: string;
  name: string;
  businessAccountId: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  validation: 'Valid' | 'Invalid';
  screens?: any[];
  createdAt: string;
  updatedAt: string;
};

function flowsUrl(path: string, params: Record<string, string> = {}): string {
  const seg = path ? (path.startsWith("/") ? path : "/" + path) : "";
  const base = `/api/whatsapp-flows${seg}`;
  const search = new URLSearchParams(params);
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}

export default function WhatsAppFlowsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedBusinessAccountId, setSelectedBusinessAccountId] = useState<string>("");
  const [businessAccountInput, setBusinessAccountInput] = useState<string>("");
  const [previewFlow, setPreviewFlow] = useState<WhatsAppFlow | null>(null);
  const [assetsFlow, setAssetsFlow] = useState<WhatsAppFlow | null>(null);
  const [deprecateFlow, setDeprecateFlow] = useState<WhatsAppFlow | null>(null);
  const [assetsJson, setAssetsJson] = useState<string>("");
  const [showImportJsonModal, setShowImportJsonModal] = useState(false);
  const [importFormName, setImportFormName] = useState("");
  const [importCategories, setImportCategories] = useState<string[]>([]);
  const [importJson, setImportJson] = useState("");
  const [importJsonError, setImportJsonError] = useState<string | null>(null);
  const [importPreviewScreens, setImportPreviewScreens] = useState<any[] | null>(null);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const flowParams = (extra: Record<string, string> = {}) =>
    organizationId ? { organizationId, ...extra } : extra;

  // Default screens for new flow (minimal so API accepts; user edits on edit page)
  const getDefaultScreens = () => {
    const ts = Date.now();
    return [
      {
        id: "screen-1",
        title: "Basic",
        fields: [
          { id: `field-${ts}-1`, type: "large_heading", textType: "large_heading", label: "Welcome to our form", required: false },
          { id: `field-${ts}-2`, type: "short_answer", inputType: "text", label: "Your Name", placeholder: "Enter text...", instructions: "", required: true },
        ],
        footerButton: { text: "Continue" },
      },
    ];
  };

  // Get phone numbers to populate business account selector (org-scoped so team members see connected numbers)
  const addedPhonesUrl = organizationId
    ? `/api/integrations/whatsapp-business/added-phones?organizationId=${encodeURIComponent(organizationId)}`
    : '/api/integrations/whatsapp-business/added-phones';
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones', organizationId],
    queryFn: async () => {
      const res = await apiRequest('GET', addedPhonesUrl);
      return await res.json();
    },
    enabled: true,
  });

  // Get flows for selected business account (org-scoped)
  const { data: flowsResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/whatsapp-flows', organizationId, selectedBusinessAccountId, currentPage, rowsPerPage],
    queryFn: async () => {
      if (!selectedBusinessAccountId) return { flows: [], total: 0, limit: rowsPerPage, offset: 0 };
      const params = new URLSearchParams(paginationParams.toString());
      params.set("businessAccountId", selectedBusinessAccountId);
      if (organizationId) params.set("organizationId", organizationId);
      const res = await apiRequest('GET', `/api/whatsapp-flows?${params.toString()}`);
      return await res.json();
    },
    enabled: !!selectedBusinessAccountId,
  });

  const { items: flows, total: totalFlows } = parsePaginatedListResponse<WhatsAppFlow>(
    flowsResponse,
    "flows"
  );

  useEffect(() => {
    resetPage();
  }, [selectedBusinessAccountId, resetPage]);

  // Set default business account from phone numbers if available
  useEffect(() => {
    if (phoneNumbersData?.phoneNumbers && phoneNumbersData.phoneNumbers.length > 0 && !selectedBusinessAccountId) {
      const firstPhone = phoneNumbersData.phoneNumbers[0];
      const accountId = firstPhone.businessAccountId || firstPhone.wabaId || firstPhone.id;
      setSelectedBusinessAccountId(accountId);
      setBusinessAccountInput(accountId);
    }
  }, [phoneNumbersData, selectedBusinessAccountId]);

  const deleteFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest('DELETE', flowsUrl(`/${flowId}`, flowParams()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      toast({
        title: "Flow deleted",
        description: "Flow has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const publishFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      const res = await apiRequest('PATCH', flowsUrl(`/${flowId}`, flowParams()), { status: 'PUBLISHED' });
      return res.json();
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      toast({
        title: "Flow published",
        description: data?.message || "Flow has been published successfully. Customers will see the latest screens.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Publish failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest('PATCH', flowsUrl(`/${flowId}`, flowParams()), { status: 'ARCHIVED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      toast({
        title: "Flow archived",
        description: "Flow has been archived successfully.",
      });
      setDeprecateFlow(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Archive failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFlowAndRedirectMutation = useMutation({
    mutationFn: async ({ name, businessAccountId }: { name: string; businessAccountId: string }) => {
      const res = await apiRequest('POST', flowsUrl("", flowParams()), {
        name: name.trim(),
        businessAccountId,
        screens: getDefaultScreens(),
        category: 'other',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || res.statusText);
      }
      const data = await res.json();
      return data.flow ?? data;
    },
    onSuccess: (flow, { businessAccountId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      setShowCreateFlowModal(false);
      setNewFlowName("");
      toast({
        title: "Flow created",
        description: "Redirecting to edit page.",
      });
      setLocation(`/whatsapp-flows/${businessAccountId}/edit/${flow.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Create failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deprecateFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest('PATCH', flowsUrl(`/${flowId}`, flowParams()), { status: 'ARCHIVED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      toast({
        title: "Flow deprecated",
        description: "Flow has been deprecated successfully.",
      });
      setDeprecateFlow(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Deprecate failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFromJsonMutation = useMutation({
    mutationFn: async ({ name, screens, category }: { name: string; screens: any[]; category: string }) => {
      const res = await apiRequest('POST', flowsUrl("", flowParams()), {
        name,
        businessAccountId: selectedBusinessAccountId,
        screens,
        category: category || 'other',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-flows', organizationId] });
      setShowImportJsonModal(false);
      setImportFormName("");
      setImportJson("");
      setImportCategories([]);
      setImportJsonError(null);
      setImportPreviewScreens(null);
      toast({
        title: "Form created",
        description: "Form has been created from JSON successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Create failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportPreview = () => {
    setImportJsonError(null);
    setImportPreviewScreens(null);
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed.screens || !Array.isArray(parsed.screens)) {
        setImportJsonError("JSON must have a 'screens' array (e.g. from WhatsApp Flow Playground).");
        return;
      }
      const screens = convertFromWhatsAppFlowFormat(parsed);
      setImportPreviewScreens(screens);
    } catch (e) {
      setImportJsonError(e instanceof SyntaxError ? "Invalid JSON" : String(e));
    }
  };

  const handleCreateFromJson = () => {
    setImportJsonError(null);
    if (!importFormName.trim()) {
      toast({ title: "Form name required", description: "Enter a form name.", variant: "destructive" });
      return;
    }
    if (!selectedBusinessAccountId) {
      toast({ title: "Business account required", description: "Select a Business Account first.", variant: "destructive" });
      return;
    }
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed.screens || !Array.isArray(parsed.screens)) {
        setImportJsonError("JSON must have a 'screens' array (e.g. from WhatsApp Flow Playground).");
        return;
      }
      const screens = convertFromWhatsAppFlowFormat(parsed);
      const category = importCategories.length > 0 ? importCategories.join(',') : 'other';
      createFromJsonMutation.mutate({ name: importFormName.trim(), screens, category });
    } catch (e) {
      setImportJsonError(e instanceof SyntaxError ? "Invalid JSON" : String(e));
      toast({ title: "Invalid JSON", description: e instanceof SyntaxError ? "Invalid JSON" : String(e), variant: "destructive" });
    }
  };

  // Load flow details for preview/assets (org-scoped)
  const flowIdForDetails = previewFlow?.id || assetsFlow?.id;
  const { data: flowDetails } = useQuery<WhatsAppFlow>({
    queryKey: ['/api/whatsapp-flows', organizationId, flowIdForDetails],
    queryFn: async () => {
      if (!flowIdForDetails) return null as any;
      const res = await apiRequest('GET', flowsUrl(`/${flowIdForDetails}`, flowParams()));
      return await res.json();
    },
    enabled: !!(previewFlow || assetsFlow),
  });

  // Generate assets JSON when assets modal opens
  useEffect(() => {
    if (assetsFlow && flowDetails) {
      const whatsAppFormat = convertToWhatsAppFlowFormat(flowDetails.screens || []);
      setAssetsJson(JSON.stringify(whatsAppFormat, null, 2));
    }
  }, [assetsFlow, flowDetails]);

  const handlePreview = async (flow: WhatsAppFlow) => {
    setPreviewFlow(flow);
  };

  const handleViewAssets = async (flow: WhatsAppFlow) => {
    setAssetsFlow(flow);
  };

  const handleCopyAssets = () => {
    navigator.clipboard.writeText(assetsJson);
    toast({
      title: "Copied",
      description: "JSON has been copied to clipboard.",
    });
  };

  const handleDownloadAssets = () => {
    const blob = new Blob([assetsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assetsFlow?.name || 'flow'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "JSON file has been downloaded.",
    });
  };

  const handleBusinessAccountChange = () => {
    if (businessAccountInput.trim()) {
      setSelectedBusinessAccountId(businessAccountInput.trim());
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'PUBLISHED': 'default',
      'DRAFT': 'secondary',
      'ARCHIVED': 'outline',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="bg-orange-500 text-white">
        {status}
      </Badge>
    );
  };

  const getValidationBadge = (validation: string) => {
    return (
      <Badge variant={validation === 'Valid' ? 'default' : 'destructive'} className={validation === 'Valid' ? 'bg-green-500' : ''}>
        {validation}
      </Badge>
    );
  };

  return (
    <div
      className="atlas-manage-page atlas-whatsapp-flows-page h-full overflow-auto"
      data-testid="page-whatsapp-flows"
    >
      <div className="max-w-[95%] mx-auto p-6 space-y-6">
        {/* Breadcrumbs */}
        <div className="text-sm text-muted-foreground">
          Dashboard &gt; Flows
        </div>

        {/* Header */}
        <div className="rh-page-hero flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Flows</h1>
            <p className="text-muted-foreground mt-1">Create and manage your automation workflows.</p>
          </div>
        </div>

        {/* Business Account Selection */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Business Account</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a WhatsApp Business Account to manage its forms
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={businessAccountInput}
                  onChange={(e) => setBusinessAccountInput(e.target.value)}
                  onBlur={handleBusinessAccountChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBusinessAccountChange();
                    }
                  }}
                  placeholder="Enter Business Account ID"
                  className="max-w-md"
                />
                {phoneNumbersData?.phoneNumbers && phoneNumbersData.phoneNumbers.length > 0 && (
                  <select
                    value={selectedBusinessAccountId}
                    onChange={(e) => {
                      setSelectedBusinessAccountId(e.target.value);
                      setBusinessAccountInput(e.target.value);
                    }}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    {phoneNumbersData.phoneNumbers.map((phone) => {
                      const accountId = phone.businessAccountId || phone.wabaId || phone.id;
                      return (
                        <option key={accountId} value={accountId}>
                          {phone.verifiedName || phone.displayPhoneNumber} ({accountId})
                        </option>
                      );
                    })}
                  </select>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportJsonModal(true)}
                  disabled={!selectedBusinessAccountId}
                  title={!selectedBusinessAccountId ? "Select a Business Account first" : undefined}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import JSON
                </Button>
                <Button
                  onClick={() => selectedBusinessAccountId && setShowCreateFlowModal(true)}
                  disabled={!selectedBusinessAccountId}
                  className="bg-orange-500 hover:bg-orange-600"
                  title={!selectedBusinessAccountId ? "Select a Business Account first" : undefined}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Flow...
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flows Table */}
        <Card>
          <CardContent className="p-0">
            {!selectedBusinessAccountId ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Please select a Business Account to view flows</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !flows || flows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No flows found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first WhatsApp flow to get started.
                </p>
                <Button
                  onClick={() => setShowCreateFlowModal(true)}
                  className="mt-4 bg-orange-500 hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Flow...
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead className="w-[150px]">Flow ID</TableHead>
                      <TableHead className="w-[120px]">Categories</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[120px]">Validation</TableHead>
                      <TableHead className="w-[100px]">Responses</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <div className="font-medium">{flow.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono text-muted-foreground">{flow.flowId}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(flow.category || 'other').split(',').map((c) => (
                              <Badge key={c} variant="outline" className="bg-gray-100 dark:bg-gray-800">
                                {c.trim() || 'other'}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(flow.status)}
                        </TableCell>
                        <TableCell>
                          {getValidationBadge(flow.validation)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/whatsapp-flows/responses/${flow.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              View responses
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setLocation(`/whatsapp-flows/responses/${flow.id}`)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                View responses
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePreview(flow)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewAssets(flow)}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Assets
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeprecateFlow(flow)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Deprecate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setLocation(`/whatsapp-flows/${selectedBusinessAccountId}/edit/${flow.id}`)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {flow.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => publishFlowMutation.mutate(flow.id)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              {flow.status === 'PUBLISHED' && (
                                <DropdownMenuItem onClick={() => archiveFlowMutation.mutate(flow.id)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                                if (confirm('Are you sure you want to delete this flow?')) {
                                  deleteFlowMutation.mutate(flow.id);
                                }
                              }}>
                                <FileText className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalFlows > 0 && (
              <ListPaginationFooter
                total={totalFlows}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
                className="p-4 border-t"
              />
            )}
          </CardContent>
        </Card>

        {/* Preview Flow Dialog */}
        <Dialog open={!!previewFlow} onOpenChange={(open) => !open && setPreviewFlow(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Preview Flow</DialogTitle>
                  <DialogDescription>{previewFlow?.name}</DialogDescription>
                </div>
                <Button variant="ghost" size="sm">
                  Documentation
                </Button>
              </div>
            </DialogHeader>
            {flowDetails && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium">Preview</span>
                  <Button variant="ghost" size="sm">
                    <RefreshCwIcon className="h-4 w-4" />
                  </Button>
                  <Select defaultValue={flowDetails.screens?.[0]?.id || ''}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {flowDetails.screens?.map((screen: any) => (
                        <SelectItem key={screen.id} value={screen.id}>
                          {screen.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <FlowPreview screens={flowDetails.screens || []} />
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Rendering and interaction varies based on device.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Assets Dialog */}
        <Dialog open={!!assetsFlow} onOpenChange={(open) => !open && setAssetsFlow(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Assets</DialogTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadAssets}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyAssets}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAssetsFlow(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-4">
              <Textarea
                value={assetsJson}
                readOnly
                className="font-mono text-sm min-h-[500px]"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Create New Flow Dialog - redirects to edit page on success */}
        <Dialog open={showCreateFlowModal} onOpenChange={(open) => {
          if (!open) {
            setShowCreateFlowModal(false);
            setNewFlowName("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Flow</DialogTitle>
              <DialogDescription>
                Create a new automation flow. Give it a descriptive name to get started.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Flow Name</label>
                <Input
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="My Awesome Flow"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newFlowName.trim() && selectedBusinessAccountId) {
                        createFlowAndRedirectMutation.mutate({
                          name: newFlowName.trim(),
                          businessAccountId: selectedBusinessAccountId,
                        });
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Enter a descriptive name for your flow.</p>
              </div>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={!newFlowName.trim() || !selectedBusinessAccountId || createFlowAndRedirectMutation.isPending}
                onClick={() => {
                  if (newFlowName.trim() && selectedBusinessAccountId) {
                    createFlowAndRedirectMutation.mutate({
                      name: newFlowName.trim(),
                      businessAccountId: selectedBusinessAccountId,
                    });
                  }
                }}
              >
                {createFlowAndRedirectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Create Flow →</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Form from JSON Dialog */}
        <Dialog open={showImportJsonModal} onOpenChange={(open) => {
          if (!open) {
            setShowImportJsonModal(false);
            setImportJsonError(null);
            setImportPreviewScreens(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Form from JSON</DialogTitle>
              <DialogDescription>
                Create a WhatsApp form by pasting the JSON configuration. Provide a name and optional categories for your form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4 space-y-2">
                <p className="text-sm font-medium">How to create your form JSON:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Visit the WhatsApp Flow Playground to design your form</li>
                  <li>Copy the generated JSON from the playground</li>
                  <li>Paste it in the Form JSON field below</li>
                </ol>
                <a
                  href="https://developers.facebook.com/docs/whatsapp/flows/playground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  Open WhatsApp Flow Playground
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div>
                <label className="text-sm font-medium">Form Name *</label>
                <Input
                  value={importFormName}
                  onChange={(e) => setImportFormName(e.target.value)}
                  placeholder="Enter form name (e.g., Customer Feedback Form)"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">A descriptive name for your WhatsApp form.</p>
              </div>

              <div>
                <label className="text-sm font-medium">Categories (Optional)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("mt-1 w-full justify-between font-normal", !importCategories.length && "text-muted-foreground")}>
                      {importCategories.length > 0 ? `${importCategories.length} selected` : "Select categories"}
                      <span className="ml-2">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                    {[
                      { value: "other", label: "OTHER" },
                      { value: "sign_up", label: "SIGN UP" },
                      { value: "sign_in", label: "SIGN IN" },
                      { value: "appointment_booking", label: "APPOINTMENT BOOKING" },
                      { value: "lead_generation", label: "LEAD GENERATION" },
                      { value: "contact_us", label: "CONTACT US" },
                      { value: "customer_support", label: "CUSTOMER SUPPORT" },
                      { value: "survey", label: "SURVEY" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer">
                        <Checkbox
                          checked={importCategories.includes(opt.value)}
                          onCheckedChange={(checked) => {
                            setImportCategories((prev) =>
                              checked ? [...prev, opt.value] : prev.filter((c) => c !== opt.value)
                            );
                          }}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-1">Select one or more categories for your form.</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Form JSON *</label>
                  <Button type="button" variant="ghost" size="sm" onClick={handleImportPreview}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                </div>
                <Textarea
                  value={importJson}
                  onChange={(e) => { setImportJson(e.target.value); setImportJsonError(null); }}
                  placeholder='Paste your JSON here from WhatsApp Flow Playground. Example: {"screens": [...], "version": "7.3"}'
                  className="mt-1 font-mono text-sm min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-1">Paste the complete WhatsApp form JSON configuration from the playground.</p>
                {importJsonError && (
                  <p className="text-sm text-destructive mt-1">{importJsonError}</p>
                )}
                {importPreviewScreens && importPreviewScreens.length > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Preview: {importPreviewScreens.length} screen(s) — {importPreviewScreens.map(s => s.title).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowImportJsonModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={handleCreateFromJson}
                  disabled={createFromJsonMutation.isPending || !importFormName.trim() || !importJson.trim()}
                >
                  {createFromJsonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Form
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deprecate Flow Dialog */}
        <AlertDialog open={!!deprecateFlow} onOpenChange={(open) => !open && setDeprecateFlow(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deprecate Flow</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deprecate this flow?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeprecateFlow(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deprecateFlow) {
                    deprecateFlowMutation.mutate(deprecateFlow.id);
                  }
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Flow Preview Component
function FlowPreview({ screens }: { screens: any[] }) {
  const [selectedScreenId, setSelectedScreenId] = useState<string>(screens[0]?.id || '');
  const selectedScreen = screens.find(s => s.id === selectedScreenId) || screens[0];

  const renderFieldPreview = (field: any) => {
    switch (field.type) {
      case 'large_heading':
      case 'small_heading':
        return (
          <div className={`mb-4 ${field.type === 'large_heading' ? 'text-xl font-bold' : 'text-lg font-semibold'}`}>
            {field.label || 'Heading'}
          </div>
        );
      case 'caption_text':
      case 'body_text':
        return (
          <p className="text-sm text-muted-foreground mb-4">{field.label || 'Text content'}</p>
        );
      case 'short_answer':
        return (
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Label'}</label>
            <input 
              type={field.inputType || 'text'} 
              placeholder="Enter text..." 
              className="w-full p-2 border rounded bg-background" 
              disabled 
            />
          </div>
        );
      case 'paragraph':
        return (
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Label'}</label>
            <textarea 
              placeholder="Enter text..." 
              className="w-full p-2 border rounded bg-background" 
              rows={3} 
              disabled 
            />
          </div>
        );
      case 'date_picker':
        return (
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">{field.label || (field.includeTime ? 'Date & Time' : 'Date')}</label>
            <input
              type={field.includeTime ? 'datetime-local' : 'date'}
              className="w-full p-2 border rounded bg-background"
              placeholder={field.includeTime ? 'dd-mm-yyyy hh:mm' : undefined}
              disabled
            />
          </div>
        );
      case 'single_choice':
      case 'multiple_choice':
      case 'dropdown':
        return (
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">{field.label || 'Select an option'}</label>
            <select className="w-full p-2 border rounded bg-background" disabled>
              {(field.options || []).map((opt: string, idx: number) => (
                <option key={idx}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'opt_in':
        return (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" disabled />
              <span className="text-sm">{field.label || 'Opt-in text'}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-lg border shadow-lg p-4">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">X</div>
          <div className="font-semibold">{selectedScreen?.title || 'Screen'}</div>
          <div className="w-6 h-6 flex items-center justify-center">⋯</div>
        </div>
        <div className="space-y-4">
          {selectedScreen?.fields?.map((field: any) => (
            <div key={field.id}>
              {renderFieldPreview(field)}
            </div>
          ))}
          {selectedScreen?.footerButton && (
            <Button className="w-full bg-green-500 hover:bg-green-600 mt-4" disabled>
              {selectedScreen.footerButton.text}
            </Button>
          )}
        </div>
        <div className="mt-4 pt-4 border-t text-xs text-center text-muted-foreground">
          Managed by the business. <a href="#" className="underline">Learn more</a>
        </div>
      </div>
    </div>
  );
}

