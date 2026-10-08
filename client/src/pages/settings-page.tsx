// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { toastPlanLimitOrError } from "@/lib/plan-limit-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  User, 
  Users, 
  Building2, 
  CreditCard, 
  Camera, 
  Mail, 
  Phone, 
  Plus, 
  X, 
  Send,
  Shield,
  Crown,
  UserIcon,
  Lock,
  Pencil,
  Key,
  Copy,
  Trash2,
  ExternalLink,
  Bell,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square
} from "lucide-react";
import { requestNotificationPermission } from "@/hooks/useNotifications";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhScrollTabs } from "@/panel-templates/ratehonk-v1/components/rh";
import { cn } from "@/lib/utils";
import { LiveChatSettingsTab } from "@/components/live-chat-settings-tab";

type Organization = {
  id: string;
  name: string;
  ownerId: string;
  logo?: string | null;
  industry?: string | null;
  website?: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  permissions?: string[];
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  } | null;
};

type InviteMember = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  permissions: string[];
};

// Features that exist in the site (sidebar) with their CRUD/operations
type PermissionOperation = { key: string; label: string };
type FeaturePermission = { key: string; label: string; operations: PermissionOperation[] };

// Dashboard is not listed: everyone can view the dashboard.
// Aligned with sidebar: only features that exist in the app. Each permission is separate.
const FEATURE_PERMISSIONS: FeaturePermission[] = [
  { key: "inbox", label: "Inbox", operations: [{ key: "view", label: "View" }, { key: "send", label: "Send" }, { key: "assign", label: "Assign" }, { key: "delete", label: "Delete" }, { key: "close", label: "Close" }] },
  { key: "reminders", label: "Reminders", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "meetings", label: "Meetings", operations: [{ key: "view", label: "View" }] },
  { key: "flows", label: "Flows", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "manage_templates", label: "Whatsapp Templates", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }, { key: "sync", label: "Sync" }] },
  { key: "groups", label: "Groups", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "manage_contacts", label: "Contacts", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }, { key: "import", label: "Import" }, { key: "export", label: "Export" }] },
  { key: "manage_campaigns", label: "Campaigns", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }, { key: "send", label: "Send" }, { key: "schedule", label: "Schedule" }] },
  { key: "whatsapp_forms", label: "Whatsapp Forms", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "canned_messages", label: "Canned Messages", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "tags", label: "Tags", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "columns", label: "Columns", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "opts_management", label: "Opts Management", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "webhook_events", label: "Webhook Events", operations: [{ key: "view", label: "View" }] },
  { key: "integrations", label: "Integrations", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "gallery", label: "Gallery", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "faq_bot", label: "FAQ Bot", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "chatbot", label: "Chatbot", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "ai_assistant", label: "AI Assistant", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "organizations", label: "Organizations", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "api_endpoints", label: "API Endpoints", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "billing", label: "Billing", operations: [{ key: "view", label: "View" }] },
  { key: "manage_settings", label: "Settings", operations: [{ key: "view", label: "View" }, { key: "channels", label: "Channels" }, { key: "webhook", label: "Webhook" }, { key: "team", label: "Team" }, { key: "apis", label: "APIs" }] },
  { key: "manage_team", label: "Manage Team", operations: [{ key: "view", label: "View" }, { key: "create", label: "Create" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }, { key: "permissions", label: "Permissions" }] },
  { key: "view_analytics", label: "View Analytics", operations: [{ key: "view", label: "View" }, { key: "export", label: "Export" }] },
  { key: "support", label: "Support", operations: [{ key: "view", label: "View" }, { key: "reply", label: "Reply & manage" }] },
];

function permissionKey(featureKey: string, operationKey: string): string {
  return `${featureKey}.${operationKey}`;
}

type ApiKeyListItem = {
  id: string;
  userId: string;
  name: string;
  keyPreview: string | null;
  createdAt: string;
  lastUsed: string | null;
};

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  industry: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const smtpSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.coerce.number().int().min(1, "Port is required"),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().min(1, "SMTP user is required"),
  smtpPass: z.string().optional(),
  fromEmail: z.string().email("Valid from email is required"),
  fromName: z.string().min(1, "From name is required"),
});

type SmtpSettingsResponse = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  hasPassword?: boolean;
};

const editMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address"),
  permissions: z.array(z.string()),
  newPassword: z.string().min(8, "Optional - min 8 characters").optional().or(z.literal("")),
});

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  member: UserIcon,
};

const ROLE_COLORS = {
  owner: "bg-yellow-500",
  admin: "bg-blue-500",
  member: "bg-gray-500",
};

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Education",
  "Manufacturing",
  "Real Estate",
  "Hospitality",
  "Transportation",
  "Media & Entertainment",
  "Other",
];

const SETTINGS_TABS = [
  { value: "profile", label: "Profile" },
  { value: "team", label: "Team" },
  { value: "organisation", label: "Organisation" },
  { value: "api-keys", label: "API Keys" },
  { value: "smtp", label: "SMTP" },
  { value: "live-chat", label: "Live Chat" },
  { value: "billing", label: "Billing" },
] as const;

export default function SettingsPage() {
  const skin = useRatehonkPageSkin();
  const [isAtlas, setIsAtlas] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: isLoadingUser } = useAuth();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabFromUrl || "profile");
  const [profileSubTab, setProfileSubTab] = useState("profile");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
  }, []);
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [inviteMembers, setInviteMembers] = useState<InviteMember[]>([
    { firstName: "", lastName: "", email: "", phone: "", permissions: [] },
  ]);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ id: string; name: string; key: string } | null>(null);
  const [apiKeyName, setApiKeyName] = useState("");
  const [hasStoredSmtpPassword, setHasStoredSmtpPassword] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : null
  );

  // Sync notification permission (e.g. after user allows in browser)
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [activeTab]);

  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ['profile', 'team', 'organisation', 'billing', 'api-keys', 'smtp', 'live-chat'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Get user's organization (one tenant = one organization)
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/organizations");
        const data = await res.json();
        return Array.isArray(data) ? data : (data.organizations || []);
      } catch {
        return [];
      }
    },
  });

  const organization = organizations[0]; // Get first (and only) organization

  // Get organization members
  const { data: members = [], refetch: refetchMembers } = useQuery<OrganizationMember[]>({
    queryKey: ["/api/organizations", organization?.id, "members"],
    queryFn: async () => {
      if (!organization?.id) return [];
      try {
        const res = await apiRequest("GET", `/api/organizations/${organization.id}/members`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    enabled: !!organization?.id && (activeTab === "team" || activeTab === "organisation"),
  });

  // API Keys
  const { data: apiKeysList = [], refetch: refetchApiKeys } = useQuery<ApiKeyListItem[]>({
    queryKey: ["/api/keys"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/keys");
      return await res.json();
    },
    enabled: activeTab === "api-keys",
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/keys", { name });
      return await res.json();
    },
    onSuccess: (data: { id: string; name: string; key: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      setNewlyCreatedKey({ id: data.id, name: data.name, key: data.key });
      setApiKeyName("");
      toast({
        title: "API key created",
        description: "Copy your key now. It won't be shown again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "API key deleted", description: "The API key has been revoked." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  // Profile form
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
    values: user ? {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: "", // Phone not in user schema yet
    } : undefined,
  });

  // Organization form
  const organizationForm = useForm<z.infer<typeof organizationSchema>>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      industry: "",
      website: "",
    },
    values: organization ? {
      name: organization.name || "",
      industry: organization.industry || "",
      website: organization.website || "",
    } : undefined,
  });

  // Password form
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // SMTP form
  const smtpForm = useForm<z.infer<typeof smtpSchema>>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "",
      smtpPass: "",
      fromEmail: "",
      fromName: "",
    },
  });

  const { refetch: refetchSmtp } = useQuery<SmtpSettingsResponse>({
    queryKey: ["/api/settings/smtp"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/smtp");
      return await res.json();
    },
    enabled: activeTab === "smtp",
  });

  useEffect(() => {
    if (activeTab !== "smtp") return;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/settings/smtp");
        const data: SmtpSettingsResponse = await res.json();
        smtpForm.reset({
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort || 587,
          smtpSecure: Boolean(data.smtpSecure),
          smtpUser: data.smtpUser || "",
          smtpPass: "",
          fromEmail: data.fromEmail || "",
          fromName: data.fromName || "",
        });
        setHasStoredSmtpPassword(Boolean(data.hasPassword));
      } catch {
        setHasStoredSmtpPassword(false);
      }
    })();
  }, [activeTab, smtpForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      const res = await apiRequest("PATCH", "/api/auth/user", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/auth/user/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to upload avatar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Avatar updated", description: "Your profile picture has been updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar",
        variant: "destructive",
      });
    },
  });

  const handleAvatarClick = () => avatarInputRef.current?.click();
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatarMutation.mutate(file);
    e.target.value = "";
  };

  // Update organization mutation
  const updateOrganizationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof organizationSchema>) => {
      if (!organization?.id) throw new Error("Organization not found");
      const res = await apiRequest("PATCH", `/api/organizations/${organization.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organization updated",
        description: "Organization details have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const saveSmtpMutation = useMutation({
    mutationFn: async (data: z.infer<typeof smtpSchema>) => {
      const payload: Record<string, unknown> = {
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
      };
      const trimmedPass = (data.smtpPass || "").trim();
      if (trimmedPass) payload.smtpPass = trimmedPass;
      const res = await apiRequest("POST", "/api/settings/smtp", payload);
      return await res.json();
    },
    onSuccess: async () => {
      setHasStoredSmtpPassword(true);
      smtpForm.setValue("smtpPass", "");
      await refetchSmtp();
      toast({
        title: "SMTP saved",
        description: "SMTP settings were saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMTP settings",
        variant: "destructive",
      });
    },
  });

  const testSmtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/test-email");
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test email sent",
        description: data?.message || "SMTP test email sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "SMTP test failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  // Invite members mutation - always use /api/users/invite so backend sends email (new or existing user)
  const inviteMembersMutation = useMutation({
    mutationFn: async (invites: InviteMember[]) => {
      if (!organization?.id) throw new Error("Organization not found");
      
      const results = await Promise.allSettled(
        invites
          .filter(inv => inv.email.trim())
          .map(async (invite) => {
                const createUserRes = await apiRequest("POST", "/api/users/invite", {
                  email: invite.email,
                  firstName: invite.firstName?.trim() || undefined,
                  lastName: invite.lastName?.trim() || undefined,
                  phone: invite.phone,
                  organizationId: organization.id,
                  role: "member",
                  permissions: invitePermissions,
                });
            return await createUserRes.json();
          })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, results };
    },
    onSuccess: (data) => {
      refetchMembers();
      setInviteMembers([{ firstName: "", lastName: "", email: "", phone: "", permissions: [] }]);
      const emailFailed = data.results?.filter((r: any) => r.status === 'fulfilled' && r.value?.emailSent === false).length || 0;
      toast({
        title: "Invitations sent",
        description: emailFailed > 0
          ? `${data.successful} member(s) invited. ${emailFailed} invitation email(s) could not be sent - configure Integrations → SMTP (or Settings → SMTP) and retry.`
          : `${data.successful} member(s) invited successfully${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
        variant: emailFailed > 0 ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      toastPlanLimitOrError(toast, error, "Error");
    },
  });

  // Remove member mutation (deletes the member from the database)
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!organization?.id) throw new Error("Organization not found");
      const res = await apiRequest("DELETE", `/api/organizations/${organization.id}/members/${memberId}`);
      return await res.json();
    },
    onSuccess: () => {
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organization?.id, "members"] });
      refetchMembers();
      toast({
        title: "Member removed",
        description: "Member has been removed from the organization.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  // Edit member form and mutation
  const editMemberForm = useForm<z.infer<typeof editMemberSchema>>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      permissions: [],
      newPassword: "",
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (data: { memberId: string; payload: z.infer<typeof editMemberSchema> }) => {
      if (!organization?.id) throw new Error("Organization not found");
      const body: Record<string, unknown> = {
        firstName: data.payload.firstName,
        lastName: data.payload.lastName || undefined,
        email: data.payload.email,
        permissions: data.payload.permissions,
      };
      if (data.payload.newPassword?.trim()) {
        body.newPassword = data.payload.newPassword;
      }
      const res = await apiRequest("PATCH", `/api/organizations/${organization.id}/members/${data.memberId}`, body);
      return await res.json();
    },
    onSuccess: () => {
      refetchMembers();
      setEditMemberDialogOpen(false);
      setEditingMember(null);
      editMemberForm.reset();
      toast({
        title: "Member updated",
        description: "Member details have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member",
        variant: "destructive",
      });
    },
  });

  const addInviteRow = () => {
    setInviteMembers([...inviteMembers, { firstName: "", lastName: "", email: "", phone: "", permissions: [] }]);
  };

  const removeInviteRow = (index: number) => {
    setInviteMembers(inviteMembers.filter((_, i) => i !== index));
  };

  const toggleInvitePermission = (fullKey: string) => {
    setInvitePermissions((prev) =>
      prev.includes(fullKey) ? prev.filter((p) => p !== fullKey) : [...prev, fullKey]
    );
  };

  const setInviteFeatureOperations = (featureKey: string, operationKeys: string[], checked: boolean) => {
    setInvitePermissions((prev) => {
      const toRemove = new Set([featureKey, ...(FEATURE_PERMISSIONS.find((f) => f.key === featureKey)?.operations.map((o) => permissionKey(featureKey, o.key)) || [])]);
      const added = checked ? operationKeys.map((op) => permissionKey(featureKey, op)) : [];
      return [...prev.filter((p) => !toRemove.has(p) && !p.startsWith(featureKey + ".")), ...added];
    });
  };

  const hasAllFeatureOperations = (featureKey: string, perms: string[]) => {
    if (perms.includes(featureKey)) return true;
    const feature = FEATURE_PERMISSIONS.find((f) => f.key === featureKey);
    if (!feature) return false;
    return feature.operations.every((op) => perms.includes(permissionKey(featureKey, op.key)));
  };

  const hasSomeFeatureOperations = (featureKey: string, perms: string[]) => {
    if (perms.includes(featureKey)) return true;
    const feature = FEATURE_PERMISSIONS.find((f) => f.key === featureKey);
    if (!feature) return false;
    return feature.operations.some((op) => perms.includes(permissionKey(featureKey, op.key)));
  };

  const updateInviteMember = (index: number, field: keyof InviteMember, value: string | string[]) => {
    const updated = [...inviteMembers];
    updated[index] = { ...updated[index], [field]: value };
    setInviteMembers(updated);
  };

  const handleSendInvites = () => {
    const validInvites = inviteMembers.filter(inv => inv.email.trim());
    if (validInvites.length === 0) {
      toast({
        title: "No invites",
        description: "Please add at least one member with a valid email address.",
        variant: "destructive",
      });
      return;
    }
    inviteMembersMutation.mutate(validInvites);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string) => {
    if (firstName) {
      return `${firstName.charAt(0).toUpperCase()}${lastName ? lastName.charAt(0).toUpperCase() : ''}`;
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = (member: OrganizationMember) => {
    if (member.user?.firstName) {
      return `${member.user.firstName}${member.user.lastName ? ` ${member.user.lastName}` : ''}`;
    }
    if (member.user?.email) {
      return member.user.email;
    }
    return `User ${member.userId.substring(0, 8)}...`;
  };

  const isCurrentUser = (member: OrganizationMember) => {
    return member.userId === user?.id;
  };

  const userRole = members.find(m => m.userId === user?.id)?.role;
  const canEditMembers = userRole === "owner" || userRole === "admin";

  const expandLegacyPermissions = (perms: string[]): string[] => {
    const result: string[] = [];
    for (const p of perms) {
      if (p.includes(".")) {
        result.push(p);
      } else {
        const feature = FEATURE_PERMISSIONS.find((f) => f.key === p);
        if (feature) {
          feature.operations.forEach((op) => result.push(permissionKey(feature.key, op.key)));
        } else {
          result.push(p);
        }
      }
    }
    return result;
  };

  const openEditMember = (member: OrganizationMember) => {
    setEditingMember(member);
    const rawPerms = member.permissions || [];
    editMemberForm.reset({
      firstName: member.user?.firstName || "",
      lastName: member.user?.lastName || "",
      email: member.user?.email || "",
      permissions: expandLegacyPermissions(rawPerms),
      newPassword: "",
    });
    setEditMemberDialogOpen(true);
  };

  if (isLoadingOrgs || isLoadingUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        skin ? "space-y-6" : "p-6 space-y-6",
        isAtlas && "rh-settings-atlas",
      )}
      data-testid="page-settings"
    >
      <div className="settings-page-chrome">
        <div className="text-sm text-muted-foreground">
          Dashboard &gt; Settings &gt;{" "}
          {activeTab === "profile"
            ? "Profile"
            : activeTab === "team"
              ? "Team"
              : activeTab === "organisation"
                ? "Organisation"
                : activeTab === "api-keys"
                  ? "API Keys"
                  : activeTab === "smtp"
                    ? "SMTP"
                    : activeTab === "live-chat"
                      ? "Live Chat"
                      : "Billing"}
        </div>
        <div className="mt-4">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            {isAtlas
              ? "Manage your account preferences and system configurations."
              : "Set up your Profile, Billing Information, Team Access and Organisation Details"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isAtlas ? (
          <div className="rh-settings-atlas-tabs" role="tablist">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                className={cn("rh-settings-atlas-tab", activeTab === tab.value && "is-active")}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : skin ? (
          <RhScrollTabs
            value={activeTab}
            onChange={setActiveTab}
            options={[...SETTINGS_TABS]}
            className="mb-2"
          />
        ) : (
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="organisation">Organisation</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="smtp">SMTP</TabsTrigger>
            <TabsTrigger value="live-chat">Live Chat</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
        )}

        {/* Profile Tab */}
        <TabsContent value="profile" className="settings-tab-panel space-y-6">
          {isAtlas ? (
            <div className="rh-settings-profile-grid">
              <div className="space-y-4">
                {profileSubTab === "profile" ? (
                  <Card className="rh-settings-card">
                    <CardHeader>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>Update your photo and personal details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...profileForm}>
                        <form
                          onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))}
                          className="space-y-6"
                        >
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handleAvatarFileChange}
                            aria-label="Upload profile picture"
                          />
                          <div className="rh-settings-avatar-row">
                            <div
                              className="relative cursor-pointer group"
                              onClick={() => !uploadAvatarMutation.isPending && handleAvatarClick()}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === "Enter" && !uploadAvatarMutation.isPending && handleAvatarClick()}
                              aria-label="Change profile picture"
                              aria-busy={uploadAvatarMutation.isPending}
                            >
                              <Avatar className="h-16 w-16">
                                <AvatarImage src={user?.profileImageUrl || undefined} />
                                <AvatarFallback className="bg-[var(--rh-brand,#047857)] text-white text-lg">
                                  {getInitials(user?.firstName, user?.lastName, user?.email)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadAvatarMutation.isPending}
                              onClick={handleAvatarClick}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              {uploadAvatarMutation.isPending ? "Uploading..." : "Change Photo"}
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={profileForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Enter your name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone Number</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Enter your phone number" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={profileForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" placeholder="Enter your email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex items-center justify-between gap-4 pt-2">
                            <button
                              type="button"
                              className="rh-settings-password-link"
                              onClick={() => setProfileSubTab("password")}
                            >
                              <Lock className="h-4 w-4" />
                              Change Password
                            </button>
                            <Button
                              type="submit"
                              className="rh-settings-primary-btn"
                              disabled={updateProfileMutation.isPending}
                            >
                              {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rh-settings-card">
                    <CardHeader>
                      <CardTitle>Change Password</CardTitle>
                      <CardDescription>Update your account password.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...passwordForm}>
                        <form
                          onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
                          className="space-y-4"
                        >
                          <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" placeholder="Enter current password" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" placeholder="Enter new password" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm Password</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" placeholder="Confirm new password" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex items-center justify-between gap-4 pt-2">
                            <button
                              type="button"
                              className="rh-settings-password-link"
                              onClick={() => setProfileSubTab("profile")}
                            >
                              Back to profile
                            </button>
                            <Button
                              type="submit"
                              className="rh-settings-primary-btn"
                              disabled={changePasswordMutation.isPending}
                            >
                              {changePasswordMutation.isPending ? "Saving..." : "Change Password"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <Card className="rh-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bell className="h-4 w-4 text-destructive" />
                      Browser Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {typeof window !== "undefined" && "Notification" in window ? (
                      <>
                        <div>
                          {(notificationPermission ?? Notification.permission) === "granted" && (
                            <span className="rh-settings-notify-status is-allowed">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Status: Allowed
                            </span>
                          )}
                          {(notificationPermission ?? Notification.permission) === "denied" && (
                            <span className="rh-settings-notify-status is-blocked">
                              <XCircle className="h-3.5 w-3.5" />
                              Status: Blocked
                            </span>
                          )}
                          {(notificationPermission ?? Notification.permission) === "default" && (
                            <span className="rh-settings-notify-status is-default">
                              <HelpCircle className="h-3.5 w-3.5" />
                              Status: Not set
                            </span>
                          )}
                        </div>
                        {(notificationPermission ?? Notification.permission) !== "granted" && (
                          <p className="text-sm text-muted-foreground">
                            {(notificationPermission ?? Notification.permission) === "denied"
                              ? "To allow notifications: click the lock or info icon in the address bar → Site settings → Notifications → Allow."
                              : "Click below to allow notifications so you get alerts in other tabs."}
                          </p>
                        )}
                        {(notificationPermission ?? Notification.permission) === "denied" ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a
                              href="https://support.google.com/chrome/answer/3220216"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Help Guide
                            </a>
                          </Button>
                        ) : (notificationPermission ?? Notification.permission) !== "granted" ? (
                          <Button
                            type="button"
                            className="rh-settings-primary-btn"
                            size="sm"
                            onClick={async () => {
                              const ok = await requestNotificationPermission();
                              setNotificationPermission(Notification.permission);
                              if (ok) toast({ title: "Notifications allowed", description: "You'll get alerts even in other tabs." });
                              else toast({ title: "Permission denied", description: "Enable notifications in your browser settings.", variant: "destructive" });
                            }}
                          >
                            Allow notifications
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Notifications are not supported in this browser.</p>
                    )}
                  </CardContent>
                </Card>

                <Link href="/billing" className="rh-settings-plan-card">
                  <div className="rh-settings-plan-eyebrow">Pro Plan</div>
                  <div className="rh-settings-plan-title">Enhance Your Workflow</div>
                  <p className="rh-settings-plan-desc">Unlock advanced automation features.</p>
                </Link>
              </div>
            </div>
          ) : (
          <div>
            <h2 className="text-xl font-semibold mb-1">Profile</h2>
            <p className="text-sm text-muted-foreground mb-4">Manage your account settings</p>
            
            {/* Profile Sub-tabs */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={profileSubTab === "profile" ? "default" : "outline"}
                size="sm"
                onClick={() => setProfileSubTab("profile")}
              >
                Profile
              </Button>
              <Button
                variant={profileSubTab === "password" ? "default" : "outline"}
                size="sm"
                onClick={() => setProfileSubTab("password")}
              >
                Change Password
              </Button>
            </div>

            {profileSubTab === "profile" && (
              <Card>
                <CardContent className="pt-6">
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex items-start gap-6">
                        <div className="space-y-2">
                          <Label>Avatar</Label>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handleAvatarFileChange}
                            aria-label="Upload profile picture"
                          />
                          <div
                            className="relative cursor-pointer group"
                            onClick={() => !uploadAvatarMutation.isPending && handleAvatarClick()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && !uploadAvatarMutation.isPending && handleAvatarClick()}
                            aria-label="Change profile picture"
                            aria-busy={uploadAvatarMutation.isPending}
                          >
                            <Avatar className="h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/30 transition-shadow">
                              <AvatarImage src={user?.profileImageUrl || undefined} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                                {getInitials(user?.firstName, user?.lastName, user?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted">
                              <Camera className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">
                            {user?.firstName && user?.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user?.email || "User"}
                          </p>
                          {(() => {
                            const currentMember = members.find(m => m.userId === user?.id);
                            return currentMember ? (
                              <Badge className={ROLE_COLORS[currentMember.role]}>
                                {currentMember.role.toUpperCase()}
                              </Badge>
                            ) : null;
                          })()}
                          <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>

                      {/* Name Field */}
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your name" />
                            </FormControl>
                            <FormDescription>Set your name.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Email Field */}
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="Enter your email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Phone Field */}
                      <FormField
                        control={profileForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your phone number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateProfileMutation.isPending}>
                          Update Profile
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {profileSubTab === "password" && (
              <Card>
                <CardContent className="pt-6">
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Enter current password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Enter new password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Confirm new password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={changePasswordMutation.isPending}>
                          Change Password
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Browser notifications status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  Browser notifications
                </CardTitle>
                <CardDescription>
                  Needed for new messages and reminders when you're in another tab. You can check or change this here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {typeof window !== "undefined" && "Notification" in window ? (
                  <>
                    <div className="flex items-center gap-2">
                      {(notificationPermission ?? Notification.permission) === "granted" && (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-400">Allowed</span>
                        </>
                      )}
                      {(notificationPermission ?? Notification.permission) === "denied" && (
                        <>
                          <XCircle className="h-5 w-5 text-destructive" />
                          <span className="font-medium text-destructive">Blocked</span>
                        </>
                      )}
                      {(notificationPermission ?? Notification.permission) === "default" && (
                        <>
                          <HelpCircle className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium text-muted-foreground">Not set</span>
                        </>
                      )}
                    </div>
                    {(notificationPermission ?? Notification.permission) !== "granted" && (
                      <p className="text-sm text-muted-foreground">
                        {(notificationPermission ?? Notification.permission) === "denied"
                          ? "To allow notifications: click the lock or info icon in the address bar → Site settings → Notifications → Allow."
                          : "Click below to allow notifications so you get alerts in other tabs."}
                      </p>
                    )}
                    {(notificationPermission ?? Notification.permission) !== "granted" && (notificationPermission ?? Notification.permission) !== "denied" && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={async () => {
                          const ok = await requestNotificationPermission();
                          setNotificationPermission(Notification.permission);
                          if (ok) toast({ title: "Notifications allowed", description: "You'll get alerts even in other tabs." });
                          else toast({ title: "Permission denied", description: "Enable notifications in your browser settings.", variant: "destructive" });
                        }}
                      >
                        Allow notifications
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Notifications are not supported in this browser.</p>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        {/* SMTP Tab */}
        <TabsContent value="smtp" className="settings-tab-panel space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">SMTP</h2>
            <p className="text-sm text-muted-foreground mb-6">Configure outgoing email server credentials.</p>

            <Card className={cn(isAtlas && "rh-settings-card")}>
              {isAtlas && (
                <CardHeader>
                  <CardTitle>SMTP Configuration</CardTitle>
                  <CardDescription>Set host, credentials, and sender details for outgoing email.</CardDescription>
                </CardHeader>
              )}
              <CardContent className={cn(!isAtlas && "pt-6")}>
                <Form {...smtpForm}>
                  <form onSubmit={smtpForm.handleSubmit((data) => saveSmtpMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={smtpForm.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="smtp.gmail.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={smtpForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                value={field.value ?? 587}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                placeholder="587"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={smtpForm.control}
                        name="smtpSecure"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3 mt-7">
                            <div>
                              <FormLabel>Use SSL/TLS</FormLabel>
                              <FormDescription>Enable for secure SMTP connections.</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={smtpForm.control}
                      name="smtpUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP User</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="john.doe@gmail.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={smtpForm.control}
                      name="smtpPass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" placeholder={hasStoredSmtpPassword ? "Leave blank to keep existing password" : "Enter SMTP password"} />
                          </FormControl>
                          <FormDescription>
                            {hasStoredSmtpPassword ? "Password is already saved. Enter only if you want to replace it." : "For Gmail, use an App Password."}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={smtpForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="john.doe@gmail.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={smtpForm.control}
                        name="fromName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="John Doe" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => testSmtpMutation.mutate()} disabled={testSmtpMutation.isPending || saveSmtpMutation.isPending}>
                        {testSmtpMutation.isPending ? "Testing..." : "Test SMTP"}
                      </Button>
                      <Button
                        type="submit"
                        className={cn(isAtlas && "rh-settings-primary-btn")}
                        disabled={saveSmtpMutation.isPending || testSmtpMutation.isPending}
                      >
                        {saveSmtpMutation.isPending ? "Saving..." : "Save SMTP"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="settings-tab-panel space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Team</h2>
            <p className="text-sm text-muted-foreground mb-6">Manage, invite and view team members</p>

            {/* Invite Members Section */}
            <Card className={cn("mb-6", isAtlas && "rh-settings-card")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Invite new members by email address</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(isAtlas && "rounded-xl")}
                    onClick={async () => {
                      try {
                        const res = await apiRequest("POST", "/api/settings/test-email");
                        const data = await res.json();
                        if (res.ok && data.success) {
                          toast({ title: "Test email sent", description: `Check ${user?.email} for the test email.` });
                        } else {
                          toast({ title: "Test failed", description: data.error || "Could not send test email", variant: "destructive" });
                        }
                      } catch (e: any) {
                        toast({ title: "Test failed", description: e.message || "Could not send test email", variant: "destructive" });
                      }
                    }}
                  >
                    Test SMTP
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {inviteMembers.map((invite, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-end">
                    <div className="col-span-2">
                      <Label>First Name</Label>
                      <Input
                        value={invite.firstName}
                        onChange={(e) => updateInviteMember(index, "firstName", e.target.value)}
                        placeholder="First name"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Last Name</Label>
                      <Input
                        value={invite.lastName}
                        onChange={(e) => updateInviteMember(index, "lastName", e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Email</Label>
                      <Input
                        value={invite.email}
                        onChange={(e) => updateInviteMember(index, "email", e.target.value)}
                        placeholder="Enter member's email"
                        type="email"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Phone</Label>
                      <div className="flex gap-2">
                        <Select defaultValue="+91">
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="+91">🇮🇳 +91</SelectItem>
                            <SelectItem value="+1">🇺🇸 +1</SelectItem>
                            <SelectItem value="+44">🇬🇧 +44</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={invite.phone}
                          onChange={(e) => updateInviteMember(index, "phone", e.target.value)}
                          placeholder="Phone number"
                        />
                      </div>
                    </div>
                    <div className="col-span-1">
                      {inviteMembers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInviteRow(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-4 mt-4">
                  <Label className="text-base font-medium mb-2 block">Permissions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between min-w-[200px] font-normal"
                    onClick={() => setPermissionsDialogOpen(true)}
                  >
                    <span className="text-muted-foreground">
                      {invitePermissions.length === 0
                        ? "Select permissions..."
                        : `${invitePermissions.length} permission${invitePermissions.length === 1 ? "" : "s"} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </div>

                {/* Permissions modal (large popup like reference) */}
                <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
                  <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                      <DialogTitle>Permissions</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-1">Select features and operations for the invited member(s). Click a feature to expand.</p>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {FEATURE_PERMISSIONS.map((feature) => {
                          const allChecked = hasAllFeatureOperations(feature.key, invitePermissions);
                          const someChecked = hasSomeFeatureOperations(feature.key, invitePermissions);
                          return (
                            <Collapsible key={feature.key} defaultOpen={false} className="group">
                              <div className="rounded-lg border">
                                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                    <span className="text-sm font-medium truncate">{feature.label}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setInviteFeatureOperations(
                                        feature.key,
                                        feature.operations.map((o) => o.key),
                                        !allChecked
                                      );
                                    }}
                                  >
                                    {allChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : someChecked ? <CheckSquare className="h-4 w-4 opacity-50" /> : <Square className="h-4 w-4" />}
                                    <span>{allChecked ? "All" : someChecked ? "Some" : "None"}</span>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="border-t px-3 py-2 space-y-1.5 bg-muted/30">
                                    {feature.operations.map((op) => {
                                      const pk = permissionKey(feature.key, op.key);
                                      const checked = invitePermissions.includes(pk);
                                      return (
                                        <label key={op.key} className="flex items-center gap-2 cursor-pointer text-sm">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleInvitePermission(pk)}
                                            className="rounded border-input"
                                          />
                                          <span>{op.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                      <Button type="button" onClick={() => setPermissionsDialogOpen(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(isAtlas && "rounded-xl")}
                    onClick={addInviteRow}
                    disabled={inviteMembers.length >= 10}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Members
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendInvites}
                    disabled={inviteMembersMutation.isPending}
                    className={cn(
                      isAtlas ? "rh-settings-primary-btn" : "bg-orange-500 hover:bg-orange-600",
                    )}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Invite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* All Team Members */}
            <Card className={cn(isAtlas && "rh-settings-card")}>
              <CardHeader>
                <CardTitle>All team members</CardTitle>
                {isAtlas && (
                  <CardDescription>View roles and manage access for people in your organisation.</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No members in this organization yet</p>
                  ) : (
                    members.map((member) => {
                      const displayName = getDisplayName(member);
                      const initials = getInitials(member.user?.firstName, member.user?.lastName, member.user?.email);
                      const perms = member.permissions || [];
                      const isOwner = member.role === "owner";
                      
                      return (
                        <div key={member.id} className="flex items-center gap-4 p-4 border rounded-lg">
                          <Avatar>
                            <AvatarImage src={member.user?.profileImageUrl || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {displayName}
                                {isCurrentUser(member) && " (You)"}
                              </p>
                              {isOwner ? (
                                <Badge className={ROLE_COLORS.owner}>Owner</Badge>
                              ) : perms.length > 0 ? (
                                <>
                                  {(() => {
                                    const byFeature = new Map<string, string[]>();
                                    for (const p of perms) {
                                      const dot = p.indexOf(".");
                                      const f = dot >= 0 ? p.slice(0, dot) : p;
                                      const op = dot >= 0 ? p.slice(dot + 1) : "__all__";
                                      if (!byFeature.has(f)) byFeature.set(f, []);
                                      if (op !== "__all__" && !byFeature.get(f)!.includes("__all__")) byFeature.get(f)!.push(op);
                                      else if (op === "__all__") byFeature.set(f, ["__all__"]);
                                    }
                                    const entries = Array.from(byFeature.entries()).slice(0, 4);
                                    return entries.map(([fKey, ops]) => {
                                      const feat = FEATURE_PERMISSIONS.find((x) => x.key === fKey);
                                      const label = feat ? feat.label : fKey;
                                      const isAll = ops.includes("__all__");
                                      const opLabels = isAll ? "All" : ops.filter((o) => o !== "__all__").slice(0, 2).map((ok) => feat?.operations.find((o) => o.key === ok)?.label || ok);
                                      return (
                                        <Badge key={fKey} variant="secondary" className="text-xs mr-1">
                                          {label} ({Array.isArray(opLabels) ? opLabels.join(", ") + (ops.length > 2 ? "…" : "") : opLabels})
                                        </Badge>
                                      );
                                    });
                                  })()}
                                  {perms.length > 12 && (
                                    <Badge variant="outline" className="text-xs">+more</Badge>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">No permissions</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                            {member.user?.phone && (
                              <p className="text-sm text-muted-foreground">{member.user.phone}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {canEditMembers && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditMember(member)}
                                title="Edit member"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {!isCurrentUser(member) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove(member)}
                                disabled={removeMemberMutation.isPending}
                                title="Remove member"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Remove Member Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove {memberToRemove ? getDisplayName(memberToRemove) : ""} from the organization? They will lose access to this organization.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      if (memberToRemove) {
                        removeMemberMutation.mutate(memberToRemove.id);
                      }
                    }}
                    disabled={removeMemberMutation.isPending}
                  >
                    {removeMemberMutation.isPending ? "Removing…" : "Remove"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Edit Member Dialog */}
            <Dialog open={editMemberDialogOpen} onOpenChange={(open) => {
              setEditMemberDialogOpen(open);
              if (!open) {
                setEditingMember(null);
                editMemberForm.reset();
              }
            }}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Edit Member</DialogTitle>
                </DialogHeader>
                <Form {...editMemberForm}>
                  <form
                    onSubmit={editMemberForm.handleSubmit((data) => {
                      if (editingMember) {
                        updateMemberMutation.mutate({ memberId: editingMember.id, payload: data });
                      }
                    })}
                    className="space-y-4"
                  >
                    <FormField
                      control={editMemberForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="First name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editMemberForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editMemberForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {editingMember?.role !== "owner" && (
                      <FormField
                        control={editMemberForm.control}
                        name="permissions"
                        render={({ field }) => {
                          const perms = field.value || [];
                          const setFeatureOps = (featureKey: string, operationKeys: string[], checked: boolean) => {
                            const feature = FEATURE_PERMISSIONS.find((f) => f.key === featureKey);
                            if (!feature) return;
                            const toRemove = feature.operations.map((o) => permissionKey(featureKey, o.key));
                            let next = perms.filter((p) => !toRemove.includes(p));
                            if (checked) {
                              next = [...next, ...operationKeys.map((op) => permissionKey(featureKey, op))];
                            }
                            field.onChange(next);
                          };
                          return (
                            <FormItem>
                              <FormLabel>Permissions</FormLabel>
                              <FormDescription>Expand a feature and check the operations to allow.</FormDescription>
                              <div className="max-h-[280px] overflow-y-auto space-y-1 pt-2 pr-1">
                                {FEATURE_PERMISSIONS.map((feature) => {
                                  const allChecked = feature.operations.every((op) => perms.includes(permissionKey(feature.key, op.key)));
                                  const someChecked = feature.operations.some((op) => perms.includes(permissionKey(feature.key, op.key)));
                                  return (
                                    <Collapsible key={feature.key} defaultOpen={false} className="group">
                                      <div className="rounded-lg border">
                                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                                            <span className="text-sm font-medium truncate">{feature.label}</span>
                                          </div>
                                          <button
                                            type="button"
                                            className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setFeatureOps(feature.key, feature.operations.map((o) => o.key), !allChecked);
                                            }}
                                          >
                                            {allChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : someChecked ? <CheckSquare className="h-4 w-4 opacity-50" /> : <Square className="h-4 w-4" />}
                                            <span>{allChecked ? "All" : someChecked ? "Some" : "None"}</span>
                                          </button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="border-t px-3 py-2 space-y-1.5 bg-muted/30">
                                            {feature.operations.map((op) => {
                                              const pk = permissionKey(feature.key, op.key);
                                              const checked = perms.includes(pk) || perms.includes(feature.key);
                                              return (
                                                <label key={op.key} className="flex items-center gap-2 cursor-pointer text-sm">
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                      const next = checked ? perms.filter((p) => p !== pk) : [...perms, pk];
                                                      field.onChange(next);
                                                    }}
                                                    className="rounded border-input"
                                                  />
                                                  <span>{op.label}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    )}
                    {editingMember?.role === "owner" && (
                      <p className="text-sm text-muted-foreground">Owners have full access. Permissions are not editable.</p>
                    )}
                    <FormField
                      control={editMemberForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password (Optional)</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Leave blank to keep current" {...field} />
                          </FormControl>
                          <FormDescription>Min 8 characters. Leave empty to keep current password.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditMemberDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateMemberMutation.isPending}>
                        {updateMemberMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="settings-tab-panel space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
              <Key className="h-5 w-5" /> API Keys
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create API keys to use the Project API (sessions, templates, send messages, contacts, webhooks). Use the key in the <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> header. Keys are shown only once when created.
            </p>
            {newlyCreatedKey && (
              <Card className={cn("mb-6 border-green-500/50 bg-green-500/5", isAtlas && "rh-settings-card")}>
                <CardHeader>
                  <CardTitle className="text-base">New API key — copy it now</CardTitle>
                  <CardDescription>This key won&apos;t be shown again.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 min-w-0 break-all rounded bg-muted px-2 py-2 text-sm font-mono">
                      {newlyCreatedKey.key}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedKey.key);
                        toast({ title: "Copied", description: "API key copied to clipboard." });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a href="/project-api" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-4 w-4" /> API docs
                    </a>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">Import Postman collection from docs.</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setNewlyCreatedKey(null)}>
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className={cn("mb-6", isAtlas && "rh-settings-card")}>
              <CardHeader>
                <CardTitle className="text-base">Create API key</CardTitle>
                <CardDescription>Give the key a name (e.g. &quot;Postman&quot;, &quot;CRM&quot;) to identify it later.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Key name"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    className={cn(isAtlas && "rh-settings-primary-btn")}
                    onClick={() => {
                      if (!apiKeyName.trim()) {
                        toast({ title: "Name required", description: "Enter a name for the key.", variant: "destructive" });
                        return;
                      }
                      createApiKeyMutation.mutate(apiKeyName.trim());
                    }}
                    disabled={createApiKeyMutation.isPending}
                  >
                    Create key
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className={cn(isAtlas && "rh-settings-card")}>
              <CardHeader>
                <CardTitle className="text-base">Your API keys</CardTitle>
                <CardDescription>Revoke a key if it is compromised. You cannot recover a key after creation.</CardDescription>
              </CardHeader>
              <CardContent>
                {apiKeysList.length === 0 ? (
                  isAtlas ? (
                    <div className="rh-settings-empty py-8">
                      <div className="rh-settings-empty-icon">
                        <Key className="h-6 w-6" />
                      </div>
                      <p className="rh-settings-empty-title">No API keys yet</p>
                      <p className="rh-settings-empty-desc">Create a key above to start using the Project API.</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No API keys yet. Create one above.</p>
                  )
                ) : (
                  <ul className="space-y-3">
                    {apiKeysList.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{k.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{k.keyPreview ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {new Date(k.createdAt).toLocaleString()}
                            {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleString()}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteApiKeyMutation.mutate(k.id)}
                          disabled={deleteApiKeyMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Organisation Tab */}
        <TabsContent value="organisation" className="settings-tab-panel space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Organisation</h2>
            <p className="text-sm text-muted-foreground mb-6">Edit Organisation details</p>

            <Card className={cn(isAtlas && "rh-settings-card")}>
              {isAtlas && (
                <CardHeader>
                  <CardTitle>Organisation details</CardTitle>
                  <CardDescription>Update your organisation name, industry, and website.</CardDescription>
                </CardHeader>
              )}
              <CardContent className={cn(!isAtlas && "pt-6")}>
                <Form {...organizationForm}>
                  <form onSubmit={organizationForm.handleSubmit((data) => updateOrganizationMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={organizationForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter organization name" />
                          </FormControl>
                          <FormDescription>Set your organisation name.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={organizationForm.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INDUSTRIES.map((industry) => (
                                <SelectItem key={industry} value={industry}>
                                  {industry}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Set industry type.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={organizationForm.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.com" type="url" />
                          </FormControl>
                          <FormDescription>Set your website address.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className={cn(isAtlas && "rh-settings-primary-btn")}
                        disabled={updateOrganizationMutation.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="settings-tab-panel space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Billing</h2>
            <p className="text-sm text-muted-foreground mb-6">Manage your subscription and billing information</p>
            <Card className={cn(isAtlas && "rh-settings-card")}>
              <CardContent className={cn(isAtlas ? "rh-settings-empty" : "pt-6")}>
                {isAtlas ? (
                  <>
                    <div className="rh-settings-empty-icon">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <p className="rh-settings-empty-title">Billing & Subscription</p>
                    <p className="rh-settings-empty-desc">
                      View your current plan, upgrade options, and payment history from the billing page.
                    </p>
                    <Button asChild className="rh-settings-primary-btn">
                      <Link href="/billing">Go to Billing</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Billing features coming soon...</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Chat Tab */}
        <TabsContent value="live-chat" className="settings-tab-panel space-y-6">
          <LiveChatSettingsTab isAtlas={isAtlas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
