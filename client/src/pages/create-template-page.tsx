// @ts-nocheck
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadGalleryFiles } from "@/lib/upload-gallery-files";
import { Loader2, FileText, Wrench, Megaphone, Video, MapPin, Bold, Italic, Strikethrough, Code, AlertCircle, Shield, Image as ImageIcon, FileText as FileTextIcon, ArrowLeft, Lock, Clock, Copy, Info, Trash2, Phone, Link as LinkIcon, Plus, Search, X, ChevronLeft, ChevronRight, MessageSquare, Globe, Link2, File as FileIcon, Music, Mic } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TemplateInteractiveActions, type QuickReply, type URLButton, type PhoneButton, type ProductCard, type MediaCard } from "@/components/template-interactive-actions";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { cn } from "@/lib/utils";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(512),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().min(1, "Language code is required").default('en'),
  templateType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).default('TEXT'),
  headerText: z.string().max(60).optional(),
  bodyText: z.string().max(1024).optional(),
  footerText: z.string().max(64).optional(),
  interactiveAction: z.enum(['NONE', 'CALL_TO_ACTION', 'QUICK_REPLY', 'ALL', 'PRODUCT_CARD_CAROUSEL', 'MEDIA_CARD_CAROUSEL', 'FORM']).default('NONE'),
  buttonType: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'NONE']).optional(),
  buttonText: z.string().max(25).optional(),
  buttonUrl: z.string().optional(),
  buttonPhone: z.string().optional(),
  templateTypeMeta: z.enum(['official', 'unofficial']),
  // Authentication specific fields
  addSecurityRecommendation: z.boolean().default(true),
  addExpiryTime: z.boolean().default(false),
  expiryTimeMinutes: z.number().min(1).max(90).optional(),
  authButtonText: z.string().default('Copy Code').optional(),
  // Image/Video/Document specific fields
  mediaUrl: z.union([z.string().url(), z.literal('')]).optional(),
  mediaFile: z.instanceof(File).optional(),
  // Sample values for variables
  sampleValues: z.record(z.string(), z.string()).optional(),
});

function ProductCarouselPreview({
  productCards,
  selectedIndex,
  mutedTextClass = "text-gray-600",
  panelClass = "bg-gray-50",
}: {
  productCards: ProductCard[];
  selectedIndex: number;
  mutedTextClass?: string;
  panelClass?: string;
}) {
  const card = productCards[selectedIndex];
  if (!card) return null;
  const btnType = productCards[0]?.buttonType || "spm";
  return (
    <div className={`border rounded-lg p-4 ${panelClass}`}>
      <p className={`text-xs ${mutedTextClass} mb-2`}>
        Product Card Carousel ({productCards.length} card{productCards.length > 1 ? "s" : ""})
        {productCards.length > 1 ? ` · ${selectedIndex + 1}/${productCards.length}` : ""}
      </p>
      <div className="border-2 border-dashed rounded p-4 text-center bg-white/60">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-xs font-medium text-gray-700">
          {card.productName || card.productRetailerId || "Select a catalog product"}
        </p>
        {card.productRetailerId ? (
          <p className="text-[10px] text-gray-500 mt-1">ID: {card.productRetailerId}</p>
        ) : null}
      </div>
      <button type="button" className="w-full mt-2 px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-sm font-medium transition-colors">
        {card.buttonLabel || "View"}
        {btnType === "url" ? " ↗" : ""}
      </button>
    </div>
  );
}

export default function CreateTemplatePage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const skin = useRatehonkPageSkin();
  const brandToggleOn = skin
    ? "data-[state=on]:bg-[var(--rh-brand)] data-[state=on]:text-white"
    : "data-[state=on]:bg-orange-500 data-[state=on]:text-white";
  const brandCheckboxOn = skin
    ? "data-[state=checked]:bg-[var(--rh-brand)] data-[state=checked]:border-[var(--rh-brand)]"
    : "data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500";
  const brandSoftBtn = skin
    ? "bg-[var(--rh-brand-light)] border-[var(--rh-brand)]/20 text-[var(--rh-brand)] hover:bg-[var(--rh-brand-soft)]"
    : "bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20";
  const brandPrimaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "bg-orange-500 hover:bg-orange-600";
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Get phoneNumberId from URL query params if available
  const urlParams = new URLSearchParams(window.location.search);
  const phoneNumberIdFromUrl = urlParams.get('phoneNumberId');
  
  // State for interactive actions
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [urlButtons, setUrlButtons] = useState<URLButton[]>([]);
  const [phoneButtons, setPhoneButtons] = useState<PhoneButton[]>([]);
  const [productCards, setProductCards] = useState<ProductCard[]>([]);
  const [metaCatalogIdForTemplate, setMetaCatalogIdForTemplate] = useState("");
  const [mediaCards, setMediaCards] = useState<MediaCard[]>([]);
  const [selectedProductCardIndex, setSelectedProductCardIndex] = useState(0);
  const [selectedMediaCardIndex, setSelectedMediaCardIndex] = useState(0);
  const [formButtonText, setFormButtonText] = useState('View');
  const [selectedFlow, setSelectedFlow] = useState<{ id: string; name: string; flowId: string } | null>(null);
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [activeButtonTab, setActiveButtonTab] = useState<'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'>('QUICK_REPLY');
  
  // Gallery dialog state
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState<"gallery" | "url">("gallery");
  const [galleryFileType, setGalleryFileType] = useState<"all" | "image" | "video" | "audio" | "document">("image");
  const [galleryUrlInput, setGalleryUrlInput] = useState<string>("");
  /** When set, gallery selection applies to this media card instead of template header */
  const [gallerySelectionContext, setGallerySelectionContext] = useState<{ type: 'media_card'; cardId: string } | null>(null);

  // Check if user has connected Meta Business API sessions
  const { data: sessions = [] } = useQuery<Array<{ sessionId: string; connectionType: string; status: string; deviceInfo?: any }>>({
    queryKey: ['/api/sessions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/sessions');
      return await res.json();
    },
  });

  // Get connected phone numbers for official sessions
  const { data: phoneNumbersData } = useQuery<{ success: boolean; phoneNumbers: Array<{ phoneNumberId?: string; displayPhoneNumber?: string; verifiedName?: string }> }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      return await res.json();
    },
  });

  // Check if user has any connected official sessions
  const hasOfficialSession = sessions.some(s => s.connectionType === 'official' && s.status === 'connected');
  const officialSessions = sessions.filter(s => s.connectionType === 'official' && s.status === 'connected');
  const hasMultipleOfficialSessions = officialSessions.length > 1;

  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>(phoneNumberIdFromUrl || '');

  const { data: commerceSettingsForTemplate } = useQuery<{ metaCatalogId?: string | null }>({
    queryKey: ["/api/commerce/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/commerce/settings");
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (commerceSettingsForTemplate?.metaCatalogId && !metaCatalogIdForTemplate) {
      setMetaCatalogIdForTemplate(commerceSettingsForTemplate.metaCatalogId);
    }
  }, [commerceSettingsForTemplate?.metaCatalogId]);

  const catalogSessionIdForTemplate = useMemo(() => {
    const pid = selectedPhoneNumberId || phoneNumberIdFromUrl;
    if (pid) {
      const match = sessions.find(
        (s) =>
          s.connectionType === "official" &&
          (s.deviceInfo as { apiPhoneNumberId?: string })?.apiPhoneNumberId === pid
      );
      if (match?.sessionId) return match.sessionId;
    }
    const first = sessions.find((s) => s.connectionType === "official" && s.status === "connected");
    return first?.sessionId || "";
  }, [sessions, selectedPhoneNumberId, phoneNumberIdFromUrl]);
  const defaultTemplateType = hasOfficialSession ? 'official' : 'unofficial';

  // Set default phone number when phoneNumbersData loads and no selection yet
  useEffect(() => {
    if (phoneNumbersData?.phoneNumbers && !selectedPhoneNumberId && !phoneNumberIdFromUrl) {
      const firstPhone = phoneNumbersData.phoneNumbers.find(p => p.phoneNumberId);
      if (firstPhone?.phoneNumberId && hasMultipleOfficialSessions) {
        setSelectedPhoneNumberId(firstPhone.phoneNumberId);
      }
    }
  }, [phoneNumbersData, selectedPhoneNumberId, phoneNumberIdFromUrl, hasMultipleOfficialSessions]);

  const createForm = useForm({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: "",
      category: 'UTILITY' as const,
      language: "en",
      templateType: 'TEXT' as const,
      headerText: "",
      bodyText: "",
      footerText: "",
      interactiveAction: 'NONE' as const,
      buttonType: 'NONE' as const,
      buttonText: "",
      buttonUrl: "",
      buttonPhone: "",
      templateTypeMeta: defaultTemplateType as 'official' | 'unofficial',
      addSecurityRecommendation: true,
      addExpiryTime: false,
      expiryTimeMinutes: 10,
      authButtonText: 'Copy Code',
      mediaUrl: '',
      mediaFile: undefined,
      sampleValues: {},
    },
  });

  // Prefill from Dummy Template "Submit" or Duplicate action (sessionStorage draft)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromDummy = params.get("fromDummy") === "1";
    const fromDuplicate = params.get("fromDuplicate") === "1";
    if (!fromDummy && !fromDuplicate) return;
    const raw = sessionStorage.getItem("dummyTemplateDraft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        name?: string;
        templateType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
        bodyText?: string;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        language?: string;
        sampleValues?: Record<string, string>;
        headerText?: string;
        footerText?: string;
        mediaUrl?: string;
        interactiveAction?:
          | "NONE"
          | "CALL_TO_ACTION"
          | "QUICK_REPLY"
          | "ALL"
          | "PRODUCT_CARD_CAROUSEL"
          | "MEDIA_CARD_CAROUSEL"
          | "FORM";
        quickReplies?: Array<{ id: string; text: string }>;
        urlButtons?: Array<{ id: string; text: string; url: string; urlType: "STATIC" | "DYNAMIC" }>;
        phoneButtons?: Array<{ id: string; text: string; phoneNumber: string; countryCode: string }>;
        productCards?: Array<any>;
        mediaCards?: Array<any>;
        formButtonText?: string;
        selectedFlow?: { id: string; name: string; flowId: string } | null;
        metaCatalogId?: string;
      };
      sessionStorage.removeItem("dummyTemplateDraft");
      if (draft.name) createForm.setValue("name", draft.name);
      if (draft.templateType) createForm.setValue("templateType", draft.templateType);
      if (draft.bodyText) createForm.setValue("bodyText", draft.bodyText);
      if (draft.category) createForm.setValue("category", draft.category);
      if (draft.language) createForm.setValue("language", draft.language);
      if (draft.sampleValues) createForm.setValue("sampleValues", draft.sampleValues);
      if (draft.headerText) createForm.setValue("headerText", draft.headerText);
      if (draft.footerText) createForm.setValue("footerText", draft.footerText);
      if (draft.mediaUrl) createForm.setValue("mediaUrl", draft.mediaUrl);
      if (draft.interactiveAction) {
        createForm.setValue("interactiveAction", draft.interactiveAction);
      }
      if (draft.quickReplies?.length) setQuickReplies(draft.quickReplies);
      if (draft.urlButtons?.length) setUrlButtons(draft.urlButtons);
      if (draft.phoneButtons?.length) setPhoneButtons(draft.phoneButtons);
      if (draft.productCards?.length) setProductCards(draft.productCards);
      if (draft.mediaCards?.length) setMediaCards(draft.mediaCards);
      if (draft.formButtonText) setFormButtonText(draft.formButtonText);
      if (draft.selectedFlow) setSelectedFlow(draft.selectedFlow);
      if (draft.metaCatalogId) setMetaCatalogIdForTemplate(draft.metaCatalogId);
      toast({
        title: fromDuplicate ? "Template duplicated" : "Template prefilled",
        description: "Review the fields and edit anything before submitting.",
      });
    } catch {
      sessionStorage.removeItem("dummyTemplateDraft");
    }
    params.delete("fromDummy");
    params.delete("fromDuplicate");
    const next = params.toString();
    window.history.replaceState(
      null,
      "",
      next ? `/templates/create?${next}` : "/templates/create",
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update template type when sessions load or phoneNumberId is provided
  useEffect(() => {
    // If phoneNumberId is provided from URL, force official template
    if (phoneNumberIdFromUrl) {
      createForm.setValue('templateTypeMeta', 'official');
      setSelectedPhoneNumberId(phoneNumberIdFromUrl);
    } else if (hasOfficialSession && createForm.getValues('templateTypeMeta') === 'unofficial') {
      createForm.setValue('templateTypeMeta', 'official');
    }
  }, [hasOfficialSession, phoneNumberIdFromUrl, createForm]);

  // Set default phone number when phone numbers load and multiple sessions exist
  useEffect(() => {
    if (phoneNumbersData?.phoneNumbers && hasMultipleOfficialSessions && !selectedPhoneNumberId && !phoneNumberIdFromUrl) {
      const firstPhone = phoneNumbersData.phoneNumbers.find(p => p.phoneNumberId);
      if (firstPhone?.phoneNumberId) {
        setSelectedPhoneNumberId(firstPhone.phoneNumberId);
      }
    }
  }, [phoneNumbersData, hasMultipleOfficialSessions, selectedPhoneNumberId, phoneNumberIdFromUrl]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createTemplateSchema>) => {
      // Map the new schema to the API expected format
      // For authentication templates, generate body text based on checkboxes
      let bodyText = data.bodyText;
      if (data.category === 'AUTHENTICATION') {
        bodyText = `{{1}} is your verification code.`;
        if (data.addSecurityRecommendation) {
          bodyText += ' For your security, do not share this code.';
        }
        if (data.addExpiryTime && data.expiryTimeMinutes) {
          bodyText += ` This code will expire in ${data.expiryTimeMinutes} minutes.`;
        }
      } else {
        // For non-authentication templates, bodyText is required
        if (!bodyText || bodyText.trim().length === 0) {
          throw new Error('Body text is required');
        }
      }
      
      const isAuthenticationTemplate = data.category === 'AUTHENTICATION';
      const apiData: any = {
        name: data.name,
        category: data.category,
        language: data.language,
        headerText: data.headerText,
        // For AUTHENTICATION templates, backend builds auth-specific BODY payload; avoid sending normal BODY text intent.
        bodyText: isAuthenticationTemplate ? '' : (bodyText || ''),
        footerText: data.footerText,
        interactiveAction: isAuthenticationTemplate ? 'NONE' : data.interactiveAction,
        templateType: data.templateTypeMeta, // Map templateTypeMeta to templateType for API
      };

      // Add interactive action data
      if (!isAuthenticationTemplate && (data.interactiveAction === 'QUICK_REPLY' || data.interactiveAction === 'ALL' || data.interactiveAction === 'CALL_TO_ACTION')) {
        apiData.orderedButtons = [
          ...urlButtons.filter((btn) => btn.text && btn.url).map((btn) => ({
            type: "URL",
            text: btn.text,
            url: btn.url,
            urlType: btn.urlType,
          })),
          ...phoneButtons.filter((btn) => btn.text && btn.phoneNumber).map((btn) => ({
            type: "PHONE_NUMBER",
            text: btn.text,
            phoneNumber: `${btn.countryCode}${btn.phoneNumber}`,
          })),
          ...quickReplies.filter((qr) => qr.text).map((qr) => ({
            type: "QUICK_REPLY",
            text: qr.text,
          })),
        ];
      }
      if (!isAuthenticationTemplate && data.interactiveAction === 'PRODUCT_CARD_CAROUSEL') {
        apiData.catalogId = metaCatalogIdForTemplate.trim() || undefined;
        apiData.productCards = productCards.map((card) => ({
          buttonLabel: card.buttonLabel,
          productRetailerId: card.productRetailerId,
          buttonType: card.buttonType || "spm",
          url: card.url,
          urlExample: card.urlExample,
        }));
      }
      if (!isAuthenticationTemplate && data.interactiveAction === 'MEDIA_CARD_CAROUSEL') {
        apiData.mediaCards = mediaCards.map(card => ({
          mediaType: card.mediaType,
          mediaUrl: card.mediaUrl,
          bodyText: card.bodyText,
          buttons: card.buttons.filter(btn => btn.text).map(btn => ({
            type: btn.type,
            text: btn.text,
            ...(btn.type === 'URL' && btn.url ? { url: btn.url } : {}),
            ...(btn.type === 'PHONE_NUMBER' && btn.phoneNumber ? { phoneNumber: `${btn.countryCode || '+1'}${btn.phoneNumber}` } : {}),
          })),
        }));
      }
      if (!isAuthenticationTemplate && data.interactiveAction === 'FORM') {
        apiData.formButtonText = formButtonText;
        if (selectedFlow) {
          apiData.flowId = selectedFlow.flowId;
          apiData.internalFlowId = selectedFlow.id;
          apiData.flowName = selectedFlow.name;
        }
      }

      // Authentication templates are OTP-only; avoid legacy generic button payload.
      if (isAuthenticationTemplate) {
        apiData.authButtonText = data.authButtonText || 'Copy Code';
        apiData.addSecurityRecommendation = !!data.addSecurityRecommendation;
        if (data.addExpiryTime && data.expiryTimeMinutes) {
          apiData.codeExpirationMinutes = Number(data.expiryTimeMinutes);
        }
      } else if (data.interactiveAction === 'NONE') {
        // Legacy button support
        apiData.buttonType = data.buttonType || 'NONE';
        apiData.buttonText = data.buttonText;
        apiData.buttonUrl = data.buttonUrl;
        apiData.buttonPhone = data.buttonPhone;
      }
      
      // Add phoneNumberId - prioritize URL param, then selected phone number
      // If multiple official sessions exist and template is official, phoneNumberId is required
      if (phoneNumberIdFromUrl) {
        apiData.phoneNumberId = phoneNumberIdFromUrl;
      } else if (selectedPhoneNumberId) {
        apiData.phoneNumberId = selectedPhoneNumberId;
      } else if (hasMultipleOfficialSessions && data.templateTypeMeta === 'official') {
        // If multiple sessions exist and none selected, API will return error with available numbers
        // We should validate on client side too
        const firstPhone = phoneNumbersData?.phoneNumbers?.find(p => p.phoneNumberId);
        if (firstPhone?.phoneNumberId) {
          apiData.phoneNumberId = firstPhone.phoneNumberId;
        } else {
          throw new Error('Please select a phone number. Multiple WhatsApp Business numbers are connected.');
        }
      }
      
      // Add sample values for variables if provided
      if (data.sampleValues && Object.keys(data.sampleValues).length > 0) {
        apiData.sampleValues = data.sampleValues;
      }
      
      // Add media URL for Image/Video/Document templates
      const isMediaTemplate = data.templateType === 'IMAGE' || data.templateType === 'VIDEO' || data.templateType === 'DOCUMENT';
      if (isMediaTemplate && data.mediaUrl) {
        apiData.mediaUrl = data.mediaUrl;
        apiData.templateType = data.templateType; // Pass the actual template type (IMAGE, VIDEO, DOCUMENT)
      }
      
      return apiRequest('POST', '/api/templates', apiData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      createForm.reset();
      toast({
        title: "Template created",
        description: variables.templateTypeMeta === 'official' 
          ? "Template submitted to Meta for approval."
          : "Template created successfully.",
      });
      setLocation('/templates');
    },
    onError: (error: Error) => {
      const msg =
        error.message ||
        "Failed to create template. Please ensure a phone number is selected if multiple numbers are connected.";
      const isMetaNameLanguageLock =
        /still removing a previous template/i.test(msg) ||
        /can't be added while the existing/i.test(msg) ||
        /cannot be added while the existing/i.test(msg) ||
        /Language is Being Deleted/i.test(msg);
      toast({
        title: isMetaNameLanguageLock
          ? "WhatsApp: name + language temporarily locked"
          : "Creation failed",
        description: (
          <span className="block max-h-64 overflow-y-auto whitespace-pre-wrap text-left text-sm">
            {msg}
          </span>
        ),
        variant: "destructive",
        ...(isMetaNameLanguageLock ? { duration: 60_000 } : {}),
      });
    },
  });

  // Helper function to extract variables from body text (e.g., {{1}}, {{2}}, etc.)
  const extractVariables = (text: string): number[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const numbers = matches.map(m => parseInt(m.replace(/[{}]/g, '')));
    return [...new Set(numbers)].sort((a, b) => a - b);
  };
  
  // Helper function to render body text with sample values
  const renderBodyWithSampleValues = (text: string, sampleValues?: Record<string, string>): string => {
    if (!sampleValues || Object.keys(sampleValues).length === 0) {
      return text;
    }
    let rendered = text;
    Object.entries(sampleValues).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value || `{{${key}}}`);
    });
    return rendered;
  };

  // Watch form data - must be defined before useQuery hooks that use it
  const data = createForm.watch();

  // Get gallery media items
  const { data: galleryItems = [] } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ['/api/gallery', galleryFileType],
    queryFn: async () => {
      const url = galleryFileType === 'all' 
        ? '/api/gallery?type=all'
        : `/api/gallery?type=${galleryFileType}`;
      const res = await apiRequest('GET', url);
      return await res.json();
    },
    enabled: galleryDialogOpen,
  });
  const selectedCategory = data.category;
  const selectedTemplateType = data.templateType;
  const isAuthentication = selectedCategory === 'AUTHENTICATION';
  const isImageType = selectedTemplateType === 'IMAGE';
  const isVideoType = selectedTemplateType === 'VIDEO';
  const isDocumentType = selectedTemplateType === 'DOCUMENT';
  const isMediaType = isImageType || isVideoType || isDocumentType;
  const interactiveAction = data.interactiveAction;

  // Media Card Carousel is only supported with TEXT template type.
  // If users select the carousel while another type is active (or switch away later),
  // force the template type back to TEXT to keep the form consistent.
  useEffect(() => {
    if (interactiveAction === 'MEDIA_CARD_CAROUSEL' && selectedTemplateType !== 'TEXT') {
      createForm.setValue('templateType', 'TEXT');
    }
  }, [interactiveAction, selectedTemplateType, createForm]);
  
  const onSubmit = createForm.handleSubmit(
    (data) => {
      console.log('Form submitted with data:', data);
      createMutation.mutate(data);
    },
    (errors) => {
      console.error('Form validation errors:', errors);
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
    }
  );

  return (
    <div>
      <div className="max-w-[95%] mx-auto w-full p-6 pb-12">
          {/* Header */}
          <div className="mb-6 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setLocation('/templates')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
            <h1 className="text-3xl font-semibold">Create</h1>
          </div>

          <Form {...createForm}>
            <form onSubmit={onSubmit} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
              {/* Left Panel - Form */}
              <div className="space-y-6 min-w-0">
              {/* Template Language */}
              <FormField
                control={createForm.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template language" />
                        </SelectTrigger>
                      </FormControl>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="en_GB">English (UK)</SelectItem>
                                <SelectItem value="en_US">English (US)</SelectItem>
                                <SelectItem value="hi">Hindi</SelectItem>
                                <SelectItem value="af">Afrikaans</SelectItem>
                                <SelectItem value="sq">Albanian</SelectItem>
                                <SelectItem value="ar">Arabic</SelectItem>
                                <SelectItem value="az">Azerbaijani</SelectItem>
                                <SelectItem value="bn">Bengali</SelectItem>
                                <SelectItem value="bg">Bulgarian</SelectItem>
                                <SelectItem value="ca">Catalan</SelectItem>
                                <SelectItem value="zh_CN">Chinese (CHN)</SelectItem>
                                <SelectItem value="zh_HK">Chinese (HKG)</SelectItem>
                                <SelectItem value="zh_TW">Chinese (TAI)</SelectItem>
                                <SelectItem value="hr">Croatian</SelectItem>
                                <SelectItem value="cs">Czech</SelectItem>
                                <SelectItem value="da">Danish</SelectItem>
                                <SelectItem value="nl">Dutch</SelectItem>
                                <SelectItem value="et">Estonian</SelectItem>
                                <SelectItem value="fil">Filipino</SelectItem>
                                <SelectItem value="fi">Finnish</SelectItem>
                                <SelectItem value="fr">French</SelectItem>
                                <SelectItem value="ka">Georgian</SelectItem>
                                <SelectItem value="de">German</SelectItem>
                                <SelectItem value="el">Greek</SelectItem>
                                <SelectItem value="gu">Gujarati</SelectItem>
                                <SelectItem value="ha">Hausa</SelectItem>
                                <SelectItem value="he">Hebrew</SelectItem>
                                <SelectItem value="hu">Hungarian</SelectItem>
                                <SelectItem value="id">Indonesian</SelectItem>
                                <SelectItem value="ga">Irish</SelectItem>
                                <SelectItem value="it">Italian</SelectItem>
                                <SelectItem value="ja">Japanese</SelectItem>
                                <SelectItem value="kn">Kannada</SelectItem>
                                <SelectItem value="kk">Kazakh</SelectItem>
                                <SelectItem value="rw_RW">Kinyarwanda</SelectItem>
                                <SelectItem value="ko">Korean</SelectItem>
                                <SelectItem value="ky_KG">Kyrgyz (Kyrgyzstan)</SelectItem>
                                <SelectItem value="lo">Lao</SelectItem>
                                <SelectItem value="lv">Latvian</SelectItem>
                                <SelectItem value="lt">Lithuanian</SelectItem>
                                <SelectItem value="mk">Macedonian</SelectItem>
                                <SelectItem value="ms">Malay</SelectItem>
                                <SelectItem value="ml">Malayalam</SelectItem>
                                <SelectItem value="mr">Marathi</SelectItem>
                                <SelectItem value="nb">Norwegian</SelectItem>
                                <SelectItem value="fa">Persian</SelectItem>
                                <SelectItem value="pl">Polish</SelectItem>
                                <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                                <SelectItem value="pt_PT">Portuguese (POR)</SelectItem>
                                <SelectItem value="pa">Punjabi</SelectItem>
                                <SelectItem value="ro">Romanian</SelectItem>
                                <SelectItem value="ru">Russian</SelectItem>
                                <SelectItem value="sr">Serbian</SelectItem>
                                <SelectItem value="sk">Slovak</SelectItem>
                                <SelectItem value="sl">Slovenian</SelectItem>
                                <SelectItem value="es">Spanish</SelectItem>
                                <SelectItem value="es_AR">Spanish (ARG)</SelectItem>
                                <SelectItem value="es_ES">Spanish (SPA)</SelectItem>
                                <SelectItem value="es_MX">Spanish (MEX)</SelectItem>
                                <SelectItem value="sw">Swahili</SelectItem>
                                <SelectItem value="sv">Swedish</SelectItem>
                                <SelectItem value="ta">Tamil</SelectItem>
                                <SelectItem value="te">Telugu</SelectItem>
                                <SelectItem value="th">Thai</SelectItem>
                                <SelectItem value="tr">Turkish</SelectItem>
                                <SelectItem value="uk">Ukrainian</SelectItem>
                                <SelectItem value="ur">Urdu</SelectItem>
                                <SelectItem value="uz">Uzbek</SelectItem>
                                <SelectItem value="vi">Vietnamese</SelectItem>
                                <SelectItem value="zu">Zulu</SelectItem>
                              </SelectContent>
                    </Select>
                    <FormDescription>Specify the language for the message template.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Template Category */}
              <FormField
                control={createForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Category</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value) => value && field.onChange(value as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')}
                        className="justify-start"
                      >
                        <ToggleGroupItem value="UTILITY" aria-label="Utility" className={brandToggleOn}>
                          <Wrench className="h-4 w-4 mr-2" />
                          Utility
                        </ToggleGroupItem>
                        <ToggleGroupItem value="MARKETING" aria-label="Marketing" className={brandToggleOn}>
                          <Megaphone className="h-4 w-4 mr-2" />
                          Marketing
                        </ToggleGroupItem>
                        <ToggleGroupItem value="AUTHENTICATION" aria-label="Authentication" className={brandToggleOn}>
                          <Shield className="h-4 w-4 mr-2" />
                          Authentication
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormDescription>Your template should fall under one of these categories.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Template Name */}
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter template name" />
                    </FormControl>
                    <FormDescription>Name can only be in lowercase alphanumeric characters and underscores.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone Number Selector - Only show when multiple official sessions exist and template type is official */}
              {hasMultipleOfficialSessions && createForm.watch('templateTypeMeta') === 'official' && (
                <FormItem>
                  <FormLabel>Connected Phone Number</FormLabel>
                  <FormDescription className="mb-2">
                    Select which WhatsApp Business number should be used for creating this template.
                  </FormDescription>
                  <Select
                    value={selectedPhoneNumberId}
                    onValueChange={(value) => {
                      setSelectedPhoneNumberId(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbersData?.phoneNumbers
                        ?.filter(p => p.phoneNumberId)
                        .map((phone) => (
                          <SelectItem key={phone.phoneNumberId} value={phone.phoneNumberId!}>
                            {phone.verifiedName || phone.displayPhoneNumber || phone.phoneNumberId}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!selectedPhoneNumberId && (
                    <p className="text-sm text-destructive mt-1">
                      Please select a phone number to create an official template.
                    </p>
                  )}
                </FormItem>
              )}

              {/* Conditional Fields based on Category */}
              {isAuthentication ? (
                <>
                  {/* Content Section for Authentication */}
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormDescription className="mb-3">
                      Content for authentication message templates can't be edited. You can add additional content from the options below.
                    </FormDescription>
                    <div className="space-y-3">
                      <FormField
                        control={createForm.control}
                        name="addSecurityRecommendation"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className={brandCheckboxOn}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-2 cursor-pointer">
                                <Lock className="h-4 w-4" />
                                Add security recommendation
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="addExpiryTime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className={brandCheckboxOn}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none flex-1">
                              <FormLabel className="flex items-center gap-2 cursor-pointer">
                                <Clock className="h-4 w-4" />
                                Add expiry time for the code
                              </FormLabel>
                              {field.value && (
                                <div className="mt-3 flex items-center gap-2">
                                  <FormField
                                    control={createForm.control}
                                    name="expiryTimeMinutes"
                                    render={({ field: expiryField }) => (
                                      <FormItem className="flex items-center gap-2">
                                        <FormLabel className="text-sm">Expiry Time (1-90 minutes)</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...expiryField}
                                            type="number"
                                            min={1}
                                            max={90}
                                            className="w-20"
                                            onChange={(e) => expiryField.onChange(parseInt(e.target.value) || 10)}
                                            value={expiryField.value || 10}
                                          />
                                        </FormControl>
                                        <span className="text-sm text-muted-foreground">Minutes</span>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </FormItem>

                  {/* Button Text for Authentication */}
                  <FormField
                    control={createForm.control}
                    name="authButtonText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Button Text</FormLabel>
                        <FormDescription className="mb-2">
                          You can edit the button text for the authentication message template.
                        </FormDescription>
                        <FormControl>
                          <Input {...field} placeholder="Copy Code" maxLength={25} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  {/* Template Type */}
                  <FormField
                    control={createForm.control}
                    name="templateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Type</FormLabel>
                        <FormControl>
                          <ToggleGroup
                            type="single"
                            value={field.value}
                            onValueChange={(value) => value && field.onChange(value as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION')}
                            className="justify-start flex-wrap"
                          >
                            <ToggleGroupItem value="TEXT" aria-label="Text" className={brandToggleOn}>
                              <FileText className="h-4 w-4 mr-2" />
                              Text
                            </ToggleGroupItem>
                            <ToggleGroupItem value="IMAGE" aria-label="Image" className={brandToggleOn}>
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Image
                            </ToggleGroupItem>
                            <ToggleGroupItem value="VIDEO" aria-label="Video" className={brandToggleOn}>
                              <Video className="h-4 w-4 mr-2" />
                              Video
                            </ToggleGroupItem>
                            <ToggleGroupItem value="DOCUMENT" aria-label="Document" className={brandToggleOn}>
                              <FileTextIcon className="h-4 w-4 mr-2" />
                              Document
                            </ToggleGroupItem>
                            <ToggleGroupItem value="LOCATION" aria-label="Location" className={brandToggleOn}>
                              <MapPin className="h-4 w-4 mr-2" />
                              Location
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </FormControl>
                        <FormDescription>Choose the type of template you want to create.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Media Upload/URL for Image/Video/Document */}
                  {isMediaType && (
                    <FormField
                      control={createForm.control}
                      name="mediaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {isImageType && 'Image URL'}
                            {isVideoType && 'Video URL'}
                            {isDocumentType && 'Document URL'}
                          </FormLabel>
                          <FormDescription className="mb-2">
                            {isImageType && 'Enter the URL of the image to use in the template header. The image must be publicly accessible.'}
                            {isVideoType && 'Enter the URL of the video to use in the template header. The video must be publicly accessible.'}
                            {isDocumentType && 'Enter the URL of the document to use in the template header. The document must be publicly accessible.'}
                          </FormDescription>
                          <FormControl>
                            <div className="space-y-2">
                              <Input 
                                {...field} 
                                type="url"
                                placeholder={`Enter ${isImageType ? 'image' : isVideoType ? 'video' : 'document'} URL`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setGallerySelectionContext(null);
                                  if (isImageType) {
                                    setGalleryFileType("image");
                                  } else if (isVideoType) {
                                    setGalleryFileType("video");
                                  } else if (isDocumentType) {
                                    setGalleryFileType("document");
                                  } else {
                                    setGalleryFileType("all");
                                  }
                                  setGalleryDialogOpen(true);
                                }}
                                className="w-full"
                              >
                                <ImageIcon className="h-4 w-4 mr-2" />
                                Select from Gallery
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Template Header - Only show for TEXT type */}
                  {!isMediaType && (
                    <FormField
                      control={createForm.control}
                      name="headerText"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Template Header (Optional)</FormLabel>
                            <span className="text-xs text-muted-foreground">{field.value?.length || 0}/60</span>
                          </div>
                          <FormControl>
                            <Input {...field} placeholder="Enter template header" maxLength={60} />
                          </FormControl>
                          <FormDescription>Header text is optional and only up to 60 characters are allowed.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Template Body */}
                  <FormField
                    control={createForm.control}
                    name="bodyText"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Template Body</FormLabel>
                          <span className="text-xs text-muted-foreground">{field.value?.length || 0}/1024</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 border rounded-md p-2 bg-background">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              const textarea = bodyTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = field.value.substring(start, end);
                                const newValue = field.value.substring(0, start) + `*${selectedText || 'text'}*` + field.value.substring(end);
                                field.onChange(newValue);
                              }
                            }}>
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              const textarea = bodyTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = field.value.substring(start, end);
                                const newValue = field.value.substring(0, start) + `_${selectedText || 'text'}_` + field.value.substring(end);
                                field.onChange(newValue);
                              }
                            }}>
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              const textarea = bodyTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const selectedText = field.value.substring(start, end);
                                const newValue = field.value.substring(0, start) + `~${selectedText || 'text'}~` + field.value.substring(end);
                                field.onChange(newValue);
                              }
                            }}>
                              <Strikethrough className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              const textarea = bodyTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const newValue = field.value.substring(0, start) + `{{1}}` + field.value.substring(end);
                                field.onChange(newValue);
                                setTimeout(() => textarea.focus(), 0);
                              }
                            }}>
                              <Code className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => {
                              const textarea = bodyTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const currentText = field.value || '';
                                const currentVars = extractVariables(currentText);
                                const nextVar = currentVars.length > 0 ? Math.max(...currentVars) + 1 : 1;
                                const newValue = currentText.substring(0, start) + `{{${nextVar}}}` + currentText.substring(end);
                                field.onChange(newValue);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + `{{${nextVar}}}`.length, start + `{{${nextVar}}}`.length);
                                }, 0);
                              }
                            }}>
                              Add Variable
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormControl>
                            <Textarea 
                              {...field}
                              ref={bodyTextareaRef}
                              placeholder="Enter your message content here..." 
                              rows={8}
                              maxLength={1024}
                              className="resize-none"
                            />
                          </FormControl>
                        </div>
                        
                        {/* Variable Buttons */}
                        {(() => {
                          const bodyTextValue = field.value || '';
                          const vars = extractVariables(bodyTextValue);
                          return vars.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {vars.map((varNum) => (
                                <Button
                                  key={varNum}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={brandSoftBtn}
                                  onClick={() => {
                                    const textarea = bodyTextareaRef.current;
                                    if (textarea) {
                                      const currentText = field.value || '';
                                      const cursorPos = textarea.selectionStart;
                                      const newValue = currentText.substring(0, cursorPos) + `{{${varNum}}}` + currentText.substring(cursorPos);
                                      field.onChange(newValue);
                                      setTimeout(() => {
                                        textarea.focus();
                                        textarea.setSelectionRange(cursorPos + `{{${varNum}}}`.length, cursorPos + `{{${varNum}}}`.length);
                                      }, 0);
                                    }
                                  }}
                                >
                                  Variable {varNum}
                                </Button>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Info className="h-4 w-4 mt-0.5" />
                          <span>Up to 1024 characters are allowed.</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Sample Values Section */}
                  {(() => {
                    const bodyTextValue = data.bodyText || '';
                    const vars = extractVariables(bodyTextValue);
                    return vars.length > 0 && !isAuthentication ? (
                      <FormItem>
                        <FormLabel>Sample Values</FormLabel>
                        <FormDescription className="mb-3">
                          Specify sample values for your parameters. These values can be changed at the time of sending. e.g. - {vars.map(v => `{{${v}}}: Value ${v}`).join(', ')}.
                        </FormDescription>
                        <div className="space-y-3">
                          {vars.map((varNum) => (
                            <FormField
                              key={varNum}
                              control={createForm.control}
                              name={`sampleValues.${varNum}` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm">Sample Value {varNum}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder={`Enter sample value for {{${varNum}}}`}
                                      value={field.value || ''}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </FormItem>
                    ) : null;
                  })()}

                  {/* Template Footer */}
                  <FormField
                    control={createForm.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Template Footer (Optional)</FormLabel>
                          <span className="text-xs text-muted-foreground">{field.value?.length || 0}/64</span>
                        </div>
                        <FormControl>
                          <Input {...field} placeholder="Enter template footer" maxLength={64} />
                        </FormControl>
                        <FormDescription>Your message content. Up to 60 characters are allowed.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Interactive Actions */}
                  <FormField
                    control={createForm.control}
                    name="interactiveAction"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <TemplateInteractiveActions
                            value={field.value}
                            onChange={(value) => {
                              if (value === 'MEDIA_CARD_CAROUSEL' && createForm.getValues('templateType') !== 'TEXT') {
                                createForm.setValue('templateType', 'TEXT');
                              }
                              field.onChange(value);
                            }}
                            quickReplies={quickReplies}
                            setQuickReplies={setQuickReplies}
                            urlButtons={urlButtons}
                            setUrlButtons={setUrlButtons}
                            phoneButtons={phoneButtons}
                            setPhoneButtons={setPhoneButtons}
                            productCards={productCards}
                            setProductCards={setProductCards}
                            mediaCards={mediaCards}
                            setMediaCards={setMediaCards}
                            selectedProductCardIndex={selectedProductCardIndex}
                            setSelectedProductCardIndex={setSelectedProductCardIndex}
                            selectedMediaCardIndex={selectedMediaCardIndex}
                            setSelectedMediaCardIndex={setSelectedMediaCardIndex}
                            formButtonText={formButtonText}
                            setFormButtonText={setFormButtonText}
                            selectedFlow={selectedFlow}
                            setSelectedFlow={setSelectedFlow}
                            flowDialogOpen={flowDialogOpen}
                            setFlowDialogOpen={setFlowDialogOpen}
                            activeButtonTab={activeButtonTab}
                            setActiveButtonTab={setActiveButtonTab}
                            phoneNumberId={selectedPhoneNumberId || phoneNumberIdFromUrl}
                            catalogSessionId={catalogSessionIdForTemplate}
                            metaCatalogId={metaCatalogIdForTemplate}
                            onMetaCatalogIdChange={setMetaCatalogIdForTemplate}
                            onOpenGalleryForMediaCard={(cardId, mediaType) => {
                              setGallerySelectionContext({ type: 'media_card', cardId });
                              setGalleryFileType(mediaType === 'IMAGE' ? 'image' : 'video');
                              setGalleryViewMode('gallery');
                              setGalleryDialogOpen(true);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={
                    createMutation.isPending || 
                    (hasMultipleOfficialSessions && createForm.watch('templateTypeMeta') === 'official' && !selectedPhoneNumberId && !phoneNumberIdFromUrl)
                  } 
                  className={cn("w-full", brandPrimaryBtn)}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Submit Template
                </Button>
                {hasMultipleOfficialSessions && createForm.watch('templateTypeMeta') === 'official' && !selectedPhoneNumberId && !phoneNumberIdFromUrl && (
                  <p className="text-sm text-destructive mt-2 text-center">
                    Please select a phone number to create an official template.
                  </p>
                )}
              </div>
            </div>

            {/* Right Panel - Mobile Preview (fixed; spacer keeps grid layout) */}
            <aside className="hidden xl:block w-full min-w-0">
              <div className="min-h-[720px] w-full" aria-hidden="true" />
              <div className="fixed top-24 right-8 z-20 w-[380px] max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden bg-muted/30 rounded-lg p-6">
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl w-[340px] mx-auto flex-shrink-0">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full flex flex-col">
                  {/* Status Bar */}
                  <div className="bg-black text-white px-6 py-2 flex items-center justify-between text-xs font-medium">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>●●●●</span>
                      <span>◐</span>
                    </div>
                  </div>
                  {/* WhatsApp Chat Header */}
                  <div className="bg-[#075e54] text-white px-3 py-3 flex items-center gap-3">
                    <ArrowLeft className="h-5 w-5 flex-shrink-0" />
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold">B</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">Business Name</div>
                      <div className="text-xs opacity-90">WhatsApp</div>
                    </div>
                    <FileIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                    <Phone className="h-5 w-5 flex-shrink-0 opacity-90" />
                  </div>
                  {/* Chat Content Area */}
                  <div className="bg-[#e5ddd5] h-[500px] overflow-y-auto overflow-x-auto scrollbar-hide flex flex-col" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    <div className="p-4 flex-1">
                <div className="bg-white rounded-lg shadow-sm p-3 max-w-[85%] ml-0 mb-4 break-words overflow-hidden" style={{ borderRadius: '7.5px 7.5px 7.5px 0' }}>
                {isAuthentication ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      <strong className="text-lg font-semibold">789123</strong> is your verification code. {data.addSecurityRecommendation && "For your security, do not share this code."}
                    </p>
                    {data.addExpiryTime && data.expiryTimeMinutes && (
                      <p className="text-xs text-gray-600 mt-2">
                        This code will expire in {data.expiryTimeMinutes} minutes.
                      </p>
                    )}
                    {data.authButtonText && (
                      <button className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                        <Copy className="h-4 w-4" />
                        {data.authButtonText}
                      </button>
                    )}
                  </div>
                ) : isImageType && data.mediaUrl ? (
                  <div className="space-y-3">
                    <div className="relative w-full rounded-lg overflow-hidden -mx-4 -mt-4 mb-2" style={{ maxHeight: '300px' }}>
                      <img 
                        src={data.mediaUrl} 
                        alt="Template preview" 
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    {data.bodyText && (
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{renderBodyWithSampleValues(data.bodyText, data.sampleValues)}</p>
                    )}
                    {data.footerText && (
                      <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">{data.footerText}</p>
                    )}
                    {/* Interactive Actions Preview */}
                    {interactiveAction !== 'NONE' && (
                      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                        {interactiveAction === 'QUICK_REPLY' && quickReplies.length > 0 && (
                          <div className="space-y-2">
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <button key={qr.id} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'CALL_TO_ACTION' && (
                          <div className="space-y-2">
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...urlButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('url-', '')) || 0;
                              const bTime = parseInt(b.id.replace('url-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LinkIcon className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...phoneButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('phone-', '')) || 0;
                              const bTime = parseInt(b.id.replace('phone-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <Phone className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'ALL' && (
                          <div className="space-y-2">
                            {urlButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LinkIcon className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {phoneButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <Phone className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <button key={qr.id} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'PRODUCT_CARD_CAROUSEL' && productCards.length > 0 && (
                          <ProductCarouselPreview
                            productCards={productCards}
                            selectedIndex={selectedProductCardIndex}
                          />
                        )}
                        {interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0 && (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-xs text-gray-600 mb-2">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                            {mediaCards[selectedMediaCardIndex] && (
                              <>
                                <div className="border-2 border-dashed rounded p-4 text-center mb-2">
                                  {mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' && mediaCards[selectedMediaCardIndex].mediaUrl ? (
                                    <img
                                      src={mediaCards[selectedMediaCardIndex].mediaUrl}
                                      alt="Media card preview"
                                      className="w-full h-28 object-cover rounded"
                                    />
                                  ) : mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' ? (
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  ) : (
                                    <Video className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  )}
                                  <p className="text-xs text-gray-500 mt-2">{mediaCards[selectedMediaCardIndex].mediaType}</p>
                                </div>
                                {mediaCards[selectedMediaCardIndex].bodyText && (
                                  <p className="text-xs mb-2 text-gray-700">{mediaCards[selectedMediaCardIndex].bodyText}</p>
                                )}
                                {mediaCards[selectedMediaCardIndex].buttons.length > 0 && (
                                  <div className="space-y-1">
                                    {mediaCards[selectedMediaCardIndex].buttons.map((btn) => (
                                      <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-xs font-medium transition-colors">
                                        {btn.text || 'Button'}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {interactiveAction === 'FORM' && (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <button className="w-full px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-sm font-medium transition-colors">
                              {formButtonText || 'View'}
                            </button>
                            {selectedFlow && (
                              <p className="text-xs text-gray-600 mt-2">Flow: {selectedFlow.name}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : isVideoType && data.mediaUrl ? (
                  <div className="space-y-3">
                    <div className="relative w-full rounded-lg overflow-hidden -mx-4 -mt-4 mb-2" style={{ maxHeight: '300px' }}>
                      <video 
                        src={data.mediaUrl} 
                        controls
                        className="w-full h-auto"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    {data.bodyText && (
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{renderBodyWithSampleValues(data.bodyText, data.sampleValues)}</p>
                    )}
                    {data.footerText && (
                      <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">{data.footerText}</p>
                    )}
                    {/* Interactive Actions Preview */}
                    {interactiveAction !== 'NONE' && (
                      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                        {interactiveAction === 'QUICK_REPLY' && quickReplies.length > 0 && (
                          <div className="space-y-2">
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <button key={qr.id} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'CALL_TO_ACTION' && (
                          <div className="space-y-2">
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...urlButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('url-', '')) || 0;
                              const bTime = parseInt(b.id.replace('url-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LinkIcon className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...phoneButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('phone-', '')) || 0;
                              const bTime = parseInt(b.id.replace('phone-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <Phone className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'ALL' && (
                          <div className="space-y-2">
                            {urlButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LinkIcon className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {phoneButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <Phone className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <button key={qr.id} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'PRODUCT_CARD_CAROUSEL' && productCards.length > 0 && (
                          <ProductCarouselPreview
                            productCards={productCards}
                            selectedIndex={selectedProductCardIndex}
                          />
                        )}
                        {interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0 && (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <p className="text-xs text-gray-600 mb-2">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                            {mediaCards[selectedMediaCardIndex] && (
                              <>
                                <div className="border-2 border-dashed rounded p-4 text-center mb-2">
                                  {mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' && mediaCards[selectedMediaCardIndex].mediaUrl ? (
                                    <img
                                      src={mediaCards[selectedMediaCardIndex].mediaUrl}
                                      alt="Media card preview"
                                      className="w-full h-28 object-cover rounded"
                                    />
                                  ) : mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' ? (
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  ) : (
                                    <Video className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  )}
                                  <p className="text-xs text-gray-500 mt-2">{mediaCards[selectedMediaCardIndex].mediaType}</p>
                                </div>
                                {mediaCards[selectedMediaCardIndex].bodyText && (
                                  <p className="text-xs mb-2 text-gray-700">{mediaCards[selectedMediaCardIndex].bodyText}</p>
                                )}
                                {mediaCards[selectedMediaCardIndex].buttons.length > 0 && (
                                  <div className="space-y-1">
                                    {mediaCards[selectedMediaCardIndex].buttons.map((btn) => (
                                      <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-xs font-medium transition-colors">
                                        {btn.text || 'Button'}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {interactiveAction === 'FORM' && (
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <button className="w-full px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-sm font-medium transition-colors">
                              {formButtonText || 'View'}
                            </button>
                            {selectedFlow && (
                              <p className="text-xs text-gray-600 mt-2">Flow: {selectedFlow.name}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : isDocumentType && data.mediaUrl ? (
                  <div className="space-y-3">
                    <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-3">
                      <FileTextIcon className="h-8 w-8 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Document</p>
                        <p className="text-xs text-gray-500">Document preview</p>
                      </div>
                    </div>
                    {data.bodyText && (
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{renderBodyWithSampleValues(data.bodyText, data.sampleValues)}</p>
                    )}
                    {data.footerText && (
                      <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">{data.footerText}</p>
                    )}
                    {/* Interactive Actions Preview */}
                    {interactiveAction !== 'NONE' && (
                      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                        {interactiveAction === 'QUICK_REPLY' && quickReplies.length > 0 && (
                          <div className="space-y-2">
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <button key={qr.id} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'CALL_TO_ACTION' && (
                          <div className="space-y-2">
                            {urlButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LinkIcon className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                            {phoneButtons.filter(btn => btn.text).map((btn) => (
                              <button key={btn.id} className="w-full text-left px-3 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <Phone className="h-4 w-4" />
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'ALL' && (
                          <div className="space-y-2">
                            {urlButtons.filter(btn => btn.text).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <LinkIcon className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                            {phoneButtons.filter(btn => btn.text).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <Phone className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <Button key={qr.id} variant="outline" size="sm" className="w-full justify-start">
                                <MessageSquare className="h-3 w-3 mr-2" />
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </Button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'PRODUCT_CARD_CAROUSEL' && productCards.length > 0 && (
                          <ProductCarouselPreview
                            productCards={productCards}
                            selectedIndex={selectedProductCardIndex}
                            mutedTextClass="text-muted-foreground"
                            panelClass="bg-muted/50"
                          />
                        )}
                        {interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0 && (
                          <div className="border rounded-lg p-4 bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-2">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                            {mediaCards[selectedMediaCardIndex] && (
                              <>
                                <div className="border-2 border-dashed rounded p-4 text-center mb-2">
                                  {mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' && mediaCards[selectedMediaCardIndex].mediaUrl ? (
                                    <img
                                      src={mediaCards[selectedMediaCardIndex].mediaUrl}
                                      alt="Media card preview"
                                      className="w-full h-28 object-cover rounded"
                                    />
                                  ) : mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' ? (
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                  ) : (
                                    <Video className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">{mediaCards[selectedMediaCardIndex].mediaType}</p>
                                </div>
                                {mediaCards[selectedMediaCardIndex].bodyText && (
                                  <p className="text-xs mb-2">{mediaCards[selectedMediaCardIndex].bodyText}</p>
                                )}
                                {mediaCards[selectedMediaCardIndex].buttons.length > 0 && (
                                  <div className="space-y-1">
                                    {mediaCards[selectedMediaCardIndex].buttons.map((btn) => (
                                      <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start text-xs">
                                        {btn.text || 'Button'}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {interactiveAction === 'FORM' && (
                          <div className="border rounded-lg p-4 bg-muted/50">
                            <Button variant="outline" size="sm" className="w-full">
                              {formButtonText || 'View'}
                            </Button>
                            {selectedFlow && (
                              <p className="text-xs text-muted-foreground mt-2">Flow: {selectedFlow.name}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.bodyText && (
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{renderBodyWithSampleValues(data.bodyText, data.sampleValues)}</p>
                    )}
                    {data.footerText && (
                      <p className="text-xs text-gray-500 text-center mt-2 pt-2 border-t border-gray-200">{data.footerText}</p>
                    )}
                    {/* Interactive Actions Preview for TEXT type */}
                    {interactiveAction !== 'NONE' && (
                      <div className="space-y-2 border-t pt-4">
                        {interactiveAction === 'QUICK_REPLY' && quickReplies.length > 0 && (
                          <div className="space-y-2">
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <Button key={qr.id} variant="outline" size="sm" className="w-full justify-start">
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </Button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'CALL_TO_ACTION' && (
                          <div className="space-y-2">
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...urlButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('url-', '')) || 0;
                              const bTime = parseInt(b.id.replace('url-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <LinkIcon className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                            {/* Sort buttons by ID (timestamp) to maintain insertion order */}
                            {[...phoneButtons].filter(btn => btn.text).sort((a, b) => {
                              const aTime = parseInt(a.id.replace('phone-', '')) || 0;
                              const bTime = parseInt(b.id.replace('phone-', '')) || 0;
                              return aTime - bTime;
                            }).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <Phone className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'ALL' && (
                          <div className="space-y-2">
                            {urlButtons.filter(btn => btn.text).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <LinkIcon className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                            {phoneButtons.filter(btn => btn.text).map((btn) => (
                              <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start">
                                <Phone className="h-3 w-3 mr-2" />
                                {btn.text}
                              </Button>
                            ))}
                            {quickReplies.filter(qr => qr.text).map((qr, idx) => (
                              <Button key={qr.id} variant="outline" size="sm" className="w-full justify-start">
                                <MessageSquare className="h-3 w-3 mr-2" />
                                {qr.text || `Quick Reply ${idx + 1}`}
                              </Button>
                            ))}
                          </div>
                        )}
                        {interactiveAction === 'PRODUCT_CARD_CAROUSEL' && productCards.length > 0 && (
                          <ProductCarouselPreview
                            productCards={productCards}
                            selectedIndex={selectedProductCardIndex}
                            mutedTextClass="text-muted-foreground"
                            panelClass="bg-muted/50"
                          />
                        )}
                        {interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0 && (
                          <div className="border rounded-lg p-4 bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-2">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                            {mediaCards[selectedMediaCardIndex] && (
                              <>
                                <div className="border-2 border-dashed rounded p-4 text-center mb-2">
                                  {mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' && mediaCards[selectedMediaCardIndex].mediaUrl ? (
                                    <img
                                      src={mediaCards[selectedMediaCardIndex].mediaUrl}
                                      alt="Media card preview"
                                      className="w-full h-28 object-cover rounded"
                                    />
                                  ) : mediaCards[selectedMediaCardIndex].mediaType === 'IMAGE' ? (
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                  ) : (
                                    <Video className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">{mediaCards[selectedMediaCardIndex].mediaType}</p>
                                </div>
                                {mediaCards[selectedMediaCardIndex].bodyText && (
                                  <p className="text-xs mb-2">{mediaCards[selectedMediaCardIndex].bodyText}</p>
                                )}
                                {mediaCards[selectedMediaCardIndex].buttons.length > 0 && (
                                  <div className="space-y-1">
                                    {mediaCards[selectedMediaCardIndex].buttons.map((btn) => (
                                      <Button key={btn.id} variant="outline" size="sm" className="w-full justify-start text-xs">
                                        {btn.text || 'Button'}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {interactiveAction === 'FORM' && (
                          <div className="border rounded-lg p-4 bg-muted/50">
                            <Button variant="outline" size="sm" className="w-full">
                              {formButtonText || 'View'}
                            </Button>
                            {selectedFlow && (
                              <p className="text-xs text-muted-foreground mt-2">Flow: {selectedFlow.name}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </div>
                    </div>
                    {/* Message Input Bar */}
                    <div className="bg-[#f0f2f5] px-3 py-3 flex items-center gap-2 border-t border-gray-200/50 flex-shrink-0">
                      <Plus className="h-6 w-6 text-[#54656f] flex-shrink-0" />
                      <span className="text-sm text-[#54656f]">Message</span>
                      <div className="flex-1" />
                      <Mic className="h-5 w-5 text-[#54656f] flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </aside>
          </form>
        </Form>

        {/* Gallery Dialog */}
        <Dialog open={galleryDialogOpen} onOpenChange={(open) => {
          setGalleryDialogOpen(open);
          if (!open) setGallerySelectionContext(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileIcon className="w-5 h-5" />
                Select File
              </DialogTitle>
            </DialogHeader>
            
            {/* Gallery View Mode Tabs */}
            <div className="flex gap-2 border-b pb-2">
              <Button
                variant={galleryViewMode === "gallery" ? "default" : "ghost"}
                size="sm"
                onClick={() => setGalleryViewMode("gallery")}
                className="flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                My Gallery
              </Button>
              <Button
                variant={galleryViewMode === "url" ? "default" : "ghost"}
                size="sm"
                onClick={() => setGalleryViewMode("url")}
                className="flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                Enter URL
              </Button>
            </div>

            {galleryViewMode === "gallery" ? (
              <div className="space-y-4">
                {/* File Type Filters */}
                <div className="flex gap-2 border-b pb-2">
                  <Button
                    variant={galleryFileType === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={galleryFileType === "image" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("image")}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Photos
                  </Button>
                  <Button
                    variant={galleryFileType === "video" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("video")}
                    className="flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Videos
                  </Button>
                  <Button
                    variant={galleryFileType === "audio" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("audio")}
                    className="flex items-center gap-2"
                  >
                    <Music className="w-4 h-4" />
                    Audio
                  </Button>
                  <Button
                    variant={galleryFileType === "document" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGalleryFileType("document")}
                    className="flex items-center gap-2"
                  >
                    <FileIcon className="w-4 h-4" />
                    Documents
                  </Button>
                  <div className="flex-1"></div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = galleryFileType === "all" ? "*/*" : 
                        galleryFileType === "image" ? "image/*" :
                        galleryFileType === "video" ? "video/*" :
                        galleryFileType === "audio" ? "audio/*" : "*";
                      input.multiple = true;
                      input.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                          await uploadGalleryFiles(files, { toast, queryClient });
                        }
                      };
                      input.click();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Files
                  </Button>
                </div>

                {/* Gallery Grid */}
                {galleryItems.length > 0 ? (
                  <div className="grid grid-cols-4 gap-4">
                    {galleryItems.map((item) => (
                      <div
                        key={item.id}
                        className="relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors group"
                        onClick={() => {
                          let mediaUrl = item.url;
                          if (mediaUrl.startsWith('/')) {
                            mediaUrl = `${window.location.origin}${item.url}`;
                          }
                          if (gallerySelectionContext?.type === 'media_card' && gallerySelectionContext.cardId) {
                            setMediaCards((prev) => prev.map((card) =>
                              card.id === gallerySelectionContext.cardId ? { ...card, mediaUrl } : card
                            ));
                            setGallerySelectionContext(null);
                            toast({ title: "Media selected", description: `${item.name} selected for card` });
                          } else {
                            createForm.setValue('mediaUrl', mediaUrl);
                            toast({ title: "Media selected", description: `${item.name} selected` });
                          }
                          setGalleryDialogOpen(false);
                        }}
                      >
                        {item.type === 'image' ? (
                          <img 
                            src={item.url} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-image.png';
                            }}
                          />
                        ) : item.type === 'video' ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : item.type === 'audio' ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Music className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {galleryFileType === 'image' ? (
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'video' ? (
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'audio' ? (
                      <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : galleryFileType === 'document' ? (
                      <FileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    ) : (
                      <FileIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    )}
                    <p className="text-sm">
                      {galleryFileType === 'all' 
                        ? 'No files in gallery' 
                        : `No ${galleryFileType}s in gallery`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Enter file URL (https://...)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={galleryUrlInput}
                      onChange={(e) => setGalleryUrlInput(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        if (galleryUrlInput) {
                          let mediaUrl = galleryUrlInput.trim();
                          if (mediaUrl.startsWith('/')) {
                            mediaUrl = `${window.location.origin}${mediaUrl}`;
                          }
                          if (gallerySelectionContext?.type === 'media_card' && gallerySelectionContext.cardId) {
                            setMediaCards((prev) => prev.map((card) =>
                              card.id === gallerySelectionContext.cardId ? { ...card, mediaUrl } : card
                            ));
                            setGallerySelectionContext(null);
                            toast({ title: "URL set", description: "Media URL set for card" });
                          } else {
                            createForm.setValue('mediaUrl', mediaUrl);
                            toast({ title: "URL set", description: "Media URL has been set" });
                          }
                          setGalleryDialogOpen(false);
                          setGalleryUrlInput("");
                        }
                      }}
                      disabled={!galleryUrlInput}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setGalleryDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


