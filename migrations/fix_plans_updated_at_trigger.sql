-- Fix: trg_set_updated_at on plans fails if updated_at was dropped by schema push.
-- Also harden the shared trigger function for any table missing the column.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE plans SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE plans ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE plans ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only assign when the target table actually has updated_at (avoids 42703 after drizzle drops the column)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
      AND table_name = TG_TABLE_NAME
      AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.plans;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_timestamp();
