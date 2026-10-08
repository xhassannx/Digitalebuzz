// @ts-nocheck
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Smartphone, Trash2, CheckCircle2, XCircle, Loader2, RefreshCw, Crown } from "lucide-react";
import type { WhatsappSession } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface SessionCardProps {
  session: WhatsappSession;
  onDisconnect: (sessionId: string) => void;
  onSyncMessages?: (sessionId: string) => void;
  onRequestMessageSync?: (sessionId: string) => void;
  isDisconnecting?: boolean;
  isSyncing?: boolean;
  hasApprovedSync?: boolean;
}

export function SessionCard({ session, onDisconnect, onSyncMessages, onRequestMessageSync, isDisconnecting = false, isSyncing = false, hasApprovedSync = false }: SessionCardProps) {
  const isConnected = session.status === 'connected' || session.status === 'Connected';

  const formatLastActive = (date?: Date) => {
    if (!date) return 'Never';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card className="relative" data-testid={`card-session-${session.id}`}>
      {isConnected && (
        <div className="absolute top-4 right-4">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium" data-testid={`text-session-name-${session.id}`}>
                {session.deviceInfo?.name || 'WhatsApp Device'}
              </p>
              <p className="text-xs text-muted-foreground" data-testid={`text-session-phone-${session.id}`}>
                {session.deviceInfo?.phoneNumber || session.sessionId}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge 
            variant={isConnected ? "default" : "secondary"}
            className="gap-1.5"
            data-testid={`badge-session-status-${session.id}`}
          >
            {isConnected ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {session.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Last Active</span>
          <span className="text-xs font-medium" data-testid={`text-last-active-${session.id}`}>
            {formatLastActive(session.lastActive)}
          </span>
        </div>

        {session.deviceInfo?.platform && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Platform</span>
            <span className="text-xs font-medium">{session.deviceInfo.platform}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-2">
          {isConnected && (
            <>
              {session.connectionType === 'unofficial' ? (
                // Unofficial mode: Show premium request button
                hasApprovedSync ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-2"
                    onClick={() => {
                      if (onSyncMessages) {
                        onSyncMessages(session.sessionId);
                      }
                    }}
                    disabled={isSyncing || isDisconnecting || !onSyncMessages}
                    data-testid={`button-sync-${session.id}`}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Messages
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-2 border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={() => {
                      if (onRequestMessageSync) {
                        onRequestMessageSync(session.sessionId);
                      }
                    }}
                    disabled={isDisconnecting || !onRequestMessageSync}
                    data-testid={`button-request-sync-${session.id}`}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Request Message Sync (Premium)
                  </Button>
                )
              ) : (
                // Official mode: Regular sync button (if needed)
                onSyncMessages && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-2"
                    onClick={() => onSyncMessages(session.sessionId)}
                    disabled={isSyncing || isDisconnecting}
                    data-testid={`button-sync-${session.id}`}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Messages
                      </>
                    )}
                  </Button>
                )
              )}
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDisconnect(session.sessionId)}
            disabled={isDisconnecting || isSyncing}
            data-testid={`button-disconnect-${session.id}`}
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Disconnect
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
