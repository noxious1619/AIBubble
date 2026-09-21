import {
  pgTable,
  bigserial,
  varchar,
  date,
  numeric,
  bigint,
  timestamp,
  text,
  doublePrecision,
  primaryKey,
  check,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const dailyPrices = pgTable(
  "daily_prices",
  {
    ticker: varchar("ticker", { length: 10 }).notNull(),
    tradeDate: date("trade_date").notNull(),
    open: numeric("open", { precision: 12, scale: 4 }).notNull(),
    high: numeric("high", { precision: 12, scale: 4 }).notNull(),
    low: numeric("low", { precision: 12, scale: 4 }).notNull(),
    close: numeric("close", { precision: 12, scale: 4 }).notNull(),
    adjClose: numeric("adj_close", { precision: 12, scale: 4 }).notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
    marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ticker, t.tradeDate] }),
    idxTickerDateDesc: index("idx_daily_prices_ticker_date").on(
      t.ticker,
      t.tradeDate
    ),
  })
);

export const fundamentalData = pgTable(
  "fundamental_data",
  {
    ticker: varchar("ticker", { length: 10 }).notNull(),
    fiscalQuarter: varchar("fiscal_quarter", { length: 6 }).notNull(),
    filingDate: date("filing_date").notNull(),
    capexTtm: numeric("capex_ttm", { precision: 20, scale: 2 }).notNull(),
    aiRevenueTtm: numeric("ai_revenue_ttm", { precision: 20, scale: 2 }),
    forwardPe: numeric("forward_pe", { precision: 10, scale: 4 }),
    sourceUrl: text("source_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ticker, t.fiscalQuarter] }),
    idxTickerFilingDateDesc: index("idx_fundamental_ticker_date").on(
      t.ticker,
      t.filingDate
    ),
  })
);

export const lpplsResults = pgTable(
  "lppls_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runTimestamp: timestamp("run_timestamp", { withTimezone: true }).notNull(),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    tc: doublePrecision("tc").notNull(),
    m: doublePrecision("m").notNull(),
    omega: doublePrecision("omega").notNull(),
    phi: doublePrecision("phi").notNull(),
    A: doublePrecision("A").notNull(),
    B: doublePrecision("B").notNull(),
    C1: doublePrecision("C1").notNull(),
    C2: doublePrecision("C2").notNull(),
    residualNorm: doublePrecision("residual_norm").notNull(),
    confidenceScore: doublePrecision("confidence_score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    idxRunTimestamp: index("idx_lppls_run_timestamp").on(t.runTimestamp),
    chkLpplsM: check("chk_lppls_m", sql`${t.m} > 0.1 AND ${t.m} < 0.9`),
    chkLpplsOmega: check("chk_lppls_omega", sql`${t.omega} > 4.0 AND ${t.omega} < 25.0`),
    chkLpplsB: check("chk_lppls_B", sql`${t.B} < 0.0`),
    chkLpplsA: check("chk_lppls_A", sql`${t.A} > 0.0`),
    chkLpplsConf: check(
      "chk_lppls_conf",
      sql`${t.confidenceScore} >= 0.0 AND ${t.confidenceScore} <= 1.0`
    ),
  })
);

export const stressIndexSnapshots = pgTable(
  "stress_index_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    snapshotDate: date("snapshot_date").notNull().unique(),
    forwardPeScore: numeric("forward_pe_score", { precision: 6, scale: 2 }).notNull(),
    hhiScore: numeric("hhi_score", { precision: 6, scale: 2 }).notNull(),
    correlationScore: numeric("correlation_score", { precision: 6, scale: 2 }).notNull(),
    capexDeficitScore: numeric("capex_deficit_score", { precision: 6, scale: 2 }).notNull(),
    compositeScore: numeric("composite_score", { precision: 6, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    idxSnapshotDate: index("idx_stress_snapshot_date").on(t.snapshotDate),
    chkStressPe: check("chk_stress_pe", sql`${t.forwardPeScore} >= 0 AND ${t.forwardPeScore} <= 100`),
    chkStressHhi: check("chk_stress_hhi", sql`${t.hhiScore} >= 0 AND ${t.hhiScore} <= 100`),
    chkStressCorr: check("chk_stress_corr", sql`${t.correlationScore} >= 0 AND ${t.correlationScore} <= 100`),
    chkStressCapex: check("chk_stress_capex", sql`${t.capexDeficitScore} >= 0 AND ${t.capexDeficitScore} <= 100`),
    chkStressComp: check("chk_stress_comp", sql`${t.compositeScore} >= 0 AND ${t.compositeScore} <= 100`),
  })
);

export const hazardRateLog = pgTable(
  "hazard_rate_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    tcValue: doublePrecision("tc_value").notNull(),
    stressScore: numeric("stress_score", { precision: 6, scale: 2 }).notNull(),
    tProx: numeric("t_prox", { precision: 8, scale: 6 }).notNull(),
    rawHazard: numeric("raw_hazard", { precision: 8, scale: 6 }).notNull(),
    sigmoidHazard: numeric("sigmoid_hazard", { precision: 8, scale: 6 }).notNull(),
    minutesToMidnight: numeric("minutes_to_midnight", { precision: 6, scale: 2 }).notNull(),
    dataQuality: varchar("data_quality", { length: 20 }).default("full").notNull(),
    cachedUntil: timestamp("cached_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lpplsResultId: bigint("lppls_result_id", { mode: "number" }).references(() => lpplsResults.id),
    stressSnapshotId: bigint("stress_snapshot_id", { mode: "number" }).references(() => stressIndexSnapshots.id),
  },
  (t) => ({
    idxComputedAt: index("idx_hazard_computed_at").on(t.computedAt),
  })
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
    headline: text("headline").notNull(),
    hazardDelta: numeric("hazard_delta", { precision: 6, scale: 2 }),
    category: varchar("category", { length: 30 }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    idxEventTime: index("idx_events_time").on(t.eventTime),
    idxCategory: index("idx_events_category").on(t.category),
  })
);



export const lpplsResultsRelations = relations(lpplsResults, ({ many }) => ({
  hazardRateLogs: many(hazardRateLog),
}));

export const stressIndexSnapshotsRelations = relations(stressIndexSnapshots, ({ many }) => ({
  hazardRateLogs: many(hazardRateLog),
}));

export const hazardRateLogRelations = relations(hazardRateLog, ({ one }) => ({
  lpplsResult: one(lpplsResults, {
    fields: [hazardRateLog.lpplsResultId],
    references: [lpplsResults.id],
  }),
  stressSnapshot: one(stressIndexSnapshots, {
    fields: [hazardRateLog.stressSnapshotId],
    references: [stressIndexSnapshots.id],
  }),
}));
