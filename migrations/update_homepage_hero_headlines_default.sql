-- Replace legacy/test homepage hero headlines with the current template default.
UPDATE website_builder_pages
SET
  content = jsonb_set(
    jsonb_set(
      content,
      '{heroHeadline1}',
      '"Everything Your Business Needs,"'::jsonb
    ),
    '{heroHeadline2}',
    '"Automated"'::jsonb
  ),
  updated_at = now()
WHERE page_key = 'homepage'
  AND (
    content->>'heroHeadline1' IN (
      'Test from script',
      'Automate your WhatsApp.',
      'Transform Your Business'
    )
    OR content->>'heroHeadline2' IN (
      'Works',
      'Grow your business.',
      'Communication'
    )
    OR trim(coalesce(content->>'heroHeadline1', '')) = ''
    OR trim(coalesce(content->>'heroHeadline2', '')) = ''
  );
