-- Automation flow run history + structured event logs
CREATE TABLE IF NOT EXISTS automation_flow_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id VARCHAR NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_node_id VARCHAR,
  trigger_type VARCHAR,
  contact_id VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'scheduled', 'completed', 'failed', 'cancelled')),
  last_error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_flow_runs_flow_started
  ON automation_flow_runs(flow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_flow_runs_org_started
  ON automation_flow_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_flow_runs_status
  ON automation_flow_runs(status);

CREATE TABLE IF NOT EXISTS automation_flow_run_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR NOT NULL REFERENCES automation_flow_runs(id) ON DELETE CASCADE,
  level VARCHAR NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  event VARCHAR NOT NULL,
  node_id VARCHAR,
  action_id VARCHAR,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_flow_run_logs_run_created
  ON automation_flow_run_logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_flow_run_logs_event
  ON automation_flow_run_logs(event);

ALTER TABLE automation_flow_scheduled_runs
  ADD COLUMN IF NOT EXISTS run_id VARCHAR REFERENCES automation_flow_runs(id) ON DELETE SET NULL;
