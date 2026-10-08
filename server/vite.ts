import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";
import {
  injectPublicBrandingIntoIndexHtml,
  loadPublicBrandingAssets,
} from "./public-branding-meta";
import {
  createServer as createViteServer,
  createLogger,
  loadConfigFromFile,
  type UserConfig,
} from "vite";
import { type Server } from "http";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server, listenPort: number) {
  // vite.config.ts uses defineConfig(async () => …) — default export is a Promise. Importing it
  // directly and spreading into createViteServer drops root/plugins; /src/main.tsx then fails.
  const configFile = path.resolve(import.meta.dirname, "..", "vite.config.ts");
  const loaded = await loadConfigFromFile(
    {
      command: "serve",
      mode: process.env.NODE_ENV === "production" ? "production" : "development",
    },
    configFile,
  );
  const cfg = (loaded?.config ?? {}) as UserConfig;
  const baseServer = cfg.server ?? {};
  const baseHmr = baseServer.hmr;
  const hmrMerged =
    typeof baseHmr === "object" && baseHmr !== null
      ? {
          ...baseHmr,
          server,
          port: listenPort,
          clientPort: listenPort,
        }
      : {
          server,
          port: listenPort,
          clientPort: listenPort,
          ...(baseHmr === false ? { overlay: false } : {}),
        };

  const vite = await createViteServer({
    ...cfg,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      ...baseServer,
      middlewareMode: true,
      hmr: hmrMerged,
      allowedHosts: true,
    },
    appType: "custom",
  });

  // Cache the template path to avoid repeated resolution
  const clientTemplate = path.resolve(
    import.meta.dirname,
    "..",
    "client",
    "index.html",
  );

  // Use Vite middleware - this handles Vite-specific requests (HMR, assets, etc.)
  app.use(vite.middlewares);
  
  // Catch-all route for serving the HTML - must be after vite.middlewares
  app.use("*", async (req, res, next) => {
    // Skip API routes - they should be handled by API route handlers
    if (req.path.startsWith("/api") || req.originalUrl?.startsWith("/api")) {
      return next();
    }

    // Skip if response already sent (handled by vite.middlewares)
    if (res.headersSent) {
      return;
    }

    const url = req.originalUrl || req.path;

    try {
      // Read the template file
      const template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Do not append ?v=... to /src/main.tsx — Vite resolves the full URL as a module id and
      // pre-transform fails with "Does the file exist?". Cache is already disabled via headers + HMR.

      // Transform the HTML through Vite (injects Vite client, HMR, etc.)
      let page = await vite.transformIndexHtml(url, template);
      const branding = await loadPublicBrandingAssets();
      page = injectPublicBrandingIntoIndexHtml(page, branding, req);

      // Set proper headers and send the response
      res.status(200)
        .set({ 
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        })
        .end(page);
    } catch (e) {
      const error = e as Error;
      vite.ssrFixStacktrace(error);
      
      // If Vite transformation fails, try to serve the template directly as fallback
      try {
        let fallbackTemplate = await fs.promises.readFile(clientTemplate, "utf-8");
        const branding = await loadPublicBrandingAssets();
        fallbackTemplate = injectPublicBrandingIntoIndexHtml(fallbackTemplate, branding, req);
        res.status(200)
          .set({ 
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
          })
          .end(fallbackTemplate);
      } catch (fallbackError) {
        next(error);
      }
    }
  });
}

export function serveStatic(app: Express) {
  // Resolve path: in production, server code is in dist/, so dist/public is correct
  // But also try process.cwd()/dist/public as fallback for different deployment setups
  let distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    // Try alternative path resolution
    distPath = path.resolve(process.cwd(), "dist", "public");
  }

  if (!fs.existsSync(distPath)) {
    const altPath = path.resolve(import.meta.dirname, "public");
    throw new Error(
      `Could not find the build directory. Tried: ${distPath} and ${altPath}. Make sure to build the client first with 'npm run build'`,
    );
  }

  log(`[serveStatic] Serving static files from: ${distPath}`);

  // Create static middleware instance once (not on every request)
  const staticMiddleware = express.static(distPath, { index: false });

  // Serve static files (CSS, JS, images, etc.) for non-API routes
  app.use((req, res, next) => {
    // Skip API routes completely - they should be handled by API route handlers
    if (req.path.startsWith("/api") || req.originalUrl?.startsWith("/api")) {
      return next();
    }
    // For non-API routes, serve static files
    express.static(distPath, { 
      index: false,
      maxAge: "1y",
      etag: true,
      lastModified: true,
    })(req, res, next);
  });

  // Fall through to index.html for SPA routing (only for non-API routes).
  // Runs after express.static calls next() (no matching asset). Use app.use so GET/HEAD are covered;
  // if Nginx returns 404 for deep links, add: try_files $uri /index.html (see docs/NGINX_SPA.md).
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.originalUrl?.startsWith("/api")) {
      return next();
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (res.headersSent) {
      return;
    }

    const indexPath = path.resolve(distPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      return res.status(500).send("index.html not found");
    }

    void (async () => {
      try {
        let html = await fs.promises.readFile(indexPath, "utf-8");
        const branding = await loadPublicBrandingAssets();
        html = injectPublicBrandingIntoIndexHtml(html, branding, req as Request);
        res
          .status(200)
          .set({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          })
          .end(html);
      } catch (err) {
        next(err);
      }
    })();
  });
}
