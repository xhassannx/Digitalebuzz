import fs from "fs";

const path = "server/routes.ts";
let content = fs.readFileSync(path, "utf8");

const routeStart = "  app.post('/api/messages/send-text'";
const routeStartIdx = content.indexOf(routeStart);
if (routeStartIdx === -1) throw new Error("send-text route not found");

const managerMarker = "      const manager = await getWhatsAppManager(validatedData.sessionId);";
const managerIdx = content.indexOf(managerMarker, routeStartIdx);
if (managerIdx === -1) throw new Error("manager marker not found");

const resJsonMarker = "messageId: result.id,";
const resJsonIdx = content.indexOf(resJsonMarker, managerIdx);
if (resJsonIdx === -1) {
  console.log("managerIdx", managerIdx, "snippet", JSON.stringify(content.slice(managerIdx, managerIdx + 200)));
  throw new Error("res.json marker not found");
}
const resJsonStart = content.lastIndexOf("      res.json({", resJsonIdx);
if (resJsonStart === -1) throw new Error("res.json start not found");

const resJsonEnd = content.indexOf("      });", resJsonStart);
if (resJsonEnd === -1) throw new Error("res.json end not found");

let body = content.slice(managerIdx, resJsonStart);

body = body.replace(
  /            const organizationId = req\.context\?\.organizationId \|\| req\.query\?\.organizationId \|\| req\.body\?\.organizationId \|\| null;\n/g,
  ""
);

body = body.replace(
  /req\.context\?\.organizationId \|\| req\.query\?\.organizationId/g,
  "organizationId"
);
body = body.replace(
  /req\.query\?\.organizationId as string \| undefined/g,
  "organizationId || undefined"
);
body = body.replace(/req\.context\?\.organizationId/g, "organizationId");
body = body.replace(
  /typeof req\.query\?\.organizationId === 'string' \? req\.query\.organizationId : null/g,
  "organizationId"
);

body = body.replace(
  /return res\.status\(400\)\.json\(\{\s*\n\s*error: '([^']*)',\s*\n\s*message: '([^']*)'\s*\n\s*\}\);/g,
  "throw new Error('$2');"
);
body = body.replace(
  /return res\.status\(400\)\.json\(\{\s*\n\s*error: '([^']*)',\s*\n\s*message: '([^']*)'\s*\}\);/g,
  "throw new Error('$2');"
);
body = body.replace(
  /return res\.status\(400\)\.json\(\{ error: '([^']*)' \}\);/g,
  "throw new Error('$1');"
);
body = body.replace(
  /return res\.status\(400\)\.json\(\{\s*error: '([^']*)',\s*message: '([^']*)'\s*\}\);/g,
  "throw new Error('$2');"
);

const returnBlock = content
  .slice(resJsonStart + "      res.json(".length, resJsonEnd + "      })".length - 1)
  .trim();
const returnBody = returnBlock.replace(/^\{\s*/, "").replace(/\s*\}$/, "");

const fnPrefix = `  async function processSendTextMessage(
    userId: string,
    organizationId: string | null,
    validatedData: SendTextMessage
  ): Promise<import('./panel-inbox-send').PanelInboxSendTextResult> {
      const session = await storage.getSession(validatedData.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

`;

const fnSuffix = `
      return { ${returnBody} };
  }

  registerPanelInboxSendText(processSendTextMessage);

`;

const routeWrapper = `  app.post('/api/messages/send-text', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), checkUsageLimits('message'), incrementUsage('message'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const validatedData = sendTextMessageSchema.parse(req.body);

      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const result = await processSendTextMessage(userId, organizationId, validatedData);
      res.json(result);
    } catch (error: any) {
      console.error('Error sending text message:', error);
      res.status(500).json({ error: error.message });
    }
  });

`;

const before = content.slice(0, routeStartIdx);
const after = content.slice(resJsonEnd + "      });".length);
const catchRe = /}\s*catch\s*\(error:\s*any\)\s*\{\s*console\.error\('Error sending text message:', error\);\s*res\.status\(500\)\.json\(\{ error: error\.message \}\);\s*}\s*}\);/;
const catchMatch = after.match(catchRe);
if (!catchMatch) throw new Error("catch block not found");
const afterRoute = after.slice(catchMatch.index + catchMatch[0].length);

const newContent = before + fnPrefix + body + fnSuffix + routeWrapper + afterRoute;
fs.writeFileSync(path, newContent);
console.log("Refactored send-text route OK");
