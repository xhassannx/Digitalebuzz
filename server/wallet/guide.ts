import fs from "fs/promises";
import path from "path";

const GUIDE_FILENAME = "WHATSAPP_WALLET_BILLING_WHITELABEL_GUIDE.md";

export async function readWalletBillingGuideMarkdown(): Promise<string> {
  const guidePath = path.join(process.cwd(), "docs", GUIDE_FILENAME);
  return fs.readFile(guidePath, "utf-8");
}
