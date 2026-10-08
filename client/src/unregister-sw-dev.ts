/**
 * Must run before other app imports: a leftover service worker from a prod/preview build
 * will cache-first Vite dev assets → stale chunks → HMR/full-reload loops on every page.
 */
if (import.meta.env.DEV && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister();
  });
}
