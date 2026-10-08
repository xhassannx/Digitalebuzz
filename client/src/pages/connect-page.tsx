import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, CheckCircle2, XCircle, Smartphone, ExternalLink, Hash, Info, Plus, Save, AlertCircle, RefreshCw, Phone, Trash2, Copy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
type AddedPhone = {
  sessionId: string;
  phoneNumberId: string;
  integrationId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  businessAccountId?: string;
  businessAccountName?: string;
  wabaId?: string;
  wabaName?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
  status: string;
  createdAt: string;
  lastActive?: string;
};

export default function ConnectPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<Set<string>>(new Set());
  const [phonePendingDelete, setPhonePendingDelete] = useState<AddedPhone | null>(null);

  // Fetch WhatsApp Business integration
  const { data: integrationData } = useQuery<{
    success: boolean;
    integrations: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  }>({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations');
      return await res.json();
    },
  });

  // Check if user has any WhatsApp Business integrations (supporting multiple accounts)
  const whatsappIntegrations = integrationData?.integrations?.filter(
    (i) => i.name === "whatsapp-business" && i.status === "connected"
  ) || [];
  const hasWhatsAppIntegration = whatsappIntegrations.length > 0;

  // Debug logging
  console.log('[Connect Page] Integration data:', integrationData);
  console.log('[Connect Page] WhatsApp integrations:', whatsappIntegrations);
  console.log('[Connect Page] Has WhatsApp integration:', hasWhatsAppIntegration);

  // Fetch available phone numbers from WhatsApp Business (from all integrations)
  const { data: phoneNumbersData, isLoading: isLoadingPhones, refetch: refetchPhoneNumbers } = useQuery<{
    success: boolean;
    phoneNumbers: Array<{
      id: string;
      display_phone_number: string;
      verified_name?: string;
      code_verification_status?: string;
      quality_rating?: any;
      businessAccountId?: string;
      businessAccountName?: string;
      wabaId?: string;
      wabaName?: string;
    }>;
    count: number;
  }>({
    queryKey: ['/api/integrations/whatsapp-business/phone-numbers'],
    enabled: hasWhatsAppIntegration,
    retry: 1,
  });

  // Fetch already added phone numbers (sessions)
  // This query should ALWAYS run, regardless of integration status
  const { data: addedPhonesData, isLoading: isLoadingAddedPhones, refetch: refetchAddedPhones } = useQuery<{
    success: boolean;
    phoneNumbers: Array<{
      sessionId: string;
      phoneNumberId: string;
      integrationId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
      businessAccountId?: string;
      businessAccountName?: string;
      wabaId?: string;
      wabaName?: string;
      qualityRating?: string;
      codeVerificationStatus?: string;
      status: string;
      createdAt: string;
      lastActive?: string;
    }>;
    count?: number;
  }>({
    queryKey: ['/api/integrations/whatsapp-business/added-phones'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/integrations/whatsapp-business/added-phones');
      const data = await res.json();
      console.log('[Connect Page] Fetched added phones:', data);
      console.log('[Connect Page] Phone numbers array:', data?.phoneNumbers);
      console.log('[Connect Page] Phone numbers count:', data?.phoneNumbers?.length);
      return data;
    },
    enabled: true, // Always enabled - don't depend on integration check
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 60_000 : 30_000),
    staleTime: 5_000, // Reduce repeated fetch churn while still reflecting connection changes quickly
  });

  // Save settings mutation (adds selected phone numbers)
  const saveSettingsMutation = useMutation({
    mutationFn: async (phoneIds: string[]) => {
      const results = [];
      for (const phoneId of phoneIds) {
        const phoneNumber = phoneNumbersData?.phoneNumbers?.find((p) => p.id === phoneId);
        if (phoneNumber) {
          const res = await apiRequest("POST", "/api/integrations/whatsapp-business/add-phone", {
            phoneNumberId: phoneId,
            businessAccountId: phoneNumber.businessAccountId,
            businessAccountName: phoneNumber.businessAccountName,
            wabaId: phoneNumber.wabaId,
            wabaName: phoneNumber.wabaName,
            displayPhoneNumber: phoneNumber.display_phone_number,
            verifiedName: phoneNumber.verified_name,
            qualityRating: phoneNumber.quality_rating,
            codeVerificationStatus: phoneNumber.code_verification_status,
            ...((phoneNumber as { integrationId?: string }).integrationId && { integrationId: (phoneNumber as { integrationId?: string }).integrationId }),
          });
          results.push(await res.json());
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      refetchAddedPhones();
      refetchPhoneNumbers();
      setSelectedPhoneIds(new Set());
      toast({
        title: "Settings saved successfully",
        description: `Successfully added ${results.length} phone number(s).`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: error.message || "Failed to add phone numbers",
      });
    },
  });

  // Delete phone number mutation
  const deletePhoneMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/integrations/whatsapp-business/delete-phone/${sessionId}`);
      return await res.json();
    },
    onSuccess: () => {
      setPhonePendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      refetchAddedPhones();
      refetchPhoneNumbers();
      toast({
        title: "Phone number removed",
        description:
          "Removed from this panel and deregistered on Meta when allowed. Dual-mode (Business App) numbers may still need unlink in the WhatsApp Business app.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete phone number",
        description: error.message || "Failed to delete phone number",
      });
    },
  });

  // Refresh connection for an already-added phone (e.g. after reconnect) – fixes "Phone Number ID does not exist" errors
  const refreshConnectionMutation = useMutation({
    mutationFn: async (phone: {
      phoneNumberId: string;
      integrationId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
      businessAccountId?: string;
      wabaId?: string;
      wabaName?: string;
    }) => {
      const res = await apiRequest("POST", "/api/integrations/whatsapp-business/add-phone", {
        phoneNumberId: phone.phoneNumberId,
        ...(phone.integrationId && { integrationId: phone.integrationId }),
        displayPhoneNumber: phone.displayPhoneNumber,
        verifiedName: phone.verifiedName,
        businessAccountId: phone.businessAccountId,
        wabaId: phone.wabaId,
        wabaName: phone.wabaName,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      refetchAddedPhones();
      toast({
        title: data.refreshed ? "Connection refreshed" : "Phone number added",
        description: data.refreshed
          ? "Session is now using your current WhatsApp Business connection. You can send messages again."
          : "Phone number is ready to use.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: error.message || "Failed to refresh connection",
      });
    },
  });

  const phoneNumbers = phoneNumbersData?.phoneNumbers || [];
  const addedPhones = addedPhonesData?.phoneNumbers || [];
  const addedPhoneIds = new Set(addedPhones.map((p) => p.phoneNumberId));
  const availablePhones = phoneNumbers.filter((p) => !addedPhoneIds.has(p.id));

  // Debug logging
  if (addedPhonesData) {
    console.log('[Connect Page] Added phones data:', addedPhonesData);
    console.log('[Connect Page] Added phones array:', addedPhones);
    console.log('[Connect Page] Added phones count:', addedPhones.length);
  }

  const handleTogglePhone = (phoneId: string) => {
    const newSelected = new Set(selectedPhoneIds);
    if (newSelected.has(phoneId)) {
      newSelected.delete(phoneId);
    } else {
      newSelected.add(phoneId);
    }
    setSelectedPhoneIds(newSelected);
  };

  const handleSaveSettings = () => {
    if (selectedPhoneIds.size === 0) {
      toast({
        variant: "destructive",
        title: "No phone numbers selected",
        description: "Please select at least one phone number to add.",
      });
      return;
    }
    saveSettingsMutation.mutate(Array.from(selectedPhoneIds));
  };

  const formatLastActive = (date?: Date | string) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
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

  const getStatusBadge = (status?: string) => {
    const statusUpper = (status || '').toUpperCase();
    if (statusUpper === 'VERIFIED' || statusUpper === 'CONNECTED') {
      return (
        <Badge variant="default" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          {status}
        </Badge>
      );
    } else if (statusUpper === 'PENDING') {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <AlertCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    }
    if (statusUpper === 'DISCONNECTED') {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <AlertCircle className="h-3 w-3" />
          Disconnected
        </Badge>
      );
    }
    return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
  };

  const copyToClipboard = (label: string, value?: string) => {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  const renderPhoneActions = (phone: AddedPhone, isConnected: boolean) => (
    <div className="flex flex-nowrap gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => refreshConnectionMutation.mutate(phone)}
        disabled={refreshConnectionMutation.isPending}
        title="Refresh connection"
        className="h-9 w-9 p-0"
      >
        {refreshConnectionMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          if (phone.phoneNumberId) {
            setLocation(`/templates?phoneNumberId=${phone.phoneNumberId}`);
          }
        }}
        disabled={!phone.phoneNumberId}
        title="View Templates"
        className="h-9 w-9 p-0"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={() => {
          if (phone.phoneNumberId) {
            setLocation(`/templates/create?phoneNumberId=${phone.phoneNumberId}`);
          } else {
            setLocation("/integrations");
          }
        }}
        disabled={!phone.phoneNumberId || !isConnected}
        title="Create Template"
        className="h-9 w-9 p-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setPhonePendingDelete(phone)}
        disabled={deletePhoneMutation.isPending}
        title="Delete Phone Number"
        className="h-9 w-9 p-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div
      className="mx-auto w-full max-w-[95%] space-y-4 p-4 sm:space-y-6 sm:p-6"
      data-testid="page-connect"
    >
      <div className="rh-page-hero flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1.5 text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
            Connect WhatsApp Business
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage your WhatsApp Business phone numbers and connections
          </p>
        </div>
        {!hasWhatsAppIntegration && (
          <Button
            onClick={() => setLocation("/integrations")}
            className="h-10 w-full shrink-0 gap-2 sm:w-auto"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Connect WhatsApp Business</span>
          </Button>
        )}
      </div>

      {/* Coexistence info: Use both WhatsApp Business App and API panel together */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 pt-4 sm:p-6 sm:pt-6">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h3 className="font-semibold mb-1">Using WhatsApp Business App + API Panel Together?</h3>
              <p className="text-sm text-muted-foreground">
                To sync messages sent from the WhatsApp Business App to this panel, connect using the{" "}
                <strong>Embedded Signup flow</strong> and choose{" "}
                <strong>&quot;Connect your WhatsApp Business App&quot;</strong> during setup. Do NOT choose &quot;Migrate to Cloud API&quot; if you want to keep using the app. Numbers added manually in Meta Business Manager may not support app sync.{" "}
                <Link href="/integrations" className="text-primary hover:underline">Connect via Integrations</Link>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasWhatsAppIntegration && (!addedPhonesData || !addedPhonesData.phoneNumbers || addedPhones.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">WhatsApp Business not connected</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please connect your WhatsApp Business account from the{" "}
              <Link href="/integrations" className="text-primary hover:underline">Integrations</Link> page first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Already Added Phone Numbers */}
          {isLoadingAddedPhones ? (
            <Card>
              <CardContent className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : addedPhones.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Added Phone Numbers</CardTitle>
                <CardDescription>Phone numbers already added and available for use</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table scrollOnMobile className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap px-4">Verified Name</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Phone Number</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Session ID</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Status</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Phone Number ID</TableHead>
                        <TableHead className="whitespace-nowrap px-4">WABA ID</TableHead>
                        <TableHead className="whitespace-nowrap px-4">WABA Name</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Quality</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Last Active</TableHead>
                        <TableHead className="whitespace-nowrap px-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addedPhones.map((phone) => {
                        const isConnected = phone.status === 'connected' || phone.status === 'Connected';
                        const displayPhone = phone.displayPhoneNumber || phone.phoneNumberId;
                        const verifiedName = phone.verifiedName || 'WhatsApp Business';
                        return (
                          <TableRow key={phone.sessionId}>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                  <Smartphone className="h-4 w-4 text-primary" />
                                </div>
                                <span className="whitespace-nowrap font-medium">
                                  {verifiedName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 whitespace-nowrap">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {displayPhone}
                              </span>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap rounded-md bg-muted/60 px-2 py-1 font-mono text-xs text-muted-foreground">
                                  {phone.sessionId || "—"}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyToClipboard("Session ID", phone.sessionId)}
                                  disabled={!phone.sessionId}
                                  title="Copy session ID"
                                  aria-label="Copy session ID"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 whitespace-nowrap">
                              {getStatusBadge(phone.status)}
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-1.5">
                                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                                  {phone.phoneNumberId || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-1.5">
                                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                                  {phone.wabaId || '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 whitespace-nowrap">
                              <span className="text-sm text-muted-foreground">
                                {phone.wabaName || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 whitespace-nowrap">
                              {getQualityBadge(phone.qualityRating)}
                            </TableCell>
                            <TableCell className="px-4 whitespace-nowrap">
                              <span className="text-sm text-muted-foreground">
                                {formatLastActive(phone.lastActive)}
                              </span>
                            </TableCell>
                            <TableCell className="rh-table-actions px-4 whitespace-nowrap">
                              {renderPhoneActions(phone, isConnected)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">No phone numbers added yet</p>
                {hasWhatsAppIntegration && !isLoadingPhones && phoneNumbers.length === 0 ? (
                  <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left max-w-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Integration connected but no phone numbers found
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                      This usually means your Meta App needs additional permissions. Check your PM2 logs for errors like &quot;(#200) You do not have permission to access this field&quot;.
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <strong>Fix:</strong> In Meta Business Manager, assign your System User to the WhatsApp Business Account and Phone Numbers with <strong>Full control</strong>. Ensure your app has <strong>Advanced Access</strong> for whatsapp_business_management and whatsapp_business_messaging. Then disconnect and reconnect from Integrations.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Select phone numbers from below and click &quot;Save Settings&quot; to add them.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {addedPhones.length >= 4 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Warning:</strong> You have {addedPhones.length} active phone numbers.
            WhatsApp allows a maximum of 4-5 linked devices.
            Please manage your phone numbers from the{" "}
            <Link href="/integrations" className="text-primary hover:underline">Integrations</Link> page.
          </p>
        </div>
      )}

      <AlertDialog
        open={!!phonePendingDelete}
        onOpenChange={(open) => {
          if (!open && !deletePhoneMutation.isPending) setPhonePendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete phone number?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Remove{" "}
                  <span className="font-medium text-foreground">
                    {phonePendingDelete?.displayPhoneNumber ||
                      phonePendingDelete?.phoneNumberId ||
                      "this number"}
                  </span>{" "}
                  from this panel?
                </p>
                <p>
                  We will also try to deregister it on Meta. Chat history stays and can restore when you
                  reconnect. If this number uses WhatsApp Business App coexistence, Meta may still require
                  a manual unlink in the app.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePhoneMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePhoneMutation.isPending || !phonePendingDelete}
              onClick={(e) => {
                e.preventDefault();
                if (!phonePendingDelete) return;
                deletePhoneMutation.mutate(phonePendingDelete.sessionId);
              }}
            >
              {deletePhoneMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete number"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
