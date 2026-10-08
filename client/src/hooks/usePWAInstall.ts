import { useState, useEffect, useCallback } from "react";
import {
  isStandaloneMode,
  isIOSDevice,
  isIOSSafari,
  isAndroidDevice,
  readPWADismissed,
  writePWADismissed,
} from "@/lib/pwa-utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isDismissed, setIsDismissed] = useState(() => readPWADismissed());

  useEffect(() => {
    if (isStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismissPrompt = useCallback(() => {
    writePWADismissed();
    setIsDismissed(true);
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error installing PWA:", error);
      return false;
    }
  };

  const isIOS = isIOSDevice();
  const needsManualInstall = !isInstalled && (isIOSSafari() || (isIOS && !isInstallable));
  const canNativeInstall = Boolean(deferredPrompt);

  /** Mobile users without the native install API (mainly iOS Safari). */
  const showIOSInstructions = !isInstalled && isIOSSafari();

  /** Android Chrome menu install when the deferred prompt is not available yet. */
  const showAndroidManualHint =
    !isInstalled && isAndroidDevice() && !canNativeInstall;

  const canShowInstallEntry =
    !isInstalled && (canNativeInstall || needsManualInstall || showAndroidManualHint);

  return {
    isInstallable,
    isInstalled,
    isDismissed,
    install,
    dismissPrompt,
    isIOS,
    needsManualInstall,
    canNativeInstall,
    showIOSInstructions,
    showAndroidManualHint,
    canShowInstallEntry,
  };
}
