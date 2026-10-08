-- Website Builder / White-label dynamic content per organization
CREATE TABLE IF NOT EXISTS "website_builder_pages" (
  "id" varchar PRIMARY KEY NOT NULL,
  "organization_id" varchar NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "page_key" varchar NOT NULL,
  "content" jsonb DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_builder_org_key_unique"
  ON "website_builder_pages" ("organization_id", "page_key");

CREATE INDEX IF NOT EXISTS "idx_website_builder_org_key"
  ON "website_builder_pages" ("organization_id", "page_key");
