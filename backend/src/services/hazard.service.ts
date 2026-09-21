import { db } from "../db";
import { lpplsResults, hazardRateLog, stressIndexSnapshots } from "../db/schema";
import { sql, desc } from "drizzle-orm";
import { LPPLSClient } from "./lppls.client";
import { redis } from "../redis";
import { ClockResponse } from "../types/api";

export class HazardSynthesisService {
  private lpplsClient = new LPPLSClient();

  /**
   * Synthesize hazard rate and cache it in Redis
   */
  public async synthesizeAndCacheHazard(): Promise<void> {
    try {
      console.log("Starting Hazard Synthesis...");

      // 1. Fetch composite price array using sql tagged template
      const pricesQuery = await db.execute<{ trade_date: string; total_price: string }>(sql`
        SELECT trade_date, SUM(adj_close) as total_price
        FROM daily_prices
        WHERE ticker IN ('MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'AAPL', 'AMD')
        GROUP BY trade_date
        ORDER BY trade_date ASC
      `);

      if (pricesQuery.rows.length < 100) {
        throw new Error("Insufficient historical data for LPPLS math engine (requires >= 100 days).");
      }

      // Take the last 500 days if there are more
      const recentRows = pricesQuery.rows.slice(-500);

      // 1. Map to the exact array of objects that LPPLSClient expects
      const payload = recentRows.map(r => ({
        trade_date: typeof r.trade_date === "string"
          ? r.trade_date
          : new Date(r.trade_date).toISOString().split("T")[0],
        adj_close: parseFloat(r.total_price)
      }));

      // 2. Call LPPLS Math Engine
      const lpplsResponse = await this.lpplsClient.solve(payload);

      // 3. Fetch latest stress score
      const latestStressSnapshot = await db
        .select()
        .from(stressIndexSnapshots)
        .orderBy(desc(stressIndexSnapshots.snapshotDate))
        .limit(1);

      if (latestStressSnapshot.length === 0) {
        throw new Error("No stress index snapshot found in DB. Cannot synthesize hazard.");
      }

      const stressScore = parseFloat(latestStressSnapshot[0].compositeScore as string);
      const stressSnapshotId = latestStressSnapshot[0].id;

      // 4. Compute Hazard Mathematics
      const today = new Date();
      const tcDateObj = this.convertDecimalYearToDate(lpplsResponse.tc);
      const daysToTc = (tcDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

      // T_prox = max(0, min(1, 1 - (days_to_tc / 730)))
      const tProx = Math.max(0, Math.min(1, 1 - (daysToTc / 730)));

      // H_raw = T_prox * (stress / 100)
      const hRaw = tProx * (stressScore / 100);

      // H_sigmoid = 1 / (1 + exp(-12 * (H_raw - 0.55)))
      const hSigmoid = 1 / (1 + Math.exp(-12 * (hRaw - 0.55)));

      // hoursToMidnight calculation (12-hour dial = 1,800 days)
      let hoursToMidnight = daysToTc / 150;
      hoursToMidnight = Math.max(0, Math.min(12, hoursToMidnight));

      // Apply hazard rate penalty
      hoursToMidnight = Math.max(0, hoursToMidnight - (hRaw * 10));

      // Overloading the minutesToMidnight variable to hold the new hours value
      const minutesToMidnight = hoursToMidnight;

      // 5. Persist to DB
      const windowStart = payload[0].trade_date;
      const windowEnd = payload[payload.length - 1].trade_date;

      // Insert LPPLS Result
      const [insertedLppls] = await db.insert(lpplsResults).values({
        runTimestamp: today,
        windowStart: windowStart,
        windowEnd: windowEnd,
        tc: lpplsResponse.tc,
        m: lpplsResponse.m,
        omega: lpplsResponse.omega,
        phi: lpplsResponse.phi,
        A: lpplsResponse.A,
        B: lpplsResponse.B,
        C1: lpplsResponse.C1,
        C2: lpplsResponse.C2,
        residualNorm: lpplsResponse.residual_norm,
        confidenceScore: lpplsResponse.confidence_score,
      }).returning({ id: lpplsResults.id });

      // Insert Hazard Log
      await db.insert(hazardRateLog).values({
        computedAt: today,
        tcValue: lpplsResponse.tc,
        stressScore: stressScore.toFixed(2),
        tProx: tProx.toFixed(6),
        rawHazard: hRaw.toFixed(6),
        sigmoidHazard: hSigmoid.toFixed(6),
        minutesToMidnight: minutesToMidnight.toFixed(2),
        dataQuality: "full",
        cachedUntil: new Date(today.getTime() + 86400 * 1000), // 24h
        lpplsResultId: insertedLppls.id,
        stressSnapshotId: stressSnapshotId,
      });

      // 6. Write to Redis
      const clockPayload: ClockResponse = {
        minutes_to_midnight: Number(minutesToMidnight.toFixed(2)),
        hazard_rate: Number(hSigmoid.toFixed(6)),
        tc_date: tcDateObj.toISOString(),
        tc_decimal: Number(lpplsResponse.tc.toFixed(6)),
        stress_score: Number(stressScore.toFixed(2)),
        data_quality: "full",
        last_updated: today.toISOString(),
        cache_ttl_seconds: 86400,
      };

      await redis.set("hazard:current", JSON.stringify(clockPayload), "EX", 86400);

      console.log(`Hazard Synthesis complete! Minutes to midnight: ${clockPayload.minutes_to_midnight}`);
    } catch (error) {
      console.error("Failed to synthesize hazard:", error);
      throw error;
    }
  }

  private convertDecimalYearToDate(decimalYear: number): Date {
    const year = Math.floor(decimalYear);
    const fraction = decimalYear - year;

    // Check if leap year
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;

    const dayOfYear = Math.floor(fraction * daysInYear);

    const date = new Date(Date.UTC(year, 0, 1)); // Jan 1st
    date.setUTCDate(date.getUTCDate() + dayOfYear);

    return date;
  }
}