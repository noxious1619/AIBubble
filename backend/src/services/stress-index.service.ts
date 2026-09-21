import { db } from "../db";
import { stressIndexSnapshots } from "../db/schema";
import { sql } from "drizzle-orm";

export class StressIndexService {
  /**
   * Calculates fundamental stress sub-scores and composite, UPSERTing them.
   */
  public async calculateAndPersistStressIndex(): Promise<void> {
    try {
      // 1. Calculate / Retrieve sub-scores
      // For Vertical Slice 2, we use deterministic stubs to establish the pipeline
      const forwardPeScore = this.calculateForwardPeScore();
      const hhiScore = this.calculateHhiScore();
      const correlationScore = this.calculateCorrelationScore();
      const capexDeficitScore = this.calculateCapexDeficitScore();

      // 2. Composite score (25% weight each)
      const compositeScore =
        forwardPeScore * 0.25 +
        hhiScore * 0.25 +
        correlationScore * 0.25 +
        capexDeficitScore * 0.25;

      const snapshotDate = new Date().toISOString().split("T")[0];

      // 3. Persist to DB
      await db
        .insert(stressIndexSnapshots)
        .values({
          snapshotDate,
          forwardPeScore: forwardPeScore.toFixed(2),
          hhiScore: hhiScore.toFixed(2),
          correlationScore: correlationScore.toFixed(2),
          capexDeficitScore: capexDeficitScore.toFixed(2),
          compositeScore: compositeScore.toFixed(2),
        })
        .onConflictDoUpdate({
          target: [stressIndexSnapshots.snapshotDate],
          set: {
            forwardPeScore: sql`EXCLUDED.forward_pe_score`,
            hhiScore: sql`EXCLUDED.hhi_score`,
            correlationScore: sql`EXCLUDED.correlation_score`,
            capexDeficitScore: sql`EXCLUDED.capex_deficit_score`,
            compositeScore: sql`EXCLUDED.composite_score`,
            createdAt: sql`NOW()`, // refresh the timestamp on update
          },
        });

      console.log(`Successfully persisted stress index snapshot for ${snapshotDate} with composite score: ${compositeScore.toFixed(2)}`);
    } catch (error) {
      console.error("Error calculating stress index:", error);
      throw error;
    }
  }

  // Stubs for Vertical Slice 2
  private calculateForwardPeScore(): number {
    return 65.5; // Example high P/E stress
  }

  private calculateHhiScore(): number {
    return 82.0; // High concentration
  }

  private calculateCorrelationScore(): number {
    return 90.5; // High correlation indicating fragility
  }

  private calculateCapexDeficitScore(): number {
    return 45.0; // Moderate capex deficit
  }
}
