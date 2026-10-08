CREATE TABLE IF NOT EXISTS opt_keywords (id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE, type VARCHAR NOT NULL CHECK (type IN ('opt_in', 'opt_out')), keyword VARCHAR NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_opt_keywords_user ON opt_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_opt_keywords_org ON opt_keywords(organization_id);
CREATE INDEX IF NOT EXISTS idx_opt_keywords_type ON opt_keywords(type);

