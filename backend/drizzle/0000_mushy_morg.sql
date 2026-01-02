CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'disconnected', 'error', 'syncing');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('google_ads', 'meta_ads', 'ga4');--> statement-breakpoint
CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"external_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"objective" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_integration_external_unique" UNIQUE("integration_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"roas" numeric(8, 4),
	"ctr" numeric(8, 4),
	"cpc" numeric(8, 4),
	"cpa" numeric(8, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_stats_campaign_date_unique" UNIQUE("campaign_id","date")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "platform" NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"status" "integration_status" DEFAULT 'disconnected' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_platform_account_unique" UNIQUE("platform","account_id")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"campaigns_processed" integer DEFAULT 0,
	"stats_processed" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_platform_idx" ON "campaigns" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "daily_stats_date_idx" ON "daily_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sync_jobs_integration_idx" ON "sync_jobs" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");