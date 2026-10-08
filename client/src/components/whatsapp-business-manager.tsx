import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, CheckCircle2, AlertCircle, Phone, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WhatsAppPhoneNumber = {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  code_verification_status?: string;
  quality_rating?: any;
  businessAccountId?: string;
  businessAccountName?: string;
  wabaId?: string;
  wabaName?: string;
  /** Integration that owns this phone (required when multiple Meta/WhatsApp accounts) */
  integrationId?: string;
};

type WhatsAppBusinessManagerProps = {
  integrationId?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function WhatsAppBusinessManager({ integrationId, isOpen, onClose }: WhatsAppBusinessManagerProps) {
  const { toast } = useToast();
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");

  // Fetch WhatsApp Business phone numbers
  const { data: phoneNumbersData, isLoading: isLoadingPhoneNumbers, refetch: refetchPhoneNumbers, error: phoneNumbersError } = useQuery<{
    success: boolean;
    phoneNumbers: WhatsAppPhoneNumber[];
    count: number;
  }>({
    queryKey: ["/api/integrations/whatsapp-business/phone-numbers"],
    enabled: isOpen,
    retry: 1,
  });

  // Fetch already added phone numbers (sessions)
  const { data: addedPhonesData, refetch: refetchAddedPhones } = useQuery<{
    success: boolean;
    phoneNumbers: Array<{
      sessionId: string;
      phoneNumberId: string;
      integrationId?: string;
      displayPhoneNumber: string;
      verifiedName?: string;
      status: string;
    }>;
    count: number;
  }>({
    queryKey: ["/api/integrations/whatsapp-business/added-phones"],
    enabled: isOpen,
  });

  // Add phone number mutation (creates a session)
  const addPhoneMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const phoneNumber = phoneNumbers?.find((p) => p.id === phoneNumberId);
      const res = await apiRequest("POST", "/api/integrations/whatsapp-business/add-phone", {
        phoneNumberId,
        businessAccountId: phoneNumber?.businessAccountId,
        businessAccountName: phoneNumber?.businessAccountName,
        wabaId: phoneNumber?.wabaId,
        wabaName: phoneNumber?.wabaName,
        displayPhoneNumber: phoneNumber?.display_phone_number,
        verifiedName: phoneNumber?.verified_name,
        qualityRating: phoneNumber?.quality_rating,
        codeVerificationStatus: phoneNumber?.code_verification_status,
        ...(phoneNumber?.integrationId && { integrationId: phoneNumber.integrationId }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp-business/added-phones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: data.refreshed ? "Connection refreshed" : "Phone number added successfully",
        description: data.refreshed
          ? "The session was already added; it is now updated with your current WhatsApp Business connection."
          : `WhatsApp Business phone number ${data.phoneNumber?.displayPhoneNumber} has been added and is ready to use.`,
      });
      refetchAddedPhones();
      setSelectedPhoneNumberId(""); // Reset selection
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add phone number",
        description: error.message || "Failed to add phone number",
      });
    },
  });

  const phoneNumbers = phoneNumbersData?.phoneNumbers || [];
  const addedPhones = addedPhonesData?.phoneNumbers || [];
  const addedPhoneIds = new Set(addedPhones.map((p) => p.phoneNumberId));
  const availablePhones = phoneNumbers.filter((p) => !addedPhoneIds.has(p.id));

  // Refresh connection for an already-added phone (e.g. after reconnect)
  const refreshConnectionMutation = useMutation({
    mutationFn: async (phone: { phoneNumberId: string; integrationId?: string; displayPhoneNumber?: string; verifiedName?: string; businessAccountId?: string; wabaId?: string; wabaName?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: data.refreshed ? "Connection refreshed" : "Phone number added",
        description: data.refreshed
          ? "Session is now using your current WhatsApp Business connection. You can send messages again."
          : "Phone number is ready to use.",
      });
      refetchAddedPhones();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: error.message || "Failed to refresh connection",
      });
    },
  });

  // Sync templates mutation
  const syncTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/sync-templates");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Templates synced successfully",
        description: `Successfully synced ${data.count || 0} templates.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to sync templates",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage WhatsApp Business</DialogTitle>
          <DialogDescription>
            Select a WhatsApp Business phone number to use for messaging.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Already Added Phone Numbers */}
          {addedPhones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Added Phone Numbers</CardTitle>
                <CardDescription>Phone numbers already added and available for use</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {addedPhones.map((phone) => (
                    <Card key={phone.sessionId} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-medium">{phone.displayPhoneNumber}</p>
                            {phone.verifiedName && (
                              <p className="text-sm text-muted-foreground">{phone.verifiedName}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Session: {phone.sessionId}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => refreshConnectionMutation.mutate(phone)}
                              disabled={refreshConnectionMutation.isPending}
                              title="Use this after reconnecting WhatsApp Business in Integrations to fix send errors"
                            >
                              {refreshConnectionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              Refresh connection
                            </Button>
                            <Badge variant={phone.status === "connected" ? "default" : "secondary"}>
                              {phone.status === "connected" ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Connected
                                </>
                              ) : (
                                phone.status
                              )}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Phone Numbers to Add */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Phone Number</CardTitle>
              <CardDescription>
                Add WhatsApp Business phone numbers from your Meta Business Account. Each number will be available as a separate session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPhoneNumbers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : phoneNumbersError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="font-medium">Error loading phone numbers</p>
                  <p className="text-sm mt-1">
                    {(phoneNumbersError as any)?.message || "Failed to fetch phone numbers. Check console for details."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => refetchPhoneNumbers()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : availablePhones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {phoneNumbers.length === 0 ? (
                    <>
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No WhatsApp Business phone numbers found.</p>
                      <p className="text-sm mt-1">
                        Make sure you have a WhatsApp Business Account set up in Meta Business Manager.
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All available phone numbers have been added.</p>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => refetchPhoneNumbers()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <>
                  <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a phone number to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhones.map((phone) => (
                        <SelectItem key={phone.id} value={phone.id}>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>
                              {phone.display_phone_number}
                              {phone.verified_name && ` - ${phone.verified_name}`}
                            </span>
                            {phone.code_verification_status === "VERIFIED" && (
                              <Badge variant="default" className="ml-2">Verified</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedPhoneNumberId && (
                    <div className="mt-4 space-y-2">
                      {phoneNumbers
                        .filter((p) => p.id === selectedPhoneNumberId)
                        .map((phone) => (
                          <Card key={phone.id} className="border">
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{phone.display_phone_number}</p>
                                    {phone.verified_name && (
                                      <p className="text-sm text-muted-foreground">{phone.verified_name}</p>
                                    )}
                                  </div>
                                  {phone.code_verification_status === "VERIFIED" && (
                                    <Badge variant="default">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                {phone.businessAccountName && (
                                  <div className="text-sm text-muted-foreground">
                                    Business Account: {phone.businessAccountName}
                                  </div>
                                )}
                                {phone.wabaName && (
                                  <div className="text-sm text-muted-foreground">
                                    WABA: {phone.wabaName}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Add Button */}
          {selectedPhoneNumberId && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button
                  onClick={() => addPhoneMutation.mutate(selectedPhoneNumberId)}
                  disabled={addPhoneMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {addPhoneMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Add This Phone Number
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This will create a new session. Templates will be automatically synced.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Manual Template Sync */}
          {integrationId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync Templates</CardTitle>
                <CardDescription>Manually sync message templates from WhatsApp Business</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => syncTemplatesMutation.mutate()}
                  disabled={syncTemplatesMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {syncTemplatesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing templates...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Templates
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

