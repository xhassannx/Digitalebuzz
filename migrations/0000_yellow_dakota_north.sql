CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used" timestamp,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" varchar PRIMARY KEY NOT NULL,
	"campaign_id" varchar NOT NULL,
	"contact_id" varchar,
	"phone_number" varchar NOT NULL,
	"name" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"message_id" varchar,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"session_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"message_template" text NOT NULL,
	"template_id" varchar,
	"template_language" varchar,
	"template_parameters" jsonb,
	"header_image_id" varchar,
	"header_image_url" text,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_nodes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"chatbot_id" varchar NOT NULL,
	"node_type" varchar NOT NULL,
	"position" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbots" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"contact_id" varchar,
	"contact_name" varchar NOT NULL,
	"contact_number" varchar NOT NULL,
	"contact_profile_pic" text,
	"last_message" text,
	"last_message_time" timestamp,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_columns" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"label" varchar NOT NULL,
	"type" varchar DEFAULT 'text' NOT NULL,
	"options" jsonb,
	"visible" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tag_assignments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"contact_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"color" varchar DEFAULT '#3b82f6' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"number" varchar NOT NULL,
	"profile_pic" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"last_seen" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" varchar PRIMARY KEY NOT NULL,
	"group_id" varchar NOT NULL,
	"contact_id" varchar,
	"phone_number" varchar NOT NULL,
	"name" varchar,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"whatsapp_group_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_states" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"integration_name" varchar NOT NULL,
	"state" varchar NOT NULL,
	"code_verifier" varchar,
	"redirect_uri" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "integration_oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"status" varchar DEFAULT 'not_connected' NOT NULL,
	"auth_type" varchar DEFAULT 'none' NOT NULL,
	"config" jsonb,
	"credentials" jsonb,
	"last_sync_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managed_contacts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"name" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"email" varchar,
	"custom_fields" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_activity_log" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organization_id" varchar,
	"user_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_sync_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"session_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"completed_at" timestamp,
	"estimated_message_count" integer,
	"actual_message_count" integer,
	"estimated_storage_size" integer,
	"actual_storage_size" integer,
	"price" integer,
	"payment_id" varchar,
	"notes" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"template_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"language" varchar DEFAULT 'en' NOT NULL,
	"status" varchar NOT NULL,
	"category" varchar NOT NULL,
	"phone_number_id" varchar,
	"components" jsonb NOT NULL,
	"meta_data" jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"chat_id" varchar NOT NULL,
	"body" text NOT NULL,
	"from_me" boolean NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"type" varchar DEFAULT 'text' NOT NULL,
	"media_url" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sender_name" varchar,
	"sender_number" varchar,
	"latitude" varchar,
	"longitude" varchar,
	"address" text,
	"vcard" text,
	"footer" text,
	"footer_button_type" varchar,
	"footer_button_text" text,
	"footer_button_url" text,
	"footer_button_phone" varchar,
	"whatsapp_message_id" varchar,
	"campaign_id" varchar,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"error_code" varchar,
	"template_name" varchar,
	"template_language" varchar,
	"template_type" varchar,
	"header_text" text,
	"template_params" jsonb
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member' NOT NULL,
	"invited_by" varchar,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_themes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organization_id" varchar NOT NULL,
	"light_primary" varchar,
	"light_primary_foreground" varchar,
	"light_secondary" varchar,
	"light_secondary_foreground" varchar,
	"light_accent" varchar,
	"light_accent_foreground" varchar,
	"light_background" varchar,
	"light_foreground" varchar,
	"light_card" varchar,
	"light_card_foreground" varchar,
	"light_border" varchar,
	"dark_primary" varchar,
	"dark_primary_foreground" varchar,
	"dark_secondary" varchar,
	"dark_secondary_foreground" varchar,
	"dark_accent" varchar,
	"dark_accent_foreground" varchar,
	"dark_background" varchar,
	"dark_foreground" varchar,
	"dark_card" varchar,
	"dark_card_foreground" varchar,
	"dark_border" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_themes_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"subscription_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar DEFAULT 'INR' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"payment_gateway" varchar NOT NULL,
	"gateway_order_id" varchar,
	"gateway_payment_id" varchar,
	"gateway_signature" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"price_monthly" integer NOT NULL,
	"price_quarterly" integer NOT NULL,
	"price_yearly" integer NOT NULL,
	"features" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"billing_cycle" varchar NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"payment_gateway" varchar,
	"gateway_subscription_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"month" varchar NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"api_calls" integer DEFAULT 0 NOT NULL,
	"active_sessions" integer DEFAULT 0 NOT NULL,
	"webhooks_triggered" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"razorpay_credentials" jsonb,
	"stripe_credentials" jsonb,
	"whatsapp_business_credentials" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_saas_owner" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"url" varchar NOT NULL,
	"events" text[] NOT NULL,
	"secret" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"last_triggered_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_flows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar,
	"flow_id" varchar,
	"name" varchar NOT NULL,
	"business_account_id" varchar NOT NULL,
	"category" varchar DEFAULT 'other',
	"status" varchar DEFAULT 'DRAFT' NOT NULL,
	"validation" varchar DEFAULT 'Valid' NOT NULL,
	"screens" jsonb NOT NULL,
	"meta_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"connection_type" varchar DEFAULT 'unofficial' NOT NULL,
	"status" varchar DEFAULT 'disconnected' NOT NULL,
	"qr_code" text,
	"device_info" jsonb,
	"last_active" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_managed_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."managed_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_nodes" ADD CONSTRAINT "chatbot_nodes_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_columns" ADD CONSTRAINT "contact_columns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_columns" ADD CONSTRAINT "contact_columns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_contact_id_managed_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."managed_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_tag_id_contact_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."contact_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_contact_id_managed_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."managed_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_contacts" ADD CONSTRAINT "managed_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managed_contacts" ADD CONSTRAINT "managed_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_activity_log" ADD CONSTRAINT "message_activity_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_activity_log" ADD CONSTRAINT "message_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sync_requests" ADD CONSTRAINT "message_sync_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sync_requests" ADD CONSTRAINT "message_sync_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sync_requests" ADD CONSTRAINT "message_sync_requests_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_sync_requests" ADD CONSTRAINT "message_sync_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_whatsapp_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."whatsapp_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_themes" ADD CONSTRAINT "organization_themes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_flows" ADD CONSTRAINT "whatsapp_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_flows" ADD CONSTRAINT "whatsapp_flows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_recipients_campaign" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipients_status" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_user" ON "campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_chatbot_nodes_chatbot" ON "chatbot_nodes" USING btree ("chatbot_id");--> statement-breakpoint
CREATE INDEX "idx_chatbot_nodes_type" ON "chatbot_nodes" USING btree ("node_type");--> statement-breakpoint
CREATE INDEX "idx_chatbots_user" ON "chatbots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chatbots_org" ON "chatbots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_chatbots_status" ON "chatbots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_columns_user" ON "contact_columns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_columns_org" ON "contact_columns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tags_user" ON "contact_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tags_org" ON "contact_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_state" ON "integration_oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_user" ON "integration_oauth_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_integrations_user" ON "integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_integrations_org" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_integrations_name" ON "integrations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_contacts_user" ON "managed_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_org" ON "managed_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_message_activity_org_date" ON "message_activity_log" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "idx_message_activity_user_date" ON "message_activity_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_sync_requests_user" ON "message_sync_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sync_requests_session" ON "message_sync_requests" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sync_requests_status" ON "message_sync_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_templates_user" ON "message_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_templates_org" ON "message_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_templates_template_id" ON "message_templates" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_templates_phone_number_id" ON "message_templates" USING btree ("phone_number_id");--> statement-breakpoint
CREATE INDEX "idx_messages_whatsapp_id" ON "messages" USING btree ("whatsapp_message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_campaign" ON "messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_messages_status" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_org_themes_org" ON "organization_themes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_usage_user_month" ON "usage_tracking" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "idx_flows_user" ON "whatsapp_flows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_flows_org" ON "whatsapp_flows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_flows_business_account" ON "whatsapp_flows" USING btree ("business_account_id");--> statement-breakpoint
CREATE INDEX "idx_flows_flow_id" ON "whatsapp_flows" USING btree ("flow_id");