import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../../src/index";
import { IngestionService } from "../../src/services/ingestion.service";
import { StressIndexService } from "../../src/services/stress-index.service";

// Mock the services so we don't actually run DB operations
vi.mock("../../src/services/ingestion.service");
vi.mock("../../src/services/stress-index.service");

describe("Admin Controller - POST /api/v1/admin/trigger-pipeline", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INTERNAL_API_SECRET: "test_secret_123",
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 401 if Authorization header is missing", async () => {
    const response = await request(app).post("/api/v1/admin/trigger-pipeline").send({ type: "daily" });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it("should return 401 if Authorization token is incorrect", async () => {
    const response = await request(app)
      .post("/api/v1/admin/trigger-pipeline")
      .set("Authorization", "Bearer wrong_token")
      .send({ type: "daily" });
    
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("should return 202 and trigger pipeline if token is correct", async () => {
    const response = await request(app)
      .post("/api/v1/admin/trigger-pipeline")
      .set("Authorization", "Bearer test_secret_123")
      .send({ type: "daily" });
    
    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty("job_id");
    expect(response.body).toHaveProperty("status", "queued");
    expect(response.body).toHaveProperty("type", "daily");
    expect(response.body).toHaveProperty("queued_at");

    // We wait a tiny bit to allow the async background task to be called in the event loop
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(IngestionService.prototype.ingestDailyPrices).toHaveBeenCalledTimes(1);
    expect(StressIndexService.prototype.calculateAndPersistStressIndex).toHaveBeenCalledTimes(1);
  });
});
