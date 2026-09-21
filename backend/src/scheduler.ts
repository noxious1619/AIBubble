import cron from "node-cron";
import { IngestionService } from "./services/ingestion.service";
import { StressIndexService } from "./services/stress-index.service";
import { HazardSynthesisService } from "./services/hazard.service";

export function initializeScheduler() {
  if (process.env.CRON_ENABLED !== "true") {
    console.log("Cron scheduler is disabled via CRON_ENABLED.");
    return;
  }

  // 0 17 * * 1-5 (Weekdays at 17:00 / 5 PM)
  cron.schedule("0 17 * * 1-5", async () => {
    console.log("[Cron] Starting automated daily pipeline...");
    try {
      const ingestionService = new IngestionService();
      await ingestionService.ingestDailyPrices();

      const stressIndexService = new StressIndexService();
      await stressIndexService.calculateAndPersistStressIndex();

      const hazardService = new HazardSynthesisService();
      await hazardService.synthesizeAndCacheHazard();

      console.log("[Cron] Daily pipeline completed successfully.");
    } catch (error) {
      console.error("[Cron] Daily pipeline failed:", error);
    }
  }, {
    timezone: "UTC" // Explicitly define timezone if needed
  });

  console.log("Cron scheduler initialized: 0 17 * * 1-5");
}
