-- AI Assistants and knowledge base files for OpenAI-powered auto-reply
CREATE TABLE IF NOT EXISTS ai_assistants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  prompt_type VARCHAR NOT NULL DEFAULT 'predefined' CHECK (prompt_type IN ('predefined', 'custom')),
  agent_role VARCHAR,
  custom_prompt TEXT,
  openai_integration_id VARCHAR,
  openai_api_key_override VARCHAR,
  model VARCHAR NOT NULL DEFAULT 'gpt-4o',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assistants_user ON ai_assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_assistants_org ON ai_assistants(organization_id);

CREATE TABLE IF NOT EXISTS ai_assistant_knowledge_files (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id VARCHAR NOT NULL REFERENCES ai_assistants(id) ON DELETE CASCADE,
  file_name VARCHAR NOT NULL,
  content TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type VARCHAR NOT NULL DEFAULT 'text/plain',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_kb_assistant ON ai_assistant_knowledge_files(assistant_id);
