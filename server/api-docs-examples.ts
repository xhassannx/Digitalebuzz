/**
 * Request/response examples for API documentation (AiSensy-style).
 * Keyed by path (exact or pattern).
 */
export function getEndpointExamples(path: string, method: string, baseUrl: string): {
  curlExample?: string;
  requestBody?: object;
  responseExample?: object;
  parameters?: Array<{ name: string; in: 'path' | 'query' | 'body'; required?: boolean; type?: string; description?: string }>;
  authHeader?: string;
} {
  const isProjectApi = path.startsWith('/api/project/v1');
  const auth = isProjectApi
    ? '-H "X-API-Key: YOUR_API_KEY"'
    : '-H "Authorization: Bearer YOUR_API_KEY"';

  const examples: Record<string, ReturnType<typeof getEndpointExamples>> = {
    'GET /api/project/v1': {
      authHeader: 'X-API-Key',
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1 \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: { name: 'Project API', version: '1.0', endpoints: {} },
    },
    'GET /api/project/v1/sessions': {
      authHeader: 'X-API-Key',
      parameters: [{ name: 'organizationId', in: 'query', required: false, description: 'Filter by organization' }],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/sessions \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: [{ sessionId: 'wb_xxx', status: 'connected', connectionType: 'official' }],
    },
    'GET /api/project/v1/chats/messaging-window': {
      authHeader: 'X-API-Key',
      parameters: [{ name: 'chatId', in: 'query', required: true, description: 'Chat UUID from GET /chats?sessionId=...' }],
      curlExample: `curl --request GET \\
  --url '${baseUrl}/api/project/v1/chats/messaging-window?chatId=CHAT_UUID' \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: {
        chatId: 'chat_uuid',
        sessionId: 'wb_xxx',
        connectionType: 'official',
        customerCareWindow: {
          applies: true,
          withinWindow: true,
          lastInboundMessageAt: '2026-03-28T10:00:00.000Z',
          windowExpiresAt: '2026-03-29T10:00:00.000Z',
          secondsRemaining: 3600,
        },
      },
    },
    'GET /api/project/v1/templates': {
      authHeader: 'X-API-Key',
      parameters: [
        { name: 'organizationId', in: 'query', required: false },
        { name: 'phoneNumberId', in: 'query', required: false },
      ],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/templates \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
    },
    'POST /api/project/v1/messages': {
      authHeader: 'X-API-Key',
      parameters: [
        { name: 'sessionId', in: 'body', required: true, description: 'Session ID from list sessions' },
        { name: 'to', in: 'body', required: true, description: 'Recipient phone e.g. 919876543210' },
        { name: 'type', in: 'body', required: true, description: 'text | image | video | audio | document | template' },
      ],
      requestBody: {
        sessionId: 'YOUR_SESSION_ID',
        to: '919876543210',
        type: 'text',
        text: { body: 'Hello from API' },
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/messages \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","type":"text","text":{"body":"Hello from API"}}'`,
      responseExample: { id: 'wamid.xxx', timestamp: '2024-01-01T00:00:00.000Z', status: 'sent' },
    },
    'POST /api/project/v1/messages/send-text': {
      authHeader: 'X-API-Key',
      requestBody: {
        sessionId: 'YOUR_SESSION_ID',
        to: '919876543210',
        message: 'Hello from API',
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/messages/send-text \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","message":"Hello from API"}'`,
      responseExample: { id: 'wamid.xxx', status: 'sent' },
    },
    'POST /api/project/v1/messages/send-template': {
      authHeader: 'X-API-Key',
      requestBody: {
        sessionId: 'YOUR_SESSION_ID',
        to: '919876543210',
        templateName: 'hello_world',
        languageCode: 'en',
        templateParams: [],
        templateBodyText: 'Optional: template body with {{name}} for named params',
        header: { type: 'image', id: 'WHATSAPP_MEDIA_ID' },
        components: 'Optional alias for templateParams',
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/messages/send-template \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","templateName":"hello_world","languageCode":"en"}'`,
      responseExample: { id: 'wamid.xxx', status: 'sent' },
    },
    'GET /api/project/v1/messages/:messageId': {
      authHeader: 'X-API-Key',
      parameters: [
        { name: 'messageId', in: 'path', required: true, description: 'Internal ID or WhatsApp message ID (wamid)' },
        { name: 'sessionId', in: 'query', required: false },
      ],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/messages/MESSAGE_ID \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: {
        type: 'message',
        id: 'xxx',
        project_id: 'session_id',
        phone_number: '919876543210',
        sender: 'AGENT',
        message_content: { text: 'Hello' },
        message_type: 'TEXT',
        status: 'READ',
      },
    },
    'POST /api/project/v1/campaign/send': {
      authHeader: 'X-API-Key',
      requestBody: {
        campaignName: 'hello_world',
        destination: '+919876543210',
        userName: 'John Doe',
        templateParams: [],
        source: 'Website lead',
        tags: ['lead'],
        attributes: { email: 'john@example.com' },
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/campaign/send \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"campaignName":"hello_world","destination":"+919876543210","userName":"John Doe","templateParams":[]}'`,
      responseExample: { id: 'wamid.xxx', status: 'sent' },
    },
    'POST /api/project/v1/campaigns': {
      authHeader: 'X-API-Key',
      requestBody: {
        organizationId: 'ORG_ID',
        sessionId: 'YOUR_SESSION_ID',
        name: 'My Campaign',
        messageTemplate: 'hello_world',
        templateLanguage: 'en',
        recipients: [{ phoneNumber: '919876543210', name: 'John Doe' }],
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/campaigns \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"organizationId":"ORG_ID","sessionId":"YOUR_SESSION_ID","name":"My Campaign","messageTemplate":"hello_world","recipients":[{"phoneNumber":"919876543210","name":"John"}]}'`,
      responseExample: { id: 'campaign_uuid', name: 'My Campaign', status: 'scheduled' },
    },
    'GET /api/project/v1/campaigns/:id': {
      authHeader: 'X-API-Key',
      parameters: [{ name: 'organizationId', in: 'query', required: true }],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/campaigns/CAMPAIGN_ID?organizationId=ORG_ID \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
    },
    'POST /api/project/v1/contacts': {
      authHeader: 'X-API-Key',
      requestBody: {
        destination: '+919876543210',
        userName: 'John Doe',
        source: 'Website',
        tags: ['lead'],
        attributes: { email: 'john@example.com' },
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/contacts \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"destination":"+919876543210","userName":"John Doe","source":"Website"}'`,
      responseExample: { id: 'contact_id', name: 'John Doe', phoneNumber: '919876543210' },
    },
    'GET /api/project/v1/canned-messages': {
      authHeader: 'X-API-Key',
      parameters: [{ name: 'organizationId', in: 'query', required: false, description: 'Defaults to first org for this API key' }],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/canned-messages \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: [
        { id: 'uuid', name: 'Thanks', type: 'TEXT', text: 'Thank you!', imageUrl: null, fileName: null, favourite: false },
      ],
    },
    'GET /api/project/v1/canned-messages/media': {
      authHeader: 'X-API-Key',
      parameters: [
        { name: 'path', in: 'query', required: true, description: '/uploads/ORG_ID/... (first segment must be an org the API key can access)' },
        { name: 'organizationId', in: 'query', required: false, description: 'Optional; if set must match ORG_ID in path' },
      ],
      curlExample: `curl --request GET \\
  --url '${baseUrl}/api/project/v1/canned-messages/media?path=%2Fuploads%2FORG_ID%2Fgallery%2Fphoto.jpg' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --output image.jpg`,
    },
    'POST /api/project/v1/canned-messages': {
      authHeader: 'X-API-Key',
      requestBody: {
        organizationId: 'ORG_ID',
        name: 'Quick thanks',
        type: 'TEXT',
        text: 'Thank you for your message!',
        favourite: false,
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/project/v1/canned-messages \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"organizationId":"ORG_ID","name":"Quick thanks","type":"TEXT","text":"Thank you!"}'`,
      responseExample: { id: 'uuid', name: 'Quick thanks', type: 'TEXT', text: 'Thank you!' },
    },
    'GET /api/project/v1/canned-messages/:id': {
      authHeader: 'X-API-Key',
      parameters: [{ name: 'organizationId', in: 'query', required: false, description: 'Only needed to disambiguate if you pass a wrong scope; otherwise resolved from API key' }],
      curlExample: `curl --request GET \\
  --url ${baseUrl}/api/project/v1/canned-messages/CANNED_ID \\
  --header 'Accept: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
    },
    'PATCH /api/project/v1/canned-messages/:id': {
      authHeader: 'X-API-Key',
      requestBody: { text: 'Updated text', favourite: true },
      curlExample: `curl --request PATCH \\
  --url ${baseUrl}/api/project/v1/canned-messages/CANNED_ID \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '{"text":"Updated text","favourite":true}'`,
    },
    'DELETE /api/project/v1/canned-messages/:id': {
      authHeader: 'X-API-Key',
      curlExample: `curl --request DELETE \\
  --url ${baseUrl}/api/project/v1/canned-messages/CANNED_ID \\
  --header 'X-API-Key: YOUR_API_KEY'`,
      responseExample: { message: 'Canned message deleted' },
    },
    'POST /api/messages/send-text': {
      authHeader: 'Authorization: Bearer',
      requestBody: {
        sessionId: 'YOUR_SESSION_ID',
        to: '919876543210',
        message: 'Hello',
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/messages/send-text \\
  --header 'Content-Type: application/json' \\
  --header 'Authorization: Bearer YOUR_API_KEY' \\
  --data '{"sessionId":"YOUR_SESSION_ID","to":"919876543210","message":"Hello"}'`,
    },
    'POST /api/sessions/create': {
      authHeader: 'Authorization: Bearer',
      requestBody: {
        connectionType: 'official',
        businessApiCredentials: {
          phoneNumberId: 'YOUR_PHONE_NUMBER_ID',
          accessToken: 'YOUR_META_ACCESS_TOKEN',
          businessAccountId: 'YOUR_WABA_ID',
        },
      },
      parameters: [
        { name: 'connectionType', in: 'body', required: false, description: 'unofficial (QR code) or official (Business API)' },
        { name: 'businessApiCredentials', in: 'body', required: true, description: 'For official: { phoneNumberId, accessToken, businessAccountId? }' },
      ],
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/sessions/create \\
  --header 'Content-Type: application/json' \\
  --header 'Authorization: Bearer YOUR_API_KEY' \\
  --data '{"connectionType":"official","businessApiCredentials":{"phoneNumberId":"123","accessToken":"xxx","businessAccountId":"456"}}'`,
      responseExample: {
        success: true,
        sessionId: 'session_1234567890_abc123',
        session: {},
        connectionType: 'official',
      },
    },
    'POST /api/messages/send-media': {
      authHeader: 'Authorization: Bearer',
      requestBody: {
        sessionId: 'YOUR_SESSION_ID',
        to: '919876543210',
        caption: 'Optional caption',
        mediaType: 'image',
        file: '(multipart/form-data)',
      },
      curlExample: `curl --request POST \\
  --url ${baseUrl}/api/messages/send-media \\
  --header 'Authorization: Bearer YOUR_API_KEY' \\
  -F "sessionId=YOUR_SESSION_ID" \\
  -F "to=919876543210" \\
  -F "mediaType=image" \\
  -F "file=@/path/to/image.jpg"`,
    },
  };

  const key = `${method} ${path}`;

  // Try exact match first
  let result = examples[key];
  if (result) return result;

  // Try pattern match (e.g. campaigns/123 matches campaigns/:id)
  for (const [k, v] of Object.entries(examples)) {
    const [m, p] = k.split(' ');
    if (m !== method) continue;
    const pattern = '^' + p.replace(/\/:[^/]+/g, '/[^/]+').replace(/\//g, '\\/') + '$';
    const regex = new RegExp(pattern);
    if (regex.test(path)) return v;
  }

  // Default curl for Project API
  if (isProjectApi) {
    return {
      authHeader: 'X-API-Key',
      curlExample: `curl --request ${method} \\
  --url ${baseUrl}${path} \\
  --header 'Accept: application/json' \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY'`,
    };
  }

  return {
    authHeader: 'Authorization: Bearer',
    curlExample: `curl --request ${method} \\
  --url ${baseUrl}${path} \\
  --header 'Accept: application/json' \\
  --header 'Content-Type: application/json' \\
  --header 'Authorization: Bearer YOUR_API_KEY'`,
  };
}
