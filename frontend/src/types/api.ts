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
