// @ts-nocheck
import { randomUUID } from "crypto";
import type { Chatbot, ChatbotNode, InsertChatbot, InsertChatbotNode } from "@shared/schema";
import { storage } from "../storage";

export const DEMO_HTTP_CHATBOT_NAME_PREFIX = "Demo: HTTP Fetch + Update";

type HttpHeader = { key: string; value: string };

export async function createDemoHttpChatbot(params: {
  userId: string;
  organizationId: string | null | undefined;
  getUrl: string;
  postUrl: string;
  bearerToken: string;
  employeeId: number;
}): Promise<{ chatbot: Chatbot; nodes: ChatbotNode[] }> {
  const { userId, organizationId, getUrl, postUrl, bearerToken, employeeId } = params;

  let sessions = organizationId ? await storage.getSessionsByOrganization(organizationId) : [];
  if (sessions.length === 0) {
    sessions = await storage.getSessionsByUser(userId);
  }
  if (sessions.length === 0) {
    throw new Error("No WhatsApp session found. Connect WhatsApp first.");
  }

  const sessionId = sessions[0].sessionId;
  const authHeaderValue = `Bearer ${bearerToken.trim()}`;
  const commonHeaders: HttpHeader[] = [{ key: "Authorization", value: authHeaderValue }];

  const triggerId = randomUUID();
  const askId = randomUUID();
  const getId = randomUUID();
  const postId = randomUUID();
  const replyId = randomUUID();

  const nodes: InsertChatbotNode[] = [
    {
      id: triggerId,
      nodeType: "trigger",
      position: { x: 80, y: 180 },
      data: {
        nodeType: "trigger",
        messageType: "text",
        keywords: [],
        fuzzyMatching: true,
        triggerSessionIds: [sessionId],
        triggerSessionId: sessionId,
        triggerPhoneNumberId: "",
        triggerDisplayPhoneNumber: "",
        triggerConnectionType: "",
      },
      connections: [{ from: triggerId, to: askId }],
    },
    {
      id: askId,
      nodeType: "ask_question",
      position: { x: 360, y: 180 },
      data: {
        nodeType: "ask_question",
        message: "Please reply with update text (example: complete 1).",
        responseFormat: "text",
        validationMessage: "",
        retryCount: 2,
        timeoutValue: 300,
        timeoutUnit: "seconds",
        timeoutMessage: "",
        continueOnTimeout: false,
      },
      connections: [{ from: askId, to: getId }],
    },
    {
      id: getId,
      nodeType: "http",
      position: { x: 640, y: 140 },
      data: {
        nodeType: "http",
        method: "GET",
        url: getUrl,
        headers: commonHeaders,
        query: [],
        body: "",
      },
      connections: [{ from: getId, to: postId }],
    },
    {
      id: postId,
      nodeType: "http",
      position: { x: 920, y: 220 },
      data: {
        nodeType: "http",
        method: "POST",
        url: postUrl,
        headers: [
          ...commonHeaders,
          { key: "Content-Type", value: "application/json" },
        ],
        query: [],
        body: JSON.stringify(
          {
            employeeId,
            message: `{{${askId}.answer}}`,
          },
          null,
          2
        ),
      },
      connections: [{ from: postId, to: replyId }],
    },
    {
      id: replyId,
      nodeType: "send_text",
      position: { x: 1210, y: 180 },
      data: {
        nodeType: "send_text",
        body:
          `HTTP test done.\n` +
          `GET status: {{${getId}.status}}\n` +
          `POST status: {{${postId}.status}}\n\n` +
          `POST response:\n{{${postId}.body}}`,
      },
      connections: [],
    },
  ];

  const chatbotPayload: InsertChatbot = {
    userId,
    organizationId: organizationId ?? null,
    name: `${DEMO_HTTP_CHATBOT_NAME_PREFIX} (${new Date().toISOString().slice(0, 10)})`,
    status: "published",
    sessionId,
  };

  const chatbot = await storage.createChatbot(chatbotPayload);
  const inserted = await storage.upsertChatbotNodes(chatbot.id, nodes);
  return { chatbot, nodes: inserted };
}
