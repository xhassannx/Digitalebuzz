import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import type { WhatsappSession } from "@shared/schema";

interface QRConnectionCardProps {
  session?: WhatsappSession;
  onConnect?: () => void;
}

export function QRConnectionCard({ session }: QRConnectionCardProps) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (session?.status === 'qr') {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [session?.status]);

  const getStatusBadge = () => {
    switch (session?.status) {
      case 'connected':
        return (
          <Badge className="gap-1.5" data-testid="badge-status-connected">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-status-connecting">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting
          </Badge>
        );
      case 'qr':
        return (
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-status-qr">
            <Smartphone className="h-3 w-3" />
            Waiting for scan
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5" data-testid="badge-status-disconnected">
            <AlertCircle className="h-3 w-3" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <Card className="max-w-md mx-auto" data-testid="card-qr-connection">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Connect WhatsApp Device</CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Scan the QR code with your WhatsApp mobile app to connect
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {(session?.status === 'qr' || session?.status === 'connecting') && session.qrCode ? (
          <>
            <div className="w-64 h-64 bg-background border rounded-lg flex items-center justify-center p-4">
              <img 
                src={session.qrCode} 
                alt="WhatsApp QR Code" 
                className="w-full h-full"
                data-testid="img-qr-code"
              />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                QR code expires in <span className="font-semibold" data-testid="text-countdown">{countdown}s</span>
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                Ready to scan
              </div>
            </div>
          </>
        ) : session?.status === 'connected' ? (
          <div className="text-center space-y-3 py-8">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <div>
              <p className="font-semibold text-lg" data-testid="text-device-name">
                {session.deviceInfo?.name || 'Device Connected'}
              </p>
              {session.deviceInfo?.phoneNumber && (
                <p className="text-sm text-muted-foreground" data-testid="text-phone-number">
                  {session.deviceInfo.phoneNumber}
                </p>
              )}
            </div>
          </div>
        ) : session?.status === 'connecting' ? (
          <div className="text-center space-y-3 py-8">
            <Loader2 className="h-16 w-16 text-muted-foreground mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground">Initializing connection...</p>
          </div>
        ) : (
          <div className="text-center space-y-3 py-8">
            <Smartphone className="h-16 w-16 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Click "Create Session" to start</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
