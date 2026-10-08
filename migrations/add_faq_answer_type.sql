-- FAQ answer types: text, image, video, document, audio
-- Matches shared/schema.ts faqItems columns used by the FAQ bot UI/API.
ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS answer_type VARCHAR(20) NOT NULL DEFAULT 'text';

ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS media_file_name VARCHAR(255);

-- Kept from main so existing DBs that already added caption are not broken on re-sync
ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS caption TEXT;
