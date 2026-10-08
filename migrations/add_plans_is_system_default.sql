-- Locked system Free plan flag (default for new signups; not editable/deletable in admin)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;
