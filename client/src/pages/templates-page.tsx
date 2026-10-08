import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useListPaginationState, parsePaginatedListResponse } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { Loader2, Plus, RefreshCw, FileText, CheckCircle2, Clock, XCircle, Image as ImageIcon, FileText as FileTextIcon, MessageSquare, Phone as PhoneIcon, ExternalLink, MoreVertical, Eye, Trash2, ArrowRight, Files, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { cn } from "@/lib/utils";
import { DummyTemplatesExplore } from "@/components/dummy-templates-explore";
import {
  TEMPLATE_PREFILL_DRAFT_KEY,
  buildMessageTemplateDuplicateDraft,
} from "@/lib/template-duplicate-draft";
import "@/panel-templates/helicoptic-v1/templates-atlas.css";

type MediaCarouselCardButton = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
};

type MediaCarouselCard = {
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl?: string;
  bodyText?: string;
  buttons?: MediaCarouselCardButton[];
};

type ProductCarouselCard = {
  buttonLabel?: string;
  productRetailerId?: string;
  productName?: string;
  buttonType?: "spm" | "url";
};

type MessageTemplate = {
  id: string;
  templateId: string;
  name: string;
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  category: string;
  components: Array<any>;
  metadata?: Record<string, any>;
  phoneNumberId?: string;
  createdAt: string;
  syncedAt: string;
};

type PhoneNumber = {
  sessionId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  businessAccountId: string;
  wabaId?: string;
  qualityRating?: string;
  throughput?: string;
  status: string;
  createdAt: string;
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
    }
  }, []);
  const brandBadgeClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white border-transparent"
    : "bg-orange-500 hover:bg-orange-600 text-white";
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const outlineBtnClass = skin || isAtlas ? "rounded-xl border-[#e5e7eb]" : "";
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string | null>(null);
  const [viewTemplatesDialogOpen, setViewTemplatesDialogOpen] = useState(false);
  const [showDummyTemplates, setShowDummyTemplates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedPreviewMediaCardIndex, setSelectedPreviewMediaCardIndex] = useState(0);
  const [selectedPreviewProductCardIndex, setSelectedPreviewProductCardIndex] = useState(0);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);

  // Get phoneNumberId from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneNumberId = params.get('phoneNumberId');
    if (phoneNumberId) {
      setSelectedPhoneNumberId(phoneNumberId);
      // Don't open dialog automatically - show filtered templates in main table instead
    }
  }, [location]);

  // Get phoneNumberId from URL for filtering
  const urlParams = new URLSearchParams(window.location.search);
  const phoneNumberIdFromUrl = urlParams.get('phoneNumberId');

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const templatesUrl = () => {
    const params = new URLSearchParams(paginationParams.toString());
    if (organizationId) params.set("organizationId", organizationId);
    if (phoneNumberIdFromUrl) params.set("phoneNumberId", phoneNumberIdFromUrl);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `/api/templates?${params.toString()}`;
  };

  const { data: templatesResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/templates', organizationId, phoneNumberIdFromUrl, statusFilter, currentPage, rowsPerPage],
    queryFn: async () => {
      const res = await apiRequest('GET', templatesUrl());
      return await res.json();
    },
    enabled: !!organizationId,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { items: templates, total: totalTemplates } = parsePaginatedListResponse<MessageTemplate>(
    templatesResponse,
    "templates"
  );

  // Newest templates first (createdAt, fallback syncedAt)
  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.syncedAt || 0).getTime();
      const bTime = new Date(b.createdAt || b.syncedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [templates]);

  useEffect(() => {
    resetPage();
  }, [statusFilter, phoneNumberIdFromUrl, resetPage]);

  const { data: phoneNumbersData, isLoading: isLoadingPhones, refetch: refetchPhones } = useQuery<{ success: boolean; phoneNumbers: PhoneNumber[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
  });

  const syncPhonesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('GET', '/api/integrations/whatsapp-business/phone-numbers');
    },
    onSuccess: () => {
      refetchPhones();
      toast({
        title: "Phone numbers synced",
        description: "Successfully synced phone numbers from Meta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/settings/sync-templates', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', organizationId] });
      toast({
        title: "Templates synced",
        description: "Successfully synced templates from Meta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncTemplatesMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return apiRequest('POST', `/api/integrations/whatsapp-business/sync-templates/${phoneNumberId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', organizationId] });
      toast({
        title: "Templates synced",
        description: "Successfully synced templates from Meta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const url = organizationId
        ? `/api/templates/${templateId}?organizationId=${encodeURIComponent(organizationId)}`
        : `/api/templates/${templateId}`;
      return apiRequest('DELETE', url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates', organizationId] });
      toast({
        title: "Template deleted",
        description: "Template has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteTemplate = (template: MessageTemplate) => {
    if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'approved':
        return (
          <Badge className={cn(brandBadgeClass)}>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBodyText = (template: MessageTemplate) => {
    const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
    return bodyComponent?.text || 'No body text';
  };

  const getQualityBadge = (quality?: string) => {
    if (!quality) return <span className="text-muted-foreground">-</span>;
    const qualityUpper = quality.toUpperCase();
    if (qualityUpper === 'GREEN') {
      return <Badge className="bg-green-500">GREEN</Badge>;
    } else if (qualityUpper === 'YELLOW') {
      return <Badge className="bg-yellow-500">YELLOW</Badge>;
    } else if (qualityUpper === 'RED') {
      return <Badge className="bg-red-500">RED</Badge>;
    }
    return <Badge variant="secondary">{quality}</Badge>;
  };

  const getThroughputBadge = (throughput?: string) => {
    if (!throughput) return <span className="text-muted-foreground">-</span>;
    const throughputUpper = throughput.toUpperCase();
    if (throughputUpper === 'STANDARD') {
      return <Badge className="bg-orange-500">STANDARD</Badge>;
    }
    return <Badge variant="secondary">{throughput}</Badge>;
  };

  const phoneNumbers = phoneNumbersData?.phoneNumbers || [];

  // Check if template is official (from Meta)
  const isOfficialTemplate = (template: MessageTemplate) => {
    // Official templates have phoneNumberId and are not unofficial
    return !!template.phoneNumberId && !template.templateId?.startsWith('unofficial_');
  };

  // Get template type from components
  const getTemplateType = (template: MessageTemplate) => {
    const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
    if (headerComponent?.format === 'IMAGE') return { type: 'Image', icon: ImageIcon };
    if (headerComponent?.format === 'VIDEO') return { type: 'Video', icon: ImageIcon };
    if (headerComponent?.format === 'DOCUMENT') return { type: 'Document', icon: FileTextIcon };
    return { type: 'Text', icon: FileText };
  };

  // Get info counts - count actual number of each component type
  const getInfoCounts = (template: MessageTemplate) => {
    const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
    const buttons = template.components?.find((c: any) => c.type === 'BUTTONS')?.buttons || [];
    
    // Count document headers (not just check if exists)
    const documentCount = headerComponent?.format === 'DOCUMENT' ? 1 : 0;
    
    // Count actual number of phone number buttons
    const phoneCount = buttons.filter((b: any) => b.type === 'PHONE_NUMBER').length;
    
    // Count actual number of URL buttons
    const urlCount = buttons.filter((b: any) => b.type === 'URL').length;
    
    // Count actual number of quick reply buttons
    const quickReplyCount = buttons.filter((b: any) => b.type === 'QUICK_REPLY').length;
    
    return { 
      document: documentCount, 
      phone: phoneCount, 
      url: urlCount, 
      quickReply: quickReplyCount 
    };
  };

  const handleDuplicateTemplate = (template: MessageTemplate) => {
    try {
      const draft = buildMessageTemplateDuplicateDraft(template);
      sessionStorage.setItem(TEMPLATE_PREFILL_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      toast({
        title: "Could not duplicate template",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }
    const params = new URLSearchParams();
    params.set("fromDuplicate", "1");
    const phoneId = template.phoneNumberId || phoneNumberIdFromUrl;
    if (phoneId) params.set("phoneNumberId", phoneId);
    setLocation(`/templates/create?${params.toString()}`);
  };

  const previewMeta: any = (previewTemplate as any)?.metaData || (previewTemplate as any)?.metadata || {};
  const previewInteractiveAction = previewMeta?.interactiveAction;
  const previewMediaCards = (previewMeta?.mediaCards || []) as MediaCarouselCard[];
  const previewProductCards = (previewMeta?.productCards || []) as ProductCarouselCard[];

  useEffect(() => {
    if (previewDialogOpen) {
      setSelectedPreviewMediaCardIndex(0);
      setSelectedPreviewProductCardIndex(0);
    }
  }, [previewDialogOpen, previewTemplate?.id]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        !skin && "mx-auto w-full max-w-[95%] p-6",
        (skin || isAtlas) && "atlas-templates-page rh-templates-atlas",
      )}
    >
        <div className="rh-page-hero flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">
              {phoneNumberIdFromUrl 
                ? `Templates for ${phoneNumbers.find(p => p.phoneNumberId === phoneNumberIdFromUrl)?.verifiedName || phoneNumberIdFromUrl}`
                : 'Whatsapp Templates'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {phoneNumberIdFromUrl 
                ? `Message templates for this WhatsApp Business phone number`
                : 'Manage your Whatsapp templates'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {phoneNumberIdFromUrl && (
              <Button
                variant="outline"
                className={outlineBtnClass}
                onClick={() => {
                  setLocation('/templates');
                  setSelectedPhoneNumberId(null);
                }}
              >
                Show All Templates
              </Button>
            )}
            <Button
              variant={showDummyTemplates ? "default" : "outline"}
              className={cn(
                outlineBtnClass,
                showDummyTemplates && (primaryBtnClass || "bg-primary text-white"),
              )}
              onClick={() => setShowDummyTemplates((v) => !v)}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Dummy Template
            </Button>
            <Button
              variant="outline"
              className={outlineBtnClass}
              onClick={() => {
                if (phoneNumberIdFromUrl) {
                  syncTemplatesMutation.mutate(phoneNumberIdFromUrl);
                } else {
                  syncMutation.mutate();
                }
              }}
              disabled={syncMutation.isPending || syncTemplatesMutation.isPending}
            >
              {(syncMutation.isPending || syncTemplatesMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Meta
            </Button>
            <Button
              className={cn(primaryBtnClass || "bg-primary", skin && "rounded-xl")}
              onClick={() => {
              const url = phoneNumberIdFromUrl 
                ? `/templates/create?phoneNumberId=${phoneNumberIdFromUrl}`
                : '/templates/create';
              setLocation(url);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Dummy explore OR status tabs + table */}
        {showDummyTemplates ? (
          <Card
            className={cn(
              "mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl",
              (skin || isAtlas) && "rh-templates-table-card border-[#e5e7eb]",
            )}
          >
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              <DummyTemplatesExplore
                primaryBtnClass={primaryBtnClass}
                outlineBtnClass={outlineBtnClass}
                phoneNumberId={phoneNumberIdFromUrl}
              />
            </CardContent>
          </Card>
        ) : (
        <Tabs
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value={statusFilter}
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl",
                (skin || isAtlas) && "rh-templates-table-card border-[#e5e7eb]",
              )}
            >
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                {isLoading ? (
                  <div className="flex flex-1 items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !sortedTemplates || sortedTemplates.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No templates found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Connect your WhatsApp Business account and sync templates, or create a new one.
                    </p>
                  </div>
                ) : (
                  <div className="rh-templates-table-scroll min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Template ID</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Name</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Category</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Language</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Status</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Template Type</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Info</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Created</TableHead>
                          <TableHead className="sticky top-0 z-20 bg-[var(--rh-brand-soft,#ecfdf5)] shadow-[0_1px_0_0_hsl(var(--border))]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTemplates.map((template) => {
                          const templateType = getTemplateType(template);
                          const infoCounts = getInfoCounts(template);
                          const TemplateTypeIcon = templateType.icon;
                          return (
                            <TableRow key={template.id}>
                              <TableCell>
                                <span className="text-sm font-mono">{template.templateId || template.id}</span>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{template.name}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
                                  {template.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="uppercase">
                                  {template.language}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(template.status)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TemplateTypeIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{templateType.type}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{infoCounts.document}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{infoCounts.phone}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{infoCounts.quickReply}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{infoCounts.url}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(template.createdAt || template.syncedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Duplicate"
                                    onClick={() => handleDuplicateTemplate(template)}
                                  >
                                    <Files className="h-4 w-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      {isOfficialTemplate(template) ? (
                                        <>
                                          <DropdownMenuItem onClick={() => {
                                            if (template.phoneNumberId) {
                                              syncTemplatesMutation.mutate(template.phoneNumberId);
                                            } else if (phoneNumberIdFromUrl) {
                                              syncTemplatesMutation.mutate(phoneNumberIdFromUrl);
                                            } else {
                                              syncMutation.mutate();
                                            }
                                          }}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Sync Status
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => {
                                            if (template.phoneNumberId) {
                                              syncTemplatesMutation.mutate(template.phoneNumberId);
                                            } else if (phoneNumberIdFromUrl) {
                                              syncTemplatesMutation.mutate(phoneNumberIdFromUrl);
                                            } else {
                                              syncMutation.mutate();
                                            }
                                          }}>
                                            <ArrowRight className="h-4 w-4 mr-2" />
                                            Sync Category
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => {
                                            setPreviewTemplate(template);
                                            setPreviewDialogOpen(true);
                                          }}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Preview
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            onClick={() => handleDeleteTemplate(template)}
                                            disabled={deleteTemplateMutation.isPending}
                                            className="text-red-600 focus:text-red-600"
                                          >
                                            {deleteTemplateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      ) : (
                                        <>
                                          <DropdownMenuItem onClick={() => {
                                            setLocation(`/templates/create?id=${template.id}`);
                                          }}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => {
                                            setPreviewTemplate(template);
                                            setPreviewDialogOpen(true);
                                          }}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Preview
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            onClick={() => handleDeleteTemplate(template)}
                                            disabled={deleteTemplateMutation.isPending}
                                            className="text-red-600 focus:text-red-600"
                                          >
                                            {deleteTemplateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {totalTemplates > 0 && (
                  <ListPaginationFooter
                    total={totalTemplates}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={setRowsPerPage}
                    className="shrink-0 p-4 border-t"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}

        {/* View Templates Dialog for Specific Phone Number */}
        <Dialog open={viewTemplatesDialogOpen} onOpenChange={setViewTemplatesDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Templates for {phoneNumbers.find(p => p.phoneNumberId === selectedPhoneNumberId)?.verifiedName || selectedPhoneNumberId}
              </DialogTitle>
              <DialogDescription>
                Message templates for this WhatsApp Business phone number
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !sortedTemplates || sortedTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No templates found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Sync templates from Meta or create a new one.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Template Name</TableHead>
                        <TableHead className="w-[150px]">Category</TableHead>
                        <TableHead className="w-[100px]">Language</TableHead>
                        <TableHead className="w-[300px]">Body Text</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[150px]">Synced At</TableHead>
                        <TableHead className="w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {template.templateId || template.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{template.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="uppercase">
                              {template.language}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {getBodyText(template)}
                            </p>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(template.status)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(template.syncedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Duplicate"
                                onClick={() => handleDuplicateTemplate(template)}
                              >
                                <Files className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  {isOfficialTemplate(template) ? (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        if (template.phoneNumberId) {
                                          syncTemplatesMutation.mutate(template.phoneNumberId);
                                        } else {
                                          syncMutation.mutate();
                                        }
                                      }}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Sync Status
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        if (template.phoneNumberId) {
                                          syncTemplatesMutation.mutate(template.phoneNumberId);
                                        } else {
                                          syncMutation.mutate();
                                        }
                                      }}>
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Sync Category
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setPreviewTemplate(template);
                                        setPreviewDialogOpen(true);
                                      }}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteTemplate(template)}
                                        disabled={deleteTemplateMutation.isPending}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        {deleteTemplateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        setLocation(`/templates/create?id=${template.id}`);
                                      }}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setPreviewTemplate(template);
                                        setPreviewDialogOpen(true);
                                      }}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Preview
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteTemplate(template)}
                                        disabled={deleteTemplateMutation.isPending}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        {deleteTemplateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                {previewTemplate?.name}
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4 mt-4">
                <div className="bg-muted/30 rounded-lg p-6 border">
                  {/* Header (skip media placeholder for media carousel — cards carry media below) */}
                  {previewTemplate.components?.find((c: any) => c.type === 'HEADER') &&
                    previewInteractiveAction !== 'MEDIA_CARD_CAROUSEL' &&
                    previewInteractiveAction !== 'PRODUCT_CARD_CAROUSEL' &&
                    (() => {
                    const headerComponent = previewTemplate.components.find((c: any) => c.type === 'HEADER');
                    const headerPreviewUrl =
                      (previewMeta as any)?.templateHeaderMediaUrl ||
                      (previewMeta as any)?.mediaUrl;
                    if (headerComponent.format === 'TEXT') {
                      return (
                        <div className="text-sm font-semibold mb-3">
                          {headerComponent.text}
                        </div>
                      );
                    } else if (headerComponent.format === 'IMAGE') {
                      return headerPreviewUrl ? (
                        <div className="w-full max-h-48 rounded-lg overflow-hidden mb-3 border bg-background">
                          <img
                            src={headerPreviewUrl}
                            alt="Template header"
                            className="w-full h-auto object-cover max-h-48"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center mb-3 text-muted-foreground text-sm text-center px-4">
                          Image header (select media when sending)
                        </div>
                      );
                    } else if (headerComponent.format === 'VIDEO' && headerPreviewUrl) {
                      return (
                        <div className="w-full max-h-48 rounded-lg overflow-hidden mb-3 border bg-background">
                          <video src={headerPreviewUrl} controls className="w-full max-h-48 object-cover" />
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Body */}
                  {previewTemplate.components?.find((c: any) => c.type === 'BODY')?.text && (
                    <div className="text-sm whitespace-pre-wrap mb-3">
                      {previewTemplate.components.find((c: any) => c.type === 'BODY').text}
                    </div>
                  )}
                  
                  {/* Footer */}
                  {previewTemplate.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                    <div className="text-xs text-muted-foreground pt-3 border-t">
                      {previewTemplate.components.find((c: any) => c.type === 'FOOTER').text}
                    </div>
                  )}
                  
                  {/* Buttons */}
                  {previewTemplate.components?.find((c: any) => c.type === 'BUTTONS')?.buttons && (() => {
                    const buttons = previewTemplate.components.find((c: any) => c.type === 'BUTTONS').buttons || [];
                    if (buttons.length > 0) {
                      return (
                        <div className="mt-4 space-y-2">
                          {buttons.map((btn: any, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              {btn.type === 'URL' && (
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                  <ExternalLink className="h-3 w-3 mr-2" />
                                  {btn.text}
                                </Button>
                              )}
                              {btn.type === 'PHONE_NUMBER' && (
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                  <PhoneIcon className="h-3 w-3 mr-2" />
                                  {btn.text}
                                </Button>
                              )}
                              {btn.type === 'QUICK_REPLY' && (
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                  <MessageSquare className="h-3 w-3 mr-2" />
                                  {btn.text}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Product Card Carousel (catalog products in metadata) */}
                  {previewInteractiveAction === 'PRODUCT_CARD_CAROUSEL' && previewProductCards.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">
                          Product Card Carousel ({previewProductCards.length} card{previewProductCards.length > 1 ? "s" : ""})
                        </div>
                        {previewProductCards.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPreviewProductCardIndex((prev) => Math.max(0, prev - 1))}
                              disabled={selectedPreviewProductCardIndex === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {selectedPreviewProductCardIndex + 1} / {previewProductCards.length}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedPreviewProductCardIndex((prev) =>
                                  Math.min(previewProductCards.length - 1, prev + 1)
                                )
                              }
                              disabled={selectedPreviewProductCardIndex === previewProductCards.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {previewProductCards[selectedPreviewProductCardIndex] && (
                        <div className="rounded-lg border bg-background p-3 space-y-2">
                          <div className="w-full min-h-[120px] rounded-lg bg-muted flex flex-col items-center justify-center text-sm text-muted-foreground gap-1">
                            <ImageIcon className="h-8 w-8 opacity-50" />
                            <span className="font-medium text-foreground">
                              {previewProductCards[selectedPreviewProductCardIndex].productName ||
                                previewProductCards[selectedPreviewProductCardIndex].productRetailerId ||
                                "Catalog product"}
                            </span>
                            {previewProductCards[selectedPreviewProductCardIndex].productRetailerId ? (
                              <span className="text-xs">
                                ID: {previewProductCards[selectedPreviewProductCardIndex].productRetailerId}
                              </span>
                            ) : null}
                          </div>
                          <Button variant="outline" size="sm" className="w-full justify-center">
                            {previewProductCards[selectedPreviewProductCardIndex].buttonLabel || "View"}
                            {(previewProductCards[0]?.buttonType || "spm") === "url" ? " ↗" : ""}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Card Carousel (stored in metadata for local preview) */}
                  {previewInteractiveAction === 'MEDIA_CARD_CAROUSEL' && previewMediaCards.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">
                          Media Card Carousel ({previewMediaCards.length} card{previewMediaCards.length > 1 ? 's' : ''})
                        </div>
                        {previewMediaCards.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPreviewMediaCardIndex((prev) => Math.max(0, prev - 1))}
                              disabled={selectedPreviewMediaCardIndex === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {selectedPreviewMediaCardIndex + 1} / {previewMediaCards.length}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPreviewMediaCardIndex((prev) => Math.min(previewMediaCards.length - 1, prev + 1))}
                              disabled={selectedPreviewMediaCardIndex === previewMediaCards.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {previewMediaCards[selectedPreviewMediaCardIndex] && (
                        <div className="rounded-lg border bg-background p-3 space-y-2">
                          {previewMediaCards[selectedPreviewMediaCardIndex].mediaType === 'IMAGE' ? (
                            <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500">
                              [Image]
                            </div>
                          ) : previewMediaCards[selectedPreviewMediaCardIndex].mediaType === 'VIDEO' ? (
                            <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500">
                              [Video]
                            </div>
                          ) : null}
                          {previewMediaCards[selectedPreviewMediaCardIndex].bodyText && (
                            <div className="text-sm whitespace-pre-wrap">{previewMediaCards[selectedPreviewMediaCardIndex].bodyText}</div>
                          )}
                          {previewMediaCards[selectedPreviewMediaCardIndex].buttons && previewMediaCards[selectedPreviewMediaCardIndex].buttons!.length > 0 && (
                            <div className="space-y-1">
                              {previewMediaCards[selectedPreviewMediaCardIndex].buttons!.map((btn, btnIdx) => (
                                <Button key={`${selectedPreviewMediaCardIndex}-${btnIdx}`} variant="outline" size="sm" className="w-full justify-start">
                                  {btn.type === 'URL' && <ExternalLink className="h-3 w-3 mr-2" />}
                                  {btn.type === 'PHONE_NUMBER' && <PhoneIcon className="h-3 w-3 mr-2" />}
                                  {btn.type === 'QUICK_REPLY' && <MessageSquare className="h-3 w-3 mr-2" />}
                                  {btn.text || 'Button'}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">{getStatusBadge(previewTemplate.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <div className="mt-1">{previewTemplate.category}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Language:</span>
                    <div className="mt-1">{previewTemplate.language}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template ID:</span>
                    <div className="mt-1 font-mono text-xs">{previewTemplate.templateId || previewTemplate.id}</div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
