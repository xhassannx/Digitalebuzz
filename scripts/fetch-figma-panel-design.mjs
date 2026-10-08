/**
 * Fetch Figma nodes and write a spec JSON for panel template implementation.
 *
 * Usage:
 *   set FIGMA_ACCESS_TOKEN=figd_...   (Windows)
 *   node scripts/fetch-figma-panel-design.mjs ratehonk-dashboard
 *   node scripts/fetch-figma-panel-design.mjs ratehonk-inbox
 *
 * Get a token: Figma → Settings → Security → Personal access tokens
 */
import fs from "node:fs";
import path from "node:path";

const LEGACY_FILE_KEY = "ghxCXiMgnQ5J8IGhPvTPMx";
const LEGACY_BASE =
  "https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp";

const NOVA_FILE_KEY = "Ho7aZJvanQlVi88TwsSZjx";
const NOVA_BASE =
  "https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled";

const PRESETS = {
  "nova-dashboard": {
    fileKey: NOVA_FILE_KEY,
    nodeId: "307:10931",
    figmaUrl: `${NOVA_BASE}?node-id=307-10931`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/nova-dashboard.json",
  },
  "nova-inbox": {
    fileKey: NOVA_FILE_KEY,
    nodeId: "371:9851",
    figmaUrl: `${NOVA_BASE}?node-id=371-9851`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/nova-inbox.json",
  },
  "ratehonk-dashboard": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:795",
    figmaUrl: `${LEGACY_BASE}?node-id=1-795`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma-dashboard-redesign.json",
  },
  "ratehonk-dashboard-refined": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma-spec.json",
  },
  "ratehonk-integrations": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:365",
    figmaUrl: `${LEGACY_BASE}?node-id=1-365`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/integrations.json",
  },
  "ratehonk-inbox": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1181",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1181`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/inbox.json",
  },
  "ratehonk-reminders": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1292",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1292`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/reminders.json",
  },
  "ratehonk-groups": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1401",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1401`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/groups.json",
  },
  "ratehonk-support": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1563",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1563`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/support.json",
  },
  "ratehonk-contacts": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1755",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1755`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/contacts.json",
  },
  "ratehonk-faq-bot": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:1971",
    figmaUrl: `${LEGACY_BASE}?node-id=1-1971`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/faq-bot.json",
  },
  "ratehonk-chatbots": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2104",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2104`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/chatbots.json",
  },
  "ratehonk-ai-assistants": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2252",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2252`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/ai-assistants.json",
  },
  "ratehonk-flows": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2444",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2444`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/flows.json",
  },
  "ratehonk-gallery": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2650",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2650`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/gallery.json",
  },
  "ratehonk-settings": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2910",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2910`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma/settings.json",
  },
  /** @deprecated use ratehonk-dashboard-refined */
  "ratehonk-v1": {
    fileKey: LEGACY_FILE_KEY,
    nodeId: "1:2",
    figmaUrl: `${LEGACY_BASE}?node-id=1-2`,
    outFile: "client/src/panel-templates/ratehonk-v1/figma-spec.json",
  },
};

const presetKey = process.argv[2] || "ratehonk-dashboard-refined";
const preset = PRESETS[presetKey];
if (!preset) {
  console.error(
    `Unknown preset "${presetKey}". Known:\n  ${Object.keys(PRESETS).join("\n  ")}`,
  );
  process.exit(1);
}

const token = process.env.FIGMA_ACCESS_TOKEN;
if (!token) {
  console.error("Set FIGMA_ACCESS_TOKEN to your Figma personal access token.");
  process.exit(1);
}

const url = `https://api.figma.com/v1/files/${preset.fileKey}/nodes?ids=${encodeURIComponent(preset.nodeId)}&depth=4`;

const res = await fetch(url, {
  headers: { "X-Figma-Token": token },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Figma API ${res.status}: ${body}`);
  process.exit(1);
}

const data = await res.json();
const outPath = path.resolve(process.cwd(), preset.outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      preset: presetKey,
      figmaUrl: preset.figmaUrl,
      fileKey: preset.fileKey,
      nodeId: preset.nodeId,
      raw: data,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${outPath}`);
