/** localStorage: timestamp when user dismissed the install banner */
export const PWA_DISMISS_STORAGE_KEY = "pwa-install-prompt-dismissed-at";

/** Hide the banner again after this many days */
export const PWA_DISMISS_DAYS = 14;

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Safari on iOS (no `beforeinstallprompt`; user must use Share → Add to Home Screen). */
export function isIOSSafari(): boolean {
  if (!isIOSDevice()) return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function readPWADismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(PWA_DISMISS_STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function writePWADismissed(): void {
  localStorage.setItem(PWA_DISMISS_STORAGE_KEY, String(Date.now()));
}
