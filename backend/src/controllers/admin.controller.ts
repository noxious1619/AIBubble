import { Router, Request, Response } from "express";
import {
  AdminTriggerPipelineRequest,
  AdminTriggerPipelineResponse,
} from "../types/api";
import { IngestionService } from "../services/ingestion.service";
import { StressIndexService } from "../services/stress-index.service";
import { HazardSynthesisService } from "../services/hazard.service";

const router = Router();
const ingestionService = new IngestionService();
const stressIndexService = new StressIndexService();
const hazardService = new HazardSynthesisService();

router.post(
  "/trigger-pipeline",
  (
    req: Request<{}, {}, AdminTriggerPipelineRequest>,
    res: Response<AdminTriggerPipelineResponse | { error: string }>
  ) => {
    // Validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    if (token !== process.env.INTERNAL_API_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Start background execution asynchronously
    // Wrap in try/catch to ensure pipeline does not fail silently
    (async () => {
      try {
        console.log(`[Job ${jobId}] Starting ingestion pipeline...`);
        await ingestionService.ingestDailyPrices();
        
        console.log(`[Job ${jobId}] Starting stress index calculation...`);
        await stressIndexService.calculateAndPersistStressIndex();
        
        console.log(`[Job ${jobId}] Starting hazard synthesis...`);
        await hazardService.synthesizeAndCacheHazard();
        
        console.log(`[Job ${jobId}] Pipeline executed successfully.`);
      } catch (error) {
        console.error(`[Job ${jobId}] Pipeline execution failed:`, error);
      }
    })();

    // Respond immediately per plan
    const responseBody: AdminTriggerPipelineResponse = {
      job_id: jobId,
      type: req.body.type || "daily",
      status: "queued",
      queued_at: new Date().toISOString(),
    };

    return res.status(202).json(responseBody);
  }
);

export default router;
