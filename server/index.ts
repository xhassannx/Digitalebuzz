import 'dotenv/config';
import "./bootstrap-timezone";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerUploadsMiddleware } from "./middleware/serve-uploads";
import { describeMediaStorageMode } from "./utils/media-storage";
import { setupVite, serveStatic, log } from "./vite";
import { registerPublicWebManifestRoute } from "./public-branding-meta";
import { startCampaignScheduler } from "./campaigns/scheduler";
import { startDripCampaignScheduler } from "./drip-campaigns/scheduler";
import { startContactsSyncScheduler } from "./contacts/sync-scheduler";
import { startChatbotDelayScheduler } from "./chatbots/delay-scheduler";
import { startAutomationDelayScheduler } from "./automation/delay-scheduler";
import { startReminderWhatsAppScheduler } from "./reminders/whatsapp-scheduler";
import { startLogRotation } from "./log-rotation";
import { startWebhookLogCleanup } from "./webhooks/meta-webhook-logger";
import { startPlatformMasterScheduler } from "./platform-master-scheduler";
import { startWhitelabelOnboardingMonthlyScheduler } from "./onboarding-monthly-scheduler";
import { startTrialAccountScheduler } from "./trial-account-scheduler";
import { startCustomerStatusBackgroundScheduler } from "./customer-status-scheduler";
import { startSubscriptionEmailScheduler } from "./subscription-email-scheduler";
import { startFlowScheduler } from "./automation/flow-scheduler";
import { startSheetsPoller } from "./automation/sheets-poller";
import { startCommerceCatalogSyncScheduler } from "./commerce/catalog-sync-scheduler";
import { ensureSystemFreePlan } from "./utils/system-free-plan";
import { startExpiredSubscriptionPurgeScheduler } from "./expired-subscription-purge-scheduler";
import { waitForDb } from "../db";
import { isMongoEnabled, initMongo, waitForMongo } from "../db/mongo";
import { startWalletBillingScheduler } from "./wallet/wallet-billing-scheduler";

if (isMongoEnabled()) {
  void initMongo();
}

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb', // Increase limit to handle large webhook payloads and media uploads
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: false,
  limit: '50mb' // Increase limit for URL-encoded data as well
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  type RoutePerf = { count: number; totalMs: number; maxMs: number; slowOver1s: number; lastStatus: number };
  type GlobalPerfState = {
    routePerfMap: Map<string, RoutePerf>;
    top10TimerStarted: boolean;
  };
  const perfStateKey = "__routePerfState__";
  const globalAny = globalThis as typeof globalThis & Record<string, unknown>;
  if (!globalAny[perfStateKey]) {
    globalAny[perfStateKey] = {
      routePerfMap: new Map<string, RoutePerf>(),
      top10TimerStarted: false,
    } as GlobalPerfState;
  }
  const perfState = globalAny[perfStateKey] as GlobalPerfState;

  if (!perfState.top10TimerStarted) {
    perfState.top10TimerStarted = true;
    const reportIntervalMs = Number(process.env.SLOW_ROUTE_REPORT_INTERVAL_MS || 60_000);
    setInterval(() => {
      const rows = Array.from(perfState.routePerfMap.entries())
        .map(([key, p]) => ({
          key,
          count: p.count,
          avgMs: p.count > 0 ? p.totalMs / p.count : 0,
          maxMs: p.maxMs,
          slowOver1s: p.slowOver1s,
          lastStatus: p.lastStatus,
        }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.avgMs - a.avgMs)
        .slice(0, 10);
      if (rows.length > 0) {
        console.log("[Perf] Top 10 slow API routes (avg ms, 60s window):");
        rows.forEach((r, idx) => {
          console.log(
            `[Perf] ${idx + 1}. ${r.key} avg=${r.avgMs.toFixed(1)}ms max=${r.maxMs}ms calls=${r.count} slow>1s=${r.slowOver1s} lastStatus=${r.lastStatus}`
          );
        });
      }
      perfState.routePerfMap.clear();
    }, reportIntervalMs);
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const routeKey = `${req.method} ${path}`;
      const prev = perfState.routePerfMap.get(routeKey) || {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        slowOver1s: 0,
        lastStatus: 0,
      };
      prev.count += 1;
      prev.totalMs += duration;
      prev.maxMs = Math.max(prev.maxMs, duration);
      if (duration >= 1000) prev.slowOver1s += 1;
      prev.lastStatus = res.statusCode;
      perfState.routePerfMap.set(routeKey, prev);

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Do NOT await DB bootstrap before listen — slow/remote RDS + PM2 wait_ready/listen_timeout
  // otherwise kills the process → nginx 502 even when DATABASE_URL works (psql / node -e OK).

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (res.headersSent) {
      return;
    }
    res.status(status).json({ message });
    // Do not re-throw after sending a response; that can terminate the process
    // and cause upstream gateway 502 responses for subsequent requests.
    console.error("[Error Middleware]", {
      status,
      message,
      method: req.method,
      path: req.originalUrl || req.path,
      userAgent: req.headers["user-agent"] || "unknown",
      error: err?.stack || err,
    });
  });

  // Explicit API route guard - must be before static file serving
  // This ensures API routes are never processed by static middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isApiRoute = req.path.startsWith("/api") || req.originalUrl?.startsWith("/api");
    if (isApiRoute) {
      // If this is an API route and headers haven't been sent, it means no route matched
      // Return 404 JSON response
      if (!res.headersSent) {
        return res.status(404).json({ message: "API endpoint not found" });
      }
      // If headers are already sent, just pass through
      return next();
    }
    // For non-API routes, continue to static file serving
    next();
  });

  // Serve uploads from local disk and/or S3 (see MEDIA_STORAGE / AWS_S3_BUCKET in .env)
  registerUploadsMiddleware(app);

  // PWA install icon comes from Website Builder branding logo — must run before static / Vite.
  registerPublicWebManifestRoute(app);

  // Port must be known before Vite middleware setup: in middleware mode the HTTP server
  // is not listening yet, so Vite cannot infer HMR WebSocket port (would be undefined).
  const port = parseInt(process.env.PORT || "5000", 10);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isDevelopment = process.env.NODE_ENV === "development" || app.get("env") === "development";
  if (isDevelopment) {
    await setupVite(app, server, port);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.

  // Use simple listen for maximum Windows compatibility
  server.listen(port, () => {
    // Signal PM2 immediately — do NOT wait for slow RDS warmup (can be 30–60s+).
    if (typeof process.send === "function") {
      process.send("ready");
    }
    log(`serving on port ${port}`);
    console.log(`✅ Server ready at http://localhost:${port}`);
    console.log(`📁 Media storage: ${describeMediaStorageMode()}`);

    // Log rotation / cleanup don't need DB — start now.
    if (process.env.DISABLE_LOG_ROTATION !== "true") {
      startLogRotation(60_000);
    }
    if (process.env.DISABLE_WEBHOOK_LOG_CLEANUP !== "true") {
      try {
        startWebhookLogCleanup(60_000);
      } catch (error: any) {
        console.error("❌ Failed to initialize webhook log cleanup:", error?.message);
      }
    }

    // Wait for RDS pool warmup before Plans + schedulers (avoids connection stampede).
    void (async () => {
      if (isMongoEnabled()) {
        console.log("[DB] Waiting for MongoDB readiness before starting background jobs...");
        await waitForMongo(30_000);
        console.log("[DB] MongoDB ready — starting Plans + schedulers");
      } else {
        console.log("[DB] Waiting for pool warmup before starting DB background jobs...");
        await waitForDb(180_000);
        console.log("[DB] Pool ready — starting Plans + schedulers");
      }

      try {
        await ensureSystemFreePlan();
      } catch (error) {
        console.error(
          "[Plans] Failed to ensure system Free plan during startup (run: npm run db:migrate-system-free-plan):",
          error
        );
      }

      const isMasterInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";
      if (!isMasterInstance) {
        console.log(`[Schedulers] Replica instance (NODE_APP_INSTANCE=${process.env.NODE_APP_INSTANCE}) - skipping background schedulers to prevent duplicate runs and DB stampede.`);
        return;
      }

      if (process.env.DISABLE_BUILTIN_SCHEDULER !== "true") {
        try {
          console.log("📅 Initializing campaign scheduler...");
          startCampaignScheduler();
          console.log("✅ Campaign scheduler initialization completed");
        } catch (error: any) {
          console.error("❌ CRITICAL: Failed to initialize campaign scheduler:", error);
        }
      }

      if (process.env.DISABLE_CONTACTS_SYNC_SCHEDULER !== "true") {
        try {
          startContactsSyncScheduler();
        } catch (error: any) {
          console.error("❌ CRITICAL: Failed to initialize contacts sync scheduler:", error);
        }
      }

      try {
        startChatbotDelayScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start chatbot delay scheduler:", error?.message);
      }

      try {
        startAutomationDelayScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start automation delay scheduler:", error?.message);
      }

      try {
        startDripCampaignScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start drip campaign scheduler:", error?.message);
      }

      try {
        startReminderWhatsAppScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start reminder WhatsApp scheduler:", error?.message);
      }

      try {
        startPlatformMasterScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start platform master settings scheduler:", error?.message);
      }

      try {
        startWhitelabelOnboardingMonthlyScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start onboarding monthly scheduler:", error?.message);
      }

      try {
        startCustomerStatusBackgroundScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start customer status background scheduler:", error?.message);
      }

      try {
        startSubscriptionEmailScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start subscription email scheduler:", error?.message);
      }

      try {
        startExpiredSubscriptionPurgeScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start expired subscription purge scheduler:", error?.message);
      }

      try {
        startTrialAccountScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start trial account scheduler:", error?.message);
      }

      if (process.env.DISABLE_FLOW_SCHEDULER !== "true") {
        try {
          startFlowScheduler();
        } catch (error: unknown) {
          console.error("❌ Failed to start flow scheduler:", error);
        }
      }

      if (process.env.DISABLE_SHEETS_POLLER !== "true") {
        try {
          startSheetsPoller();
        } catch (error: unknown) {
          console.error("❌ Failed to start Google Sheets poller:", error);
        }
      }

      try {
        startCommerceCatalogSyncScheduler();
      } catch (error: unknown) {
        console.error("❌ Failed to start commerce catalog sync scheduler:", error);
      }

      try {
        startWalletBillingScheduler();
      } catch (error: any) {
        console.error("❌ Failed to start wallet billing scheduler:", error?.message);
      }
    })().catch((err) => {
      console.error("[DB] Failed while starting background jobs:", err);
    });
  });

  server.on('error', (err: any) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try a different port in .env`);
    }
    process.exit(1);
  });
})();
