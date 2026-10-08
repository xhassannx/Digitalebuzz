/**
 * Static + HTTP smoke checks for commerce endpoints (no WhatsApp/Shopify credentials required).
 * Run: tsx server/scripts/commerce-smoke-check.ts
 * Optional: SMOKE_BASE_URL=http://localhost:5000 (server must already be running)
 */
import "dotenv/config";

type Check = { name: string; ok: boolean; detail: string; optional?: boolean };

const checks: Check[] = [];

function pass(name: string, detail: string, optional = false) {
  checks.push({ name, ok: true, detail, optional });
}

function fail(name: string, detail: string, optional = false) {
  checks.push({ name, ok: false, detail, optional });
}

async function checkModuleExports() {
  try {
    const { registerCommerceRoutes } = await import("../commerce/routes");
    const { registerShopifyRoutes } = await import("../integrations/handlers/shopify");
    const { buildShopifyOAuthUrl, getShopifyOAuthConfig } = await import("../commerce/shopify-oauth");
    const { sendWhatsAppNativePaymentMessage } = await import("../commerce/whatsapp-native-payment");
    const { createAndSendContactPayment, parseFlowPaymentAmount } = await import(
      "../payments/create-contact-payment"
    );
    const executor = await import("../automation/executor");

    if (typeof registerCommerceRoutes !== "function") throw new Error("registerCommerceRoutes missing");
    if (typeof registerShopifyRoutes !== "function") throw new Error("registerShopifyRoutes missing");
    if (typeof buildShopifyOAuthUrl !== "function") throw new Error("buildShopifyOAuthUrl missing");
    if (typeof sendWhatsAppNativePaymentMessage !== "function") {
      throw new Error("sendWhatsAppNativePaymentMessage missing");
    }
    if (typeof createAndSendContactPayment !== "function") {
      throw new Error("createAndSendContactPayment missing");
    }
    if (typeof parseFlowPaymentAmount !== "function") throw new Error("parseFlowPaymentAmount missing");
    if (typeof executor.contactContextPayload !== "function") {
      throw new Error("executor exports missing");
    }

    pass("Module exports", "Commerce, Shopify OAuth, payments, and executor modules load");

    const cfg = getShopifyOAuthConfig();
    if (cfg) {
      pass("Shopify OAuth env", "SHOPIFY_API_KEY / SHOPIFY_API_SECRET configured");
    } else {
      fail(
        "Shopify OAuth env",
        "Not configured — manual token connect still works; set SHOPIFY_API_KEY + SHOPIFY_API_SECRET for OAuth",
        true
      );
    }
  } catch (e: unknown) {
    fail("Module exports", e instanceof Error ? e.message : String(e));
  }
}

async function checkParseFlowPaymentAmount() {
  try {
    const { parseFlowPaymentAmount } = await import("../payments/create-contact-payment");
    const n = parseFlowPaymentAmount("499", { total_price: "999" });
    if (n !== 499) throw new Error(`Expected 499, got ${n}`);
    const fromTrigger = parseFlowPaymentAmount("{{trigger.total_price}}", {
      total_price: "1200.50",
    });
    if (fromTrigger !== 1200.5) throw new Error(`Expected 1200.5, got ${fromTrigger}`);
    const fromRazorpay = parseFlowPaymentAmount("{{trigger.amount}}", {
      amount: 45000,
      payment_id: "pay_test",
      event: "payment.captured",
    });
    if (fromRazorpay !== 450) throw new Error(`Expected 450 from paise, got ${fromRazorpay}`);
    pass("parseFlowPaymentAmount", "Plain number and trigger fallback work");
  } catch (e: unknown) {
    fail("parseFlowPaymentAmount", e instanceof Error ? e.message : String(e));
  }
}

async function checkDbColumns() {
  if (!process.env.DATABASE_URL) {
    fail("DB commerce columns", "DATABASE_URL not set — skip DB check");
    return;
  }
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'organization_commerce_settings'
        AND column_name IN (
          'whatsapp_native_pay_enabled',
          'meta_payment_configuration_name',
          'shopify_collection_product_sets',
          'shopify_checkout_enabled'
        )
    `;
    const found = new Set((rows as { column_name: string }[]).map((r) => r.column_name));
    const required = [
      "whatsapp_native_pay_enabled",
      "meta_payment_configuration_name",
      "shopify_collection_product_sets",
      "shopify_checkout_enabled",
    ];
    const missing = required.filter((c) => !found.has(c));
    if (missing.length) {
      fail("DB commerce columns", `Missing: ${missing.join(", ")} — run db:migrate-commerce-* scripts`);
    } else {
      pass("DB commerce columns", "Native pay + checkout + collection columns present");
    }
  } catch (e: unknown) {
    fail("DB commerce columns", e instanceof Error ? e.message : String(e));
  }
}

async function httpCheck(path: string, expectedStatuses: number[], method = "GET", body?: unknown) {
  const base = (process.env.SMOKE_BASE_URL || process.env.BASE_URL || "http://localhost:5000").replace(
    /\/$/,
    ""
  );
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    if (expectedStatuses.includes(res.status)) {
      pass(`HTTP ${method} ${path}`, `Status ${res.status} (expected one of ${expectedStatuses.join(", ")})`);
    } else {
      fail(
        `HTTP ${method} ${path}`,
        `Status ${res.status}, expected ${expectedStatuses.join(" or ")} — route may be missing or server down`
      );
    }
  } catch (e: unknown) {
    fail(
      `HTTP ${method} ${path}`,
      `Could not reach ${base}: ${e instanceof Error ? e.message : String(e)}. Start server with npm run dev`
    );
  }
}

async function checkHttpRoutes() {
  await httpCheck("/api/commerce/settings", [401, 403]);
  await httpCheck("/api/commerce/shopify/collections", [401, 403]);
  await httpCheck("/api/integrations/shopify/oauth/install?shop=test.myshopify.com&json=1", [401, 403, 503]);
  await httpCheck("/api/integrations/shopify/oauth/callback", [302, 400]);
  await httpCheck("/api/commerce/whatsapp-native-pay/send", [401, 403], "POST", {
    sessionId: "x",
    to: "919999999999",
    amountMajor: 1,
  });
  await httpCheck("/api/commerce/shopify/collections/sync", [401, 403], "POST", {
    collectionId: "1",
  });
}

async function main() {
  console.log("Commerce smoke check\n");
  await checkModuleExports();
  await checkParseFlowPaymentAmount();
  await checkDbColumns();
  await checkHttpRoutes();

  const failed = checks.filter((c) => !c.ok && !c.optional);
  for (const c of checks) {
    const label = c.ok ? "PASS" : c.optional ? "WARN" : "FAIL";
    console.log(`${label}  ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }
  const required = checks.filter((c) => !c.optional);
  const requiredPassed = required.filter((c) => c.ok).length;
  console.log(`\n${requiredPassed}/${required.length} required checks passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
