-- AI Assistant agent rules (working hours, follow-up, calendar, memory, RAG)
ALTER TABLE ai_assistants ADD COLUMN IF NOT EXISTS agent_rules JSONB;
