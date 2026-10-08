import fs from "fs";

const path = "server/routes.ts";
let content = fs.readFileSync(path, "utf8");

const routeStart = "  app.post('/api/messages/send-media'";
const routeStartIdx = content.indexOf(routeStart);
if (routeStartIdx === -1) throw new Error("send-media route not found");

const bodyStartMarker = "      // Append footer to caption if provided";
const bodyStartIdx = content.indexOf(bodyStartMarker, routeStartIdx);
if (bodyStartIdx === -1) throw new Error("body start marker not found");

const webhookIdx = content.indexOf("await triggerWebhooks(userId, 'message.sent',", bodyStartIdx);
if (webhookIdx === -1) throw new Error("webhook marker not found");

const resJsonStart = content.indexOf("      res.json({", webhookIdx);
if (resJsonStart === -1) throw new Error("res.json start not found");

const resJsonEnd = content.indexOf("      });", resJsonStart);
if (resJsonEnd === -1) throw new Error("res.json end not found");

let body = content.slice(bodyStartIdx, resJsonStart);

body = body.replace(
  /      const organizationId = req\.context\?\.organizationId \|\| req\.query\?\.organizationId \|\| req\.body\?\.organizationId \|\| null;\n      const session = await storage\.getSession\(validatedData\.sessionId\);\n      if \(!\(await sessionAllowedForUser\(session, validatedData\.sessionId, userId, organizationId\)\)\) \{\n        return res\.status\(404\)\.json\(\{ error: 'Session not found' \}\);\n      }\n\n/g,
  ""
);
body = body.replace(/let fileBuffer = file\.buffer;/g, "let fileBuffer = uploadedFile.buffer;");
body = body.replace(/let fileName = file\.originalname;/g, "let fileName = uploadedFile.originalname;");
body = body.replace(/let mimeType: string \| undefined = file\.mimetype;/g,
  "let mimeType: string | undefined = uploadedFile.mimetype;");
body = body.replace(/file\.mimetype/g, "uploadedFile.mimetype");
body = body.replace(/file\.originalname/g, "uploadedFile.originalname");
body = body.replace(/file\.buffer/g, "uploadedFile.buffer");
body = body.replace(
  /        const organizationId = req\.context\?\.organizationId \|\| \(await storage\.getOrganizationsByUser\(userId\)\)\[0\]\?\.id;/g,
  "        const orgIdForSave = organizationId || (await storage.getOrganizationsByUser(userId))[0]?.id;"
);
body = body.replace(/if \(organizationId\) \{\s*\n\s*const mediaFolder = path\.join\(process\.cwd\(\), 'uploads', organizationId, 'messages'\)/g,
  "if (orgIdForSave) {\n          const mediaFolder = path.join(process.cwd(), 'uploads', orgIdForSave, 'messages')"
);
body = body.replace(
  /mediaUrl = `\/uploads\/\$\{organizationId\}\/messages\/\$\{filename\}`;/g,
  "mediaUrl = `/uploads/${orgIdForSave}/messages/${filename}`;"
);
body = body.replace(
  /mediaUrl: mediaUrl \|\| file\.originalname/g,
  "mediaUrl: mediaUrl || uploadedFile.originalname"
);

body = body.replace(
  /return res\.status\(400\)\.json\(\{\s*\n\s*error: '([^']*)',\s*\n\s*message:\s*\n\s*'([^']*)'\s*\n\s*\}\);/g,
  "throw new Error('$2');"
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
  /return res\.status\(500\)\.json\(\{\s*\n\s*error: '([^']*)',\s*\n\s*message: '([^']*)'\s*\n\s*\}\);/g,
  "throw new Error('$2');"
);

const returnBlock = content
  .slice(resJsonStart + "      res.json(".length, resJsonEnd + "      })".length - 1)
  .trim();
const returnBody = returnBlock.replace(/^\{\s*/, "").replace(/\s*\}$/, "");

const fnPrefix = `  async function processSendMediaMessage(
    userId: string,
    organizationId: string | null,
    validatedData: SendMediaMessage,
    uploadedFile: { buffer: Buffer; originalname: string; mimetype?: string }
  ): Promise<import('./panel-inbox-send').PanelInboxSendMediaResult> {
      const session = await storage.getSession(validatedData.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

`;

const fnSuffix = `
      return { ${returnBody} };
  }

  registerPanelInboxSendMedia(processSendMediaMessage);

`;

const routeWrapper = `  app.post('/api/messages/send-media', ...withAuthAndRateLimit, ...withOrgContext, requirePermission('inbox.send'), checkUsageLimits('message'), incrementUsage('message'), upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { sessionId, to, caption, mediaType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let footerButtons = undefined;
      if (req.body.footerButtons) {
        try {
          footerButtons = typeof req.body.footerButtons === 'string'
            ? JSON.parse(req.body.footerButtons)
            : req.body.footerButtons;
        } catch (e) {
          console.warn('[Send Media] Failed to parse footerButtons:', e);
        }
      }

      const validatedData = sendMediaMessageSchema.parse({
        sessionId,
        to,
        caption,
        mediaType,
        footer: req.body.footer,
        footerButtonType: req.body.footerButtonType || 'NONE',
        footerButtonText: req.body.footerButtonText,
        footerButtonUrl: req.body.footerButtonUrl,
        footerButtonPhone: req.body.footerButtonPhone,
        footerButtons,
      });

      const organizationId = req.context?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
      const session = await storage.getSession(validatedData.sessionId);
      if (!(await sessionAllowedForUser(session, validatedData.sessionId, userId, organizationId))) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const result = await processSendMediaMessage(userId, organizationId, validatedData, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error sending media message:', error);
      res.status(500).json({ error: error.message });
    }
  });

`;

const before = content.slice(0, routeStartIdx);
const after = content.slice(resJsonEnd + "      });".length);
const catchRe = /catch\s*\(error:\s*any\)\s*\{[\s\S]*?Error sending media message[\s\S]*?\n\s*\}\s*\n\s*\}\);/;
const catchMatch = after.match(catchRe);
if (!catchMatch) {
  console.log("after snippet", JSON.stringify(after.slice(0, 300)));
  throw new Error("catch block not found");
}
const afterRoute = after.slice(catchMatch.index + catchMatch[0].length);

const newContent = before + fnPrefix + body + fnSuffix + routeWrapper + afterRoute;
fs.writeFileSync(path, newContent);
console.log("Refactored send-media route OK");
