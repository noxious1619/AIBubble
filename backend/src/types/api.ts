import { z } from "zod";

export const ClockResponseSchema = z.object({
  minutes_to_midnight: z.number().min(0).max(60),
  hazard_rate: z.number().min(0).max(1),
  tc_date: z.string(),
  tc_decimal: z.number(),
  stress_score: z.number().min(0).max(100),
  data_quality: z.enum(["full", "degraded", "stale"]),
  last_updated: z.string(),
  cache_ttl_seconds: z.number(),
});

export type ClockResponse = z.infer<typeof ClockResponseSchema>;

export const ModelResponseSchema = z.object({
  lppls: z.object({
    tc: z.number(),
    tc_date: z.string(),
    m: z.number(),
    omega: z.number(),
    phi: z.number(),
    A: z.number(),
    B: z.number(),
    C1: z.number(),
    C2: z.number(),
    residual_norm: z.number(),
    confidence_score: z.number(),
    window_start: z.string(),
    window_end: z.string(),
    run_timestamp: z.string(),
  }),
  stress: z.object({
    composite_score: z.number(),
    weights: z.object({
      forward_pe: z.number(),
      hhi: z.number(),
      correlation: z.number(),
      capex_deficit: z.number(),
    }),
    components: z.object({
      forward_pe: z.object({
        score: z.number(),
        current_pe: z.number(),
        fair_value_pe: z.number(),
        max_hist_pe: z.number(),
        formula: z.string(),
      }),
      hhi: z.object({
        score: z.number(),
        current_hhi: z.number(),
        min_hhi: z.number(),
        max_hhi: z.number(),
        formula: z.string(),
      }),
      correlation: z.object({
        score: z.number(),
        mean_rho: z.number(),
        window_days: z.number(),
        formula: z.string(),
      }),
      capex_deficit: z.object({
        score: z.number(),
        deficit_ratio: z.number(),
        baseline: z.number(),
        max_ratio: z.number(),
        formula: z.string(),
      }),
    }),
    snapshot_date: z.string(),
  }),
  hazard: z.object({
    t_prox: z.number(),
    raw_hazard: z.number(),
    sigmoid_k: z.number(),
    sigmoid_h0: z.number(),
    sigmoid_hazard: z.number(),
    minutes_to_midnight: z.number(),
    computed_at: z.string(),
  }),
  data_sources: z.object({
    price_data: z.string(),
    fundamental_data: z.array(
      z.object({
        ticker: z.string(),
        fiscal_quarter: z.string(),
        source_url: z.string(),
      })
    ),
    price_data_through: z.string(),
    fundamental_data_as_of: z.string(),
  }),
});

export type ModelResponse = z.infer<typeof ModelResponseSchema>;

export const HistoryQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
});

export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

export const HistoryResponseSchema = z.object({
  range: z.string(),
  data: z.array(
    z.object({
      date: z.string(),
      minutes_to_midnight: z.number(),
      stress_score: z.number(),
      tc_date: z.string(),
    })
  ),
  meta: z.object({
    count: z.number(),
    earliest: z.string(),
    latest: z.string(),
  }),
});

export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;

export const AdminTriggerPipelineRequestSchema = z.object({
  type: z.enum(["daily", "quarterly"]),
  force_recalculate: z.boolean(),
});

export type AdminTriggerPipelineRequest = z.infer<
  typeof AdminTriggerPipelineRequestSchema
>;

export const AdminTriggerPipelineHeadersSchema = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export type AdminTriggerPipelineHeaders = z.infer<
  typeof AdminTriggerPipelineHeadersSchema
>;

export const AdminTriggerPipelineResponseSchema = z.object({
  job_id: z.string(),
  type: z.string(),
  status: z.string(),
  queued_at: z.string(),
});

export type AdminTriggerPipelineResponse = z.infer<
  typeof AdminTriggerPipelineResponseSchema
>;

export const PythonSolveRequestSchema = z
  .object({
    prices: z.array(z.number().positive()).min(100).max(2000),
    dates: z.array(z.string()).min(100).max(2000),
  })
  .refine((data) => data.prices.length === data.dates.length, {
    message: "Prices and dates arrays must be of equal length",
    path: ["dates"],
  });

export type PythonSolveRequest = z.infer<typeof PythonSolveRequestSchema>;

export const PythonSolveResponseSchema = z.object({
  tc: z.number(),
  m: z.number(),
  omega: z.number(),
  phi: z.number(),
  A: z.number(),
  B: z.number(),
  C1: z.number(),
  C2: z.number(),
  residual_norm: z.number(),
  confidence_score: z.number(),
});

export type PythonSolveResponse = z.infer<typeof PythonSolveResponseSchema>;
