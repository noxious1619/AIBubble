import { Router, Request, Response, NextFunction } from "express";
import { ModelResponse } from "../types/api";

const router = Router();

router.get("/", async (req: Request, res: Response<ModelResponse>, next: NextFunction) => {
  // TODO: Implement GET /api/v1/model logic
  // Read from PostgreSQL, map to ModelResponse schema
});

export default router;
