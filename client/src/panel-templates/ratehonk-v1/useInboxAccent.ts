import { useRatehonkPageSkin } from "./RatehonkSkinContext";

/** Accent + layout classes for Inbox when RateHonk v1 is active. */
export function useInboxAccent() {
  const isRatehonk = useRatehonkPageSkin();
  // Ensure Nova inbox chrome when template is active even if provider tree differs
  const isNova =
    isRatehonk ||
    (typeof document !== "undefined" &&
      (document.documentElement.dataset.panelTemplate === "ratehonk-v1" ||
        document.documentElement.dataset.panelTemplate === "helicoptic-v1" ||
        document.documentElement.dataset.rhShell === "1"));
  return {
    isRatehonk: isNova,
    tagAllActive: isNova
      ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)]"
      : "bg-orange-500 hover:bg-orange-600",
    iconBtn: isNova
      ? "bg-[var(--rh-brand-light)] text-[var(--rh-brand)] hover:bg-[var(--rh-brand-soft)]"
      : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
    primaryBtn: isNova
      ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)]"
      : "bg-orange-500 hover:bg-orange-600",
    checkbox: isNova
      ? "data-[state=checked]:bg-[var(--rh-brand)] data-[state=checked]:border-[var(--rh-brand)]"
      : "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
    switchChecked: isNova
      ? "data-[state=checked]:bg-[var(--rh-brand)]"
      : "data-[state=checked]:bg-primary",
    unreadBadge: isNova ? "bg-[var(--rh-brand)]" : "bg-orange-500",
    banner: isNova ? "bg-[var(--rh-brand)]" : "bg-orange-500",
    emptyIconWrap: isNova ? "bg-[var(--rh-brand-soft)]" : "bg-orange-500/20",
    emptyIcon: isNova ? "text-[var(--rh-brand)]" : "text-orange-500",
    listSelected: isNova ? "bg-[var(--rh-brand-soft)]" : "bg-accent",
    listHover: isNova
      ? "hover:bg-[#f0f0f0]"
      : "hover:bg-[#b8b8b8] dark:hover:bg-muted/80",
    /** Full width on mobile; fixed rail from lg up (chat-page toggles visibility). */
    sidebarWidth: isNova
      ? "min-w-0 max-w-full shrink-0 w-full lg:w-1/4 lg:max-w-[25%] lg:min-w-0"
      : "w-full max-w-full shrink-0 lg:w-[500px] lg:max-w-[500px]",
    spinner: isNova ? "border-[var(--rh-brand)]" : "border-primary",
    pageBg: isNova ? "bg-[#f5f5f5]" : "bg-[#ffffff]",
    searchInput: isNova
      ? "rounded-xl border-[#e5e7eb] bg-white shadow-sm focus-visible:ring-[var(--rh-brand)]"
      : "",
    conversationHeader: isNova
      ? "border-b border-[#e5e7eb] bg-white"
      : "border-b bg-[#f0f2f5] dark:bg-muted",
    mobileConversationHeader: isNova
      ? "bg-[var(--rh-brand)] text-white"
      : "bg-[#008069] text-white",
  };
}
