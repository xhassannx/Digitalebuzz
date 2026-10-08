import { Link } from "wouter";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import { Key, BookOpen, Zap, Download } from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-muted border p-4 overflow-x-auto text-sm font-mono my-3">
      <code className="text-foreground">{children}</code>
    </pre>
  );
}

function ApiSection({
  method,
  path,
  title,
  children,
}: {
  method: string;
  path: string;
  title: string;
  children: React.ReactNode;
}) {
  const methodColor =
    method === "GET"
      ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400"
      : method === "DELETE"
      ? "bg-red-600/20 text-red-600 dark:text-red-400"
      : method === "PATCH"
      ? "bg-blue-600/20 text-blue-600 dark:text-blue-400"
      : "bg-amber-600/20 text-amber-600 dark:text-amber-400";
  return (
    <section className="border rounded-lg p-5 mb-6 bg-card">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${methodColor}`}
        >
          {method}
        </span>
        <code className="text-sm bg-muted px-2 py-1 rounded">{path}</code>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {children}
    </section>
  );
}

export default function ProjectApiPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      <div className={MARKETING_PAGE_SHELL}>
        <div className="mx-auto w-full max-w-4xl py-12">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Project API</h1>
        </div>
        <p className="text-muted-foreground mb-4 text-lg">
          Use the Project API to integrate your WhatsApp panel with third-party systems: CRMs, websites, automation tools, and custom apps. Authenticate with an API key and call the same capabilities as the dashboard.
        </p>
        <p className="mb-8">
          <a
            href="/Project_API.postman_collection.json"
            download="Project_API.postman_collection.json"
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Download Postman collection
          </a>
          <span className="ml-2 text-sm text-muted-foreground">
            Import in Postman and set variables <code className="bg-muted px-1 rounded">baseUrl</code> and <code className="bg-muted px-1 rounded">apiKey</code>.
          </span>
        </p>

        {/* Base URL */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-6 w-6" /> Base URL
          </h2>
          <CodeBlock>{`https://your-domain.com/api/project/v1`}</CodeBlock>
          <p className="text-muted-foreground text-sm">
            Example (local): <code className="bg-muted px-1 rounded">http://localhost:5002/api/project/v1</code>
          </p>
        </section>

        {/* Authentication */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            <Key className="h-6 w-6" /> Authentication
          </h2>
          <p className="text-muted-foreground mb-3">
            All Project API requests must include your API key.
          </p>
          <p className="font-medium mb-1">Header (recommended):</p>
          <CodeBlock>{`X-API-Key: wapi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
          <p className="font-medium mt-4 mb-1">How to get an API key</p>
          <ol className="list-decimal pl-6 space-y-1 text-muted-foreground">
            <li>Log in to your WhatsApp panel.</li>
            <li>Go to <strong>Settings</strong> → <strong>API Keys</strong>.</li>
            <li>Create a new key and copy it. Store it securely; it is shown only once.</li>
          </ol>
        </section>

        {/* Media ID – how to get and use */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Media ID – how to get and use it</h2>
          <p className="text-muted-foreground mb-3">
            For template headers (image/video/document) and for sending images by ID, you need a <strong>WhatsApp media ID</strong>. Upload the file first, then use the returned <code className="bg-muted px-1 rounded">mediaId</code> in your request.
          </p>
          <p className="font-medium mb-1">1. Upload media (WhatsApp Business sessions only)</p>
          <p className="text-sm text-muted-foreground mb-2">
            <strong>POST</strong> <code className="bg-muted px-1 rounded">/api/media/upload</code> — same auth (X-API-Key). Body: <code className="bg-muted px-1 rounded">multipart/form-data</code> with <code className="bg-muted px-1 rounded">sessionId</code> (text) and <code className="bg-muted px-1 rounded">file</code> (file).
          </p>
          <CodeBlock>{`curl -X POST "https://your-domain.com/api/media/upload" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "sessionId=YOUR_SESSION_ID" \\
  -F "file=@/path/to/image.jpg"`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">Response: <code className="bg-muted px-1 rounded">{"{ \"success\": true, \"mediaId\": \"1234567890...\", \"url\": \"...\" }"}</code>. Use <code className="bg-muted px-1 rounded">mediaId</code> in the payloads below.</p>
          <p className="font-medium mt-4 mb-1">2. Use media ID in send-template (header)</p>
          <p className="text-sm text-muted-foreground mb-2">Set <code className="bg-muted px-1 rounded">header</code> to <code className="bg-muted px-1 rounded">{"{ \"type\": \"image\" | \"video\" | \"document\", \"id\": \"MEDIA_ID\" }"}</code>.</p>
          <CodeBlock>{`{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "promo_with_image",
  "languageCode": "en",
  "header": { "type": "image", "id": "MEDIA_ID_FROM_WHATSAPP" },
  "templateParams": ["Summer Sale", "20% off"]
}`}</CodeBlock>
          <CodeBlock>{`{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "templateName": "document_template",
  "languageCode": "en",
  "header": { "type": "document", "id": "WHATSAPP_DOCUMENT_MEDIA_ID" },
  "templateParams": ["Invoice.pdf"]
}`}</CodeBlock>
          <p className="font-medium mt-4 mb-1">3. Use media ID in unified messages (image by id)</p>
          <p className="text-sm text-muted-foreground mb-2">Send image using uploaded media ID instead of a URL:</p>
          <CodeBlock>{`{
  "sessionId": "YOUR_SESSION_ID",
  "to": "919876543210",
  "type": "image",
  "image": {
    "id": "MEDIA_ID_FROM_WHATSAPP",
    "caption": "Optional caption"
  }
}`}</CodeBlock>
        </section>

        {/* Endpoints */}
        <h2 className="text-2xl font-semibold mb-4">Endpoints</h2>

        <ApiSection method="POST" path="/api/sessions/create" title="1. Create session">
          <p className="text-muted-foreground mb-3">
            Creates a WhatsApp session. Two modes: <strong>unofficial</strong> (QR code) or <strong>official</strong> (Business API). Use <code className="bg-muted px-1 rounded">sessionId</code> from response in send message calls.
          </p>
          <p className="text-sm font-medium mb-1">Unofficial (QR code):</p>
          <CodeBlock>{`curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"connectionType":"unofficial"}' \\
  https://your-domain.com/api/sessions/create`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">Response: {"{"} success, sessionId, qrCode (data URL) {"}"}. Scan QR with WhatsApp → Linked Devices.</p>
          <p className="text-sm font-medium mt-4 mb-1">Official (Business API):</p>
          <CodeBlock>{`curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "connectionType": "official",
    "businessApiCredentials": {
      "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
      "accessToken": "YOUR_META_ACCESS_TOKEN",
      "businessAccountId": "YOUR_WABA_ID"
    }
  }' \\
  https://your-domain.com/api/sessions/create`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">Get phoneNumberId and accessToken from Meta Business Manager. Phone must be verified first.</p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1" title="2. API info">
          <p className="text-muted-foreground mb-3">
            Returns API name, version, and list of endpoints. Use this to discover available operations.
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" https://your-domain.com/api/project/v1`}</CodeBlock>
          <p className="text-sm text-muted-foreground">Response: JSON with name, version, baseUrl, endpoints, docs.</p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/sessions" title="3. List sessions">
          <p className="text-muted-foreground mb-3">
            Returns all WhatsApp sessions (phone numbers / connections) for the account linked to the API key.
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" https://your-domain.com/api/project/v1/sessions`}</CodeBlock>
          <p className="text-sm text-muted-foreground">Use sessionId in send-message, send-text, and send-template.</p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/chats" title="3a. List chats (inbox) for a session">
          <p className="text-muted-foreground mb-3">
            Returns all conversations stored for one WhatsApp connection. <code className="bg-muted px-1 rounded">sessionId</code> is required (same value as <code className="bg-muted px-1 rounded">sessionId</code> from list sessions).
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "https://your-domain.com/api/project/v1/chats?sessionId=wb_xxx"`}</CodeBlock>
          <p className="text-sm text-muted-foreground">Response: JSON array of chat objects (id, contactNumber, contactName, lastMessage, etc.). For full message history by customer phone, use GET /api/project/v1/chats/by-phone/:phone.</p>
        </ApiSection>

        <ApiSection method="PATCH" path="/api/project/v1/chats/read" title="3b. Mark chat as read (clear unread)">
          <p className="text-muted-foreground mb-3">
            Same behavior as opening a thread in Inbox: sets <code className="bg-muted px-1 rounded">unreadCount</code> to 0 and marks inbound messages as read (excludes failed). Pass <code className="bg-muted px-1 rounded">chatId</code> from list chats.
          </p>
          <CodeBlock>{`curl -X PATCH -H "X-API-Key: YOUR_API_KEY" \\
  "https://your-domain.com/api/project/v1/chats/read?chatId=CHAT_UUID"

# Or JSON body:
curl -X PATCH -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"chatId":"CHAT_UUID"}' \\
  https://your-domain.com/api/project/v1/chats/read`}</CodeBlock>
          <p className="text-sm text-muted-foreground">Response: <code className="bg-muted px-1 rounded">success</code>, <code className="bg-muted px-1 rounded">messagesMarkedRead</code> (count updated).</p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/chats/messaging-window" title="3c. Customer care window (24 hours, official /chat)">
          <p className="text-muted-foreground mb-3">
            For <strong>official</strong> (Business API) sessions, returns whether free-form messaging is allowed using the same rule as the Inbox <code className="bg-muted px-1 rounded">/chat</code> page: the latest <strong>inbound</strong> message (<code className="bg-muted px-1 rounded">fromMe === false</code>) must be within the last 24 hours. If there is no inbound message yet, <code className="bg-muted px-1 rounded">withinWindow</code> is <code className="bg-muted px-1 rounded">false</code> (use templates first). For <strong>unofficial</strong> (QR) sessions, <code className="bg-muted px-1 rounded">customerCareWindow.applies</code> is <code className="bg-muted px-1 rounded">false</code> and <code className="bg-muted px-1 rounded">withinWindow</code> is <code className="bg-muted px-1 rounded">true</code> (no Cloud API window).
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Without this endpoint, you can derive the same result from <code className="bg-muted px-1 rounded">GET /api/project/v1/messages?chatId=...</code>: take the newest message with <code className="bg-muted px-1 rounded">fromMe: false</code> and compare <code className="bg-muted px-1 rounded">timestamp</code> to now (≤ 24 hours → window open for official).
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "https://your-domain.com/api/project/v1/chats/messaging-window?chatId=CHAT_UUID"`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">
            Response fields: <code className="bg-muted px-1 rounded">customerCareWindow.applies</code>, <code className="bg-muted px-1 rounded">withinWindow</code>, <code className="bg-muted px-1 rounded">lastInboundMessageAt</code>, <code className="bg-muted px-1 rounded">windowExpiresAt</code>, <code className="bg-muted px-1 rounded">secondsRemaining</code> (when open).
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/templates" title="4. List templates">
          <p className="text-muted-foreground mb-3">
            Returns approved message templates. Optional: <code className="bg-muted px-1 rounded">?organizationId=...</code>, <code className="bg-muted px-1 rounded">?phoneNumberId=...</code>.
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" "https://your-domain.com/api/project/v1/templates?phoneNumberId=123456789"`}</CodeBlock>
          <p className="text-sm text-muted-foreground">Use name and language in send-template.</p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/messages" title="5. Send message (unified)">
          <p className="text-muted-foreground mb-3">
            AiSensy-style unified endpoint. Supports type: <code className="bg-muted px-1 rounded">text</code>, <code className="bg-muted px-1 rounded">image</code>, <code className="bg-muted px-1 rounded">video</code>, <code className="bg-muted px-1 rounded">audio</code>, <code className="bg-muted px-1 rounded">document</code>, <code className="bg-muted px-1 rounded">template</code>. Use <code className="bg-muted px-1 rounded">type</code> and the matching payload. Image: use <code className="bg-muted px-1 rounded">image.link</code> (URL) or <code className="bg-muted px-1 rounded">image.id</code> (media ID from upload).
          </p>
          <CodeBlock>{`# Text
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","type":"text","text":{"body":"Hello"}}' \\
  https://your-domain.com/api/project/v1/messages

# Image (by URL)
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","type":"image","image":{"link":"https://example.com/img.jpg","caption":"Check this"}}' \\
  https://your-domain.com/api/project/v1/messages

# Image (by media ID – get ID from POST /api/media/upload)
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","type":"image","image":{"id":"MEDIA_ID_FROM_WHATSAPP","caption":"Optional caption"}}' \\
  https://your-domain.com/api/project/v1/messages

# Template
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","type":"template","template":{"name":"hello_world","language":{"code":"en"}}}' \\
  https://your-domain.com/api/project/v1/messages`}</CodeBlock>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/messages/:messageId" title="6. Get message details">
          <p className="text-muted-foreground mb-3">
            Returns message details by internal ID or WhatsApp message ID (wamid). AiSensy-style response. Optional <code className="bg-muted px-1 rounded">sessionId</code> query to scope.
          </p>
          <CodeBlock>{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "https://your-domain.com/api/project/v1/messages/MESSAGE_ID?sessionId=wb_xxx"`}</CodeBlock>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/messages/send-text" title="7. Send text message">
          <p className="text-muted-foreground mb-3">
            Sends a free-form text message. Recipient must have messaged your business in the last 24 hours.
          </p>
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4">sessionId</td><td className="py-2 pr-4">string</td><td className="py-2">Required. From list sessions</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">to</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Recipient phone e.g. 919876543210</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">message</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Text to send</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">organizationId</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Multi-org context</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock>{`curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","message":"Hi"}' \\
  https://your-domain.com/api/project/v1/messages/send-text`}</CodeBlock>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/messages/send-template" title="8. Send template message">
          <p className="text-muted-foreground mb-3">
            Sends an approved WhatsApp template. Use for first outreach or outside the 24-hour window. Supports body parameters (positional or named), media header (image/video/document).
          </p>
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4">sessionId</td><td className="py-2 pr-4">string</td><td className="py-2">Required. WhatsApp Business only</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">to</td><td className="py-2 pr-4">string</td><td className="py-2">Required. e.g. 919876543210</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateName</td><td className="py-2 pr-4">string</td><td className="py-2">Required. From list templates</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">languageCode</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Default en</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateParams</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. Body params: strings (positional) or &#123; parameter_name, text &#125; (named)</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateBodyText</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Template body with &#123;&#123;name&#125;&#125; for named param detection</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">header</td><td className="py-2 pr-4">object</td><td className="py-2">Optional. &#123; type: &quot;image&quot;|&quot;video&quot;|&quot;document&quot;, id: WhatsApp media ID &#125;</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">components</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. Alias for templateParams</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock>{`curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"sessionId":"wb_xxx","to":"919876543210","templateName":"hello_world","languageCode":"en"}' \\
  https://your-domain.com/api/project/v1/messages/send-template`}</CodeBlock>
          <p className="text-sm font-medium mt-3 mb-1">Payload examples with media ID</p>
          <p className="text-sm text-muted-foreground mb-2">Get <code className="bg-muted px-1 rounded">mediaId</code> from <strong>POST /api/media/upload</strong> (see &quot;Media ID&quot; section above).</p>
          <CodeBlock>{`# Template with header image
{"sessionId":"...","to":"919876543210","templateName":"promo_with_image","languageCode":"en","header":{"type":"image","id":"MEDIA_ID_FROM_WHATSAPP"},"templateParams":["Summer Sale","20% off"]}

# Template with header document
{"sessionId":"...","to":"919876543210","templateName":"document_template","languageCode":"en","header":{"type":"document","id":"WHATSAPP_DOCUMENT_MEDIA_ID"},"templateParams":["Invoice.pdf"]}`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">With body params only: <code className="bg-muted px-1 rounded">templateParams</code>: [&quot;John&quot;, &quot;ORD-123&quot;]. With header: <code className="bg-muted px-1 rounded">header</code>: &#123; &quot;type&quot;: &quot;image&quot;|&quot;video&quot;|&quot;document&quot;, &quot;id&quot;: &quot;MEDIA_ID&quot; &#125;.</p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/campaign/send" title="9. Campaign send (Aisensy-compatible)">
          <p className="text-muted-foreground mb-3">
            Single endpoint compatible with Aisensy API: send template by campaign name, create/update contact, optional tags and attributes.
          </p>
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4">apiKey</td><td className="py-2 pr-4">string</td><td className="py-2">Optional if X-API-Key header used</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">campaignName</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Template name</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">destination</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Phone with country code</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">userName</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Contact name</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateParams</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. Template parameter values</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">source</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Lead source</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">tags</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. Tag names</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">attributes</td><td className="py-2 pr-4">object</td><td className="py-2">Optional. Custom contact attributes</td></tr>
              </tbody>
            </table>
          </div>
          <CodeBlock>{`curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"campaignName":"hello_world","destination":"+919876543210","userName":"John Doe","tags":["lead"],"attributes":{"email":"john@example.com"}}' \\
  https://your-domain.com/api/project/v1/campaign/send`}</CodeBlock>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/campaigns" title="10. List campaigns (templates)">
          <p className="text-muted-foreground mb-3">
            Returns approved templates as campaigns. Use campaignName in campaign/send. Optional: ?organizationId=..., ?phoneNumberId=..., ?type=broadcast for broadcast campaigns.
          </p>
          <p className="text-sm text-muted-foreground">Response: Array of campaignName, templateId, language, status, category.</p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/campaigns" title="10a. Create campaign">
          <p className="text-muted-foreground mb-3">
            Creates a broadcast campaign with optional recipients and optional schedule. After creation you can execute via POST campaigns/:id/send. If you omit <code className="bg-muted px-1 rounded">scheduledAt</code>, the campaign is scheduled to run in 2 minutes.
          </p>
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4">organizationId</td><td className="py-2 pr-4">string</td><td className="py-2">Required* (or first org used)</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">sessionId</td><td className="py-2 pr-4">string</td><td className="py-2">Required. From list sessions</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">name</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Campaign name (your reference)</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">messageTemplate</td><td className="py-2 pr-4">string</td><td className="py-2">Required. Template name from list templates</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateLanguage</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Default en</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateId</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. WhatsApp template ID</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">templateParameters</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. e.g. [&#123; column, fallback &#125;] per variable</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">headerImageId</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. Media ID from POST /api/media/upload</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">headerImageUrl</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. URL for template header</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">scheduledAt</td><td className="py-2 pr-4">string</td><td className="py-2">Optional. ISO 8601; omit = 2 min from now; future = scheduled; past = draft</td></tr>
                <tr className="border-b"><td className="py-2 pr-4">recipients</td><td className="py-2 pr-4">array</td><td className="py-2">Optional. [ &#123; phoneNumber, name?, contactId? &#125;, ... ]</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm font-medium mb-1">Recipient object:</p>
          <p className="text-sm text-muted-foreground mb-2">phoneNumber (required), name (optional), contactId (optional).</p>
          <CodeBlock>{`# Minimal – send in 2 minutes
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "sessionId": "YOUR_SESSION_ID",
    "name": "Welcome Campaign",
    "messageTemplate": "hello_world",
    "templateLanguage": "en",
    "recipients": [
      { "phoneNumber": "919876543210", "name": "John Doe" },
      { "phoneNumber": "919876543211", "name": "Jane Smith" }
    ]
  }' \\
  https://your-domain.com/api/project/v1/campaigns

# Scheduled at specific date/time (ISO 8601)
curl -X POST -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "YOUR_ORG_ID",
    "sessionId": "YOUR_SESSION_ID",
    "name": "Weekly Promo",
    "messageTemplate": "promo_offer",
    "templateLanguage": "en",
    "scheduledAt": "2025-02-15T09:00:00.000Z",
    "recipients": [
      { "phoneNumber": "919876543210", "name": "John" },
      { "phoneNumber": "919876543211", "name": "Jane" }
    ]
  }' \\
  https://your-domain.com/api/project/v1/campaigns`}</CodeBlock>
          <p className="text-sm text-muted-foreground mt-2">After creation: GET campaigns/:id for details, POST campaigns/:id/send to execute, GET campaigns/:id/analytics for counts.</p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/campaigns/:id" title="10b. Campaign details">
          <p className="text-muted-foreground mb-3">
            Get campaign by ID. Query: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/campaigns/:id/send" title="10c. Execute campaign">
          <p className="text-muted-foreground mb-3">
            Send campaign to all recipients. Body/query: organizationId.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/campaigns/:id/analytics" title="10d. Campaign analytics">
          <p className="text-muted-foreground mb-3">
            Sent/delivered/read/failed counts. Query: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/campaigns/:id/audience" title="10e. Campaign audience">
          <p className="text-muted-foreground mb-3">
            Recipients list. Query: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="DELETE" path="/api/project/v1/templates/:id" title="10f. Delete template">
          <p className="text-muted-foreground mb-3">
            Removes template from local sync (Meta templates managed in Business Suite).
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/contacts" title="11. List contacts">
          <p className="text-muted-foreground mb-3">
            Returns contacts for the account. Optional: ?organizationId=..., ?tags=tag1&tags=tag2.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/contacts/:id" title="12. Get contact by id">
          <p className="text-muted-foreground mb-3">
            Returns a single contact by internal id. Optional query: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/contacts/by-phone/:phone" title="13. Get contact by mobile number">
          <p className="text-muted-foreground mb-3">
            Returns a contact by phone number (e.g. 919876543210 or +919876543210). Optional: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/contacts" title="14. Create or update contact">
          <p className="text-muted-foreground mb-3">
            Create a contact or update by phone. Request body: destination (required), userName, source, tags, attributes, organizationId.
          </p>
          <p className="text-sm text-muted-foreground">Response: 201 with contact + created: true, or 200 with contact + updated: true.</p>
        </ApiSection>

        <ApiSection method="PATCH" path="/api/project/v1/contacts/:id" title="15. Update contact">
          <p className="text-muted-foreground mb-3">
            Update contact by id. Body: userName, source, tags, attributes. Optional: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/templates/:id" title="16. Get template by id">
          <p className="text-muted-foreground mb-3">
            Returns a single message template by internal id.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/webhooks" title="17. List webhooks">
          <p className="text-muted-foreground mb-3">
            Returns webhook configurations for the project. Optional: ?organizationId=....
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/webhooks/:id" title="18. Get webhook details">
          <p className="text-muted-foreground mb-3">
            Returns a single webhook by id. Optional: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="DELETE" path="/api/project/v1/webhooks/:id" title="19. Delete webhook">
          <p className="text-muted-foreground mb-3">
            Deletes a webhook subscription. Optional: ?organizationId=...
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/canned-messages" title="19a. List canned messages">
          <p className="text-muted-foreground mb-3">
            Same org-scoped templates as the live chat canned picker on <code className="bg-muted px-1 rounded">/chat</code>. Organization is taken from the API key: use{" "}
            <code className="bg-muted px-1 rounded">GET .../canned-messages</code> with no query to list the first organization tied to the key. Optional{" "}
            <code className="bg-muted px-1 rounded">?organizationId=...</code> when the key belongs to several orgs. Returns JSON array with{" "}
            <code className="bg-muted px-1 rounded">id</code>, <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">type</code> (TEXT | IMAGE),{" "}
            <code className="bg-muted px-1 rounded">text</code>, <code className="bg-muted px-1 rounded">imageUrl</code>, <code className="bg-muted px-1 rounded">fileName</code>,{" "}
            <code className="bg-muted px-1 rounded">favourite</code>.
          </p>
        </ApiSection>

        <ApiSection method="POST" path="/api/project/v1/canned-messages" title="19b. Create canned message">
          <p className="text-muted-foreground mb-3">
            Body: <code className="bg-muted px-1 rounded">name</code> (required), <code className="bg-muted px-1 rounded">type</code> (TEXT or IMAGE),{" "}
            <code className="bg-muted px-1 rounded">text</code>, optional <code className="bg-muted px-1 rounded">imageUrl</code>, <code className="bg-muted px-1 rounded">fileName</code>,{" "}
            <code className="bg-muted px-1 rounded">favourite</code>, <code className="bg-muted px-1 rounded">organizationId</code>. Responds <code className="bg-muted px-1 rounded">201</code> with the created row.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/canned-messages/:id" title="19c. Get canned message by id">
          <p className="text-muted-foreground mb-3">
            No <code className="bg-muted px-1 rounded">organizationId</code> required: the server finds which of your orgs owns this id. Optional query/body org only if you need to restrict scope.
          </p>
        </ApiSection>

        <ApiSection method="PATCH" path="/api/project/v1/canned-messages/:id" title="19d. Update canned message">
          <p className="text-muted-foreground mb-3">
            Body may include <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">type</code>, <code className="bg-muted px-1 rounded">text</code>,{" "}
            <code className="bg-muted px-1 rounded">imageUrl</code>, <code className="bg-muted px-1 rounded">fileName</code>, <code className="bg-muted px-1 rounded">favourite</code>.{" "}
            Organization is inferred from the API key unless you pass <code className="bg-muted px-1 rounded">organizationId</code> (query or JSON).
          </p>
        </ApiSection>

        <ApiSection method="DELETE" path="/api/project/v1/canned-messages/:id" title="19e. Delete canned message">
          <p className="text-muted-foreground mb-3">
            Same as get/update: org resolved from the API key by default; optional <code className="bg-muted px-1 rounded">organizationId</code> in query or body.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/canned-messages/media" title="19f. Canned message image file">
          <p className="text-muted-foreground mb-3">
            Stream an image from panel storage. Query <code className="bg-muted px-1 rounded">path</code> must look like{" "}
            <code className="bg-muted px-1 rounded">/uploads/ORG_ID/gallery/...</code>; the org is taken from the first path segment and must be one your API key can access. Optional{" "}
            <code className="bg-muted px-1 rounded">organizationId</code> must match that segment if you send it.
          </p>
        </ApiSection>

        <ApiSection method="GET" path="/api/project/v1/media/:mediaId" title="20. Get media by id">
          <p className="text-muted-foreground mb-3">
            Returns media URL by media id. Query required: ?sessionId=... (WhatsApp Business session). Optional: ?organizationId=...
          </p>
        </ApiSection>

        {/* Errors */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3">Errors</h2>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong>401 Unauthorized</strong> – Missing or invalid API key. Send X-API-Key with a valid key.</li>
            <li><strong>404 Session not found</strong> – sessionId does not exist or does not belong to your account.</li>
            <li><strong>400 Validation failed</strong> – Check request body (e.g. missing sessionId, to, or message).</li>
            <li><strong>400 WhatsApp Business API not ready</strong> – Reconnect the number in Integrations and try again.</li>
            <li><strong>500</strong> – Server or WhatsApp API error; response body may include error and message.</li>
          </ul>
        </section>

        {/* Quick integration */}
        <section className="border rounded-lg p-5 bg-primary/5 border-primary/20">
          <h2 className="text-xl font-semibold mb-3">Quick integration steps</h2>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Create an API key in the dashboard (Settings → API Keys).</li>
            <li><strong>Aisensy-style:</strong> GET /api/project/v1/campaigns to get campaignName, then POST /api/project/v1/campaign/send with campaignName, destination, userName, and optional templateParams, tags, attributes, source.</li>
            <li><strong>REST-style:</strong> GET /api/project/v1/sessions for sessionId. Use POST /api/project/v1/messages with type (text, image, video, audio, document, template) and matching payload. Or use send-text / send-template for legacy endpoints.</li>
            <li><strong>Contacts:</strong> POST /api/project/v1/contacts to create/update by phone; GET /api/project/v1/contacts to list. GET /api/project/v1/webhooks to see webhook URLs.</li>
            <li><strong>Canned messages:</strong> GET /api/project/v1/canned-messages (org from API key; optional ?organizationId= for multi-org). CRUD without organizationId on get/patch/delete when the message id is unique to your orgs. Gallery files: GET /api/project/v1/canned-messages/media?path=/uploads/ORG_ID/...</li>
          </ol>
        </section>

        <div className="mt-10 pt-6 border-t text-center text-muted-foreground text-sm">
          <Link href="/" className="text-primary hover:underline">Back to Home</Link>
          {" · "}
          <Link href="/login" className="text-primary hover:underline">Log in</Link>
        </div>
        </div>
      </div>
    </div>
  );
}
