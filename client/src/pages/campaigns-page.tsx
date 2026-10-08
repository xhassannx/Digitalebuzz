// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, resolveApiUrl, rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit, Send, Calendar, Users, TrendingUp, Search, MessageSquare, X, File as FileIcon, Image as ImageIcon, Video, Music, Link2, Clock, Eye, Play, XCircle, MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Phone, AlertTriangle, Loader2, Upload } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useLocation, Link } from "wouter";
import { useListPaginationState, parsePaginatedListResponse, useDebouncedValue } from "@/lib/list-pagination";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { ContactRecipientPicker } from "@/components/contact-recipient-picker";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  messageTemplate: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  totalRecipients?: number;
  createdAt: string;
  updatedAt: string;
};

type CampaignRecipient = {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  name: string | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
};

type ManagedContact = {
  id: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  tags: string[];
};

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  messageTemplate: z.string().optional(),
  status: z.enum(["draft", "scheduled", "running", "completed", "failed"]).default("draft"),
  scheduledAt: z.string().optional(),
});

type CampaignInput = z.infer<typeof campaignSchema>;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  scheduled: "bg-blue-500",
  running: "bg-yellow-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

function resolveGalleryMediaUrl(url: string): string {
  if (!url) return url;
  const rewritten = rewritePanelMediaUrlToCurrentOrigin(url);
  if (rewritten.startsWith("http://") || rewritten.startsWith("https://")) return rewritten;
  return resolveApiUrl(rewritten.startsWith("/") ? rewritten : `/${rewritten}`);
}

function guessMimeType(url: string, kind: "image" | "video"): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const imageMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  const videoMap: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  if (kind === "video") return videoMap[ext] || "video/mp4";
  return imageMap[ext] || "image/jpeg";
}

function isImageMedia(url: string, blobType?: string, itemType?: string): boolean {
  if (itemType === "image") return true;
  if (blobType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i.test(url);
}

function isVideoMedia(url: string, blobType?: string, itemType?: string): boolean {
  if (itemType === "video") return true;
  if (blobType?.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|avi|3gp)(\?|#|$)/i.test(url);
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();
  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    resetPage,
    paginationParams,
  } = useListPaginationState(10);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  
  // Campaign creation state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [manualPhoneNumbers, setManualPhoneNumbers] = useState<string>("");
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateParameters, setTemplateParameters] = useState<Array<{ column?: string; fallback?: string }>>([]);
  const [headerImageUrl, setHeaderImageUrl] = useState<string>("");
  const [headerImageId, setHeaderImageId] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string>("");
  const [headerVideoId, setHeaderVideoId] = useState<string | null>(null);
  const [scheduleBroadcast, setScheduleBroadcast] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [retryCampaign, setRetryCampaign] = useState(false);
  const [retrySteps, setRetrySteps] = useState<Array<{ hours: number; minutes: number }>>([
    { hours: 12, minutes: 0 },
  ]);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState<"gallery" | "url">("gallery");
  const [gallerySelectedType, setGallerySelectedType] = useState<"all" | "image" | "video" | "audio" | "document">("all");
  const [galleryCarouselCardIndex, setGalleryCarouselCardIndex] = useState<number | null>(null);
  const [carouselCardMediaUrls, setCarouselCardMediaUrls] = useState<(string | null)[]>([]);
  const [carouselPreviewIndex, setCarouselPreviewIndex] = useState(0);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [initialRecipientsFromCampaign, setInitialRecipientsFromCampaign] = useState<Array<{ phoneNumber: string; name?: string }> | null>(null);
  const [contactCache, setContactCache] = useState<Map<string, ManagedContact>>(new Map());

  const mergeContactsIntoCache = useCallback((rows: ManagedContact[]) => {
    if (!rows.length) return;
    setContactCache((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const row of rows) {
        if (!next.has(row.id) || next.get(row.id)?.phoneNumber !== row.phoneNumber) {
          next.set(row.id, row);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // When navigating from campaign detail "Create new campaign", pre-fill recipients and open create dialog
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("campaigns_initialRecipients");
      if (stored) {
        sessionStorage.removeItem("campaigns_initialRecipients");
        const parsed = JSON.parse(stored) as Array<{ phoneNumber: string; name?: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInitialRecipientsFromCampaign(parsed);
          setCreateDialogOpen(true);
        }
      }
    } catch (_) {}
  }, []);

  const { data: campaignsResponse, isLoading } = useQuery({
    queryKey: ["/api/campaigns", debouncedSearchQuery, currentPage, rowsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams(paginationParams.toString());
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      const res = await apiRequest("GET", `/api/campaigns?${params.toString()}`);
      return res.json();
    },
  });

  const { items: campaigns, total: totalCampaigns } = parsePaginatedListResponse<Campaign>(
    campaignsResponse,
    "campaigns"
  );

  useEffect(() => {
    resetPage();
  }, [debouncedSearchQuery, resetPage]);

  const { data: recipients = [] } = useQuery<CampaignRecipient[]>({
    queryKey: ["/api/campaigns", selectedCampaign?.id, "recipients"],
    enabled: !!selectedCampaign?.id && analyticsDialogOpen,
  });

  // Get contacts for selection (preload cache; picker also loads with search)
  const { data: contacts = [] } = useQuery<ManagedContact[]>({
    queryKey: ["/api/contacts", "campaign-create"],
    queryFn: () => fetchLegacyListApi<ManagedContact>("/api/contacts", "contacts"),
    enabled: createDialogOpen,
  });

  useEffect(() => {
    if (contacts.length > 0) mergeContactsIntoCache(contacts);
  }, [contacts, mergeContactsIntoCache]);

  // Get WhatsApp Business phone numbers
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: any[] }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
    enabled: createDialogOpen,
  });

  const { data: addedPhonesForBanner } = useQuery<{ phoneNumbers?: Array<{ code_verification_status?: string }> }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return res.json();
    },
  });
  const hasUnverifiedBusinessNumber = (addedPhonesForBanner?.phoneNumbers ?? []).some(
    (p: any) => p.code_verification_status === 'NOT_VERIFIED'
  );

  // Get templates for selected phone number
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates", selectedPhoneNumberId],
    queryFn: () => {
      const url = selectedPhoneNumberId
        ? `/api/templates?phoneNumberId=${selectedPhoneNumberId}`
        : "/api/templates";
      return fetchLegacyListApi(url, "templates");
    },
    enabled: createDialogOpen && !!selectedPhoneNumberId,
  });

  // Upload media mutation for template headers
  const uploadMediaMutation = useMutation({
    mutationFn: async ({ sessionId, file, mediaType }: { sessionId: string; file: File; mediaType?: 'image' | 'video' }) => {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('file', file);
      if (mediaType) formData.append('mediaType', mediaType);

      const response = await fetch(resolveApiUrl('/api/media/upload'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload media');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      const isVideo = variables.mediaType === 'video';
      if (isVideo) {
        setHeaderVideoId(data.mediaId);
        const preview = data.previewUrl || data.url;
        if (preview) setHeaderVideoUrl(resolveGalleryMediaUrl(preview));
        toast({
          title: "Video uploaded",
          description: `Video uploaded successfully. Media ID: ${data.mediaId?.substring(0, 20)}...`,
        });
      } else {
        setHeaderImageId(data.mediaId);
        const preview = data.previewUrl || data.url;
        if (preview) setHeaderImageUrl(resolveGalleryMediaUrl(preview));
        toast({
          title: "Image uploaded",
          description: `Image uploaded successfully. Media ID: ${data.mediaId?.substring(0, 20)}...`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  // Get contact columns for parameter mapping
  const { data: contactColumns = [] } = useQuery<any[]>({
    queryKey: ["/api/columns"],
    queryFn: () => fetchLegacyListApi("/api/columns", "columns"),
    enabled: createDialogOpen,
  });

  // Get gallery items
  const { data: galleryItems = [] } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ["/api/gallery", gallerySelectedType],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/gallery?type=${gallerySelectedType}`);
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled: galleryDialogOpen,
  });

  // Extract template variables
  const extractTemplateVariables = (template: any): number[] => {
    if (!template?.components) return [];
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return [];
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map((m: string) => parseInt(m.replace(/[{}]/g, '')));
    return [...new Set(vars)].sort((a, b) => a - b);
  };

  // Get preview text
  const getPreviewText = (template: any, params: Array<{ column?: string; fallback?: string }>): string => {
    if (!template?.components) return '';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    
    let text = bodyComponent.text;
    const varNumbers = extractTemplateVariables(template);
    
    varNumbers.forEach((varNum, index) => {
      if (index >= params.length) return;
      const param = params[index];
      const value = param.fallback || `{{${varNum}}}`;
      text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), value);
    });
    
    return text;
  };

  const createForm = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      messageTemplate: "",
      status: "draft",
      scheduledAt: "",
    },
  });

  const editForm = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignInput & { 
      recipients: Array<{ phoneNumber: string; contactId?: string; name?: string }>;
      templateId?: string;
      phoneNumberId?: string;
      templateParameters?: Array<{ column?: string; fallback?: string }>;
      headerImageId?: string;
      headerImageUrl?: string;
      headerVideoId?: string;
      headerVideoUrl?: string;
      retryEnabled?: boolean;
      retrySteps?: Array<{ hours: number; minutes: number }>;
    }) => {
      // Find the selected template
      const selectedTemplate = templates.find((t: any) => (t.id || t.templateId) === data.templateId);
      if (!selectedTemplate && data.templateId) {
        throw new Error('Template not found');
      }

      // Find phone number to get sessionId
      const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p: any) => p.phoneNumberId === data.phoneNumberId);
      if (!phoneNumber) {
        throw new Error('Phone number not found');
      }

      // Create campaign with template data
      const campaignData: any = {
        name: data.name,
        sessionId: phoneNumber.sessionId,
        messageTemplate: selectedTemplate?.name || data.messageTemplate || '',
        templateId: data.templateId,
        templateLanguage: selectedTemplate?.language || 'en',
        templateParameters: data.templateParameters,
        headerImageId: data.headerImageId,
        headerImageUrl: data.headerImageUrl,
        headerVideoId: data.headerVideoId,
        headerVideoUrl: data.headerVideoUrl,
        ...(Array.isArray(data.carouselCardMediaUrls) && data.carouselCardMediaUrls.length > 0
          ? { carouselCardMediaUrls: data.carouselCardMediaUrls }
          : {}),
        status: data.status,
        scheduledAt: data.scheduledAt || null,
        recipients: data.recipients,
        retryEnabled: !!data.retryEnabled,
        retrySteps: data.retryEnabled ? data.retrySteps || [] : null,
      };

      const response = await apiRequest("POST", "/api/campaigns", campaignData);
      const campaign = await response.json();
      
      // Campaign is now automatically scheduled for 2 minutes from creation if no schedule was provided
      // No need to execute immediately - the scheduler will handle it

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCreateDialogOpen(false);
      createForm.reset();
      setInitialRecipientsFromCampaign(null);
      // Reset all state
      setSelectedContacts(new Set());
      setManualPhoneNumbers("");
      setSelectedPhoneNumberId("");
      setSelectedTemplateId("");
      setTemplateParameters([]);
      setHeaderImageUrl("");
      setHeaderImageId(null);
      setHeaderVideoUrl("");
      setHeaderVideoId(null);
      setCarouselCardMediaUrls([]);
      setGalleryCarouselCardIndex(null);
      setCarouselPreviewIndex(0);
      setScheduleBroadcast(false);
      setScheduleDate(undefined);
      setScheduleTime("");
      setRetryCampaign(false);
      setRetrySteps([{ hours: 12, minutes: 0 }]);
      setImageUrlInput("");
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CampaignInput) => apiRequest("PATCH", `/api/campaigns/${selectedCampaign?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setEditDialogOpen(false);
      setSelectedCampaign(null);
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/campaigns/${selectedCampaign?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDeleteDialogOpen(false);
      setSelectedCampaign(null);
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/execute`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      if (data?.accepted) {
        toast({
          title: "Campaign started",
          description:
            data.message ||
            "Sending in the background. Open the campaign and refresh in a bit to see progress.",
        });
        return;
      }
      toast({
        title: "Success",
        description: `Campaign finished. ${data.sentCount || 0} message(s) sent.`,
      });
    },
    onError: (error: any) => {
      let description = error.message || "Failed to execute campaign";
      try {
        const match = error.message?.match(/\d+: (\{.*\})/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.error) description = parsed.error;
        }
      } catch (_) {}
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (campaignId: string) => apiRequest("POST", `/api/campaigns/${campaignId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCancelDialogOpen(false);
      setSelectedCampaign(null);
      toast({
        title: "Success",
        description: "Campaign cancelled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel campaign",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    editForm.reset({
      name: campaign.name,
      messageTemplate: campaign.messageTemplate,
      status: campaign.status as any,
      scheduledAt: campaign.scheduledAt || "",
    });
    setEditDialogOpen(true);
  };

  const handleViewAnalytics = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setAnalyticsDialogOpen(true);
  };

  const handleCreateCampaign = () => {
    const formName = createForm.getValues("name")?.trim();
    if (!formName) {
      toast({
        title: "Campaign name required",
        description: "Enter a name for your campaign.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPhoneNumberId) {
      toast({
        title: "WhatsApp number required",
        description: "Select which WhatsApp Business number will send this campaign.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTemplateId) {
      toast({
        title: "Template required",
        description: "Select an approved message template for this campaign.",
        variant: "destructive",
      });
      return;
    }

    const selectedTemplate = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
    if (!selectedTemplate) {
      toast({
        title: "Template not found",
        description: "Reload templates or pick another template and try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Collect all recipients (from campaign detail pre-fill, or from selected contacts + manual)
    let recipients: Array<{ phoneNumber: string; contactId?: string; name?: string }> = [];
    
    if (initialRecipientsFromCampaign && initialRecipientsFromCampaign.length > 0) {
      recipients = initialRecipientsFromCampaign.map(r => ({ phoneNumber: r.phoneNumber, name: r.name }));
    } else {
      const selectedContactsData = [...selectedContacts]
        .map((id) => contactCache.get(id))
        .filter((c): c is ManagedContact => !!c?.phoneNumber?.trim());

      if (selectedContacts.size > 0 && selectedContactsData.length === 0) {
        toast({
          title: "Could not resolve contacts",
          description: "Search and select contacts again, or use Manual Numbers.",
          variant: "destructive",
        });
        return;
      }

      if (selectedContacts.size > selectedContactsData.length) {
        toast({
          title: "Some contacts could not be loaded",
          description: `${selectedContacts.size - selectedContactsData.length} selected contact(s) missing phone numbers were skipped.`,
          variant: "destructive",
        });
      }

      selectedContactsData.forEach(contact => {
        recipients.push({
          phoneNumber: contact.phoneNumber,
          contactId: contact.id,
          name: contact.name || undefined,
        });
      });
      const manualNumbers = manualPhoneNumbers
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);
      manualNumbers.forEach(phone => {
        if (!recipients.find(r => r.phoneNumber === phone)) {
          recipients.push({ phoneNumber: phone });
        }
      });
    }

    if (recipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please select contacts or enter manual phone numbers",
        variant: "destructive",
      });
      return;
    }

    // Build template params
    const templateParams: string[] = [];
    if (selectedTemplate && templateParameters.length > 0) {
      const contactsMap = new Map([...contactCache.values()].map(c => [c.phoneNumber, c]));
      const firstContact = recipients.length > 0 ? contactsMap.get(recipients[0].phoneNumber) : null;
      
      templateParameters.forEach((param) => {
        let value = param.fallback || '';
        if (param.column && firstContact) {
          if (param.column === 'name') {
            value = firstContact.name || param.fallback || '';
          } else if (param.column === 'phoneNumber') {
            value = firstContact.phoneNumber || param.fallback || '';
          } else if (param.column === 'email') {
            value = firstContact.email || param.fallback || '';
          }
        }
        templateParams.push(value);
      });
    }

    // Build scheduledAt
    let scheduledAt: string | undefined = undefined;
    if (scheduleBroadcast && scheduleDate) {
      const dateTime = new Date(scheduleDate);
      if (scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':');
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        // If no time is provided, set to current time + 5 minutes as default
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        dateTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
      }
      
      // Validate that scheduled time is in the future
      const now = new Date();
      if (dateTime <= now) {
        toast({
          title: "Invalid Schedule Time",
          description: "Scheduled time must be in the future. Please select a time at least a few minutes from now.",
          variant: "destructive",
        });
        return;
      }
      
      scheduledAt = dateTime.toISOString();
    }

    const template = selectedTemplate;
    const tmplMeta = template?.metaData || template?.metadata || {};
    const carCards = Array.isArray(tmplMeta.mediaCards) ? tmplMeta.mediaCards : [];
    const isCarouselTemplate =
      tmplMeta.interactiveAction === "MEDIA_CARD_CAROUSEL" && carCards.length >= 2;

    if (
      isCarouselTemplate &&
      (carouselCardMediaUrls.length !== carCards.length ||
        carouselCardMediaUrls.some((u) => !String(u ?? "").trim()))
    ) {
      toast({
        title: "Carousel media required",
        description: `Select media for all ${carCards.length} carousel cards before creating the campaign.`,
        variant: "destructive",
      });
      return;
    }

    const carouselPayload = isCarouselTemplate
      ? (carouselCardMediaUrls.map((u) => String(u!).trim()) as string[])
      : undefined;

    const headerComponent = template?.components?.find(
      (c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO')
    );

    if (!isCarouselTemplate && headerComponent) {
      if (uploadMediaMutation.isPending) {
        toast({
          title: "Media uploading",
          description: "Please wait for the media to finish uploading before creating the campaign.",
        });
        return;
      }
      if (headerComponent.format === 'VIDEO') {
        if (headerVideoUrl && !headerVideoId) {
          toast({
            title: "Video upload incomplete",
            description: "The video upload did not complete. Please select the video again.",
            variant: "destructive",
          });
          return;
        }
        if (!headerVideoId && !headerVideoUrl) {
          toast({
            title: "Video required",
            description: "This template requires a video header. Please upload a video first.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (headerImageUrl && !headerImageId) {
          toast({
            title: "Image upload incomplete",
            description: "The image upload did not complete. Please select the image again.",
            variant: "destructive",
          });
          return;
        }
        if (!headerImageId && !headerImageUrl) {
          toast({
            title: "Image required",
            description: "This template requires an image header. Please upload an image first.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (retryCampaign) {
      if (retrySteps.length === 0) {
        toast({
          title: "Retry steps required",
          description: "Add at least one retry with hours/minutes, or turn off Retry Campaign.",
          variant: "destructive",
        });
        return;
      }
      const invalid = retrySteps.some(
        (s) =>
          !Number.isFinite(s.hours) ||
          !Number.isFinite(s.minutes) ||
          s.hours < 0 ||
          s.minutes < 0 ||
          s.minutes > 59 ||
          (s.hours === 0 && s.minutes === 0)
      );
      if (invalid) {
        toast({
          title: "Invalid retry delay",
          description: "Each retry needs a delay of at least 1 minute (hours 0–720, minutes 0–59).",
          variant: "destructive",
        });
        return;
      }
    }

    const formData = createForm.getValues();
    createMutation.mutate({
      ...formData,
      recipients,
      templateId: selectedTemplateId || undefined,
      phoneNumberId: selectedPhoneNumberId || undefined,
      templateParameters: templateParameters.length > 0 ? templateParameters : undefined,
      headerImageId: headerImageId || undefined,
      headerImageUrl: headerImageUrl || undefined,
      headerVideoId: headerVideoId || undefined,
      headerVideoUrl: headerVideoUrl || undefined,
      carouselCardMediaUrls: carouselPayload,
      scheduledAt,
      retryEnabled: retryCampaign,
      retrySteps: retryCampaign ? retrySteps : undefined,
    });
  };

  const getDeliveryRate = (campaign: Campaign): number => {
    if (campaign.sentCount === 0) return 0;
    return Math.round((campaign.deliveredCount / campaign.sentCount) * 100);
  };

  const paginatedCampaigns = campaigns;

  // Format status display
  const getStatusDisplay = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', color: 'bg-green-500' };
      case 'failed':
        return { label: 'Failed', color: 'bg-red-500' };
      case 'running':
        return { label: 'Partially_completed', color: 'bg-orange-500' };
      case 'scheduled':
        return { label: 'Scheduled', color: 'bg-blue-500' };
      case 'draft':
        return { label: 'Draft', color: 'bg-gray-500' };
      default:
        return { label: status, color: 'bg-gray-500' };
    }
  };

  // Format date display
  const formatDateDisplay = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else if (diffDays < 7) {
      return `${format(date, 'MMM d')} at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const getReadRate = (campaign: Campaign): number => {
    if (campaign.deliveredCount === 0) return 0;
    return Math.round((campaign.readCount / campaign.deliveredCount) * 100);
  };

  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
  const totalRead = campaigns.reduce((sum, c) => sum + c.readCount, 0);

  const selectedTemplate = templates.find((t: any) => (t.id || t.templateId) === selectedTemplateId);
  const templateMeta = selectedTemplate?.metaData || selectedTemplate?.metadata || {};
  const mediaCards = Array.isArray(templateMeta.mediaCards) ? templateMeta.mediaCards : [];
  const isMediaCarousel =
    templateMeta.interactiveAction === "MEDIA_CARD_CAROUSEL" && mediaCards.length > 0;
  const headerComponent = selectedTemplate?.components?.find(
    (c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO')
  );
  const isVideoHeader = headerComponent?.format === 'VIDEO';
  const manualNumbersArray = manualPhoneNumbers.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  const totalRecipients = initialRecipientsFromCampaign?.length ?? (selectedContacts.size + manualNumbersArray.length);
  const campaignNameValue = createForm.watch("name");
  const needsHeaderMedia = !!headerComponent && !isMediaCarousel;
  const needsCarouselMedia = isMediaCarousel;
  const hasHeaderMediaReady = !needsHeaderMedia
    ? true
    : isVideoHeader
      ? !!(headerVideoId || headerVideoUrl)
      : !!(headerImageId || headerImageUrl);
  const hasCarouselMediaReady =
    !needsCarouselMedia ||
    (carouselCardMediaUrls.length === mediaCards.length &&
      carouselCardMediaUrls.every((u) => String(u ?? "").trim()));
  const canCreateCampaign =
    !!campaignNameValue?.trim() &&
    totalRecipients > 0 &&
    !!selectedPhoneNumberId &&
    !!selectedTemplateId &&
    hasHeaderMediaReady &&
    hasCarouselMediaReady &&
    !uploadMediaMutation.isPending &&
    !createMutation.isPending;
  const selectedPhoneNumber = phoneNumbersData?.phoneNumbers?.find(
    (p: any) => p.phoneNumberId === selectedPhoneNumberId
  );

  const resetHeaderMedia = () => {
    setHeaderImageUrl("");
    setHeaderImageId(null);
    setHeaderVideoUrl("");
    setHeaderVideoId(null);
    setImageUrlInput("");
  };

  const resetCarouselMedia = () => {
    setCarouselCardMediaUrls([]);
    setGalleryCarouselCardIndex(null);
    setCarouselPreviewIndex(0);
  };

  const selectGalleryItemForCarousel = (url: string, itemType?: string) => {
    if (galleryCarouselCardIndex === null) return false;
    const card = mediaCards[galleryCarouselCardIndex];
    const expectVideo = card?.mediaType === "VIDEO";
    const expectImage = card?.mediaType === "IMAGE";
    const typeOk =
      (expectImage && (itemType === "image" || isImageMedia(url, undefined, itemType))) ||
      (expectVideo && (itemType === "video" || isVideoMedia(url, undefined, itemType)));
    if (!typeOk) {
      toast({
        title: "Wrong media type",
        description: `Card ${galleryCarouselCardIndex + 1} requires ${expectVideo ? "a video" : "an image"}.`,
        variant: "destructive",
      });
      return true;
    }
    const displayUrl = resolveGalleryMediaUrl(url);
    setCarouselCardMediaUrls((prev) => {
      const next = [...prev];
      next[galleryCarouselCardIndex] = displayUrl;
      return next;
    });
    setGalleryDialogOpen(false);
    setGalleryCarouselCardIndex(null);
    return true;
  };

  const uploadHeaderMediaFromUrl = async (
    url: string,
    itemType?: "image" | "video" | "audio" | "document"
  ) => {
    if (!selectedPhoneNumber) {
      toast({
        title: "Phone number required",
        description: "Select a WhatsApp Business number before uploading media.",
        variant: "destructive",
      });
      return;
    }

    const displayUrl = resolveGalleryMediaUrl(url);

    if (isVideoHeader) {
      setHeaderVideoUrl(displayUrl);
      setHeaderVideoId(null);
    } else {
      setHeaderImageUrl(displayUrl);
      setHeaderImageId(null);
    }

    try {
      const response = await fetch(displayUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch media from URL");
      const blob = await response.blob();
      const isVideo = isVideoMedia(url, blob.type, itemType);
      const isImage = isImageMedia(url, blob.type, itemType);
      if (isVideoHeader && !isVideo) {
        setHeaderVideoUrl("");
        setHeaderVideoId(null);
        toast({
          title: "Invalid media",
          description: "This template requires a video. Please use a video file.",
          variant: "destructive",
        });
        return;
      }
      if (!isVideoHeader && !isImage) {
        setHeaderImageUrl("");
        setHeaderImageId(null);
        toast({
          title: "Invalid media",
          description: "This template requires an image. Please use an image file.",
          variant: "destructive",
        });
        return;
      }
      const fileName = url.split("/").pop()?.split("?")[0] || (isVideo ? "video.mp4" : "image.jpg");
      const mimeType =
        blob.type && blob.type !== "application/octet-stream"
          ? blob.type
          : guessMimeType(url, isVideo ? "video" : "image");
      const file = new window.File([blob], fileName, { type: mimeType });
      if (isVideoHeader) {
        uploadMediaMutation.mutate({
          sessionId: selectedPhoneNumber.sessionId,
          file,
          mediaType: "video",
        });
      } else {
        uploadMediaMutation.mutate({
          sessionId: selectedPhoneNumber.sessionId,
          file,
          mediaType: "image",
        });
      }
    } catch (error: any) {
      if (isVideoHeader) {
        setHeaderVideoUrl("");
        setHeaderVideoId(null);
      } else {
        setHeaderImageUrl("");
        setHeaderImageId(null);
      }
      toast({
        title: "Failed to load media",
        description: error.message || "Failed to process media URL",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={cn("space-y-6", skin ? "min-w-0" : "p-6")}
      data-testid="page-campaigns"
    >
      {hasUnverifiedBusinessNumber && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">WhatsApp Business number is not verified</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Campaigns are sent normally. For best deliverability, verify your number in Meta Business Manager (Connect).
            </p>
            <Link href="/connect" className="text-sm font-medium text-amber-800 dark:text-amber-200 underline mt-2 inline-block">
              Verify in Connect →
            </Link>
          </div>
        </div>
      )}
      <div className={cn("flex items-center gap-4", skin ? "justify-end" : "justify-between")}>
        <div className="campaigns-page-chrome min-w-0">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Create and manage bulk messaging campaigns</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setInitialRecipientsFromCampaign(null);
            setSelectedContacts(new Set());
            setManualPhoneNumbers("");
            setSelectedPhoneNumberId("");
            setSelectedTemplateId("");
            setTemplateParameters([]);
            setHeaderImageUrl("");
            setHeaderImageId(null);
            setHeaderVideoUrl("");
            setHeaderVideoId(null);
            setCarouselCardMediaUrls([]);
            setGalleryCarouselCardIndex(null);
            setCarouselPreviewIndex(0);
            setScheduleBroadcast(false);
            setScheduleDate(undefined);
            setScheduleTime("");
            setRetryCampaign(false);
            setRetrySteps([{ hours: 12, minutes: 0 }]);
            setContactCache(new Map());
          }
        }}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-create-campaign"
              className={cn(skin && primaryBtnClass)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-6xl w-[min(72rem,95vw)]" data-testid="dialog-create-campaign">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(handleCreateCampaign, (errors) => {
                  const first = Object.values(errors)[0];
                  toast({
                    title: "Missing required fields",
                    description: first?.message?.toString() || "Check campaign name and required fields.",
                    variant: "destructive",
                  });
                })}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  {/* Left Column - Form Fields */}
                  <div className="space-y-4 min-w-0">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Summer Sale 2024" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Recipients Section - Moved to top for visibility */}
                    <div className="space-y-4 border-t pt-4">
                      {initialRecipientsFromCampaign && initialRecipientsFromCampaign.length > 0 ? (
                        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                          <Label className="text-sm font-medium">{initialRecipientsFromCampaign.length} recipients from campaign</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setInitialRecipientsFromCampaign(null)}>
                            Select different recipients
                          </Button>
                        </div>
                      ) : (
                        <Label className="text-sm font-medium">Recipients ({totalRecipients})</Label>
                      )}
                      {(!initialRecipientsFromCampaign || initialRecipientsFromCampaign.length === 0) && (
                      <Tabs defaultValue="contacts" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-auto gap-1">
                          <TabsTrigger value="contacts" className="text-xs sm:text-sm py-2 px-2 whitespace-nowrap">
                            Select Contacts
                          </TabsTrigger>
                          <TabsTrigger value="manual" className="text-xs sm:text-sm py-2 px-2 whitespace-nowrap">
                            Manual Numbers
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="contacts" className="space-y-2 mt-2">
                          <ContactRecipientPicker
                            mode="multiple"
                            selectedIds={selectedContacts}
                            onSelectionChange={setSelectedContacts}
                            onContactsLoaded={mergeContactsIntoCache}
                            enabled={createDialogOpen}
                            listMaxHeightClass="max-h-52"
                          />
                        </TabsContent>
                        <TabsContent value="manual" className="space-y-2">
                          <Label className="text-sm text-muted-foreground">
                            Enter phone numbers (one per line)
                          </Label>
                          <Textarea
                            placeholder="+1234567890&#10;+0987654321"
                            value={manualPhoneNumbers}
                            onChange={(e) => setManualPhoneNumbers(e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            {manualNumbersArray.length} number{manualNumbersArray.length !== 1 ? 's' : ''} entered
                          </p>
                        </TabsContent>
                      </Tabs>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">WhatsApp Business Number</Label>
                      <Select value={selectedPhoneNumberId} onValueChange={(value) => {
                        setSelectedPhoneNumberId(value);
                        setSelectedTemplateId("");
                        setTemplateParameters([]);
                        resetHeaderMedia();
                        resetCarouselMedia();
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select WhatsApp Business Number" />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneNumbersData?.phoneNumbers && phoneNumbersData.phoneNumbers.length > 0 ? (
                            phoneNumbersData.phoneNumbers.map((phone: any) => (
                              <SelectItem key={phone.phoneNumberId} value={phone.phoneNumberId}>
                                {phone.displayPhoneNumber} {phone.verifiedName ? `(${phone.verifiedName})` : ''}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-muted-foreground">No phone numbers available</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Message Template</Label>
                      <Select value={selectedTemplateId} onValueChange={(templateId) => {
                        setSelectedTemplateId(templateId);
                        setCarouselPreviewIndex(0);
                        setGalleryCarouselCardIndex(null);
                        resetHeaderMedia();
                        const template = templates.find((t: any) => (t.id || t.templateId) === templateId);
                        if (template) {
                          const tmplMeta = template?.metaData || template?.metadata || {};
                          const mcs = Array.isArray(tmplMeta.mediaCards) ? tmplMeta.mediaCards : [];
                          if (tmplMeta.interactiveAction === "MEDIA_CARD_CAROUSEL" && mcs.length > 0) {
                            setCarouselCardMediaUrls(Array.from({ length: mcs.length }, () => null));
                          } else {
                            setCarouselCardMediaUrls([]);
                          }
                          const vars = extractTemplateVariables(template);
                          setTemplateParameters(vars.map(() => ({ column: '', fallback: '' })));
                          const header = template.components?.find(
                            (c: any) => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO')
                          );
                          setGallerySelectedType(header?.format === 'VIDEO' ? 'video' : 'image');
                        } else {
                          setTemplateParameters([]);
                          setCarouselCardMediaUrls([]);
                        }
                      }} disabled={!selectedPhoneNumberId}>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedPhoneNumberId ? "Select a template" : "Select phone number first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.length > 0 ? (
                            templates
                              .filter((template: any) => template.status === 'APPROVED' || template.status === 'approved')
                              .map((template: any) => (
                                <SelectItem key={template.id || template.templateId} value={template.id || template.templateId}>
                                  {template.name} ({template.category || 'N/A'})
                                </SelectItem>
                              ))
                          ) : (
                            <div className="p-2 text-sm text-muted-foreground">
                              {selectedPhoneNumberId ? "No templates available" : "Select phone number first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template Parameters */}
                    {selectedTemplateId && templateParameters.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium block">Template Parameters</Label>
                        {templateParameters.map((param, index) => {
                          const varNum = index + 1;
                          return (
                            <div key={index} className="space-y-2 border rounded-lg p-3">
                              <Label className="text-sm font-medium">Parameter {varNum}</Label>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Select Column</Label>
                                  <Select
                                    value={param.column || ''}
                                    onValueChange={(value) => {
                                      const newParams = [...templateParameters];
                                      newParams[index] = { ...newParams[index], column: value };
                                      setTemplateParameters(newParams);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="name">Name</SelectItem>
                                      <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                      <SelectItem value="email">Email</SelectItem>
                                      {contactColumns.map((col: any) => (
                                        <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                          {col.label} (Custom Field)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Fallback value (optional)</Label>
                                  <Input
                                    placeholder="Enter fallback value"
                                    value={param.fallback || ''}
                                    maxLength={1024}
                                    onChange={(e) => {
                                      const newParams = [...templateParameters];
                                      newParams[index] = {
                                        ...newParams[index],
                                        fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                                      };
                                      setTemplateParameters(newParams);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Media card carousel — one image/video per card */}
                    {selectedTemplateId && isMediaCarousel && (
                      <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                        <div>
                          <Label className="text-sm font-medium block">Carousel media</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Required: one{" "}
                            {mediaCards.some((c: any) => c.mediaType === "VIDEO") ? "image or video" : "image"} per
                            card. WhatsApp uses these files when the message is sent (not only the template draft media).
                          </p>
                        </div>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {mediaCards.map((card: any, idx: number) => (
                            <div key={`ccar-${idx}`} className="flex flex-col gap-2 border rounded-md p-3 bg-background">
                              <span className="text-xs font-medium">
                                Card {idx + 1} · {card.mediaType === "VIDEO" ? "Video" : "Image"}
                              </span>
                              {carouselCardMediaUrls[idx] ? (
                                <p
                                  className="text-xs text-muted-foreground truncate"
                                  title={carouselCardMediaUrls[idx] || ""}
                                >
                                  {String(carouselCardMediaUrls[idx]).length > 56
                                    ? `${String(carouselCardMediaUrls[idx]).slice(0, 56)}…`
                                    : carouselCardMediaUrls[idx]}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-700 dark:text-amber-500">No file selected</p>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  setGalleryCarouselCardIndex(idx);
                                  setGallerySelectedType(card.mediaType === "VIDEO" ? "video" : "image");
                                  setGalleryViewMode("gallery");
                                  setGalleryDialogOpen(true);
                                }}
                                disabled={!selectedPhoneNumberId}
                              >
                                {card.mediaType === "VIDEO" ? (
                                  <Video className="w-4 h-4 mr-2" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 mr-2" />
                                )}
                                Select from gallery
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Header media (IMAGE or VIDEO templates — not carousel) */}
                    {headerComponent && !isMediaCarousel && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {isVideoHeader ? "Video header" : "Image header"} <span className="text-destructive">*</span>
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setGalleryCarouselCardIndex(null);
                            setGallerySelectedType(isVideoHeader ? 'video' : 'image');
                            setGalleryDialogOpen(true);
                          }}
                          disabled={uploadMediaMutation.isPending || !selectedPhoneNumberId}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Select {isVideoHeader ? "video" : "image"} from gallery
                        </Button>
                        <div className="text-xs text-muted-foreground text-center">OR</div>
                        <div className="flex gap-2">
                          <Input
                            placeholder={isVideoHeader ? "Enter video URL (https://...)" : "Enter image URL (https://...)"}
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                            disabled={uploadMediaMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (imageUrlInput) uploadHeaderMediaFromUrl(imageUrlInput);
                            }}
                            disabled={!imageUrlInput || !selectedPhoneNumberId || uploadMediaMutation.isPending}
                          >
                            {uploadMediaMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload
                              </>
                            )}
                          </Button>
                        </div>
                        {(headerImageUrl || headerVideoUrl) && (
                          <div className="mt-2 p-2 border rounded">
                            {headerVideoUrl ? (
                              <>
                                <video src={resolveGalleryMediaUrl(headerVideoUrl)} controls className="max-w-full max-h-32 rounded" />
                                {headerVideoId && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Media ID: {headerVideoId.substring(0, 20)}...
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <img src={resolveGalleryMediaUrl(headerImageUrl)} alt="Header preview" className="max-w-full max-h-32 rounded" />
                                {headerImageId && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Media ID: {headerImageId.substring(0, 20)}...
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Schedule Section */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={scheduleBroadcast}
                          onCheckedChange={setScheduleBroadcast}
                          id="schedule"
                        />
                        <Label htmlFor="schedule" className="text-sm font-medium">Schedule Broadcast</Label>
                      </div>
                      {scheduleBroadcast && (
                        <div className="grid grid-cols-2 gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <Calendar className="mr-2 h-4 w-4" />
                                {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={scheduleDate}
                                onSelect={setScheduleDate}
                                disabled={(date) => {
                                  // Allow today's date, only disable past dates
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const compareDate = new Date(date);
                                  compareDate.setHours(0, 0, 0, 0);
                                  return compareDate < today;
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            placeholder="Time"
                          />
                        </div>
                      )}
                    </div>

                    {/* Retry Campaign (AiSensy-style) */}
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="retry-campaign" className="text-sm font-medium">
                            Retry Campaign
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Ensure high deliveries! Set up to 3 automated retries for failed messages.
                          </p>
                        </div>
                        <Switch
                          checked={retryCampaign}
                          onCheckedChange={(on) => {
                            setRetryCampaign(on);
                            if (on && retrySteps.length === 0) {
                              setRetrySteps([{ hours: 12, minutes: 0 }]);
                            }
                          }}
                          id="retry-campaign"
                        />
                      </div>

                      {retryCampaign && (
                        <div className="rounded-md border bg-muted/40 p-3 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Set up to three retries, with delays based on the time after the campaign is sent.
                          </p>
                          <div className="relative space-y-4 pl-4 border-l-2 border-emerald-500 ml-1.5">
                            <div className="relative">
                              <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              <p className="text-sm font-medium">Campaign Sent</p>
                            </div>

                            {retrySteps.map((step, index) => {
                              const afterLabel =
                                index === 0
                                  ? "after Campaign completion"
                                  : index === 1
                                    ? "after 1st Retry"
                                    : "after 2nd Retry";
                              return (
                                <div key={index} className="relative space-y-2">
                                  <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      <p className="text-sm font-medium">Retry #{index + 1}</p>
                                    </div>
                                    {retrySteps.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() =>
                                          setRetrySteps((prev) => prev.filter((_, i) => i !== index))
                                        }
                                        aria-label={`Remove retry ${index + 1}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {step.hours} hours and {step.minutes} minutes {afterLabel}.
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Hours</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={720}
                                        value={step.hours}
                                        onChange={(e) => {
                                          const hours = Math.max(0, Math.min(720, parseInt(e.target.value || "0", 10) || 0));
                                          setRetrySteps((prev) =>
                                            prev.map((s, i) => (i === index ? { ...s, hours } : s))
                                          );
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Minutes</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={step.minutes}
                                        onChange={(e) => {
                                          const minutes = Math.max(0, Math.min(59, parseInt(e.target.value || "0", 10) || 0));
                                          setRetrySteps((prev) =>
                                            prev.map((s, i) => (i === index ? { ...s, minutes } : s))
                                          );
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {retrySteps.length < 3 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                setRetrySteps((prev) => [...prev, { hours: 12, minutes: 0 }])
                              }
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add Retry
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Preview */}
                  <div className="space-y-4 min-w-0">
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <Label className="text-sm font-medium mb-2 block">Preview</Label>
                      {selectedTemplate ? (
                        <div className="space-y-2">
                          <div
                            className="bg-[#e5ddd5] rounded-lg p-4 overflow-y-auto max-h-[280px]"
                            style={{
                              backgroundImage:
                                "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
                              backgroundSize: "20px 20px",
                            }}
                          >
                            <div className="bg-white rounded-lg shadow-md p-4 max-w-[85%] ml-0 w-fit" style={{ borderRadius: '7.5px 7.5px 7.5px 0' }}>
                              {/* Header Image or Video (hidden for media carousel) */}
                              {!isMediaCarousel && headerComponent && (
                                <div className="relative w-full rounded-t-lg overflow-hidden -mx-4 -mt-4 mb-2" style={{ maxHeight: '300px', width: 'calc(100% + 2rem)' }}>
                                  {isVideoHeader ? (
                                    headerVideoUrl ? (
                                      <video src={resolveGalleryMediaUrl(headerVideoUrl)} controls className="w-full h-auto object-contain" style={{ maxHeight: '300px' }} />
                                    ) : (
                                      <div className="bg-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                                        [Video]
                                      </div>
                                    )
                                  ) : headerImageUrl ? (
                                    <img 
                                      src={resolveGalleryMediaUrl(headerImageUrl)} 
                                      alt="Header" 
                                      className="w-full h-auto object-contain" 
                                      style={{ display: 'block', maxHeight: '300px' }}
                                    />
                                  ) : (
                                    <div className="bg-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                                      [Image]
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Body Text */}
                              <p className="text-sm text-[#303030] leading-relaxed whitespace-pre-wrap break-words">
                                {getPreviewText(selectedTemplate, templateParameters)}
                              </p>

                              {/* Carousel cards + per-card buttons (preview) */}
                              {isMediaCarousel &&
                                (() => {
                                  const currentCard = mediaCards[carouselPreviewIndex];
                                  if (!currentCard) return null;
                                  const selectedCarouselUrl = carouselCardMediaUrls[carouselPreviewIndex];
                                  const cardMediaPreview =
                                    typeof selectedCarouselUrl === "string" && selectedCarouselUrl.trim()
                                      ? resolveGalleryMediaUrl(selectedCarouselUrl.trim())
                                      : null;
                                  return (
                                    <div className="mb-2 mt-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-[#667781]">
                                          Carousel · {mediaCards.length} card{mediaCards.length > 1 ? "s" : ""}
                                        </p>
                                        {mediaCards.length > 1 && (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              onClick={() =>
                                                setCarouselPreviewIndex((p) => Math.max(0, p - 1))
                                              }
                                              disabled={carouselPreviewIndex === 0}
                                            >
                                              <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">
                                              {carouselPreviewIndex + 1}/{mediaCards.length}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              onClick={() =>
                                                setCarouselPreviewIndex((p) =>
                                                  Math.min(mediaCards.length - 1, p + 1)
                                                )
                                              }
                                              disabled={carouselPreviewIndex === mediaCards.length - 1}
                                            >
                                              <ChevronRight className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="border rounded-lg p-3 bg-gray-50">
                                        {currentCard.mediaType === "IMAGE" && cardMediaPreview ? (
                                          <img
                                            src={cardMediaPreview}
                                            alt={`Card ${carouselPreviewIndex + 1}`}
                                            className="w-full h-40 object-cover rounded mb-2"
                                          />
                                        ) : currentCard.mediaType === "IMAGE" ? (
                                          <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                            [Image]
                                          </div>
                                        ) : null}
                                        {currentCard.mediaType === "VIDEO" && cardMediaPreview ? (
                                          <video
                                            src={cardMediaPreview}
                                            controls
                                            className="w-full max-h-40 object-cover rounded mb-2 bg-black"
                                          />
                                        ) : currentCard.mediaType === "VIDEO" && !cardMediaPreview ? (
                                          <div className="w-full min-h-[140px] rounded-lg bg-gray-200 flex items-center justify-center text-sm text-sky-500 mb-2">
                                            [Video]
                                          </div>
                                        ) : null}
                                        {currentCard.bodyText && (
                                          <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                                            {currentCard.bodyText}
                                          </p>
                                        )}
                                        {Array.isArray(currentCard.buttons) && currentCard.buttons.length > 0 && (
                                          <div className="space-y-1">
                                            {currentCard.buttons.map((button: any, index: number) => (
                                              <button
                                                key={index}
                                                type="button"
                                                className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-700"
                                              >
                                                {button.text || `Button ${index + 1}`}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              
                              {/* Footer */}
                              {!isMediaCarousel && selectedTemplate.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                                <p className="text-xs text-[#667781] text-center mt-2 pt-2 border-t border-[#667781]/20">
                                  {selectedTemplate.components.find((c: any) => c.type === 'FOOTER').text}
                                </p>
                              )}
                              
                              {/* Buttons (template-level; carousel uses per-card buttons above) */}
                              {!isMediaCarousel && selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS') && (() => {
                                const buttonsComponent = selectedTemplate.components.find((c: any) => c.type === 'BUTTONS');
                                const buttons = buttonsComponent?.buttons || [];
                                
                                if (buttons.length === 0) return null;
                                
                                return (
                                  <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                                    {buttons.map((button: any, index: number) => {
                                      if (button.type === 'QUICK_REPLY') {
                                        return (
                                          <button key={index} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                            {button.text || `Quick Reply ${index + 1}`}
                                          </button>
                                        );
                                      } else if (button.type === 'URL') {
                                        return (
                                          <button key={index} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                            <Link2 className="h-4 w-4" />
                                            {button.text || `Button ${index + 1}`}
                                          </button>
                                        );
                                      } else if (button.type === 'PHONE_NUMBER') {
                                        return (
                                          <button key={index} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                            <Phone className="h-4 w-4" />
                                            {button.text || `Button ${index + 1}`}
                                          </button>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                );
                              })()}
                              
                              {/* Timestamp and read receipt */}
                              <div className="flex justify-end mt-2">
                                <span className="text-xs text-[#667781]">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                <svg className="w-4 h-4 ml-1 text-[#53bdeb]" fill="currentColor" viewBox="0 0 16 15">
                                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                                </svg>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex-shrink-0">
                            This is a preview. Actual messages will use contact-specific data for dynamic fields.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Select a template to see preview</p>
                      )}
                    </div>

                    <div className="border rounded-lg p-4 flex-shrink-0">
                      <Label className="text-sm font-medium mb-2 block">Campaign Summary</Label>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recipients:</span>
                          <span className="font-medium">{totalRecipients}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">From Contacts:</span>
                          <span className="font-medium">{selectedContacts.size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Manual Numbers:</span>
                          <span className="font-medium">{manualNumbersArray.length}</span>
                        </div>
                        {scheduleBroadcast && scheduleDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Scheduled:</span>
                            <span className="font-medium">
                              {format(scheduleDate, "PPP")} {scheduleTime && `at ${scheduleTime}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground text-left w-full sm:w-auto order-2 sm:order-1">
                    {!campaignNameValue?.trim()
                      ? "Enter a campaign name"
                      : totalRecipients < 1
                        ? "Select at least one recipient"
                        : !selectedPhoneNumberId
                          ? "Select a WhatsApp Business number"
                          : !selectedTemplateId
                            ? "Select an approved template"
                            : needsCarouselMedia && !hasCarouselMediaReady
                              ? "Select media for all carousel cards"
                            : needsHeaderMedia && !hasHeaderMediaReady
                              ? "Upload template header media"
                              : "Ready to create"}
                  </p>
                  <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!canCreateCampaign}>
                      <Send className="w-4 h-4 mr-2" />
                      {createMutation.isPending ? "Creating..." : "Create Campaign"}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Gallery Dialog */}
        <Dialog open={galleryDialogOpen} onOpenChange={(open) => {
          setGalleryDialogOpen(open);
          if (!open) setGalleryCarouselCardIndex(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileIcon className="w-5 h-5" />
                Select File
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={galleryViewMode} onValueChange={(v) => setGalleryViewMode(v as "gallery" | "url")}>
              <TabsList>
                <TabsTrigger value="gallery">My Gallery</TabsTrigger>
                <TabsTrigger value="url">Enter URL</TabsTrigger>
              </TabsList>
              
              <TabsContent value="gallery" className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={gallerySelectedType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGallerySelectedType("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={gallerySelectedType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGallerySelectedType("image")}
                  >
                    <ImageIcon className="w-4 h-4 mr-1" />
                    Images
                  </Button>
                  <Button
                    variant={gallerySelectedType === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGallerySelectedType("video")}
                  >
                    <Video className="w-4 h-4 mr-1" />
                    Videos
                  </Button>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                  {galleryItems.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg overflow-hidden cursor-pointer hover:border-primary"
                      onClick={() => {
                        if (selectGalleryItemForCarousel(item.url, item.type)) return;
                        uploadHeaderMediaFromUrl(item.url, item.type);
                        setGalleryDialogOpen(false);
                      }}
                    >
                      {item.type === 'video' ? (
                        <div className="relative w-full h-32 bg-muted flex items-center justify-center">
                          <video src={item.url} className="w-full h-32 object-cover" muted />
                          <Play className="absolute w-8 h-8 text-white drop-shadow" />
                        </div>
                      ) : item.type === 'image' ? (
                        <img src={resolveGalleryMediaUrl(item.url)} alt={item.name} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-muted flex items-center justify-center">
                          <FileIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs truncate">{item.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="url" className="space-y-4">
                <div>
                  <Label>{isVideoHeader ? "Video URL" : "Image URL"}</Label>
                  <Input
                    placeholder={isVideoHeader ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    disabled={uploadMediaMutation.isPending}
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!imageUrlInput) return;
                    if (selectGalleryItemForCarousel(imageUrlInput)) return;
                    uploadHeaderMediaFromUrl(imageUrlInput);
                    setGalleryDialogOpen(false);
                  }}
                  disabled={!imageUrlInput || uploadMediaMutation.isPending}
                >
                  {uploadMediaMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Use URL'
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn(skin && "campaigns-stat-card")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages Sent</CardTitle>
            <Send className={cn("h-4 w-4", skin ? "campaigns-stat-icon" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sent">{totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card className={cn(skin && "campaigns-stat-card")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className={cn("h-4 w-4", skin ? "campaigns-stat-icon" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-delivery-rate">
              {totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalDelivered.toLocaleString()} delivered</p>
          </CardContent>
        </Card>
        <Card className={cn(skin && "campaigns-stat-card")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
            <MessageSquare className={cn("h-4 w-4", skin ? "campaigns-stat-icon" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-read-rate">
              {totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalRead.toLocaleString()} read</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-campaigns"
            placeholder="Search Campaigns..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className={cn(
              "pl-10",
              skin && "rounded-xl border-[#e5e7eb] bg-white shadow-sm focus-visible:ring-[var(--rh-brand)]",
            )}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setCreateDialogOpen(true)}
          className={cn(
            skin &&
              "border-[var(--rh-brand)] text-[var(--rh-brand)] hover:bg-[var(--rh-brand-soft)] hover:text-[var(--rh-brand)]",
          )}
        >
          <Plus className="w-4 h-4 mr-2" />
          Manual fill
        </Button>
      </div>

      {isLoading ? (
        <Card className={cn(skin && "campaigns-table-card")}>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div
                  className={cn(
                    "w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto",
                    skin ? "border-[var(--rh-brand)]" : "border-primary",
                  )}
                />
                <p className="text-muted-foreground">Loading campaigns...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : totalCampaigns === 0 ? (
        <Card className={cn(skin && "campaigns-table-card")}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No campaigns found</p>
            <p className="text-muted-foreground mt-1">
              {searchQuery ? "Try a different search query" : "Create your first campaign to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className={cn(skin && "campaigns-table-card")}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Contacts</TableHead>
                  <TableHead>Scheduled Time</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCampaigns.map((campaign) => {
                  const statusDisplay = getStatusDisplay(campaign.status);
                  const totalRecipients = campaign.totalRecipients || 0;
                  
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        <Link 
                          href={`/campaigns/${campaign.id}`}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {campaign.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={`${statusDisplay.color} text-white border-0`}
                        >
                          {statusDisplay.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{totalRecipients}</TableCell>
                      <TableCell>
                        {campaign.scheduledAt ? formatDateDisplay(campaign.scheduledAt) : '-'}
                      </TableCell>
                      <TableCell>{formatDateDisplay(campaign.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setLocation(`/campaigns/${campaign.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Report
                            </DropdownMenuItem>
                            {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'failed') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm(`Are you sure you want to execute campaign "${campaign.name}"?`)) {
                                    executeMutation.mutate(campaign.id);
                                  }
                                }}
                                disabled={executeMutation.isPending}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Execute Now
                              </DropdownMenuItem>
                            )}
                            {(campaign.status === 'running' || campaign.status === 'scheduled') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCampaign(campaign);
                                  setCancelDialogOpen(true);
                                }}
                                disabled={cancelMutation.isPending}
                                className="text-destructive"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Campaign
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          
          <ListPaginationFooter
            total={totalCampaigns}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            className="p-4 border-t"
          />
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-campaign">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="messageTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message Template</FormLabel>
                    <FormControl>
                      <Textarea data-testid="input-edit-message" rows={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" data-testid="button-submit-edit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-campaign">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCampaign?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent data-testid="dialog-cancel-campaign">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel "{selectedCampaign?.name}"? This will stop the campaign from sending any remaining messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancel">No, Keep Running</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-cancel"
              onClick={() => selectedCampaign && cancelMutation.mutate(selectedCampaign.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
        <DialogContent className="max-w-4xl" data-testid="dialog-campaign-analytics">
          <DialogHeader>
            <DialogTitle>Campaign Analytics - {selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card data-testid="card-metric-sent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-metric-sent">{selectedCampaign?.sentCount || 0}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-metric-delivered">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-metric-delivered">{selectedCampaign?.deliveredCount || 0}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-metric-read">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Read</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold" data-testid="text-metric-read">{selectedCampaign?.readCount || 0}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-metric-failed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-metric-failed">{selectedCampaign?.failedCount || 0}</p>
                </CardContent>
              </Card>
            </div>

            <div className="border rounded-lg">
              <div className="p-4 border-b">
                <h3 className="font-medium">Recipients</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {recipients.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recipients yet</p>
                ) : (
                  <div className="divide-y">
                    {recipients.map((recipient) => (
                      <div key={recipient.id} className="p-4 flex items-center justify-between" data-testid={`row-recipient-${recipient.id}`}>
                        <div>
                          <p className="font-medium">{recipient.name || recipient.phoneNumber}</p>
                          <p className="text-sm text-muted-foreground">{recipient.phoneNumber}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={recipient.status === "delivered" ? "default" : recipient.status === "failed" ? "destructive" : "secondary"} data-testid={`badge-recipient-status-${recipient.id}`}>
                            {recipient.status}
                          </Badge>
                          {recipient.readAt && (
                            <span className="text-xs text-muted-foreground">
                              Read {new Date(recipient.readAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
