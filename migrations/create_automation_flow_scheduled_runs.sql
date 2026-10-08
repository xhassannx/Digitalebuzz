-- Persist automation flow execution paused by long delays (drip campaigns, 24h waits, etc.)
CREATE TABLE IF NOT EXISTS automation_flow_scheduled_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id VARCHAR NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  next_node_id VARCHAR,
  resume_at TIMESTAMP NOT NULL,
  run_context JSONB NOT NULL DEFAULT '{}',
  visited_node_ids JSONB NOT NULL DEFAULT '[]',
  status VARCHAR NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_flow_scheduled_runs_status_resume
  ON automation_flow_scheduled_runs(status, resume_at);
CREATE INDEX IF NOT EXISTS idx_automation_flow_scheduled_runs_flow
  ON automation_flow_scheduled_runs(flow_id);
