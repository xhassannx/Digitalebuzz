import "./unregister-sw-dev";
import { initInstallLabelReplace } from "./install-label-replace";
import { initStripWhatsAppDocumentTitlePrefix } from "./strip-document-title-prefix";
import { loadLeadConnectorWidgetIfTemplate2 } from "@/lib/leadconnector-widget";
import { createRoot } from "react-dom/client";

loadLeadConnectorWidgetIfTemplate2();
initInstallLabelReplace();
initStripWhatsAppDocumentTitlePrefix();
import App from "./App";
import "./index.css";

// Ensure DOM is ready before initializing
function initApp() {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    // Retry after a short delay if root element is not found
    setTimeout(initApp, 100);
    return;
  }

  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    // Show error message to user
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
        <div style="text-align: center;">
          <h1>Application Error</h1>
          <p>Failed to load the application. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // DOM is already ready
  initApp();
}

// Service worker + Vite dev fight each other (cached HTML/assets → reload loops, stale chunks). Only use SW in production.
// Dev unregister also runs at module load (unregister-sw-dev.ts) so SW cannot intercept the first Vite requests.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        console.log("Service Worker registered – notifications will work in other tabs");

        const showReloadPrompt = () => {
          const ev = new CustomEvent("service-worker-update", { detail: { registration } });
          window.dispatchEvent(ev);
        };

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  showReloadPrompt();
                }
              }
            });
          }
        });

        if (registration.waiting) showReloadPrompt();

        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        if (registration.active?.scriptURL && !registration.active.scriptURL.includes("service-worker.js")) {
          registration.unregister();
        }
      });
    });
  });
}
