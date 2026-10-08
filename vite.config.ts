import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/** Runs before the first module request so a leftover SW cannot cache-first Vite chunks (reload loops). */
function devUnregisterServiceWorkerPlugin() {
  return {
    name: "dev-unregister-sw-early",
    transformIndexHtml(html: string) {
      const inject = `<script>(function(){if(!('serviceWorker'in navigator))return;navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});})();</script>\n    `;
      return html.replace('<script type="module"', `${inject}<script type="module"`);
    },
  };
}

export default defineConfig(async ({ command, mode }) => {
  const envDir = path.resolve(import.meta.dirname);
  const resolvedMode =
    mode ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const env = loadEnv(resolvedMode, envDir, "");
  /** 1=LandingPage, 2=PartnerWithUs, 3=Login, 4=WhiteLabel — client reads import.meta.env.VITE_TEMPLATE_ID */
  const publicTemplateId = env.VITE_TEMPLATE_ID || env.TEMPLATE_ID || "1";

  const isReplit =
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined;

  const replitPlugins = isReplit
    ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
    : [];

  // Replit modal treats window "error" with evt.error === null as "(unknown runtime error)".
  // Failed <img> loads do that, so local chat with broken/404 media spams a blank overlay.
  const replitRuntimeOverlay = isReplit
    ? (await import("@replit/vite-plugin-runtime-error-modal")).default()
    : null;

  return {
    envDir,
    define: {
      "import.meta.env.VITE_TEMPLATE_ID": JSON.stringify(publicTemplateId),
      "import.meta.env.VITE_DEFAULT_TIMEZONE": JSON.stringify(
        env.VITE_DEFAULT_TIMEZONE || env.DEFAULT_TIMEZONE || env.TZ || "Asia/Kolkata"
      ),
    },
    plugins: [
      react(),
      ...(replitRuntimeOverlay ? [replitRuntimeOverlay] : []),
      ...(command === "serve" ? [devUnregisterServiceWorkerPlugin()] : []),
      ...replitPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        // Force a single React instance (fixes "Cannot read properties of null (reading 'useState')")
        react: path.resolve(import.meta.dirname, "node_modules/react"),
        "react-dom": path.resolve(import.meta.dirname, "node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          import.meta.dirname,
          "node_modules/react/jsx-runtime",
        ),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    root: path.resolve(import.meta.dirname, "client"),
    optimizeDeps: {
      // Never `exclude: ["react", ...]` — Vite scans them as dep entries; esbuild then errors:
      // "The entry point react cannot be marked as external".
      // Pin the React stack so pre-bundling resolves one copy (with resolve.alias + dedupe above).
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      esbuildOptions: {
        mainFields: ["module", "main"],
        // es2020+ required: drizzle-zod / zod paths use BigInt literals (`123n`); safari13 cannot transpile them.
        target: "es2020",
      },
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: false,
      // es2020 matches BigInt in bundled deps; safari13 breaks `vite build` with bigint literal errors.
      target: "es2020",
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        // Default safe chunking to prevent circular chunk TDZ errors
      },
    },
    // Strip debugger statements (prevents pause when DevTools is open on /chat)
    esbuild: {
      drop: ["debugger"],
      target: "es2020",
    },
    server: {
      fs: {
        strict: true,
        // Do not use **/.* — it matches node_modules/.vite and blocks serving pre-bundled deps.
        deny: ["**/.env", "**/.env.*", "**/.npmrc"],
      },
      watch: {
        // Polling every 1s + forced full-reload was causing reload loops (e.g. when .vite deps update).
        usePolling: process.env.VITE_WATCH_POLLING === "1",
        ...(process.env.VITE_WATCH_POLLING === "1" ? { interval: 1000 } : {}),
        ignored: [
          "**/node_modules/.vite/**",
          path.resolve(import.meta.dirname, "uploads"),
        ],
      },
      hmr: {
        overlay: true,
      },
    },
  };
});
