CREATE TABLE IF NOT EXISTS "daily_prices" (
	"ticker" varchar(10) NOT NULL,
	"trade_date" date NOT NULL,
	"open" numeric(12, 4) NOT NULL,
	"high" numeric(12, 4) NOT NULL,
	"low" numeric(12, 4) NOT NULL,
	"close" numeric(12, 4) NOT NULL,
	"adj_close" numeric(12, 4) NOT NULL,
	"volume" bigint NOT NULL,
	"market_cap" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_prices_ticker_trade_date_pk" PRIMARY KEY("ticker","trade_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"headline" text NOT NULL,
	"hazard_delta" numeric(6, 2),
	"category" varchar(30) NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fundamental_data" (
	"ticker" varchar(10) NOT NULL,
	"fiscal_quarter" varchar(6) NOT NULL,
	"filing_date" date NOT NULL,
	"capex_ttm" numeric(20, 2) NOT NULL,
	"ai_revenue_ttm" numeric(20, 2),
	"forward_pe" numeric(10, 4),
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fundamental_data_ticker_fiscal_quarter_pk" PRIMARY KEY("ticker","fiscal_quarter")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hazard_rate_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"tc_value" double precision NOT NULL,
	"stress_score" numeric(6, 2) NOT NULL,
	"t_prox" numeric(8, 6) NOT NULL,
	"raw_hazard" numeric(8, 6) NOT NULL,
	"sigmoid_hazard" numeric(8, 6) NOT NULL,
	"minutes_to_midnight" numeric(6, 2) NOT NULL,
	"data_quality" varchar(20) DEFAULT 'full' NOT NULL,
	"cached_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lppls_result_id" bigint,
	"stress_snapshot_id" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lppls_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_timestamp" timestamp with time zone NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"tc" double precision NOT NULL,
	"m" double precision NOT NULL,
	"omega" double precision NOT NULL,
	"phi" double precision NOT NULL,
	"A" double precision NOT NULL,
	"B" double precision NOT NULL,
	"C1" double precision NOT NULL,
	"C2" double precision NOT NULL,
	"residual_norm" double precision NOT NULL,
	"confidence_score" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stress_index_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"forward_pe_score" numeric(6, 2) NOT NULL,
	"hhi_score" numeric(6, 2) NOT NULL,
	"correlation_score" numeric(6, 2) NOT NULL,
	"capex_deficit_score" numeric(6, 2) NOT NULL,
	"composite_score" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stress_index_snapshots_snapshot_date_unique" UNIQUE("snapshot_date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hazard_rate_log" ADD CONSTRAINT "hazard_rate_log_lppls_result_id_lppls_results_id_fk" FOREIGN KEY ("lppls_result_id") REFERENCES "public"."lppls_results"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hazard_rate_log" ADD CONSTRAINT "hazard_rate_log_stress_snapshot_id_stress_index_snapshots_id_fk" FOREIGN KEY ("stress_snapshot_id") REFERENCES "public"."stress_index_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_prices_ticker_date" ON "daily_prices" USING btree ("ticker","trade_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_time" ON "events" USING btree ("event_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_category" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fundamental_ticker_date" ON "fundamental_data" USING btree ("ticker","filing_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hazard_computed_at" ON "hazard_rate_log" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hazard_date" ON "hazard_rate_log" USING btree (DATE("computed_at"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lppls_run_timestamp" ON "lppls_results" USING btree ("run_timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stress_snapshot_date" ON "stress_index_snapshots" USING btree ("snapshot_date");