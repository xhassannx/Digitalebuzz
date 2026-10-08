import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useListPaginationState, parsePaginatedListResponse } from "@/lib/list-pagination";
import { ListPaginationFooter } from "@/components/list-pagination-footer";
import { Trash2, Eye, EyeOff, Copy, Check, AlertCircle, CheckCircle, Edit2, X, Save } from "lucide-react";
import type { Webhook } from "@shared/schema";

const WEBHOOK_EVENTS = [
  { value: 'messages', label: 'All message events', description: 'All message events: received, sent, status updated' },
  { value: 'message.received', label: 'Message Received', description: 'When a message is received from a contact' },
  { value: 'message.sent', label: 'Message Sent', description: 'When a message is successfully sent' },
  { value: 'message.status_updated', label: 'Message Status Updated', description: 'When a message status changes (delivered, read, etc.)' },
  { value: 'forms', label: 'All form events', description: 'All WhatsApp form submission events' },
  { value: 'form.response', label: 'Form Response', description: 'When a contact submits a WhatsApp Flow form' },
  { value: 'session.connected', label: 'Session Connected', description: 'When a WhatsApp session connects' },
  { value: 'session.disconnected', label: 'Session Disconnected', description: 'When a WhatsApp session disconnects' },
  { value: 'chat.new', label: 'New Chat', description: 'When a new conversation is created' },
  { value: 'contacts', label: 'All contact events', description: 'All contact events: created, updated, deleted, tag added/removed' },
  { value: 'contact.created', label: 'Contact Created', description: 'When a new contact is created' },
  { value: 'contact.updated', label: 'Contact Updated', description: 'When a contact is updated' },
  { value: 'contact.deleted', label: 'Contact Deleted', description: 'When a contact is deleted' },
  { value: 'contact.tag_added', label: 'Contact Tag Added', description: 'When a tag is assigned to a contact' },
  { value: 'contact.tag_removed', label: 'Contact Tag Removed', description: 'When a tag is removed from a contact' },
  { value: 'app_events', label: 'All app events', description: 'All integration events: Calendly, Google Calendar, Shopify, Facebook Lead Ads' },
  { value: 'calendly.invitee_created', label: 'Calendly: Event Scheduled', description: 'When someone books a Calendly appointment' },
  { value: 'calendly.invitee_canceled', label: 'Calendly: Event Canceled', description: 'When a Calendly appointment is canceled' },
  { value: 'calendly.routing_form_submission', label: 'Calendly: Routing Form', description: 'When someone submits a Calendly routing form' },
  { value: 'google_calendar.event_created', label: 'Google Calendar: Event Created', description: 'When a Google Calendar event is created' },
  { value: 'google_calendar.event_updated', label: 'Google Calendar: Event Updated', description: 'When a Google Calendar event is updated' },
  { value: 'google_calendar.event_deleted', label: 'Google Calendar: Event Deleted', description: 'When a Google Calendar event is deleted' },
  { value: 'shopify.order_created', label: 'Shopify: Order Created', description: 'When a new Shopify order is placed' },
  { value: 'shopify.order_updated', label: 'Shopify: Order Updated', description: 'When a Shopify order is updated' },
  { value: 'shopify.customer_created', label: 'Shopify: Customer Created', description: 'When a new Shopify customer is created' },
  { value: 'facebook_lead_ads.lead_received', label: 'Facebook Lead Ads: Lead Received', description: 'When a new lead is received from Facebook Lead Ads' },
] as const;

export function WebhookManager() {
  const { toast } = useToast();
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [deleteConfirmWebhook, setDeleteConfirmWebhook] = useState<string | null>(null);
  const {
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    paginationParams,
  } = useListPaginationState(10);

  const { data: webhooksResponse, isLoading } = useQuery({
    queryKey: ["/api/webhooks", currentPage, rowsPerPage],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/webhooks?${paginationParams.toString()}`);
      return res.json();
    },
  });

  const { items: webhooks, total: totalWebhooks } = parsePaginatedListResponse<Webhook>(
    webhooksResponse,
    "webhooks"
  );

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: { url: string; events: string[] }) => {
      const res = await apiRequest('POST', '/api/webhooks', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setNewWebhookUrl("");
      setSelectedEvents([]);
      toast({
        title: "Webhook created",
        description: "Your webhook has been successfully created",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create webhook",
      });
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { url: string; events: string[] } }) => {
      const res = await apiRequest('PATCH', `/api/webhooks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setEditingWebhook(null);
      toast({
        title: "Webhook updated",
        description: "Your webhook has been successfully updated",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update webhook",
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      await apiRequest('DELETE', `/api/webhooks/${webhookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      setDeleteConfirmWebhook(null);
      toast({
        title: "Webhook deleted",
        description: "Your webhook has been successfully deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete webhook",
      });
    },
  });

  const handleCreateWebhook = () => {
    if (!newWebhookUrl.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a webhook URL",
      });
      return;
    }

    if (selectedEvents.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one event",
      });
      return;
    }

    createMutation.mutate({
      url: newWebhookUrl,
      events: selectedEvents,
    });
  };

  const handleEventToggle = (eventValue: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventValue)
        ? prev.filter(e => e !== eventValue)
        : [...prev, eventValue]
    );
  };

  const handleEditEventToggle = (eventValue: string) => {
    setEditEvents(prev => 
      prev.includes(eventValue)
        ? prev.filter(e => e !== eventValue)
        : [...prev, eventValue]
    );
  };

  const startEditing = (webhook: Webhook) => {
    setEditingWebhook(webhook.id);
    setEditUrl(webhook.url);
    setEditEvents([...webhook.events]);
  };

  const cancelEditing = () => {
    setEditingWebhook(null);
    setEditUrl("");
    setEditEvents([]);
  };

  const handleSaveEdit = () => {
    if (!editUrl.trim() || editEvents.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide URL and at least one event",
      });
      return;
    }

    updateMutation.mutate({
      id: editingWebhook!,
      data: {
        url: editUrl,
        events: editEvents,
      },
    });
  };

  const toggleSecretVisibility = (webhookId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [webhookId]: !prev[webhookId],
    }));
  };

  const copySecret = async (secret: string, webhookId: string) => {
    await navigator.clipboard.writeText(secret);
    setCopiedSecret(webhookId);
    setTimeout(() => setCopiedSecret(null), 2000);
    toast({
      title: "Copied",
      description: "Webhook secret copied to clipboard",
    });
  };

  const confirmDelete = (webhookId: string) => {
    setDeleteConfirmWebhook(webhookId);
  };

  const handleDelete = () => {
    if (deleteConfirmWebhook) {
      deleteMutation.mutate(deleteConfirmWebhook);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Webhook Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Webhook</CardTitle>
          <CardDescription>
            Configure a new webhook to receive real-time events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input 
              id="webhook-url" 
              placeholder="https://your-domain.com/webhook"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
            <p className="text-xs text-muted-foreground">
              We'll send HMAC-signed POST requests to this URL when events occur
            </p>
          </div>

          <div className="space-y-3">
            <Label>Events to Subscribe</Label>
            <div className="space-y-3">
              {WEBHOOK_EVENTS.map((event) => (
                <div key={event.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={`event-${event.value}`}
                    checked={selectedEvents.includes(event.value)}
                    onCheckedChange={() => handleEventToggle(event.value)}
                    data-testid={`checkbox-event-${event.value}`}
                  />
                  <div className="space-y-0.5 flex-1">
                    <Label 
                      htmlFor={`event-${event.value}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {event.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleCreateWebhook}
            disabled={createMutation.isPending}
            data-testid="button-create-webhook"
          >
            {createMutation.isPending ? "Creating..." : "Create Webhook"}
          </Button>
        </CardContent>
      </Card>

      {/* Active Webhooks List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Webhooks</CardTitle>
          <CardDescription>
            Manage your configured webhooks and view delivery status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading webhooks...
            </div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks configured yet. Create one above to get started.
            </div>
          ) : (
            <>
            <div className="space-y-4">
              {webhooks.map((webhook, index) => (
                <div key={webhook.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="space-y-3" data-testid={`webhook-item-${webhook.id}`}>
                    {/* Header with Status and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {webhook.status === 'active' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                          {webhook.status}
                        </Badge>
                        {webhook.failureCount > 0 && (
                          <Badge variant="destructive" data-testid={`badge-failures-${webhook.id}`}>
                            {webhook.failureCount} failures
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingWebhook === webhook.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleSaveEdit}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-webhook-${webhook.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={cancelEditing}
                              disabled={updateMutation.isPending}
                              data-testid={`button-cancel-edit-${webhook.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(webhook)}
                              data-testid={`button-edit-webhook-${webhook.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(webhook.id)}
                              data-testid={`button-delete-webhook-${webhook.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* URL (Editable or Display) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">URL</Label>
                      {editingWebhook === webhook.id ? (
                        <Input 
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="https://your-domain.com/webhook"
                          data-testid={`input-edit-url-${webhook.id}`}
                        />
                      ) : (
                        <div className="font-mono text-sm bg-muted p-2 rounded-md break-all">
                          {webhook.url}
                        </div>
                      )}
                    </div>

                    {/* Events (Editable or Display) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Subscribed Events</Label>
                      {editingWebhook === webhook.id ? (
                        <div className="space-y-2 bg-muted p-3 rounded-md">
                          {WEBHOOK_EVENTS.map((event) => (
                            <div key={event.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-event-${webhook.id}-${event.value}`}
                                checked={editEvents.includes(event.value)}
                                onCheckedChange={() => handleEditEventToggle(event.value)}
                                data-testid={`checkbox-edit-event-${event.value}-${webhook.id}`}
                              />
                              <Label 
                                htmlFor={`edit-event-${webhook.id}-${event.value}`}
                                className="text-xs cursor-pointer"
                              >
                                {event.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" data-testid={`badge-event-${event}`}>
                              {event}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Secret (Only in Display Mode) */}
                    {editingWebhook !== webhook.id && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Signing Secret</Label>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm bg-muted p-2 rounded-md flex-1 break-all">
                            {showSecrets[webhook.id] ? webhook.secret : '••••••••••••••••••••••••••••'}
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => toggleSecretVisibility(webhook.id)}
                            data-testid={`button-toggle-secret-${webhook.id}`}
                          >
                            {showSecrets[webhook.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copySecret(webhook.secret, webhook.id)}
                            data-testid={`button-copy-secret-${webhook.id}`}
                          >
                            {copiedSecret === webhook.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use this secret to verify webhook signatures (HMAC-SHA256)
                        </p>
                      </div>
                    )}

                    {/* Delivery Stats (Only in Display Mode) */}
                    {editingWebhook !== webhook.id && webhook.lastTriggeredAt && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Last Triggered</Label>
                        <div className="text-sm">
                          {new Date(webhook.lastTriggeredAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalWebhooks > 0 && (
              <ListPaginationFooter
                total={totalWebhooks}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={setRowsPerPage}
                className="mt-4"
              />
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmWebhook !== null} onOpenChange={() => setDeleteConfirmWebhook(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone and you will stop receiving events at this endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* HMAC Signature Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Security</CardTitle>
          <CardDescription>
            How to verify webhook signatures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            All webhook requests include an <code className="bg-muted px-1 py-0.5 rounded">X-Webhook-Signature</code> header 
            containing an HMAC-SHA256 signature. Verify this signature to ensure the request came from our servers:
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-xs">
              const crypto = require('crypto');<br/>
              const signature = crypto<br/>
              &nbsp;&nbsp;.createHmac('sha256', webhookSecret)<br/>
              &nbsp;&nbsp;.update(JSON.stringify(requestBody))<br/>
              &nbsp;&nbsp;.digest('hex');<br/>
              <br/>
              if (signature === req.headers['x-webhook-signature']) &#123;<br/>
              &nbsp;&nbsp;// Valid webhook<br/>
              &#125;
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
