-- Drip campaigns: timed WhatsApp automation sequences
CREATE TABLE IF NOT EXISTS drip_campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id VARCHAR,
  name VARCHAR NOT NULL,
  goal VARCHAR NOT NULL DEFAULT 'Lead Nurturing',
  entry_trigger VARCHAR NOT NULL DEFAULT 'manual',
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone VARCHAR NOT NULL DEFAULT 'Asia/Kolkata',
  start_time VARCHAR NOT NULL DEFAULT '09:00',
  end_time VARCHAR NOT NULL DEFAULT '18:00',
  working_days JSONB NOT NULL DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
  duplicate_strategy VARCHAR NOT NULL DEFAULT 'ignore',
  humanizer_delay_minutes INTEGER NOT NULL DEFAULT 0,
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_org ON drip_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_status ON drip_campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_trigger ON drip_campaigns(organization_id, entry_trigger, status);

CREATE TABLE IF NOT EXISTS drip_campaign_enrollments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id VARCHAR NOT NULL REFERENCES managed_contacts(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL DEFAULT 'running',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  next_execute_at TIMESTAMP,
  last_executed_at TIMESTAMP,
  enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  stopped_reason TEXT,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign ON drip_campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_contact ON drip_campaign_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_due ON drip_campaign_enrollments(status, next_execute_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drip_enrollments_campaign_contact
  ON drip_campaign_enrollments(campaign_id, contact_id);

CREATE TABLE IF NOT EXISTS drip_campaign_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  enrollment_id VARCHAR NOT NULL REFERENCES drip_campaign_enrollments(id) ON DELETE CASCADE,
  contact_id VARCHAR REFERENCES managed_contacts(id) ON DELETE SET NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  action_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_logs_campaign ON drip_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_logs_enrollment ON drip_campaign_logs(enrollment_id);
