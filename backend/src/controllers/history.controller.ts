import { Router, Request, Response, NextFunction } from "express";
import { HistoryQuery, HistoryResponse } from "../types/api";

const router = Router();

router.get(
  "/",
  async (
    req: Request<{}, {}, {}, HistoryQuery>,
    res: Response<HistoryResponse>,
    next: NextFunction
  ) => {
    // TODO: Implement GET /api/v1/history logic
    // Extract req.query.range, query hazard_rate_log, map to HistoryResponse schema
  }
);

export default router;
