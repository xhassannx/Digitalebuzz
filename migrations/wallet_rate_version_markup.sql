-- Per-country/category markup on rate versions (NULL = use global markup from platform config).

ALTER TABLE wallet_meta_rate_versions
  ADD COLUMN IF NOT EXISTS markup_minor integer;

COMMENT ON COLUMN wallet_meta_rate_versions.markup_minor IS
  'Fixed markup paise for this rate row. NULL = fall back to platform markupByCategory.';
