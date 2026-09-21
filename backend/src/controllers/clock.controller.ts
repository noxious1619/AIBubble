import { Router, Request, Response } from "express";
import { redis } from "../redis";
import { ClockResponseSchema, ClockResponse } from "../types/api";

import { db } from "../db";
import { hazardRateLog } from "../db/schema";
import { desc } from "drizzle-orm";

function convertDecimalYearToDate(decimalYear: number): Date {
  const year = Math.floor(decimalYear);
  const fraction = decimalYear - year;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInYear = isLeap ? 366 : 365;
  const dayOfYear = Math.floor(fraction * daysInYear);
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + dayOfYear);
  return date;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const cachedData = await redis.get("hazard:current");

    if (!cachedData) {
      res.setHeader("X-Cache", "MISS");
      
      const records = await db
        .select()
        .from(hazardRateLog)
        .orderBy(desc(hazardRateLog.computedAt))
        .limit(1);

      if (records.length === 0) {
        return res.status(404).json({ error: "Clock data not synthesized yet. Try again later." });
      }

      const latest = records[0];
      const tcDateObj = convertDecimalYearToDate(latest.tcValue);

      const clockPayload: ClockResponse = {
        minutes_to_midnight: Number(parseFloat(latest.minutesToMidnight as string).toFixed(2)),
        hazard_rate: Number(parseFloat(latest.sigmoidHazard as string).toFixed(6)),
        tc_date: tcDateObj.toISOString(),
        tc_decimal: Number(latest.tcValue.toFixed(6)),
        stress_score: Number(parseFloat(latest.stressScore as string).toFixed(2)),
        data_quality: latest.dataQuality as "full" | "degraded" | "stale",
        last_updated: latest.computedAt.toISOString(),
        cache_ttl_seconds: 86400,
      };

      await redis.set("hazard:current", JSON.stringify(clockPayload), "EX", 86400);

      const validatedResponse = ClockResponseSchema.parse(clockPayload);
      return res.status(200).json(validatedResponse);
    }

    const parsedData = JSON.parse(cachedData);
    
    // Validate output shape before sending
    const validatedResponse = ClockResponseSchema.parse(parsedData);

    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(validatedResponse);
  } catch (error) {
    console.error("Clock API Error:", error);
    return res.status(500).json({ error: "Internal Server Error serving clock data" });
  }
});

export default router;
