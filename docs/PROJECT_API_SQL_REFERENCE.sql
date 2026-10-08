-- =============================================================================
-- Project API – SQL reference
-- =============================================================================
-- The Project API uses the following table for API key authentication.
-- No additional migrations were added for Project API; it reuses existing
-- tables: webhooks, managed_contacts, message_templates, whatsapp_sessions,
-- organizations, etc.
--
-- If your database was created from the initial migration (0000_yellow_dakota_north.sql),
-- the api_keys table already exists. Use this file only for reference or if you
-- need to create api_keys in a separate environment.
-- =============================================================================

-- API Keys table (used by Project API for X-API-Key authentication)
-- Already present in initial migration; included here for reference.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" varchar PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "organization_id" varchar,
  "name" varchar NOT NULL,
  "key" varchar NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used" timestamp,
  CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);

-- Optional: add foreign key if not already present (matches initial migration)
-- ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk"
--   FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- =============================================================================
-- Tables used by Project API (read-only reference; do not run – already in schema)
-- =============================================================================
-- Project API endpoints use these existing tables:
--   api_keys         – API key auth (create/list/delete keys in Settings → API Keys)
--   webhooks         – GET/DELETE webhooks, list
--   managed_contacts – GET/POST/PATCH contacts, list, by-phone
--   message_templates – GET templates, GET template by id
--   whatsapp_sessions – GET sessions
--   organizations    – org context for contacts, webhooks
--   contact_tags, contact_tag_assignments – contact tags
-- No new tables or columns were added for Project API.
-- =============================================================================
