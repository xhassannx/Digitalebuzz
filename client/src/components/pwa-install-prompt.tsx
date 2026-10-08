import { useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/**
 * Bottom banner on mobile: install the panel as a home-screen app (PWA).
 * Android: native install when supported; iOS: Share → Add to Home Screen steps.
 */
export function PWAInstallPrompt() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const {
    isInstalled,
    isDismissed,
    install,
    dismissPrompt,
    canNativeInstall,
    showIOSInstructions,
    showAndroidManualHint,
    canShowInstallEntry,
  } = usePWAInstall();

  if (!isMobile || isInstalled || isDismissed || !canShowInstallEntry) {
    return null;
  }

  const handleInstall = async () => {
    if (canNativeInstall) {
      const ok = await install();
      toast({
        title: ok ? "App installed" : "Installation cancelled",
        description: ok
          ? "Open Inbox from your home screen anytime."
          : "You can install later from the account menu.",
        variant: ok ? "default" : "destructive",
      });
      if (ok) dismissPrompt();
      return;
    }
    setInstructionsOpen(true);
  };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-[90] border-t bg-card px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] md:hidden"
        role="region"
        aria-label="Install app"
      >
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dfe8ff] text-[#0059bb]">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-snug">
              Install app shortcut
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {showIOSInstructions
                ? "Add to your home screen for one-tap access to Inbox."
                : canNativeInstall
                  ? "Install like an app — opens directly to your inbox."
                  : "Add this panel to your home screen from the browser menu."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-8" onClick={() => void handleInstall()}>
                {canNativeInstall ? (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Install
                  </>
                ) : showIOSInstructions ? (
                  <>
                    <Share className="mr-1.5 h-3.5 w-3.5" />
                    How to install
                  </>
                ) : (
                  "Install steps"
                )}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={dismissPrompt}>
                Not now
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Dismiss install prompt"
            onClick={dismissPrompt}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to home screen</DialogTitle>
            <DialogDescription>
              {showIOSInstructions
                ? "On iPhone or iPad, use Safari’s Share menu:"
                : showAndroidManualHint
                  ? "In Chrome on Android:"
                  : "Use your browser’s install option:"}
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            {showIOSInstructions ? (
              <>
                <li>
                  Tap the <strong>Share</strong> button{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-hidden /> at the bottom of
                  Safari.
                </li>
                <li>
                  Scroll and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> — the app icon will appear on your home screen.
                </li>
              </>
            ) : (
              <>
                <li>
                  Open the browser <strong>menu</strong> (⋮).
                </li>
                <li>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li>Confirm — then open Inbox from the new icon.</li>
              </>
            )}
          </ol>
          <p className="text-xs text-muted-foreground">
            You must be signed in. The shortcut opens your inbox at{" "}
            <span className="font-medium">/chat</span>.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Reusable install steps dialog (e.g. account menu on iOS). */
export function PWAInstallInstructionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { showIOSInstructions, showAndroidManualHint, canNativeInstall, install } = usePWAInstall();
  const { toast } = useToast();

  const handleNativeInstall = async () => {
    const ok = await install();
    toast({
      title: ok ? "App installed" : "Installation cancelled",
      variant: ok ? "default" : "destructive",
    });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Install app shortcut</DialogTitle>
          <DialogDescription>
            {canNativeInstall
              ? "Install this panel on your device for quick access."
              : showIOSInstructions
                ? "Add to Home Screen from Safari:"
                : "Add from your browser menu:"}
          </DialogDescription>
        </DialogHeader>
        {canNativeInstall ? (
          <Button type="button" className="w-full" onClick={() => void handleNativeInstall()}>
            <Download className="mr-2 h-4 w-4" />
            Install now
          </Button>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            {showIOSInstructions ? (
              <>
                <li>
                  Tap <strong>Share</strong>{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-hidden /> in Safari.
                </li>
                <li>
                  Choose <strong>Add to Home Screen</strong>.
                </li>
                <li>Tap <strong>Add</strong>.</li>
              </>
            ) : (
              <>
                <li>Open the browser menu (⋮).</li>
                <li>
                  Select <strong>Install app</strong>
                  {showAndroidManualHint ? "" : " or Add to Home screen"}.
                </li>
              </>
            )}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
