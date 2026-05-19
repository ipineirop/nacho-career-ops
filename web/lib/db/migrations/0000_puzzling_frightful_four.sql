CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"country" text,
	"stage" text,
	"latest_funding" jsonb,
	"employee_count" integer,
	"founded" date,
	"sector" text,
	"sub_sector" text,
	"investors" text[],
	"notable_leaders" jsonb,
	"glassdoor_score" numeric,
	"context_summary" text,
	"last_enriched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"role_id" uuid,
	"type" text NOT NULL,
	"title" text,
	"content" text,
	"storage_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evaluation_dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"dimension_name" text NOT NULL,
	"grade" text,
	"score_numeric" numeric,
	"reasoning_markdown" text
);
--> statement-breakpoint
CREATE TABLE "evaluation_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"gap_description" text NOT NULL,
	"blocker_severity" text,
	"adjacent_experience" text,
	"mitigation_strategy" text
);
--> statement-breakpoint
CREATE TABLE "evaluation_proof_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"requirement" text NOT NULL,
	"evidence" text,
	"match_strength" text
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"evaluated_at" timestamp DEFAULT now(),
	"evaluation_version" integer DEFAULT 1,
	"overall_score" numeric,
	"recommendation" text,
	"cv_match_score" numeric,
	"north_star_score" numeric,
	"comp_score" numeric,
	"cultural_score" numeric,
	"red_flag_adjustment" numeric,
	"verdict_summary" text,
	"full_report_markdown" text,
	"model_used" text,
	"prompt_version" text,
	"superseded_by" uuid,
	"display_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"type" text NOT NULL,
	"direction" text,
	"occurred_at" timestamp DEFAULT now(),
	"description" text,
	"sentiment" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp DEFAULT now(),
	"entry_type" text NOT NULL,
	"title" text,
	"body_markdown" text,
	"related_company_id" uuid,
	"metrics" jsonb,
	"tags" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment" text NOT NULL,
	"median_comp_usd" numeric,
	"p25_comp_usd" numeric,
	"p75_comp_usd" numeric,
	"sample_size" integer,
	"last_calculated_at" timestamp DEFAULT now(),
	"confidence_level" text,
	"source_breakdown" jsonb,
	CONSTRAINT "market_signals_segment_unique" UNIQUE("segment")
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"scope" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "oauth_user_provider_uniq" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"outcome_type" text NOT NULL,
	"occurred_at" timestamp DEFAULT now(),
	"offer_base_usd" numeric,
	"offer_total_usd" numeric,
	"offer_currency" text,
	"negotiated_delta_pct" numeric,
	"accepted" boolean,
	"rejection_reason" text,
	"ghosted_after_stage" text,
	"notes_markdown" text
);
--> statement-breakpoint
CREATE TABLE "pipeline_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text NOT NULL,
	"status_changed_at" timestamp DEFAULT now(),
	"applied_at" timestamp,
	"last_touch_at" timestamp,
	"follow_up_due_at" timestamp,
	"notes_markdown" text,
	CONSTRAINT "pipeline_user_role_uniq" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"company_name" text NOT NULL,
	"company_id" uuid,
	"role_title" text NOT NULL,
	"role_archetype" text,
	"function" text,
	"domain" text,
	"seniority_level" text,
	"location" text,
	"remote_policy" text,
	"team_description" text,
	"comp_range_low" numeric,
	"comp_range_high" numeric,
	"comp_currency" text,
	"comp_disclosed" boolean DEFAULT false,
	"posted_at" timestamp,
	"scraped_at" timestamp,
	"verified_at" timestamp,
	"liveness_status" text DEFAULT 'active',
	"raw_jd_text" text,
	"structured_jd" jsonb,
	"portal" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_source_ref_unique" UNIQUE("source_ref")
);
--> statement-breakpoint
CREATE TABLE "star_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"situation" text,
	"task" text,
	"action" text,
	"result" text,
	"reflection" text,
	"tags" text[],
	"used_in_evaluations" uuid[],
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_career_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"company_id" uuid,
	"role_title" text NOT NULL,
	"role_archetype" text,
	"function" text,
	"seniority_at_role" text,
	"location_during_role" text,
	"remote_during_role" text,
	"started_at" date,
	"ended_at" date,
	"team_size_managed" integer,
	"pnl_scope_usd" numeric,
	"key_outcomes_markdown" text,
	"proof_points" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_compensation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"employer_name" text,
	"base_amount" numeric,
	"base_currency" text,
	"bonus_structure_markdown" text,
	"bonus_realized_amount" numeric,
	"equity_value_usd" numeric,
	"benefits" jsonb,
	"total_comp_usd_normalized" numeric,
	"effective_from" date,
	"effective_to" date,
	"source" text,
	"confidence" text,
	"private" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"occurred_at" timestamp DEFAULT now(),
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location_type" text NOT NULL,
	"country_iso" text NOT NULL,
	"state_or_region" text,
	"city" text,
	"neighborhood" text,
	"postal_code" text,
	"since_date" date,
	"until_date" date,
	"verified" boolean DEFAULT false,
	"source" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"floor_comp_usd" numeric,
	"target_comp_usd" numeric,
	"ideal_comp_usd" numeric,
	"comp_currency_display" text DEFAULT 'usd',
	"target_geographies" text[],
	"target_remote_modes" text[],
	"target_company_stages" text[],
	"target_industries" text[],
	"target_domains" text[],
	"target_functions" text[],
	"target_seniority_levels" text[],
	"non_negotiables" jsonb,
	"nice_to_haves" text[],
	"deal_breakers" text[],
	"brief_cadence" text DEFAULT 'weekly',
	"brief_pick_count" integer DEFAULT 5,
	"preferred_brief_time" text,
	"human_answer" text,
	"created_at" timestamp DEFAULT now(),
	"superseded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"years_of_experience" integer,
	"seniority_level" text,
	"primary_function" text,
	"secondary_functions" text[],
	"domains" text[],
	"industries" text[],
	"languages" jsonb,
	"education" jsonb,
	"work_authorization" text[],
	"relocation_willingness" text,
	"remote_preference" text,
	"cv_markdown" text,
	"cv_uploaded_at" timestamp,
	"profile_markdown" text,
	"linkedin_url" text,
	"linkedin_last_synced_at" timestamp,
	"portfolio_urls" text[],
	"profile_completeness_score" integer,
	"last_meaningful_update_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_signals_derived" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"career_arc_description" text,
	"trajectory_velocity" text,
	"scope_growth_rate" numeric,
	"domain_consistency" text,
	"market_alignment_score" numeric,
	"inferred_strengths" text[],
	"inferred_gaps" text[],
	"last_calculated_at" timestamp,
	"calculation_version" text,
	CONSTRAINT "user_signals_derived_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name_full" text,
	"name_preferred" text,
	"locale" text DEFAULT 'es-MX',
	"timezone" text DEFAULT 'America/Mexico_City',
	"account_status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"last_active_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_dimensions" ADD CONSTRAINT "evaluation_dimensions_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_gaps" ADD CONSTRAINT "evaluation_gaps_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_proof_points" ADD CONSTRAINT "evaluation_proof_points_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_related_company_id_companies_id_fk" FOREIGN KEY ("related_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_status" ADD CONSTRAINT "pipeline_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_status" ADD CONSTRAINT "pipeline_status_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_stories" ADD CONSTRAINT "star_stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_career_history" ADD CONSTRAINT "user_career_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_career_history" ADD CONSTRAINT "user_career_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_compensation" ADD CONSTRAINT "user_compensation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_signals_derived" ADD CONSTRAINT "user_signals_derived_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "eval_dimensions_eval_idx" ON "evaluation_dimensions" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "eval_gaps_eval_idx" ON "evaluation_gaps" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "eval_proof_eval_idx" ON "evaluation_proof_points" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "evaluations_user_idx" ON "evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "evaluations_role_idx" ON "evaluations" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "evaluations_user_role_idx" ON "evaluations" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "interactions_user_idx" ON "interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interactions_role_idx" ON "interactions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "journal_user_idx" ON "journal_entries" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "outcomes_user_idx" ON "outcomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outcomes_type_idx" ON "outcomes" USING btree ("outcome_type");--> statement-breakpoint
CREATE INDEX "pipeline_user_idx" ON "pipeline_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pipeline_user_status_idx" ON "pipeline_status" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "roles_source_ref_idx" ON "roles" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "roles_company_idx" ON "roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "star_stories_user_idx" ON "star_stories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "career_history_user_idx" ON "user_career_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_compensation_user_idx" ON "user_compensation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_events_user_idx" ON "user_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "user_locations_user_idx" ON "user_locations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_user_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_current_idx" ON "user_preferences" USING btree ("user_id","superseded_at");--> statement-breakpoint
CREATE INDEX "user_profiles_user_idx" ON "user_profiles" USING btree ("user_id");