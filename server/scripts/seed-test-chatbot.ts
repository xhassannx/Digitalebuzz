// @ts-nocheck
/**
 * Seed a test chatbot: On Message (any message) → AI Agent.
 * Uses the first user, first WhatsApp session, and first AI Assistant in the DB.
 *
 * Run: npm run seed:test-chatbot
 */

import "dotenv/config";
import { db } from "../../db";
import { users } from "@shared/schema";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import type { InsertChatbotNode } from "@shared/schema";

const TEST_USER_EMAIL = "sk.kush2010@gmail.com";

async function seedTestChatbot() {
  console.log("🤖 Seeding test chatbot (On Message → AI Agent)...\n");

  const [user] = await db.select().from(users).where(eq(users.email, TEST_USER_EMAIL)).limit(1);
  if (!user) {
    console.error(`❌ No user found with email: ${TEST_USER_EMAIL}. Sign up with this email first.`);
    process.exit(1);
  }
  const userId = user.id;
  console.log("✅ Using user:", user.email);

  const sessions = await storage.getSessionsByUser(userId);
  if (sessions.length === 0) {
    console.error("❌ No WhatsApp session found for this user. Connect a number first.");
    process.exit(1);
  }
  const sessionId = sessions[0].sessionId;
  console.log("✅ Using session:", sessionId);

  const assistants = await storage.getAiAssistants(userId);
  if (assistants.length === 0) {
    console.error("❌ No AI Assistant found. Create one in AI Assistants and link OpenAI first.");
    process.exit(1);
  }
  const assistantId = assistants[0].id;
  console.log("✅ Using AI Assistant:", assistants[0].name, `(${assistantId})\n`);

  const chatbot = await storage.createChatbot({
    userId,
    name: "Test AI Bot",
    status: "published",
    sessionId,
  });
  console.log("✅ Created chatbot:", chatbot.name, `(${chatbot.id})`);

  const triggerId = "seed-trigger-1";
  const aiAgentId = "seed-ai-agent-1";

  const nodes: InsertChatbotNode[] = [
    {
      id: triggerId,
      nodeType: "trigger",
      position: { x: 100, y: 100 },
      data: {
        nodeType: "trigger",
        messageType: "text",
        keywords: [], // empty = match any message
        fuzzyMatching: true,
        triggerSessionIds: [sessionId],
        triggerSessionId: sessionId,
        triggerPhoneNumberId: "",
        triggerDisplayPhoneNumber: "",
        triggerConnectionType: "",
      },
      connections: [{ from: triggerId, to: aiAgentId }],
    },
    {
      id: aiAgentId,
      nodeType: "ai_agent",
      position: { x: 400, y: 100 },
      data: {
        nodeType: "ai_agent",
        assistantId,
        welcomeMessage: "Hi! I'm your test AI assistant. Ask me anything.",
        stopKeywords: [],
      },
      connections: [],
    },
  ];

  await storage.upsertChatbotNodes(chatbot.id, nodes);
  console.log("✅ Added nodes: On Message (any message) → AI Agent\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Test chatbot ready.");
  console.log("   Send any WhatsApp message to your connected number.");
  console.log("   The bot will reply using your AI Assistant.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

seedTestChatbot().catch((err) => {
  console.error(err);
  process.exit(1);
});
