import { Router, Request, Response } from "express";
import { db } from "../db";
import { hazardRateLog, lpplsResults, stressIndexSnapshots } from "../db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/history", async (req: Request, res: Response) => {
  try {
    const records = await db
      .select({
        date: hazardRateLog.computedAt,
        minutes_to_midnight: hazardRateLog.minutesToMidnight,
        stress_score: hazardRateLog.stressScore,
        tc_value: hazardRateLog.tcValue,
        t_prox: hazardRateLog.tProx,
        raw_hazard: hazardRateLog.rawHazard,
        sigmoid_hazard: hazardRateLog.sigmoidHazard,
        lppls: {
          tc: lpplsResults.tc,
          m: lpplsResults.m,
          omega: lpplsResults.omega,
          phi: lpplsResults.phi,
          A: lpplsResults.A,
          B: lpplsResults.B,
          C1: lpplsResults.C1,
          C2: lpplsResults.C2,
          confidence_score: lpplsResults.confidenceScore,
        },
        stress: {
          forward_pe_score: stressIndexSnapshots.forwardPeScore,
          hhi_score: stressIndexSnapshots.hhiScore,
          correlation_score: stressIndexSnapshots.correlationScore,
          capex_deficit_score: stressIndexSnapshots.capexDeficitScore,
          composite_score: stressIndexSnapshots.compositeScore,
        },
      })
      .from(hazardRateLog)
      .leftJoin(lpplsResults, eq(hazardRateLog.lpplsResultId, lpplsResults.id))
      .leftJoin(stressIndexSnapshots, eq(hazardRateLog.stressSnapshotId, stressIndexSnapshots.id))
      .orderBy(desc(hazardRateLog.computedAt))
      .limit(30);

    if (!records || records.length === 0) {
      return res.status(404).json({ error: "No historical data available." });
    }

    const history = records
      .map((r) => ({
        date: r.date.toISOString(),
        minutes_to_midnight: parseFloat(r.minutes_to_midnight as string),
        stress_score: parseFloat(r.stress_score as string),
        tc_decimal: r.tc_value,
      }))
      .reverse();

    const latest = records[0];
    const latest_lppls = latest.lppls?.tc != null ? latest.lppls : null;

    const latest_hazard = latest.t_prox != null ? {
      t_prox: parseFloat(latest.t_prox as string),
      raw_hazard: parseFloat(latest.raw_hazard as string),
      sigmoid_hazard: parseFloat(latest.sigmoid_hazard as string),
    } : null;

    const latest_stress = latest.stress?.composite_score != null ? {
      forward_pe_score: parseFloat(latest.stress.forward_pe_score as string),
      hhi_score: parseFloat(latest.stress.hhi_score as string),
      correlation_score: parseFloat(latest.stress.correlation_score as string),
      capex_deficit_score: parseFloat(latest.stress.capex_deficit_score as string),
      composite_score: parseFloat(latest.stress.composite_score as string),
    } : null;

    return res.status(200).json({ history, latest_lppls, latest_hazard, latest_stress });
  } catch (error) {
    console.error("Failed to fetch analytics history:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
