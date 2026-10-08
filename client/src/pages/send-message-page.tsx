// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Image, MapPin, User, Users, Phone, Upload, Eye, Plus, Trash2, Link2, ExternalLink, FileIcon, ImageIcon, Video, Music } from "lucide-react";

// Component to fetch and display media preview
function MessagePreviewImage({ sessionId, mediaId, previewUrl }: { sessionId: string; mediaId: string; previewUrl?: string }) {
  // If previewUrl is provided, use it directly (faster, no API call needed)
  const { data: mediaData, isLoading, error } = useQuery<{ url: string }>({
    queryKey: ['/api/media', mediaId, sessionId],
    queryFn: async () => {
      // If previewUrl is provided, return it directly
      if (previewUrl) {
        return { url: previewUrl };
      }
      
      // Otherwise, fetch from API
      const response = await fetch(`/api/media/${mediaId}?sessionId=${sessionId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch media');
      }
      return response.json();
    },
    enabled: !!mediaId && !!sessionId && mediaId.trim().length > 0,
    retry: 2,
    // Use previewUrl as initial data if available
    initialData: previewUrl ? { url: previewUrl } : undefined,
  });

  // Determine the image URL to use
  const imageUrl = previewUrl || mediaData?.url;

  if (isLoading && !previewUrl) {
    return (
      <div className="rounded-lg overflow-hidden bg-gray-100 border">
        <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-2" />
          <span className="text-xs text-gray-500">Loading image...</span>
        </div>
      </div>
    );
  }

  if ((error || !imageUrl) && !previewUrl) {
    return (
      <div className="rounded-lg overflow-hidden bg-gray-100 border">
        <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center">
          <Image className="h-8 w-8 text-gray-400 mb-2" />
          <span className="text-xs text-gray-500">Image preview unavailable</span>
          <span className="text-xs text-gray-400 mt-1">Media ID: {mediaId.substring(0, 20)}...</span>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden mb-3" style={{ borderRadius: '7.5px 7.5px 0 0' }}>
      <img 
        src={imageUrl} 
        alt="Template header" 
        className="w-full h-auto object-cover"
        style={{ maxHeight: '300px' }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
      <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center hidden">
        <Image className="h-8 w-8 text-gray-400 mb-2" />
        <span className="text-xs text-gray-500">Image unavailable</span>
      </div>
    </div>
  );
}
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadGalleryFiles } from "@/lib/upload-gallery-files";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { EmojiPicker } from "@/components/emoji-picker";
import { MessageFormattingToolbar } from "@/components/message-formatting-toolbar";
import type { WhatsappSession } from "@shared/schema";

// Button schema for footer buttons
const footerButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().min(1, "Button text is required"),
  url: z.string().optional(),
  phoneNumber: z.string().optional(),
}).superRefine((data, ctx) => {
  // Only validate if text is provided (button is being used)
  // This prevents validation errors for empty/incomplete buttons
  if (!data.text || data.text.trim().length === 0) {
    return; // Skip validation if text is empty - will be caught by text field validation
  }
  
  // URL button requires URL field
  if (data.type === 'URL') {
    if (!data.url || data.url.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL is required for URL button",
        path: ["url"],
      });
    } else {
      // Validate URL format
      try {
        new URL(data.url);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid URL (e.g., https://example.com)",
          path: ["url"],
        });
      }
    }
  }
  
  // Phone Number button requires phoneNumber field
  if (data.type === 'PHONE_NUMBER') {
    if (!data.phoneNumber || data.phoneNumber.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required for Phone Number button",
        path: ["phoneNumber"],
      });
    }
  }
  
  // Quick Reply button only needs text (no action field needed)
  // This is correct - Quick Reply buttons don't have an action field
});

const textMessageSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  to: z.string().optional(),
  selectedContacts: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
  message: z.string().optional(), // Made optional - required only when not using templates
  caption: z.string().optional(), // For media tab
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
  // Template message fields (for WhatsApp Business API)
  templateName: z.string().optional(),
  templateLanguage: z.string().optional().default('en'),
  templateParams: z.array(z.string()).optional(),
  headerImageId: z.string().optional(), // For templates with IMAGE/VIDEO/DOCUMENT header
  headerVideoId: z.string().optional(),
  headerDocumentId: z.string().optional(),
  headerImageUrl: z.string().optional(), // Local preview URL for image header
  headerVideoUrl: z.string().optional(), // Local preview URL for video header
  headerDocumentUrl: z.string().optional(), // Local preview URL for document header
  headerDocumentFilename: z.string().optional(),
}).refine((data) => {
  const hasManual = data.to && data.to.trim().length > 0;
  const hasContacts = data.selectedContacts && data.selectedContacts.length > 0;
  const hasGroups = data.selectedGroups && data.selectedGroups.length > 0;
  return hasManual || hasContacts || hasGroups;
}, {
  message: "Please select at least one recipient (manual numbers, contacts, or groups)",
  path: ["to"],
}).refine((data) => {
  // Message is required only if not using a template AND not using caption (media tab)
  // For media tab, caption is used instead of message
  if (!data.templateName) {
    // If caption is provided (media tab), message is not required
    if (data.caption !== undefined && data.caption !== null) {
      return true; // Media tab - caption is used instead of message
    }
    // Text tab - message is required
    return data.message && data.message.trim().length > 0;
  }
  return true; // Template messages don't need the message field
}, {
  message: "Message is required when not using a template",
  path: ["message"],
});

const locationMessageSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  to: z.string().optional(),
  selectedContacts: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
}).refine((data) => {
  const hasManual = data.to && data.to.trim().length > 0;
  const hasContacts = data.selectedContacts && data.selectedContacts.length > 0;
  const hasGroups = data.selectedGroups && data.selectedGroups.length > 0;
  return hasManual || hasContacts || hasGroups;
}, {
  message: "Please select at least one recipient (manual numbers, contacts, or groups)",
  path: ["to"],
});

const contactMessageSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  to: z.string().optional(),
  selectedContacts: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
}).refine((data) => {
  const hasManual = data.to && data.to.trim().length > 0;
  const hasContacts = data.selectedContacts && data.selectedContacts.length > 0;
  const hasGroups = data.selectedGroups && data.selectedGroups.length > 0;
  return hasManual || hasContacts || hasGroups;
}, {
  message: "Please select at least one recipient (manual numbers, contacts, or groups)",
  path: ["to"],
});

type ManagedContact = {
  id: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  whatsappGroupId: string | null;
};

export default function SendMessagePage() {
  const { toast } = useToast();
  const [connectionTypeTab, setConnectionTypeTab] = useState<"official" | "unofficial">("official");
  const [activeTab, setActiveTab] = useState("text");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Handle preview URL cleanup
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  // Update preview URL when file changes
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [selectedFile]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateParams, setTemplateParams] = useState<Array<{ column?: string; fallback?: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [headerFormat, setHeaderFormat] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [headerDocumentUrl, setHeaderDocumentUrl] = useState<string | null>(null);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState<"gallery" | "url">("gallery");
  const [galleryFileType, setGalleryFileType] = useState<"all" | "image" | "video" | "audio" | "document">("image");

  const { data: sessions, isLoading: sessionsLoading } = useQuery<WhatsappSession[]>({
    queryKey: ['/api/sessions'],
  });

  const { data: sendMsgOrgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const sendMsgOrgId = Array.isArray(sendMsgOrgData) ? sendMsgOrgData?.[0]?.id : (sendMsgOrgData?.organizations ?? [])[0]?.id;
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useQuery<any[]>({
    queryKey: ['/api/templates', sendMsgOrgId],
    queryFn: () => {
      const url = sendMsgOrgId ? `/api/templates?organizationId=${encodeURIComponent(sendMsgOrgId)}` : "/api/templates";
      return fetchLegacyListApi(url, "templates");
    },
    enabled: !!sendMsgOrgId,
  });

  // Fetch contact columns for dropdown options
  const { data: contactColumns = [] } = useQuery<any[]>({
    queryKey: ["/api/columns"],
    queryFn: async () => {
      try {
        return await fetchLegacyListApi("/api/columns", "columns");
      } catch {
        return [];
      }
    },
  });

  // Gallery query - only fetch when dialog is open
  const { data: mediaItems = [], isLoading: galleryLoading } = useQuery<Array<{ id: string; url: string; name: string; type: string }>>({
    queryKey: ["/api/gallery", galleryFileType],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/gallery?type=${galleryFileType}`);
        return await res.json();
      } catch (error) {
        return [];
      }
    },
    enabled: galleryDialogOpen, // Only fetch when dialog is open
  });

  // Filter sessions by connection type
  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];
  const officialSessions = connectedSessions.filter(s => s.connectionType === 'official');
  const unofficialSessions = connectedSessions.filter(s => s.connectionType === 'unofficial');
  
  // Get sessions for current tab
  // Always use official sessions during review
  const currentTabSessions = officialSessions;

  const textForm = useForm({
    resolver: zodResolver(textMessageSchema),
    mode: 'onSubmit', // Only validate on submit, not on change
    reValidateMode: 'onChange', // Re-validate on change after first submit
    defaultValues: {
      sessionId: "",
      to: "",
      selectedContacts: [] as string[],
      selectedGroups: [] as string[],
      message: "",
      caption: "",
      footer: "",
      footerButtonType: 'NONE' as const,
      footerButtonText: "",
      footerButtonUrl: "",
      footerButtonPhone: "",
      footerButtons: [] as Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phoneNumber?: string }>,
      templateName: undefined,
      templateLanguage: "en",
      templateParams: [] as Array<{ column?: string; fallback?: string }>,
      headerImageId: undefined,
      headerVideoId: undefined,
      headerDocumentId: undefined,
      headerImageUrl: undefined,
      headerVideoUrl: undefined,
      headerDocumentUrl: undefined,
    },
  });

  const selectedSessionId = textForm.watch('sessionId');
  const selectedSession = sessions?.find(s => s.sessionId === selectedSessionId);
  // Force Business API features only in official tab
  const isBusinessAPI = connectionTypeTab === 'official';

  // Filter templates for the selected session (only approved templates for Business API)
  const filteredTemplates = selectedSessionId && connectionTypeTab === 'official' 
    ? templates?.filter(t => t.status?.toLowerCase() === 'approved' || t.status === 'APPROVED') || []
    : templates || [];
  
  const { data: contacts = [] } = useQuery<ManagedContact[]>({
    queryKey: ['/api/contacts'],
    enabled: !!selectedSessionId,
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
    enabled: !!selectedSessionId,
  });

  // Extract template parameters from message - returns array of parameter configs
  const extractTemplateParams = (message: string): Array<{ column?: string; fallback?: string }> => {
    const paramRegex = /\{\{(\d+)\}\}/g;
    const matches = Array.from(message.matchAll(paramRegex));
    if (matches.length === 0) return [];
    
    const paramNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
    return paramNumbers.map(() => ({ column: '', fallback: '' }));
  };

  // Get preview text with resolved parameter values
  const getPreviewText = (template: any, params: Array<{ column?: string; fallback?: string }>, contact?: ManagedContact): string => {
    if (!template?.components) return '';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    
    let text = bodyComponent.text;
    
    // Extract variable numbers from template (e.g., {{1}}, {{2}})
    const paramRegex = /\{\{(\d+)\}\}/g;
    const matches = Array.from(text.matchAll(paramRegex));
    const varNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
    
    // Replace each variable with its corresponding parameter value
    varNumbers.forEach((varNum, index) => {
      if (index >= params.length) return;
      
      const param = params[index];
      let value = '';
      
      // If column is selected and contact is available, try to get value from contact first
      if (param.column && contact) {
        if (param.column === 'name') {
          value = contact.name || '';
        } else if (param.column === 'phoneNumber') {
          value = contact.phoneNumber || '';
        } else if (param.column === 'email') {
          value = contact.email || '';
        } else if (param.column.startsWith('customFields.')) {
          const fieldName = param.column.replace('customFields.', '');
          value = contact.customFields?.[fieldName] || '';
        }
      }
      
      // Use fallback if column value is empty
      if (!value && param.fallback) {
        value = param.fallback;
      }
      
      // Replace all occurrences of {{varNum}} with the value
      text = text.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), value || `{{${varNum}}}`);
    });
    
    return text;
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = messageTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textForm.getValues('message');
    const newValue = currentValue.substring(0, start) + emoji + currentValue.substring(end);
    
    textForm.setValue('message', newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const locationForm = useForm({
    resolver: zodResolver(locationMessageSchema),
    mode: 'onSubmit', // Only validate on submit, not on change
    reValidateMode: 'onChange', // Re-validate on change after first submit
    defaultValues: {
      sessionId: "",
      to: "",
      selectedContacts: [] as string[],
      selectedGroups: [] as string[],
      latitude: 0,
      longitude: 0,
      address: "",
      footer: "",
      footerButtonType: 'NONE' as const,
      footerButtonText: "",
      footerButtonUrl: "",
      footerButtonPhone: "",
      footerButtons: [] as Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phoneNumber?: string }>,
    },
  });

  const contactForm = useForm({
    resolver: zodResolver(contactMessageSchema),
    mode: 'onSubmit', // Only validate on submit, not on change
    reValidateMode: 'onChange', // Re-validate on change after first submit
    defaultValues: {
      sessionId: "",
      to: "",
      selectedContacts: [] as string[],
      selectedGroups: [] as string[],
      contactName: "",
      contactPhone: "",
      footer: "",
      footerButtonType: 'NONE' as const,
      footerButtonText: "",
      footerButtonUrl: "",
      footerButtonPhone: "",
      footerButtons: [] as Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phoneNumber?: string }>,
    },
  });

  const sendTextMutation = useMutation({
    mutationFn: async (data: z.infer<typeof textMessageSchema>) => {
      let phoneNumbers: string[] = [];

      // Get phone numbers from manual input
      if (data.to && data.to.trim().length > 0) {
        const manualNumbers = (data.to || '')
        .split(/[,\n]/)
        .map(num => num.trim())
        .filter(num => num.length > 0);
        phoneNumbers.push(...manualNumbers);
      }

      // Get phone numbers from selected contacts
      if (data.selectedContacts && data.selectedContacts.length > 0) {
        const selectedContactsData = contacts.filter(c => data.selectedContacts?.includes(c.id));
        const contactNumbers = selectedContactsData.map(c => c.phoneNumber);
        phoneNumbers.push(...contactNumbers);
      }

      // Get WhatsApp group IDs from selected groups
      if (data.selectedGroups && data.selectedGroups.length > 0) {
        const selectedGroupsData = groups.filter(g => data.selectedGroups?.includes(g.id));
        const groupIds = selectedGroupsData
          .map(g => {
            if (g.whatsappGroupId) {
              // Ensure group ID has @g.us suffix
              return g.whatsappGroupId.includes('@g.us') 
                ? g.whatsappGroupId 
                : `${g.whatsappGroupId}@g.us`;
            }
            return null;
          })
          .filter((id): id is string => !!id);
        phoneNumbers.push(...groupIds);
      }

      if (phoneNumbers.length === 0) {
        throw new Error('No recipients selected');
      }

      // Check if session is Business API
      const session = sessions?.find(s => s.sessionId === data.sessionId);
      const isBusinessAPISession = session?.connectionType === 'official';

      const results = [];
      for (const phoneNumber of phoneNumbers) {
        const requestBody: any = {
            sessionId: data.sessionId,
            to: phoneNumber,
            message: data.message,
          footer: data.footer,
        };

        // Add footer buttons if provided (prefer new multiple buttons format over old single button format)
        if (data.footerButtons && data.footerButtons.length > 0) {
          requestBody.footerButtons = data.footerButtons;
        } else if (data.footerButtonType && data.footerButtonType !== 'NONE' && data.footerButtonText) {
          // Fallback to old single button format for backward compatibility
          requestBody.footerButtonType = data.footerButtonType;
          requestBody.footerButtonText = data.footerButtonText;
          if (data.footerButtonUrl) {
            requestBody.footerButtonUrl = data.footerButtonUrl;
          }
          if (data.footerButtonPhone) {
            requestBody.footerButtonPhone = data.footerButtonPhone;
          }
        }

        // Add template fields if template is selected and using Business API
        if (isBusinessAPISession && data.templateName) {
          requestBody.templateName = data.templateName;
          requestBody.templateLanguage = data.templateLanguage || 'en';
          
          // Add header media IDs if provided
          if (data.headerImageId) {
            requestBody.headerImageId = data.headerImageId;
          }
          if (data.headerVideoId) {
            requestBody.headerVideoId = data.headerVideoId;
          }
          if (data.headerDocumentId) {
            requestBody.headerDocumentId = data.headerDocumentId;
          }
          if (data.headerDocumentUrl) {
            requestBody.headerDocumentUrl = data.headerDocumentUrl;
          }
          if (data.headerDocumentFilename) {
            requestBody.headerDocumentFilename = data.headerDocumentFilename;
          }
          
          // Resolve template parameters from column mappings or use fallback values
          if (data.templateParams && Array.isArray(data.templateParams) && data.templateParams.length > 0) {
            // Get the contact for this specific recipient (phoneNumber in the loop)
            const recipientContact = contacts.find(c => {
              const contactPhone = c.phoneNumber.replace(/[^0-9]/g, '');
              const recipientPhone = phoneNumber.replace(/[^0-9]/g, '');
              return contactPhone === recipientPhone;
            }) || (data.selectedContacts && data.selectedContacts.length > 0
              ? contacts.find(c => c.id === data.selectedContacts[0])
              : null);
            
            // Resolve each parameter from column or use fallback
            requestBody.templateParams = data.templateParams.map((param: any) => {
              // Handle both old string format and new object format
              if (typeof param === 'string') {
                return param;
              }
              
              let value = param.fallback || '';
              
              if (param.column && recipientContact) {
                if (param.column === 'name') {
                  value = recipientContact.name || param.fallback || '';
                } else if (param.column === 'phoneNumber') {
                  value = recipientContact.phoneNumber || param.fallback || '';
                } else if (param.column === 'email') {
                  value = recipientContact.email || param.fallback || '';
                } else if (param.column.startsWith('customFields.')) {
                  const fieldName = param.column.replace('customFields.', '');
                  value = recipientContact.customFields?.[fieldName] || param.fallback || '';
                }
              }
              
              return value;
            });
          } else {
            // Try to extract from message (look for values after {{n}})
            const paramRegex = /\{\{(\d+)\}\}/g;
            const matches = Array.from(data.message.matchAll(paramRegex));
            if (matches.length > 0) {
              const paramNumbers = [...new Set(matches.map(m => parseInt(m[1])))].sort((a, b) => a - b);
              // Extract parameters, but don't filter out empty ones - WhatsApp needs exact count
              requestBody.templateParams = paramNumbers.map(num => {
                const match = data.message.match(new RegExp(`\\{\\{${num}\\}\\}\\s*([^\\{\\n]+)`));
                return match ? match[1].trim() : '';
              });
            } else {
              // If no parameters found in message but template might require them, send empty array
              // The backend will handle padding based on template requirements
              requestBody.templateParams = [];
            }
          }
        }

        const response = await fetch('/api/messages/send-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          credentials: 'include',
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to send to ${phoneNumber}: ${error.error}`);
        }
        results.push(await response.json());
      }
      return { count: results.length, results };
    },
    onSuccess: (data) => {
      toast({
        title: "Messages sent!",
        description: `Successfully sent to ${data.count} recipient(s).`,
      });
      textForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const sendMediaMutation = useMutation({
    mutationFn: async (data: { sessionId: string; to: string; caption: string; selectedContacts?: string[]; selectedGroups?: string[]; footer?: string; footerButtonType?: string; footerButtonText?: string; footerButtonUrl?: string; footerButtonPhone?: string; footerButtons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phoneNumber?: string }> }) => {
      if (!selectedFile) throw new Error('No file selected');
      
      // Collect all recipients
      const phoneNumbers: string[] = [];
      if (data.to) {
        phoneNumbers.push(...data.to.split(/[,\n]/).map(n => n.trim()).filter(n => n));
      }
      if (data.selectedContacts) {
        const contactNumbers = contacts.filter(c => data.selectedContacts?.includes(c.id)).map(c => c.phoneNumber);
        phoneNumbers.push(...contactNumbers);
      }
      if (data.selectedGroups) {
        const groupIds = groups.filter(g => data.selectedGroups?.includes(g.id)).map(g => g.whatsappGroupId).filter((id): id is string => !!id);
        phoneNumbers.push(...groupIds);
      }

      if (phoneNumbers.length === 0) {
        throw new Error('Please select at least one recipient');
      }

      const results = [];
      for (const phoneNumber of phoneNumbers) {
      const formData = new FormData();
      formData.append('sessionId', data.sessionId);
        formData.append('to', phoneNumber);
      formData.append('caption', data.caption || '');
      formData.append('mediaType', selectedFile.type.startsWith('image/') ? 'image' : 'document');
      formData.append('file', selectedFile);
      if (data.footer) formData.append('footer', data.footer);
      if (data.footerButtonType) formData.append('footerButtonType', data.footerButtonType);
      if (data.footerButtonText) formData.append('footerButtonText', data.footerButtonText);
      if (data.footerButtonUrl) formData.append('footerButtonUrl', data.footerButtonUrl);
      if (data.footerButtonPhone) formData.append('footerButtonPhone', data.footerButtonPhone);
      if (data.footerButtons && data.footerButtons.length > 0) {
        formData.append('footerButtons', JSON.stringify(data.footerButtons));
      }

      const response = await fetch('/api/messages/send-media', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
          throw new Error(`Failed to send to ${phoneNumber}: ${error.error || 'Failed to send media'}`);
      }
        results.push(await response.json());
      }
      return { count: results.length, results };
    },
    onSuccess: (data) => {
      toast({
        title: "Media sent!",
        description: `Successfully sent to ${data.count} recipient(s).`,
      });
      setSelectedFile(null);
      textForm.reset(); // Reset form after successful send
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send media",
        variant: "destructive",
      });
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async ({ sessionId, file }: { sessionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('file', file);

      const response = await fetch('/api/media/upload', {
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
      // Automatically populate the media ID field based on file type
      const fileType = variables.file.type;
      if (fileType.startsWith('image/')) {
        textForm.setValue('headerImageId', data.mediaId);
        // If previewUrl is provided, also set it for immediate preview
        if (data.previewUrl) {
          textForm.setValue('headerImageUrl', data.previewUrl);
        }
        // Invalidate media query to trigger refetch for preview
        queryClient.invalidateQueries({ queryKey: ['/api/media', data.mediaId] });
        toast({
          title: "Image uploaded",
          description: `Image ID: ${data.mediaId.substring(0, 20)}...`,
        });
      } else if (fileType.startsWith('video/')) {
        textForm.setValue('headerVideoId', data.mediaId);
        if (data.previewUrl) {
          textForm.setValue('headerVideoUrl', data.previewUrl);
        }
        toast({
          title: "Video uploaded",
          description: `Video ID: ${data.mediaId.substring(0, 20)}...`,
        });
      } else {
        textForm.setValue('headerDocumentId', data.mediaId);
        if (data.previewUrl) {
          textForm.setValue('headerDocumentUrl', data.previewUrl);
        }
        if (data.filename || data.url) {
          textForm.setValue(
            'headerDocumentFilename',
            data.filename || String(data.url).split('/').pop() || undefined
          );
        }
        toast({
          title: "Document uploaded",
          description: `Document ID: ${data.mediaId.substring(0, 20)}...`,
        });
      }
      
      toast({
        title: "Media uploaded!",
        description: `Media uploaded successfully. Media ID: ${data.mediaId}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  const sendLocationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof locationMessageSchema>) => {
      // Collect all recipients
      const phoneNumbers: string[] = [];
      if (data.to) {
        phoneNumbers.push(...data.to.split(/[,\n]/).map(n => n.trim()).filter(n => n));
      }
      if (data.selectedContacts) {
        const contactNumbers = contacts.filter(c => data.selectedContacts?.includes(c.id)).map(c => c.phoneNumber);
        phoneNumbers.push(...contactNumbers);
      }
      if (data.selectedGroups) {
        const groupIds = groups.filter(g => data.selectedGroups?.includes(g.id)).map(g => g.whatsappGroupId).filter((id): id is string => !!id);
        phoneNumbers.push(...groupIds);
      }

      if (phoneNumbers.length === 0) {
        throw new Error('Please select at least one recipient');
      }

      const results = [];
      for (const phoneNumber of phoneNumbers) {
        const requestBody: any = {
          sessionId: data.sessionId,
          to: phoneNumber,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
        };

        // Add footer if provided
        if (data.footer) {
          requestBody.footer = data.footer;
        }

        // Add footer buttons if provided (prefer new multiple buttons format over old single button format)
        if (data.footerButtons && data.footerButtons.length > 0) {
          requestBody.footerButtons = data.footerButtons;
        } else if (data.footerButtonType && data.footerButtonType !== 'NONE' && data.footerButtonText) {
          // Fallback to old single button format for backward compatibility
          requestBody.footerButtonType = data.footerButtonType;
          requestBody.footerButtonText = data.footerButtonText;
          if (data.footerButtonUrl) {
            requestBody.footerButtonUrl = data.footerButtonUrl;
          }
          if (data.footerButtonPhone) {
            requestBody.footerButtonPhone = data.footerButtonPhone;
          }
        }

      const response = await fetch('/api/messages/send-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
          throw new Error(`Failed to send to ${phoneNumber}: ${error.error || 'Failed to send location'}`);
      }
        results.push(await response.json());
      }
      return { count: results.length, results };
    },
    onSuccess: (data) => {
      toast({
        title: "Location sent!",
        description: `Successfully sent to ${data.count} recipient(s).`,
      });
      locationForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send location",
        variant: "destructive",
      });
    },
  });

  const sendContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contactMessageSchema>) => {
      // Collect all recipients
      const phoneNumbers: string[] = [];
      if (data.to) {
        phoneNumbers.push(...data.to.split(/[,\n]/).map(n => n.trim()).filter(n => n));
      }
      if (data.selectedContacts) {
        const contactNumbers = contacts.filter(c => data.selectedContacts?.includes(c.id)).map(c => c.phoneNumber);
        phoneNumbers.push(...contactNumbers);
      }
      if (data.selectedGroups) {
        const groupIds = groups.filter(g => data.selectedGroups?.includes(g.id)).map(g => g.whatsappGroupId).filter((id): id is string => !!id);
        phoneNumbers.push(...groupIds);
      }

      if (phoneNumbers.length === 0) {
        throw new Error('Please select at least one recipient');
      }

      const results = [];
      for (const phoneNumber of phoneNumbers) {
        const requestBody: any = {
          sessionId: data.sessionId,
          to: phoneNumber,
          name: data.contactName,
          phone: data.contactPhone,
        };

        // Add email if provided
        if (data.email) {
          requestBody.email = data.email;
        }

        // Add footer if provided
        if (data.footer) {
          requestBody.footer = data.footer;
        }

        // Add footer buttons if provided (prefer new multiple buttons format over old single button format)
        if (data.footerButtons && data.footerButtons.length > 0) {
          requestBody.footerButtons = data.footerButtons;
        } else if (data.footerButtonType && data.footerButtonType !== 'NONE' && data.footerButtonText) {
          // Fallback to old single button format for backward compatibility
          requestBody.footerButtonType = data.footerButtonType;
          requestBody.footerButtonText = data.footerButtonText;
          if (data.footerButtonUrl) {
            requestBody.footerButtonUrl = data.footerButtonUrl;
          }
          if (data.footerButtonPhone) {
            requestBody.footerButtonPhone = data.footerButtonPhone;
          }
        }

        const response = await fetch('/api/messages/send-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          credentials: 'include',
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to send to ${phoneNumber}: ${error.error || 'Failed to send contact'}`);
        }
        results.push(await response.json());
      }
      return { count: results.length, results };
    },
    onSuccess: (data) => {
      toast({
        title: "Contact sent!",
        description: `Successfully sent to ${data.count} recipient(s).`,
      });
      contactForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send contact",
        variant: "destructive",
      });
    },
  });

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (connectedSessions.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              No connected WhatsApp sessions found. Please connect a device first.
            </p>
            <Button asChild>
              <a href="/connect">Connect Device</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Send Message</h1>
        <p className="text-muted-foreground">
          Send WhatsApp messages directly from the dashboard
        </p>
      </div>

      {/* Connection Type Tabs - Hidden during review, only showing Official */}
      {/* Message Type Tabs - Only show for Unofficial */}
      {false && connectionTypeTab === 'unofficial' ? (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="text" data-testid="tab-text-message">
            <Send className="h-4 w-4 mr-2" />
            Text
          </TabsTrigger>
          <TabsTrigger value="media" data-testid="tab-media-message">
            <Image className="h-4 w-4 mr-2" />
            Media
          </TabsTrigger>
          <TabsTrigger value="location" data-testid="tab-location-message">
            <MapPin className="h-4 w-4 mr-2" />
            Location
          </TabsTrigger>
          <TabsTrigger value="contact" data-testid="tab-contact-message">
            <User className="h-4 w-4 mr-2" />
            Contact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <div className="grid lg:grid-cols-[2.5fr_1fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Text Message</CardTitle>
                <CardDescription>
                  Send a text message to any WhatsApp number
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...textForm}>
                <form onSubmit={textForm.handleSubmit((data) => {
                  // Filter out incomplete buttons (buttons without text) before sending
                  const validButtons = (data.footerButtons || []).filter(btn => 
                    btn.text && btn.text.trim().length > 0
                  );
                  
                  sendTextMutation.mutate({
                    ...data,
                    footerButtons: validButtons.length > 0 ? validButtons : undefined,
                  });
                }, (errors) => {
                  // Handle validation errors
                  console.log('Form validation errors:', errors);
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields correctly.",
                    variant: "destructive",
                  });
                })} className="space-y-4">
                  <FormField
                    control={textForm.control}
                    name="sessionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Session</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-text">
                              <SelectValue placeholder="Select a connected session" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currentTabSessions.length === 0 ? (
                              <SelectItem value="no-sessions" disabled>
                                {connectionTypeTab === 'official' 
                                  ? 'No connected Business API sessions. Configure in Settings.'
                                  : 'No connected WhatsApp sessions. Go to Connect page to connect.'}
                              </SelectItem>
                            ) : (
                              currentTabSessions.map((session) => (
                              <SelectItem key={session.id} value={session.sessionId}>
                                {session.deviceInfo?.phoneNumber || session.sessionId}
                                  {connectionTypeTab === 'official' && ' (Business API)'}
                              </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Manual Phone Numbers
                      </h3>
                  <FormField
                    control={textForm.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="1234567890&#10;9876543210&#10;Or: 1234567890, 9876543210" 
                            className="min-h-24"
                            data-testid="input-recipient-text" 
                          />
                        </FormControl>
                        <FormDescription>
                          Enter one number per line or comma-separated (without + or country code symbols)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Select Contacts
                      </h3>
                      <FormField
                        control={textForm.control}
                        name="selectedContacts"
                        render={() => (
                  <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No contacts available. Go to Contacts page to add contacts.
                                </p>
                              ) : (
                                contacts.map((contact) => (
                                  <FormField
                                    key={contact.id}
                                    control={textForm.control}
                                    name="selectedContacts"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={contact.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(contact.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), contact.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== contact.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            <div className="flex items-center justify-between">
                                              <span>{contact.name || contact.phoneNumber}</span>
                                              <span className="text-xs text-muted-foreground ml-2">
                                                {contact.phoneNumber}
                                              </span>
                                            </div>
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more contacts to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Select Groups
                      </h3>
                      <FormField
                        control={textForm.control}
                        name="selectedGroups"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No groups available. Go to Groups page to create groups.
                                </p>
                              ) : (
                                groups.map((group) => (
                                  <FormField
                                    key={group.id}
                                    control={textForm.control}
                                    name="selectedGroups"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={group.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(group.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), group.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== group.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            <div>
                                              <div className="font-medium">{group.name}</div>
                                              {group.description && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  {group.description}
                                                </div>
                                              )}
                                            </div>
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more groups to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormItem>
                    <FormLabel>Select Template {isBusinessAPI ? '(Recommended for Business API)' : '(Optional)'}</FormLabel>
                    <Select
                      value={selectedTemplateId || ''}
                      onValueChange={(templateId) => {
                        setSelectedTemplateId(templateId);
                        const template = filteredTemplates.find(t => t.id === templateId);
                        if (template) {
                          setSelectedTemplate(template);
                          
                          // Set template name and language
                          textForm.setValue('templateName', template.name);
                          textForm.setValue('templateLanguage', template.language || 'en');
                          
                          // Check for HEADER component
                          const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
                          if (headerComponent) {
                            const format = headerComponent.format || 'TEXT';
                            setHeaderFormat(format);
                            
                            // Clear header media IDs
                            textForm.setValue('headerImageId', undefined);
                            textForm.setValue('headerVideoId', undefined);
                            textForm.setValue('headerDocumentId', undefined);
                          } else {
                            setHeaderFormat(null);
                          }
                          
                          // Extract body text and parameters
                          const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
                          if (bodyComponent?.text) {
                            textForm.setValue('message', bodyComponent.text);
                            
                            // Extract template parameters
                            const params = extractTemplateParams(bodyComponent.text);
                            // Ensure params are in correct format
                            const formattedParams = params.map(p => 
                              typeof p === 'string' ? { column: '', fallback: p } : p
                            );
                            setTemplateParams(formattedParams);
                            textForm.setValue('templateParams', formattedParams);
                          } else {
                            textForm.setValue('message', '');
                            setTemplateParams([]);
                            textForm.setValue('templateParams', []);
                          }
                        } else {
                          // Clear template selection
                          setSelectedTemplate(null);
                          setHeaderFormat(null);
                          textForm.setValue('templateName', undefined);
                          textForm.setValue('templateLanguage', 'en');
                          setTemplateParams([]);
                          textForm.setValue('templateParams', []);
                          textForm.setValue('headerImageId', undefined);
                          textForm.setValue('headerVideoId', undefined);
                          textForm.setValue('headerDocumentId', undefined);
                        }
                      }}
                      disabled={!templates || templates.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !templates || templates.length === 0 
                              ? "No templates available" 
                              : "Select a template to use"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templatesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading templates...
                          </SelectItem>
                        ) : templatesError ? (
                          <SelectItem value="error" disabled>
                            Error loading templates
                          </SelectItem>
                        ) : templates && templates.length > 0 ? (
                          templates
                            .filter(t => 
                              t.status?.toLowerCase() === 'approved' || 
                              t.metadata?.templateType === 'unofficial'
                            )
                            .map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name} ({template.category})
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="no-templates" disabled>
                            No templates available. Create templates in the Templates page.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select an approved template to send messages outside the 24-hour window. Templates work for all recipients.
                    </FormDescription>
                  </FormItem>
                  
                  {/* Template Header Media Input */}
                  {(isBusinessAPI && selectedTemplateId && headerFormat && headerFormat !== 'TEXT') ? (
                    <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold">
                          Template Header
                          {headerFormat ? ' (' + headerFormat + ')' : ''}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {headerFormat === 'IMAGE' ? "This template requires an IMAGE header. Select an image from gallery and provide the image ID." : null}
                          {headerFormat === 'VIDEO' ? "This template requires a VIDEO header. Upload a video first and provide the video ID." : null}
                          {headerFormat === 'DOCUMENT' ? "This template requires a DOCUMENT header. Upload a document first and provide the document ID." : null}
                        </p>
                      </div>
                      {headerFormat === 'IMAGE' ? (
                        <FormField
                          control={textForm.control}
                          name="headerImageId"
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Image ID <span className="text-destructive">*</span>
                                </FormLabel>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Enter WhatsApp image ID or upload image below"
                                        required
                                      />
                                    </FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        setGalleryDialogOpen(true);
                                        setGalleryFileType("image");
                                      }}
                                      disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                      title="Select from gallery"
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <FormDescription className="text-xs">
                                    Select an image from gallery or paste an existing WhatsApp image ID.
                                  </FormDescription>
                                </div>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      ) : null}
                      {headerFormat === 'VIDEO' ? (
                        <FormField
                          control={textForm.control}
                          name="headerVideoId"
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Video ID <span className="text-destructive">*</span>
                                </FormLabel>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Enter WhatsApp video ID or upload video below"
                                        required
                                      />
                                    </FormControl>
                                    <input
                                      type="file"
                                      id="header-video-upload"
                                      accept="video/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && selectedSessionId) {
                                          uploadMediaMutation.mutate({
                                            sessionId: selectedSessionId,
                                            file: file,
                                          });
                                        }
                                      }}
                                      disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const input = document.getElementById('header-video-upload');
                                        if (input) {
                                          input.click();
                                        }
                                      }}
                                      disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                    >
                                      {uploadMediaMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <FormDescription className="text-xs">
                                    Upload a video directly or paste an existing WhatsApp video ID.
                                  </FormDescription>
                                </div>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      ) : null}
                      {headerFormat === 'DOCUMENT' ? (
                        <FormField
                          control={textForm.control}
                          name="headerDocumentId"
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Document ID <span className="text-destructive">*</span>
                                </FormLabel>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Enter WhatsApp document ID or upload document below"
                                        required
                                      />
                                    </FormControl>
                                    <input
                                      type="file"
                                      id="header-document-upload"
                                      accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && selectedSessionId) {
                                          uploadMediaMutation.mutate({
                                            sessionId: selectedSessionId,
                                            file: file,
                                          });
                                        }
                                      }}
                                      disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const input = document.getElementById('header-document-upload');
                                        if (input) {
                                          input.click();
                                        }
                                      }}
                                      disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                    >
                                      {uploadMediaMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <FormDescription className="text-xs">
                                    Upload a document directly or paste an existing WhatsApp document ID.
                                  </FormDescription>
                                </div>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  
                  {/* Template Parameters Input */}
                  {selectedTemplateId && templateParams.length > 0 && isBusinessAPI && (
                    <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                      <FormLabel className="text-base font-semibold">Template Parameters</FormLabel>
                      <FormDescription className="text-sm mb-3">
                        Select columns to map to template variables. These will replace {'{{1}}'}, {'{{2}}'}, etc. in your template.
                      </FormDescription>
                      <div className="space-y-3">
                        {templateParams.map((param, index) => {
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
                                      const newParams = [...templateParams];
                                      newParams[index] = { ...newParams[index], column: value };
                                      setTemplateParams(newParams);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="name">Name</SelectItem>
                                      <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                      <SelectItem value="email">Email</SelectItem>
                                      {contactColumns
                                        .filter((col: any) => col && col.visible && col.id)
                                        .map((col: any) => (
                                          <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                            {col.label} (Custom Field)
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  {param.column && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Will use value from: {param.column === 'name' ? 'Name' : 
                                                           param.column === 'phoneNumber' ? 'Phone Number' : 
                                                           param.column === 'email' ? 'Email' :
                                                           param.column.startsWith('customFields.') ? param.column.replace('customFields.', '') : param.column}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground mb-1 block">Fallback value (optional)</Label>
                                  <Input
                                    placeholder="Enter fallback value"
                                    value={param.fallback || ''}
                                    maxLength={1024}
                                    onChange={(e) => {
                                      const newParams = [...templateParams];
                                      newParams[index] = {
                                        ...newParams[index],
                                        fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                                      };
                                      setTemplateParams(newParams);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <FormField
                    control={textForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message {selectedTemplateId && isBusinessAPI ? '(Template Preview)' : ''}</FormLabel>
                        <div className="space-y-2">
                          <MessageFormattingToolbar 
                            textareaRef={messageTextareaRef}
                            onFormat={(newValue) => textForm.setValue('message', newValue)}
                            onEmojiClick={() => {
                              // Focus textarea and trigger emoji picker
                              messageTextareaRef.current?.focus();
                            }}
                          />
                        <div className="flex gap-2">
                          <FormControl>
                            <Textarea 
                              {...field}
                              ref={messageTextareaRef}
                              placeholder="Type your message here..." 
                              className="min-h-32"
                              data-testid="input-message-text"
                            />
                          </FormControl>
                            <div className="flex flex-col gap-2">
                          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                            </div>
                          </div>
                          <FormDescription>
                            Formatting help available below
                          </FormDescription>
                          <div className="text-xs text-muted-foreground space-y-1 mt-1">
                            <div className="font-semibold">How to use formatting:</div>
                            <div>• <strong>Select text</strong> and click a button to transform it (e.g., select "Hello" → click Sans Serif → becomes "𝖧𝖾𝗅𝗅𝗈")</div>
                            <div>• <strong>Click without selection</strong> to insert a sample character</div>
                            <div>• <strong>WhatsApp formatting:</strong> Bold (*text*), Italic (_text_), Strikethrough (~text~), Monospace (```text```)</div>
                            <div>• <strong>Unicode styles:</strong> Transform text to fancy Unicode characters (Sans Serif, Cursive, Doublestruck, etc.)</div>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Footer Section */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                    <h3 className="text-sm font-semibold">Footer & Buttons (Optional)</h3>
                    <FormField
                      control={textForm.control}
                      name="footer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Footer Message</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              placeholder="Add a footer message..." 
                              data-testid="input-footer-text"
                            />
                          </FormControl>
                          <FormDescription>
                            Footer text will be appended to the message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={textForm.control}
                      name="footerButtons"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Buttons</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentButtons = field.value || [];
                                // Preserve existing buttons and add new empty button
                                const newButtons = [...currentButtons, { type: 'QUICK_REPLY' as const, text: '' }];
                                field.onChange(newButtons);
                                // Clear validation errors to prevent showing errors for new empty button
                                setTimeout(() => {
                                  textForm.clearErrors(`footerButtons`);
                                }, 0);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Button
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {(field.value || []).map((button, index) => (
                              <div key={index} className="p-4 border rounded-md space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Button {index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const currentButtons = field.value || [];
                                      field.onChange(currentButtons.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                <FormField
                                  control={textForm.control}
                                  name={`footerButtons.${index}.type`}
                                  render={({ field: typeField }) => (
                                    <FormItem>
                                      <FormLabel>Button Type</FormLabel>
                                      <Select 
                                        onValueChange={(value) => {
                                          typeField.onChange(value);
                                          // Clear action fields when type changes
                                          const currentButtons = field.value || [];
                                          const updatedButtons = [...currentButtons];
                                          updatedButtons[index] = {
                                            ...updatedButtons[index],
                                            type: value as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
                                            url: value === 'URL' ? updatedButtons[index]?.url : undefined,
                                            phoneNumber: value === 'PHONE_NUMBER' ? updatedButtons[index]?.phoneNumber : undefined,
                                          };
                                          field.onChange(updatedButtons);
                                          // Trigger validation after type change
                                          setTimeout(() => {
                                            textForm.trigger(`footerButtons.${index}`);
                                          }, 100);
                                        }} 
                                        value={typeField.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="QUICK_REPLY">Quick Reply Button</SelectItem>
                                          <SelectItem value="URL">URL Button</SelectItem>
                                          <SelectItem value="PHONE_NUMBER">Phone Number Button</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={textForm.control}
                                  name={`footerButtons.${index}.text`}
                                  render={({ field: textField }) => (
                                    <FormItem>
                                      <FormLabel>Button Text <span className="text-destructive">*</span></FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...textField}
                                          placeholder="Click here" 
                                          required
                                          onChange={(e) => {
                                            textField.onChange(e);
                                            // Trigger validation on change
                                            setTimeout(() => {
                                              textForm.trigger(`footerButtons.${index}.text`);
                                            }, 100);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                {button.type === 'QUICK_REPLY' && (
                                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                    <strong>Note:</strong> Quick Reply buttons only require button text. When clicked, the button text will be sent as a reply message.
                                  </div>
                                )}
                                {button.type === 'URL' && (
                                  <FormField
                                    control={textForm.control}
                                    name={`footerButtons.${index}.url`}
                                    render={({ field: urlField }) => (
                                      <FormItem>
                                        <FormLabel>URL (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...urlField}
                                            type="url"
                                            placeholder="https://example.com" 
                                            required
                                            onChange={(e) => {
                                              urlField.onChange(e);
                                              // Trigger validation on change
                                              setTimeout(() => {
                                                textForm.trigger(`footerButtons.${index}.url`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The URL that will open when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                                {button.type === 'PHONE_NUMBER' && (
                                  <FormField
                                    control={textForm.control}
                                    name={`footerButtons.${index}.phoneNumber`}
                                    render={({ field: phoneField }) => (
                                      <FormItem>
                                        <FormLabel>Phone Number (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...phoneField}
                                            placeholder="1234567890" 
                                            required
                                            onChange={(e) => {
                                              phoneField.onChange(e);
                                              // Trigger validation on change
                                              setTimeout(() => {
                                                textForm.trigger(`footerButtons.${index}.phoneNumber`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The phone number that will be called when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            ))}
                            {(!field.value || field.value.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No buttons added. Click "Add Button" to add one.
                              </p>
                            )}
                          </div>
                          <FormDescription>
                            Add multiple interactive buttons to your message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={sendTextMutation.isPending} data-testid="button-send-text">
                    {sendTextMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Right Side - Mobile Preview */}
          <Card className="sticky top-6 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your message will appear on WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl max-w-lg mx-auto w-full">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full">
                  {/* Phone Notch */}
                  <div className="h-6 bg-black rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-5 bg-black rounded-b-2xl"></div>
                  </div>
                  
                  {/* WhatsApp UI */}
                  <div className="bg-[#e5ddd5] min-h-[500px] flex flex-col">
                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Text Message</div>
                        <div className="text-xs opacity-90">WhatsApp</div>
                      </div>
                    </div>
                    
                    {/* Message Content Area */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {/* Message Body - Real-time preview */}
                      {(() => {
                        const message = textForm.watch('message') || '';
                        const footer = textForm.watch('footer') || '';
                        const footerButtons = textForm.watch('footerButtons') || [];
                        // Support both old single button format and new multiple buttons format
                        const footerButtonType = textForm.watch('footerButtonType') || 'NONE';
                        const footerButtonText = textForm.watch('footerButtonText') || '';
                        const footerButtonUrl = textForm.watch('footerButtonUrl') || '';
                        const footerButtonPhone = textForm.watch('footerButtonPhone') || '';
                        
                        const buttons = footerButtons.length > 0 
                          ? footerButtons 
                          : (footerButtonType !== 'NONE' && footerButtonText
                              ? [{
                                  type: footerButtonType,
                                  text: footerButtonText,
                                  url: footerButtonUrl,
                                  phoneNumber: footerButtonPhone,
                                }]
                              : []);
                        
                        let fullMessage = message;
                        if (footer) {
                          fullMessage = `${fullMessage}\n\n${footer}`;
                        }
                        for (const button of buttons) {
                          if (button.type === 'URL' && button.text && button.url) {
                            fullMessage = `${fullMessage}\n\n${button.text}: ${button.url}`;
                          } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
                            fullMessage = `${fullMessage}\n\n${button.text}: ${button.phoneNumber}`;
                          } else if (button.type === 'QUICK_REPLY' && button.text) {
                            fullMessage = `${fullMessage}\n\n${button.text}`;
                          }
                        }
                        
                        return fullMessage ? (
                          <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm ml-auto max-w-[80%]">
                            <div className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                              {fullMessage}
                            </div>
                            <div className="flex justify-end mt-2">
                              <span className="text-xs text-gray-500">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 16 15">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-200 rounded-lg p-3 ml-auto max-w-[80%]">
                            <div className="text-sm text-gray-400 italic">Type your message to see preview...</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="media">
          <div className="grid lg:grid-cols-[2.5fr_1fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Media Message</CardTitle>
                <CardDescription>
                  Send images, videos, or documents
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...textForm}>
                <form onSubmit={textForm.handleSubmit((data) => {
                  // Filter out incomplete buttons (buttons without text) before sending
                  const validButtons = (data.footerButtons || []).filter(btn => 
                    btn.text && btn.text.trim().length > 0
                  );
                  
                  sendMediaMutation.mutate({ 
                    sessionId: data.sessionId, 
                    to: data.to || '', 
                    caption: data.caption || '',
                    selectedContacts: data.selectedContacts,
                    selectedGroups: data.selectedGroups,
                    footer: data.footer,
                    footerButtonType: data.footerButtonType,
                    footerButtonText: data.footerButtonText,
                    footerButtonUrl: data.footerButtonUrl,
                    footerButtonPhone: data.footerButtonPhone,
                    footerButtons: validButtons.length > 0 ? validButtons : undefined,
                  });
                }, (errors) => {
                  // Handle validation errors
                  console.log('Form validation errors:', errors);
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields correctly.",
                    variant: "destructive",
                  });
                })} className="space-y-4">
                  <FormField
                    control={textForm.control}
                    name="sessionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Session</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-media">
                              <SelectValue placeholder="Select a connected session" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currentTabSessions.length === 0 ? (
                              <SelectItem value="no-sessions" disabled>
                                {connectionTypeTab === 'official' 
                                  ? 'No connected Business API sessions. Configure in Settings.'
                                  : 'No connected WhatsApp sessions. Go to Connect page to connect.'}
                              </SelectItem>
                            ) : (
                              currentTabSessions.map((session) => (
                                <SelectItem key={session.id} value={session.sessionId}>
                                  {session.deviceInfo?.phoneNumber || session.sessionId}
                                  {connectionTypeTab === 'official' && ' (Business API)'}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Manual Phone Numbers
                      </h3>
                      <FormField
                        control={textForm.control}
                        name="to"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="1234567890&#10;9876543210&#10;Or: 1234567890, 9876543210" 
                                className="min-h-24"
                                data-testid="input-recipient-media" 
                              />
                            </FormControl>
                            <FormDescription>
                              Enter one number per line or comma-separated (without + or country code symbols)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Select Contacts
                      </h3>
                      <FormField
                        control={textForm.control}
                        name="selectedContacts"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No contacts available. Go to Contacts page to add contacts.
                                </p>
                              ) : (
                                contacts.map((contact) => (
                                  <FormField
                                    key={contact.id}
                                    control={textForm.control}
                                    name="selectedContacts"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={contact.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(contact.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), contact.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== contact.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            <div>
                                              <div className="font-medium">{contact.name || contact.phoneNumber}</div>
                                              <div className="text-xs text-muted-foreground">{contact.phoneNumber}</div>
                                            </div>
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more contacts to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Select Groups
                      </h3>
                      <FormField
                        control={textForm.control}
                        name="selectedGroups"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No groups available. Go to Groups page to create groups.
                                </p>
                              ) : (
                                groups.map((group) => (
                                  <FormField
                                    key={group.id}
                                    control={textForm.control}
                                    name="selectedGroups"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={group.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(group.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), group.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== group.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            {group.name}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more groups to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">File</label>
                  <Input 
                    type="file" 
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                      // Clear previous file URL if any
                      if (file) {
                        // File will be previewed using URL.createObjectURL in the preview section
                      }
                    }}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    data-testid="input-file-media"
                  />
                  {selectedFile && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                      {selectedFile.type.startsWith('image/') && (
                        <div className="mt-2 rounded-lg overflow-hidden border max-w-xs">
                          <img 
                            src={URL.createObjectURL(selectedFile)} 
                            alt="Preview" 
                            className="w-full h-auto"
                            onLoad={(e) => {
                              // Revoke object URL after image loads to prevent memory leaks
                              const img = e.target as HTMLImageElement;
                              if (img.src.startsWith('blob:')) {
                                // Keep the blob URL for preview, will be cleaned up when component unmounts
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <FormField
                  control={textForm.control}
                  name="caption"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caption (Optional)</FormLabel>
                      <div className="space-y-2">
                        <MessageFormattingToolbar 
                          textareaRef={captionTextareaRef}
                          onFormat={(newValue) => textForm.setValue('caption', newValue)}
                          onEmojiClick={() => {
                            // Focus textarea and trigger emoji picker
                            captionTextareaRef.current?.focus();
                          }}
                        />
                        <div className="flex gap-2">
                          <FormControl>
                            <Textarea 
                              {...field}
                              ref={captionTextareaRef}
                              placeholder="Add a caption..." 
                              className="min-h-32"
                              data-testid="textarea-caption-media"
                            />
                          </FormControl>
                          <div className="flex flex-col gap-2">
                            <EmojiPicker onEmojiSelect={(emoji) => {
                              const captionTextarea = document.querySelector('[data-testid="textarea-caption-media"]') as HTMLTextAreaElement;
                              if (captionTextarea) {
                                const start = captionTextarea.selectionStart;
                                const end = captionTextarea.selectionEnd;
                                const currentValue = field.value || '';
                                const newValue = currentValue.substring(0, start) + emoji + currentValue.substring(end);
                                textForm.setValue('caption', newValue);
                                setTimeout(() => {
                                  captionTextarea.focus();
                                  captionTextarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                }, 0);
                              }
                            }} />
                          </div>
                        </div>
                        <FormDescription>
                          Formatting help available below
                        </FormDescription>
                        <div className="text-xs text-muted-foreground space-y-1 mt-1">
                          <div className="font-semibold">How to use formatting:</div>
                          <div>• <strong>Select text</strong> and click a button to transform it (e.g., select "Hello" → click Sans Serif → becomes "𝖧𝖾𝗅𝗅𝗈")</div>
                          <div>• <strong>Click without selection</strong> to insert a sample character</div>
                          <div>• <strong>WhatsApp formatting:</strong> Bold (*text*), Italic (_text_), Strikethrough (~text~), Monospace (```text```)</div>
                          <div>• <strong>Unicode styles:</strong> Transform text to fancy Unicode characters (Sans Serif, Cursive, Doublestruck, etc.)</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Footer Section */}
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <h3 className="text-sm font-semibold">Footer & Buttons (Optional)</h3>
                  <FormField
                    control={textForm.control}
                    name="footer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Message</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="Add a footer message..." 
                          />
                        </FormControl>
                        <FormDescription>
                          Footer text will be appended to the message
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={textForm.control}
                    name="footerButtons"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Buttons</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentButtons = field.value || [];
                              field.onChange([...currentButtons, { type: 'QUICK_REPLY' as const, text: '' }]);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Button
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {(field.value || []).map((button, index) => (
                            <div key={index} className="p-4 border rounded-md space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Button {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const currentButtons = field.value || [];
                                    field.onChange(currentButtons.filter((_, i) => i !== index));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              <FormField
                                control={textForm.control}
                                name={`footerButtons.${index}.type`}
                                render={({ field: typeField }) => (
                                  <FormItem>
                                    <FormLabel>Button Type</FormLabel>
                                    <Select onValueChange={typeField.onChange} value={typeField.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="QUICK_REPLY">Quick Reply Button</SelectItem>
                                        <SelectItem value="URL">URL Button</SelectItem>
                                        <SelectItem value="PHONE_NUMBER">Phone Number Button</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={textForm.control}
                                name={`footerButtons.${index}.text`}
                                render={({ field: textField }) => (
                                  <FormItem>
                                    <FormLabel>Button Text <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...textField}
                                        placeholder="Click here" 
                                        required
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              {button.type === 'URL' && (
                                <FormField
                                  control={textForm.control}
                                  name={`footerButtons.${index}.url`}
                                  render={({ field: urlField }) => (
                                    <FormItem>
                                      <FormLabel>URL <span className="text-destructive">*</span></FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...urlField}
                                          type="url"
                                          placeholder="https://example.com" 
                                          required
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                              {button.type === 'PHONE_NUMBER' && (
                                <FormField
                                  control={textForm.control}
                                  name={`footerButtons.${index}.phoneNumber`}
                                  render={({ field: phoneField }) => (
                                    <FormItem>
                                      <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...phoneField}
                                          placeholder="1234567890" 
                                          required
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          ))}
                          {(!field.value || field.value.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No buttons added. Click "Add Button" to add one.
                            </p>
                          )}
                        </div>
                        <FormDescription>
                          Add multiple interactive buttons to your message
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={sendMediaMutation.isPending || !selectedFile} data-testid="button-send-media">
                  {sendMediaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Image className="mr-2 h-4 w-4" />
                  Send Media
                </Button>
              </form>
              </Form>
            </CardContent>
          </Card>

          {/* Right Side - Mobile Preview */}
          <Card className="sticky top-6 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your media will appear on WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl max-w-lg mx-auto w-full">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full">
                  {/* Phone Notch */}
                  <div className="h-6 bg-black rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-5 bg-black rounded-b-2xl"></div>
                  </div>
                  
                  {/* WhatsApp UI */}
                  <div className="bg-[#e5ddd5] min-h-[500px] flex flex-col">
                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Media Message</div>
                        <div className="text-xs opacity-90">WhatsApp</div>
                      </div>
                    </div>
                    
                    {/* Message Content Area */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {/* Media Preview */}
                      {selectedFile ? (
                        <div className="bg-[#dcf8c6] rounded-lg p-2 shadow-sm ml-auto max-w-[80%]">
                          {selectedFile.type.startsWith('image/') && previewUrl ? (
                            <img 
                              src={previewUrl} 
                              alt="Preview" 
                              className="w-full rounded-lg mb-2"
                              onError={() => {
                                console.error('Failed to load preview image');
                              }}
                            />
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-3 mb-2">
                              <Image className="h-8 w-8 text-gray-500" />
                              <div>
                                <div className="text-sm font-medium text-gray-700">{selectedFile.name}</div>
                                <div className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                              </div>
                            </div>
                          )}
                          {(() => {
                            const caption = textForm.watch('caption') || '';
                            const footer = textForm.watch('footer') || '';
                            const footerButtons = textForm.watch('footerButtons') || [];
                            // Support both old single button format and new multiple buttons format
                            const footerButtonType = textForm.watch('footerButtonType') || 'NONE';
                            const footerButtonText = textForm.watch('footerButtonText') || '';
                            const footerButtonUrl = textForm.watch('footerButtonUrl') || '';
                            const footerButtonPhone = textForm.watch('footerButtonPhone') || '';
                            
                            const buttons = footerButtons.length > 0 
                              ? footerButtons 
                              : (footerButtonType !== 'NONE' && footerButtonText
                                  ? [{
                                      type: footerButtonType,
                                      text: footerButtonText,
                                      url: footerButtonUrl,
                                      phoneNumber: footerButtonPhone,
                                    }]
                                  : []);
                            
                            let fullCaption = caption;
                            if (footer) {
                              fullCaption = fullCaption ? `${fullCaption}\n\n${footer}` : footer;
                            }
                            for (const button of buttons) {
                              if (button.type === 'URL' && button.text && button.url) {
                                fullCaption = `${fullCaption}\n\n${button.text}: ${button.url}`;
                              } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
                                fullCaption = `${fullCaption}\n\n${button.text}: ${button.phoneNumber}`;
                              } else if (button.type === 'QUICK_REPLY' && button.text) {
                                fullCaption = `${fullCaption}\n\n${button.text}`;
                              }
                            }
                            
                            return fullCaption ? (
                              <div className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                                {fullCaption}
                              </div>
                            ) : null;
                          })()}
                          <div className="flex justify-end mt-2">
                            <span className="text-xs text-gray-500">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 16 15">
                              <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-200 rounded-lg p-3 ml-auto max-w-[80%]">
                          <div className="text-sm text-gray-400 italic">Select a file to see preview...</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="location">
          <div className="grid lg:grid-cols-[2.5fr_1fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Share Location</CardTitle>
                <CardDescription>
                  Send your location or any coordinates
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...locationForm}>
                <form onSubmit={locationForm.handleSubmit((data) => {
                  // Filter out incomplete buttons (buttons without text) before sending
                  const validButtons = (data.footerButtons || []).filter(btn => 
                    btn.text && btn.text.trim().length > 0
                  );
                  
                  sendLocationMutation.mutate({
                    ...data,
                    footerButtons: validButtons.length > 0 ? validButtons : undefined,
                  });
                }, (errors) => {
                  // Handle validation errors
                  console.log('Form validation errors:', errors);
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields correctly.",
                    variant: "destructive",
                  });
                })} className="space-y-4">
                  <FormField
                    control={locationForm.control}
                    name="sessionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Session</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-location">
                              <SelectValue placeholder="Select a connected session" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currentTabSessions.length === 0 ? (
                              <SelectItem value="no-sessions" disabled>
                                {connectionTypeTab === 'official' 
                                  ? 'No connected Business API sessions. Configure in Settings.'
                                  : 'No connected WhatsApp sessions. Go to Connect page to connect.'}
                              </SelectItem>
                            ) : (
                              currentTabSessions.map((session) => (
                              <SelectItem key={session.id} value={session.sessionId}>
                                {session.deviceInfo?.phoneNumber || session.sessionId}
                                  {connectionTypeTab === 'official' && ' (Business API)'}
                              </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Manual Phone Numbers
                      </h3>
                      <FormField
                        control={locationForm.control}
                        name="to"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="1234567890&#10;9876543210&#10;Or: 1234567890, 9876543210" 
                                className="min-h-24"
                                data-testid="input-recipient-location" 
                              />
                            </FormControl>
                            <FormDescription>
                              Enter one number per line or comma-separated (without + or country code symbols)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Select Contacts
                      </h3>
                      <FormField
                        control={locationForm.control}
                        name="selectedContacts"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No contacts available. Go to Contacts page to add contacts.
                                </p>
                              ) : (
                                contacts.map((contact) => (
                                  <FormField
                                    key={contact.id}
                                    control={locationForm.control}
                                    name="selectedContacts"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={contact.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(contact.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), contact.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== contact.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            <div>
                                              <div className="font-medium">{contact.name || contact.phoneNumber}</div>
                                              <div className="text-xs text-muted-foreground">{contact.phoneNumber}</div>
                                            </div>
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more contacts to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Select Groups
                      </h3>
                      <FormField
                        control={locationForm.control}
                        name="selectedGroups"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No groups available. Go to Groups page to create groups.
                                </p>
                              ) : (
                                groups.map((group) => (
                                  <FormField
                                    key={group.id}
                                    control={locationForm.control}
                                    name="selectedGroups"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={group.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(group.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), group.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== group.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            {group.name}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more groups to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={locationForm.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="any"
                              placeholder="37.7749"
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              data-testid="input-latitude"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="any"
                              placeholder="-122.4194"
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              data-testid="input-longitude"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={locationForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="San Francisco, CA" data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Footer Section */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                    <h3 className="text-sm font-semibold">Footer & Buttons (Optional)</h3>
                    <FormField
                      control={locationForm.control}
                      name="footer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Footer Message</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              placeholder="Add a footer message..." 
                            />
                          </FormControl>
                          <FormDescription>
                            Footer text will be appended to the message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="footerButtons"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Buttons</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentButtons = field.value || [];
                                // Preserve existing buttons and add new empty button
                                const newButtons = [...currentButtons, { type: 'QUICK_REPLY' as const, text: '' }];
                                field.onChange(newButtons);
                                // Clear validation errors to prevent showing errors for new empty button
                                setTimeout(() => {
                                  locationForm.clearErrors(`footerButtons`);
                                }, 0);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Button
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {(field.value || []).map((button, index) => (
                              <div key={index} className="p-4 border rounded-md space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Button {index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const currentButtons = field.value || [];
                                      field.onChange(currentButtons.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                <FormField
                                  control={locationForm.control}
                                  name={`footerButtons.${index}.type`}
                                  render={({ field: typeField }) => (
                                    <FormItem>
                                      <FormLabel>Button Type</FormLabel>
                                      <Select 
                                        onValueChange={(value) => {
                                          typeField.onChange(value);
                                          // Clear action fields when type changes
                                          const currentButtons = field.value || [];
                                          const updatedButtons = [...currentButtons];
                                          updatedButtons[index] = {
                                            ...updatedButtons[index],
                                            type: value as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
                                            url: value === 'URL' ? updatedButtons[index]?.url : undefined,
                                            phoneNumber: value === 'PHONE_NUMBER' ? updatedButtons[index]?.phoneNumber : undefined,
                                          };
                                          field.onChange(updatedButtons);
                                          // Trigger validation after type change
                                          setTimeout(() => {
                                            locationForm.trigger(`footerButtons.${index}`);
                                          }, 100);
                                        }} 
                                        value={typeField.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="QUICK_REPLY">Quick Reply Button</SelectItem>
                                          <SelectItem value="URL">URL Button</SelectItem>
                                          <SelectItem value="PHONE_NUMBER">Phone Number Button</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={locationForm.control}
                                  name={`footerButtons.${index}.text`}
                                  render={({ field: textField }) => (
                                    <FormItem>
                                      <FormLabel>Button Text <span className="text-destructive">*</span></FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...textField}
                                          placeholder="Click here" 
                                          required
                                          onChange={(e) => {
                                            textField.onChange(e);
                                            setTimeout(() => {
                                              locationForm.trigger(`footerButtons.${index}.text`);
                                            }, 100);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                {button.type === 'QUICK_REPLY' && (
                                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                    <strong>Note:</strong> Quick Reply buttons only require button text. When clicked, the button text will be sent as a reply message.
                                  </div>
                                )}
                                {button.type === 'URL' && (
                                  <FormField
                                    control={locationForm.control}
                                    name={`footerButtons.${index}.url`}
                                    render={({ field: urlField }) => (
                                      <FormItem>
                                        <FormLabel>URL (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...urlField}
                                            type="url"
                                            placeholder="https://example.com" 
                                            required
                                            onChange={(e) => {
                                              urlField.onChange(e);
                                              setTimeout(() => {
                                                locationForm.trigger(`footerButtons.${index}.url`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The URL that will open when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                                {button.type === 'PHONE_NUMBER' && (
                                  <FormField
                                    control={locationForm.control}
                                    name={`footerButtons.${index}.phoneNumber`}
                                    render={({ field: phoneField }) => (
                                      <FormItem>
                                        <FormLabel>Phone Number (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...phoneField}
                                            placeholder="1234567890" 
                                            required
                                            onChange={(e) => {
                                              phoneField.onChange(e);
                                              setTimeout(() => {
                                                locationForm.trigger(`footerButtons.${index}.phoneNumber`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The phone number that will be called when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            ))}
                            {(!field.value || field.value.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No buttons added. Click "Add Button" to add one.
                              </p>
                            )}
                          </div>
                          <FormDescription>
                            Add multiple interactive buttons to your message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={sendLocationMutation.isPending} data-testid="button-send-location">
                    {sendLocationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <MapPin className="mr-2 h-4 w-4" />
                    Share Location
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Right Side - Mobile Preview */}
          <Card className="sticky top-6 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your location will appear on WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl max-w-lg mx-auto w-full">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full">
                  {/* Phone Notch */}
                  <div className="h-6 bg-black rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-5 bg-black rounded-b-2xl"></div>
                  </div>
                  
                  {/* WhatsApp UI */}
                  <div className="bg-[#e5ddd5] min-h-[500px] flex flex-col">
                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Location Message</div>
                        <div className="text-xs opacity-90">WhatsApp</div>
                      </div>
                    </div>
                    
                    {/* Message Content Area */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {/* Location Preview */}
                      {(() => {
                        const latitude = locationForm.watch('latitude');
                        const longitude = locationForm.watch('longitude');
                        const address = locationForm.watch('address') || '';
                        const footer = locationForm.watch('footer') || '';
                        const footerButtons = locationForm.watch('footerButtons') || [];
                        // Support both old single button format and new multiple buttons format
                        const footerButtonType = locationForm.watch('footerButtonType') || 'NONE';
                        const footerButtonText = locationForm.watch('footerButtonText') || '';
                        const footerButtonUrl = locationForm.watch('footerButtonUrl') || '';
                        const footerButtonPhone = locationForm.watch('footerButtonPhone') || '';
                        
                        const buttons = footerButtons.length > 0 
                          ? footerButtons 
                          : (footerButtonType !== 'NONE' && footerButtonText
                              ? [{
                                  type: footerButtonType,
                                  text: footerButtonText,
                                  url: footerButtonUrl,
                                  phoneNumber: footerButtonPhone,
                                }]
                              : []);
                        
                        if (latitude && longitude) {
                          return (
                            <div className="bg-[#dcf8c6] rounded-lg p-2 shadow-sm ml-auto max-w-[80%]">
                              <div className="bg-gray-200 rounded-lg h-32 flex items-center justify-center mb-2">
                                <MapPin className="h-8 w-8 text-gray-500" />
                              </div>
                              {address && (
                                <div className="text-sm font-medium text-gray-800 mb-1">{address}</div>
                              )}
                              <div className="text-xs text-gray-600 mb-2">{latitude}, {longitude}</div>
                              {(() => {
                                let fullFooter = footer;
                                for (const button of buttons) {
                                  if (button.type === 'URL' && button.text && button.url) {
                                    fullFooter = `${fullFooter}\n\n${button.text}: ${button.url}`;
                                  } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
                                    fullFooter = `${fullFooter}\n\n${button.text}: ${button.phoneNumber}`;
                                  } else if (button.type === 'QUICK_REPLY' && button.text) {
                                    fullFooter = `${fullFooter}\n\n${button.text}`;
                                  }
                                }
                                return fullFooter ? (
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed border-t pt-2 mt-2">
                                    {fullFooter}
                                  </div>
                                ) : null;
                              })()}
                              <div className="flex justify-end mt-2">
                                <span className="text-xs text-gray-500">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 16 15">
                                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                                </svg>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-200 rounded-lg p-3 ml-auto max-w-[80%]">
                            <div className="text-sm text-gray-400 italic">Enter location to see preview...</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="contact">
          <div className="grid lg:grid-cols-[2.5fr_1fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Share Contact</CardTitle>
                <CardDescription>
                  Send a contact card to WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...contactForm}>
                <form onSubmit={contactForm.handleSubmit((data) => {
                  // Filter out incomplete buttons (buttons without text) before sending
                  const validButtons = (data.footerButtons || []).filter(btn => 
                    btn.text && btn.text.trim().length > 0
                  );
                  
                  sendContactMutation.mutate({
                    ...data,
                    footerButtons: validButtons.length > 0 ? validButtons : undefined,
                  });
                }, (errors) => {
                  // Handle validation errors
                  console.log('Form validation errors:', errors);
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields correctly.",
                    variant: "destructive",
                  });
                })} className="space-y-4">
                  <FormField
                    control={contactForm.control}
                    name="sessionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Session</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-session-contact">
                              <SelectValue placeholder="Select a connected session" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currentTabSessions.length === 0 ? (
                              <SelectItem value="no-sessions" disabled>
                                {connectionTypeTab === 'official' 
                                  ? 'No connected Business API sessions. Configure in Settings.'
                                  : 'No connected WhatsApp sessions. Go to Connect page to connect.'}
                              </SelectItem>
                            ) : (
                              currentTabSessions.map((session) => (
                              <SelectItem key={session.id} value={session.sessionId}>
                                {session.deviceInfo?.phoneNumber || session.sessionId}
                                  {connectionTypeTab === 'official' && ' (Business API)'}
                              </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Manual Phone Numbers
                      </h3>
                      <FormField
                        control={contactForm.control}
                        name="to"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="1234567890&#10;9876543210&#10;Or: 1234567890, 9876543210" 
                                className="min-h-24"
                                data-testid="input-recipient-contact" 
                              />
                            </FormControl>
                            <FormDescription>
                              Enter one number per line or comma-separated (without + or country code symbols)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Select Contacts
                      </h3>
                      <FormField
                        control={contactForm.control}
                        name="selectedContacts"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No contacts available. Go to Contacts page to add contacts.
                                </p>
                              ) : (
                                contacts.map((contact) => (
                                  <FormField
                                    key={contact.id}
                                    control={contactForm.control}
                                    name="selectedContacts"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={contact.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(contact.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), contact.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== contact.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            <div>
                                              <div className="font-medium">{contact.name || contact.phoneNumber}</div>
                                              <div className="text-xs text-muted-foreground">{contact.phoneNumber}</div>
                                            </div>
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more contacts to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Select Groups
                      </h3>
                      <FormField
                        control={contactForm.control}
                        name="selectedGroups"
                        render={() => (
                          <FormItem>
                            <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                              {groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No groups available. Go to Groups page to create groups.
                                </p>
                              ) : (
                                groups.map((group) => (
                                  <FormField
                                    key={group.id}
                                    control={contactForm.control}
                                    name="selectedGroups"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={group.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(group.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...(field.value || []), group.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== group.id
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer flex-1">
                                            {group.name}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            <FormDescription>
                              Select one or more groups to send the message to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={contactForm.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" data-testid="input-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="9876543210" data-testid="input-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Footer Section */}
                  <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                    <h3 className="text-sm font-semibold">Footer & Buttons (Optional)</h3>
                    <FormField
                      control={contactForm.control}
                      name="footer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Footer Message</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              placeholder="Add a footer message..." 
                            />
                          </FormControl>
                          <FormDescription>
                            Footer text will be appended to the message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="footerButtons"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Buttons</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentButtons = field.value || [];
                                // Preserve existing buttons and add new empty button
                                const newButtons = [...currentButtons, { type: 'QUICK_REPLY' as const, text: '' }];
                                field.onChange(newButtons);
                                // Clear validation errors to prevent showing errors for new empty button
                                setTimeout(() => {
                                  contactForm.clearErrors(`footerButtons`);
                                }, 0);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Button
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {(field.value || []).map((button, index) => (
                              <div key={index} className="p-4 border rounded-md space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Button {index + 1}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const currentButtons = field.value || [];
                                      field.onChange(currentButtons.filter((_, i) => i !== index));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                <FormField
                                  control={contactForm.control}
                                  name={`footerButtons.${index}.type`}
                                  render={({ field: typeField }) => (
                                    <FormItem>
                                      <FormLabel>Button Type</FormLabel>
                                      <Select 
                                        onValueChange={(value) => {
                                          typeField.onChange(value);
                                          // Clear action fields when type changes
                                          const currentButtons = field.value || [];
                                          const updatedButtons = [...currentButtons];
                                          updatedButtons[index] = {
                                            ...updatedButtons[index],
                                            type: value as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
                                            url: value === 'URL' ? updatedButtons[index]?.url : undefined,
                                            phoneNumber: value === 'PHONE_NUMBER' ? updatedButtons[index]?.phoneNumber : undefined,
                                          };
                                          field.onChange(updatedButtons);
                                          // Trigger validation after type change
                                          setTimeout(() => {
                                            contactForm.trigger(`footerButtons.${index}`);
                                          }, 100);
                                        }} 
                                        value={typeField.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="QUICK_REPLY">Quick Reply Button</SelectItem>
                                          <SelectItem value="URL">URL Button</SelectItem>
                                          <SelectItem value="PHONE_NUMBER">Phone Number Button</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={contactForm.control}
                                  name={`footerButtons.${index}.text`}
                                  render={({ field: textField }) => (
                                    <FormItem>
                                      <FormLabel>Button Text <span className="text-destructive">*</span></FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...textField}
                                          placeholder="Click here" 
                                          required
                                          onChange={(e) => {
                                            textField.onChange(e);
                                            setTimeout(() => {
                                              contactForm.trigger(`footerButtons.${index}.text`);
                                            }, 100);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                {button.type === 'QUICK_REPLY' && (
                                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                    <strong>Note:</strong> Quick Reply buttons only require button text. When clicked, the button text will be sent as a reply message.
                                  </div>
                                )}
                                {button.type === 'URL' && (
                                  <FormField
                                    control={contactForm.control}
                                    name={`footerButtons.${index}.url`}
                                    render={({ field: urlField }) => (
                                      <FormItem>
                                        <FormLabel>URL (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...urlField}
                                            type="url"
                                            placeholder="https://example.com" 
                                            required
                                            onChange={(e) => {
                                              urlField.onChange(e);
                                              setTimeout(() => {
                                                contactForm.trigger(`footerButtons.${index}.url`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The URL that will open when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                                {button.type === 'PHONE_NUMBER' && (
                                  <FormField
                                    control={contactForm.control}
                                    name={`footerButtons.${index}.phoneNumber`}
                                    render={({ field: phoneField }) => (
                                      <FormItem>
                                        <FormLabel>Phone Number (Action) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...phoneField}
                                            placeholder="1234567890" 
                                            required
                                            onChange={(e) => {
                                              phoneField.onChange(e);
                                              setTimeout(() => {
                                                contactForm.trigger(`footerButtons.${index}.phoneNumber`);
                                              }, 100);
                                            }}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          The phone number that will be called when the button is clicked
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            ))}
                            {(!field.value || field.value.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No buttons added. Click "Add Button" to add one.
                              </p>
                            )}
                          </div>
                          <FormDescription>
                            Add multiple interactive buttons to your message
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={sendContactMutation.isPending} data-testid="button-send-contact">
                    {sendContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <User className="mr-2 h-4 w-4" />
                    Share Contact
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Right Side - Mobile Preview */}
          <Card className="sticky top-6 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your contact will appear on WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl max-w-lg mx-auto w-full">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full">
                  {/* Phone Notch */}
                  <div className="h-6 bg-black rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-5 bg-black rounded-b-2xl"></div>
                  </div>
                  
                  {/* WhatsApp UI */}
                  <div className="bg-[#e5ddd5] min-h-[500px] flex flex-col">
                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Contact Message</div>
                        <div className="text-xs opacity-90">WhatsApp</div>
                      </div>
                    </div>
                    
                    {/* Message Content Area */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {/* Contact Preview */}
                      {(() => {
                        const contactName = contactForm.watch('contactName') || '';
                        const contactPhone = contactForm.watch('contactPhone') || '';
                        const footer = contactForm.watch('footer') || '';
                        const footerButtons = contactForm.watch('footerButtons') || [];
                        // Support both old single button format and new multiple buttons format
                        const footerButtonType = contactForm.watch('footerButtonType') || 'NONE';
                        const footerButtonText = contactForm.watch('footerButtonText') || '';
                        const footerButtonUrl = contactForm.watch('footerButtonUrl') || '';
                        const footerButtonPhone = contactForm.watch('footerButtonPhone') || '';
                        
                        const buttons = footerButtons.length > 0 
                          ? footerButtons 
                          : (footerButtonType !== 'NONE' && footerButtonText
                              ? [{
                                  type: footerButtonType,
                                  text: footerButtonText,
                                  url: footerButtonUrl,
                                  phoneNumber: footerButtonPhone,
                                }]
                              : []);
                        
                        if (contactName || contactPhone) {
                          return (
                            <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm ml-auto max-w-[80%]">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-[#075e54] flex items-center justify-center">
                                  <User className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-800">{contactName || 'Contact Name'}</div>
                                  <div className="text-xs text-gray-600">{contactPhone || 'Phone Number'}</div>
                                </div>
                              </div>
                              {(() => {
                                let fullFooter = footer;
                                for (const button of buttons) {
                                  if (button.type === 'URL' && button.text && button.url) {
                                    fullFooter = `${fullFooter}\n\n${button.text}: ${button.url}`;
                                  } else if (button.type === 'PHONE_NUMBER' && button.text && button.phoneNumber) {
                                    fullFooter = `${fullFooter}\n\n${button.text}: ${button.phoneNumber}`;
                                  } else if (button.type === 'QUICK_REPLY' && button.text) {
                                    fullFooter = `${fullFooter}\n\n${button.text}`;
                                  }
                                }
                                return fullFooter ? (
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed border-t pt-2 mt-2">
                                    {fullFooter}
                                  </div>
                                ) : null;
                              })()}
                              <div className="flex justify-end mt-2">
                                <span className="text-xs text-gray-500">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                <svg className="w-4 h-4 ml-1 text-gray-500" fill="currentColor" viewBox="0 0 16 15">
                                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                                </svg>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-gray-200 rounded-lg p-3 ml-auto max-w-[80%]">
                            <div className="text-sm text-gray-400 italic">Enter contact details to see preview...</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2.5fr_1fr] gap-6">
          {/* Left Side - Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send Message (Business API)</CardTitle>
              <CardDescription>
                Send template messages using WhatsApp Business API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...textForm}>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  textForm.handleSubmit((data) => sendTextMutation.mutate(data))();
                }} className="space-y-4">
                {/* Session Selection */}
                <FormField
                  control={textForm.control}
                  name="sessionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Session</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a Business API session" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currentTabSessions.length === 0 ? (
                            <SelectItem value="no-sessions" disabled>
                              No connected Business API sessions. Configure in Settings.
                            </SelectItem>
                          ) : (
                            currentTabSessions.map((session) => (
                              <SelectItem key={session.id} value={session.sessionId}>
                                {session.deviceInfo?.phoneNumber || session.sessionId} (Business API)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Recipients - Manual and Contacts only (no groups for Business API) */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Manual Phone Numbers
                    </h3>
                    <FormField
                      control={textForm.control}
                      name="to"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="1234567890&#10;9876543210&#10;Or: 1234567890, 9876543210" 
                              className="min-h-24"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter one number per line or comma-separated (without + or country code symbols)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
    </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Select Contacts
                    </h3>
                    <FormField
                      control={textForm.control}
                      name="selectedContacts"
                      render={() => (
                        <FormItem>
                          <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                            {contacts.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No contacts available. Go to Contacts page to add contacts.
                              </p>
                            ) : (
                              contacts.map((contact) => (
                                <FormField
                                  key={contact.id}
                                  control={textForm.control}
                                  name="selectedContacts"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={contact.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(contact.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), contact.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== contact.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer flex-1">
                                          <div>
                                            <div className="font-medium">{contact.name || contact.phoneNumber}</div>
                                            <div className="text-xs text-muted-foreground">{contact.phoneNumber}</div>
                                          </div>
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))
                            )}
                          </div>
                          <FormDescription>
                            Select one or more contacts to send the message to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Template Selection */}
                <FormItem>
                  <FormLabel>Select Template (Recommended for Business API)</FormLabel>
                  <Select
                    value={selectedTemplateId || ''}
                    onValueChange={(templateId) => {
                      setSelectedTemplateId(templateId);
                      const template = filteredTemplates.find(t => t.id === templateId);
                      if (template) {
                        setSelectedTemplate(template);
                        
                        textForm.setValue('templateName', template.name);
                        textForm.setValue('templateLanguage', template.language || 'en');
                        
                        const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
                        if (headerComponent) {
                          const format = headerComponent.format || 'TEXT';
                          setHeaderFormat(format);
                          
                          textForm.setValue('headerImageId', undefined);
                          textForm.setValue('headerVideoId', undefined);
                          textForm.setValue('headerDocumentId', undefined);
                        } else {
                          setHeaderFormat(null);
                        }
                        
                        const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
                        if (bodyComponent?.text) {
                          // Don't set message field for official tab - we'll use template body directly
                          const params = extractTemplateParams(bodyComponent.text);
                          setTemplateParams(params);
                          textForm.setValue('templateParams', params);
                        } else {
                          setTemplateParams([]);
                          textForm.setValue('templateParams', []);
                        }
                      } else {
                        setSelectedTemplate(null);
                        setHeaderFormat(null);
                        textForm.setValue('templateName', undefined);
                        textForm.setValue('templateLanguage', 'en');
                        setTemplateParams([]);
                        textForm.setValue('templateParams', []);
                        textForm.setValue('headerImageId', undefined);
                        textForm.setValue('headerVideoId', undefined);
                        textForm.setValue('headerDocumentId', undefined);
                      }
                    }}
                    disabled={!filteredTemplates || filteredTemplates.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !filteredTemplates || filteredTemplates.length === 0 
                            ? "No templates available" 
                            : "Select a template to use"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templatesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading templates...
                        </SelectItem>
                      ) : templatesError ? (
                        <SelectItem value="error" disabled>
                          Error loading templates
                        </SelectItem>
                      ) : filteredTemplates && filteredTemplates.length > 0 ? (
                        filteredTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.category})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-templates" disabled>
                          No approved templates available for this session. Create templates in the Templates page.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select an approved template to send messages outside the 24-hour window. Templates work for all recipients.
                  </FormDescription>
                </FormItem>

                {/* Template Header Media Input */}
                {selectedTemplateId && headerFormat && headerFormat !== 'TEXT' ? (
                  <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold">
                        Template Header
                        {headerFormat ? ' (' + headerFormat + ')' : ''}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {headerFormat === 'IMAGE' ? "This template requires an IMAGE header. Upload an image first and provide the image ID." : null}
                        {headerFormat === 'VIDEO' ? "This template requires a VIDEO header. Upload a video first and provide the video ID." : null}
                        {headerFormat === 'DOCUMENT' ? "This template requires a DOCUMENT header. Upload a document first and provide the document ID." : null}
                      </p>
                    </div>
                    {headerFormat === 'IMAGE' ? (
                      <FormField
                        control={textForm.control}
                        name="headerImageId"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Image ID <span className="text-destructive">*</span>
                              </FormLabel>
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Enter WhatsApp image ID or upload image below"
                                      required
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      setGalleryDialogOpen(true);
                                      setGalleryFileType("image");
                                    }}
                                    disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                    title="Select from gallery"
                                  >
                                    {uploadMediaMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ImageIcon className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <FormDescription className="text-xs">
                                  Select an image from gallery or paste an existing WhatsApp image ID.
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    ) : null}
                    {headerFormat === 'VIDEO' ? (
                      <FormField
                        control={textForm.control}
                        name="headerVideoId"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Video ID <span className="text-destructive">*</span>
                              </FormLabel>
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Enter WhatsApp video ID or upload video below"
                                      required
                                    />
                                  </FormControl>
                                  <input
                                    type="file"
                                    id="header-video-upload-official"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file && selectedSessionId) {
                                        uploadMediaMutation.mutate({
                                          sessionId: selectedSessionId,
                                          file: file,
                                        });
                                      }
                                    }}
                                    disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      const input = document.getElementById('header-video-upload-official');
                                      if (input) {
                                        input.click();
                                      }
                                    }}
                                    disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                  >
                                    {uploadMediaMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <FormDescription className="text-xs">
                                  Upload a video directly or paste an existing WhatsApp video ID.
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    ) : null}
                    {headerFormat === 'DOCUMENT' ? (
                      <FormField
                        control={textForm.control}
                        name="headerDocumentId"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Document ID <span className="text-destructive">*</span>
                              </FormLabel>
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Enter WhatsApp document ID or upload document below"
                                      required
                                    />
                                  </FormControl>
                                  <input
                                    type="file"
                                    id="header-document-upload-official"
                                    accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file && selectedSessionId) {
                                        uploadMediaMutation.mutate({
                                          sessionId: selectedSessionId,
                                          file: file,
                                        });
                                      }
                                    }}
                                    disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      const input = document.getElementById('header-document-upload-official');
                                      if (input) {
                                        input.click();
                                      }
                                    }}
                                    disabled={uploadMediaMutation.isPending || !selectedSessionId}
                                  >
                                    {uploadMediaMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <FormDescription className="text-xs">
                                  Upload a document directly or paste an existing WhatsApp document ID.
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}

                {/* Template Parameters Input */}
                {selectedTemplateId && templateParams.length > 0 ? (
                  <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                    <FormLabel className="text-base font-semibold">Template Parameters</FormLabel>
                    <FormDescription className="text-sm mb-3">
                      Select columns to map to template variables. These will replace {'{{1}}'}, {'{{2}}'}, etc. in your template.
                    </FormDescription>
                    <div className="space-y-3">
                      {templateParams.map((param, index) => {
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
                                    const newParams = [...templateParams];
                                    newParams[index] = { ...newParams[index], column: value };
                                    setTemplateParams(newParams);
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select column" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    {contactColumns
                                      .filter((col: any) => col && col.visible && col.id)
                                      .map((col: any) => (
                                        <SelectItem key={col.id} value={`customFields.${col.label}`}>
                                          {col.label} (Custom Field)
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                {param.column && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Will use value from: {param.column === 'name' ? 'Name' : 
                                                         param.column === 'phoneNumber' ? 'Phone Number' : 
                                                         param.column === 'email' ? 'Email' :
                                                         param.column.startsWith('customFields.') ? param.column.replace('customFields.', '') : param.column}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Fallback value (optional)</Label>
                                <Input
                                  placeholder="Enter fallback value"
                                  value={param.fallback || ''}
                                  maxLength={1024}
                                  onChange={(e) => {
                                    const newParams = [...templateParams];
                                    newParams[index] = {
                                      ...newParams[index],
                                      fallback: e.target.value.replace(/\r\n|\r|\n/g, " "),
                                    };
                                    setTemplateParams(newParams);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Right Side - Mobile Preview */}
          <Card className="sticky top-6 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your message will appear on WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl max-w-lg mx-auto w-full">
                <div className="bg-white rounded-[2rem] overflow-hidden w-full">
                  {/* Phone Notch */}
                  <div className="h-6 bg-black rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-5 bg-black rounded-b-2xl"></div>
                  </div>
                  
                  {/* WhatsApp UI */}
                  <div className="bg-[#efeae2] min-h-[500px] flex flex-col" style={{
                    backgroundImage: 'url(/whatsapp-background.svg)',
                    backgroundSize: '400px 400px',
                    backgroundRepeat: 'repeat',
                    backgroundPosition: '0 0',
                  }}>
                    {/* WhatsApp Header */}
                    <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Template Message</div>
                        <div className="text-xs opacity-90">{selectedTemplate?.name || 'Select a template'}</div>
                      </div>
                    </div>
                    
                    {/* Message Content Area */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {/* Header Image/Video/Document - Real-time preview */}
                      {headerFormat === 'IMAGE' && textForm.watch('headerImageId') && (
                        <div className="mb-2">
                          <MessagePreviewImage 
                            sessionId={selectedSessionId || ''} 
                            mediaId={textForm.watch('headerImageId') || ''}
                            previewUrl={textForm.watch('headerImageUrl') || undefined}
                          />
                        </div>
                      )}
                      {headerFormat === 'VIDEO' && textForm.watch('headerVideoId') && (
                        <div className="rounded-lg overflow-hidden bg-gray-100 border">
                          <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center">
                            <Image className="h-16 w-16 text-gray-500 mb-2" />
                            <span className="text-sm text-gray-600 font-medium">Video Header</span>
                          </div>
                        </div>
                      )}
                      {headerFormat === 'DOCUMENT' && textForm.watch('headerDocumentId') && (
                        <div className="rounded-lg border-2 border-gray-300 p-4 bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                              <Image className="h-6 w-6 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700">Document Attachment</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Body Text - Real-time preview with parameters */}
                      {selectedTemplateId && (() => {
                        const template = filteredTemplates.find(t => t.id === selectedTemplateId);
                        
                        // Get selected contact for preview
                        const formData = textForm.getValues();
                        const selectedContact = formData.selectedContacts && formData.selectedContacts.length > 0
                          ? contacts.find(c => c.id === formData.selectedContacts[0])
                          : formData.to
                            ? contacts.find(c => c.phoneNumber === formData.to.replace(/[^0-9]/g, ''))
                            : null;
                        
                        // Get preview text with resolved values
                        const previewText = getPreviewText(template, templateParams, selectedContact || undefined);
                        
                        return previewText ? (
                          <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm ml-auto max-w-[80%]" style={{ borderRadius: '7.5px 0 7.5px 7.5px' }}>
                            <div className="text-sm text-[#303030] whitespace-pre-wrap break-words leading-relaxed">
                              {previewText}
                            </div>
                            
                            {/* Footer */}
                            {template?.components?.find((c: any) => c.type === 'FOOTER')?.text && (
                              <div className="text-xs text-[#667781] pt-2 mt-2 border-t border-[#667781]/20">
                                {template.components.find((c: any) => c.type === 'FOOTER').text}
                              </div>
                            )}
                            
                            {/* Buttons */}
                            {template?.components?.find((c: any) => c.type === 'BUTTONS')?.buttons && (() => {
                              const buttons = template.components.find((c: any) => c.type === 'BUTTONS').buttons || [];
                              if (buttons.length > 0) {
                                return (
                                  <div className="mt-3 space-y-2">
                                    {buttons.map((button: any, index: number) => {
                                      if (button.type === 'QUICK_REPLY') {
                                        return (
                                          <button key={index} className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                                            {button.text || `Button ${index + 1}`}
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
                              }
                              return null;
                            })()}
                            
                            <div className="flex justify-end mt-2">
                              <span className="text-xs text-[#667781]">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              <svg className="w-4 h-4 ml-1 text-[#53bdeb]" fill="currentColor" viewBox="0 0 16 15">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.174.532.074l6.275-3.577a.444.444 0 0 0 .19-.631l-.494-.762a.302.302 0 0 0-.338-.15z"/>
                              </svg>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Button Below Preview */}
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const formData = textForm.getValues();
                  
                  // Validate required fields
                  if (!formData.sessionId) {
                    toast({
                      title: "Error",
                      description: "Please select a session",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (!selectedTemplateId) {
                    toast({
                      title: "Error",
                      description: "Please select a template",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Check if template has required header media
                  if (headerFormat === 'IMAGE' && !formData.headerImageId) {
                    toast({
                      title: "Error",
                      description: "Please upload an image for the template header",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (headerFormat === 'VIDEO' && !formData.headerVideoId) {
                    toast({
                      title: "Error",
                      description: "Please upload a video for the template header",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (headerFormat === 'DOCUMENT' && !formData.headerDocumentId) {
                    toast({
                      title: "Error",
                      description: "Please upload a document for the template header",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Submit the form
                  textForm.handleSubmit((data) => {
                    sendTextMutation.mutate(data);
                  }, (errors) => {
                    console.error('Form validation errors:', errors);
                    toast({
                      title: "Validation Error",
                      description: "Please check all required fields are filled",
                      variant: "destructive",
                    });
                  })();
                }}
                disabled={sendTextMutation.isPending || !selectedTemplateId || !selectedSessionId}
                className="w-full mt-4"
              >
                {sendTextMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gallery Dialog */}
      <Dialog open={galleryDialogOpen} onOpenChange={setGalleryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileIcon className="w-5 h-5" />
              Select Image from Gallery
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
                  variant={galleryFileType === "image" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGalleryFileType("image")}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  Photos
                </Button>
                <div className="flex-1"></div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
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
              {galleryLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading gallery...</p>
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No images in gallery</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {mediaItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors group"
                      onClick={async () => {
                        if (item.type === 'image' && selectedSessionId) {
                          try {
                            // Set preview URL immediately
                            setHeaderImageUrl(item.url);
                            textForm.setValue('headerImageUrl', item.url);
                            
                            // Fetch the image and upload to WhatsApp to get media ID
                            const response = await fetch(item.url);
                            const blob = await response.blob();
                            const file = new File([blob], item.name, { type: blob.type });
                            
                            // Upload to WhatsApp to get media ID
                            uploadMediaMutation.mutate({
                              sessionId: selectedSessionId,
                              file: file,
                            });
                            
                            setGalleryDialogOpen(false);
                          } catch (error: any) {
                            toast({
                              title: "Failed to load image",
                              description: error.message || "Please try again",
                              variant: "destructive",
                            });
                          }
                        }
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
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Enter image URL (https://...)</label>
                <div className="flex gap-2">
                  <Input
                    id="image-url-input"
                    placeholder="https://..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const url = input.value.trim();
                        if (url && selectedSessionId) {
                          setHeaderImageUrl(url);
                          textForm.setValue('headerImageUrl', url);
                          // Fetch and upload the image
                          fetch(url)
                            .then(res => res.blob())
                            .then(blob => {
                              const file = new File([blob], 'image.jpg', { type: blob.type });
                              uploadMediaMutation.mutate({
                                sessionId: selectedSessionId,
                                file: file,
                              });
                              setGalleryDialogOpen(false);
                            })
                            .catch((error: any) => {
                              toast({
                                title: "Failed to load image",
                                description: error.message || "Please check the URL",
                                variant: "destructive",
                              });
                            });
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('image-url-input') as HTMLInputElement;
                      const url = input?.value.trim();
                      if (url && selectedSessionId) {
                        setHeaderImageUrl(url);
                        textForm.setValue('headerImageUrl', url);
                        fetch(url)
                          .then(res => res.blob())
                          .then(blob => {
                            const file = new File([blob], 'image.jpg', { type: blob.type });
                            uploadMediaMutation.mutate({
                              sessionId: selectedSessionId,
                              file: file,
                            });
                            setGalleryDialogOpen(false);
                          })
                          .catch((error: any) => {
                            toast({
                              title: "Failed to load image",
                              description: error.message || "Please check the URL",
                              variant: "destructive",
                            });
                          });
                      }
                    }}
                  >
                    Load
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
