-- Ensure system Free / default plan columns + row exist on every database.
-- db:push only syncs schema; this seeds the locked Free plan used for new signups.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS auto_assign_on_signup boolean DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS auto_assign_trial_days integer DEFAULT 7;

-- Insert locked Free plan when missing (unique on name = system_free)
INSERT INTO plans (
  id,
  name,
  display_name,
  description,
  price_monthly,
  price_quarterly,
  price_yearly,
  features,
  is_active,
  status,
  is_popular,
  currency,
  default_billing_cycle,
  plan_features,
  auto_assign_on_signup,
  auto_assign_trial_days,
  is_system_default,
  created_at
)
SELECT
  gen_random_uuid()::varchar,
  'system_free',
  'Free',
  'Default free plan for new signups (system — not editable)',
  0,
  0,
  0,
  '{
    "maxSessions": 1,
    "maxMessagesPerMonth": 10,
    "maxApiCallsPerMinute": 10,
    "maxWebhooks": 1,
    "maxContacts": 10,
    "maxTeamMembers": 1,
    "maxWorkflows": 1,
    "maxChatbots": 1,
    "maxWabaNumbers": 1,
    "hasWhatsappBusinessApi": true,
    "hasAnalytics": false,
    "hasPrioritySupport": false,
    "hasMessageHistorySync": false
  }'::jsonb,
  true,
  'published',
  false,
  'INR',
  'monthly',
  '[]'::jsonb,
  true,
  3,
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM plans
  WHERE is_system_default = true
     OR name IN ('system_free', 'free')
);

-- Promote / lock legacy free or existing system_free row to match ensureSystemFreePlan()
UPDATE plans
SET
  display_name = 'Free',
  description = 'Default free plan for new signups (system — not editable)',
  price_monthly = 0,
  price_quarterly = 0,
  price_yearly = 0,
  features = '{
    "maxSessions": 1,
    "maxMessagesPerMonth": 10,
    "maxApiCallsPerMinute": 10,
    "maxWebhooks": 1,
    "maxContacts": 10,
    "maxTeamMembers": 1,
    "maxWorkflows": 1,
    "maxChatbots": 1,
    "maxWabaNumbers": 1,
    "hasWhatsappBusinessApi": true,
    "hasAnalytics": false,
    "hasPrioritySupport": false,
    "hasMessageHistorySync": false
  }'::jsonb,
  is_active = true,
  status = 'published',
  currency = 'INR',
  default_billing_cycle = 'monthly',
  auto_assign_on_signup = true,
  auto_assign_trial_days = 3,
  is_system_default = true
WHERE name IN ('system_free', 'free')
  AND (
    is_system_default = true
    OR NOT EXISTS (SELECT 1 FROM plans p2 WHERE p2.is_system_default = true AND p2.id <> plans.id)
  );

-- Ensure exactly one auto-assign plan: the system default
UPDATE plans
SET auto_assign_on_signup = false
WHERE auto_assign_on_signup = true
  AND is_system_default = false;
