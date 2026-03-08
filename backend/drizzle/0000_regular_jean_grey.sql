CREATE TYPE "public"."condition" AS ENUM('gt', 'gte', 'lt', 'lte', 'eq');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('jenkins', 'kibana', 'github', 'portainer', 'aws', 'gcp', 'azure', 'grafana');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'investigating', 'resolved', 'suppressed');--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" "source" NOT NULL,
	"metric" text NOT NULL,
	"condition" "condition" NOT NULL,
	"threshold" real NOT NULL,
	"severity" "severity" NOT NULL,
	"message" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"rule_name" text NOT NULL,
	"severity" "severity" NOT NULL,
	"source" "source" NOT NULL,
	"message" text NOT NULL,
	"value" real NOT NULL,
	"threshold" real NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"incident_id" text
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "status" DEFAULT 'open' NOT NULL,
	"root_cause" text NOT NULL,
	"fixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correlations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_data" jsonb,
	"github_issue_url" text,
	"slack_thread_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alerts_triggered" ON "alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_alerts_rule_id" ON "alerts" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_resolved" ON "alerts" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "idx_incidents_created" ON "incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_incidents_status" ON "incidents" USING btree ("status");