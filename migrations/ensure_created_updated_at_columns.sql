-- Ensure every public table has created_at / updated_at with DEFAULT NOW().
-- Backfill NULLs, then attach a trigger so updated_at refreshes on UPDATE.

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip safely if drizzle/schema push dropped updated_at but left the trigger
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

DO $$
DECLARE
  r RECORD;
  has_created BOOLEAN;
  has_updated BOOLEAN;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE 'sql_%'
      AND c.relname NOT IN ('spatial_ref_sys')
    ORDER BY c.relname
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'created_at'
    ) INTO has_created;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'updated_at'
    ) INTO has_updated;

    IF NOT has_created THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
        r.table_name
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_at SET DEFAULT NOW()',
        r.table_name
      );
      EXECUTE format(
        'UPDATE public.%I SET created_at = NOW() WHERE created_at IS NULL',
        r.table_name
      );
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN created_at SET NOT NULL',
          r.table_name
        );
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not set created_at NOT NULL on %: %', r.table_name, SQLERRM;
      END;
    END IF;

    IF NOT has_updated THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
        r.table_name
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN updated_at SET DEFAULT NOW()',
        r.table_name
      );
      EXECUTE format(
        'UPDATE public.%I SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL',
        r.table_name
      );
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN updated_at SET NOT NULL',
          r.table_name
        );
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not set updated_at NOT NULL on %: %', r.table_name, SQLERRM;
      END;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW
       EXECUTE PROCEDURE public.set_updated_at_timestamp()',
      r.table_name
    );
  END LOOP;
END;
$$;

-- Explicit guarantee for managed_contacts (primary request)
ALTER TABLE managed_contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE managed_contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE managed_contacts SET created_at = NOW() WHERE created_at IS NULL;
UPDATE managed_contacts SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE managed_contacts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE managed_contacts ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE managed_contacts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE managed_contacts ALTER COLUMN updated_at SET NOT NULL;
