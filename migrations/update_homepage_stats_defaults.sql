-- Replace inflated/legacy homepage stats with modest defaults.
UPDATE website_builder_pages
SET
  content = jsonb_set(
    content,
    '{stats}',
    '[
      {"value":"250+","label":"businesses"},
      {"value":"1.2M+","label":"messages / mo"},
      {"value":"96%","label":"delivery rate"},
      {"value":"24/7","label":"Support"}
    ]'::jsonb
  ),
  updated_at = now()
WHERE page_key = 'homepage'
  AND (
    content->'stats' IS NULL
    OR jsonb_typeof(content->'stats') <> 'array'
    OR jsonb_array_length(content->'stats') = 0
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(content->'stats') AS s(item)
      WHERE trim(coalesce(item->>'value', '')) IN (
        '5,000+',
        '5000+',
        '10K+',
        '120M+',
        '50M+',
        '98.5%',
        '99.9%'
      )
    )
  );
