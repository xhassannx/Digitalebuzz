-- Per-card send-time media for template MEDIA_CARD_CAROUSEL (inbox display matches what was sent).
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "carousel_card_media_urls" jsonb;
