-- Admin assign-plan uses plan.default_billing_cycle when the request omits billingCycle.
-- Enterprise should default to yearly (12-month period) instead of monthly.
UPDATE plans
SET default_billing_cycle = 'yearly'
WHERE lower(name) = 'enterprise'
   OR lower(trim(display_name)) = 'enterprise';
