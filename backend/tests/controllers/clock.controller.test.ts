import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/index";
import { redis } from "../../src/redis";

// Mock Redis
vi.mock("../../src/redis", () => ({
  redis: {
    get: vi.fn(),
  },
}));

// Mock Scheduler so it doesn't run during tests
vi.mock("../../src/scheduler", () => ({
  initializeScheduler: vi.fn(),
}));

describe("Clock Controller - GET /api/v1/clock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 MISS when Redis is empty", async () => {
    (redis.get as any).mockResolvedValue(null);

    const response = await request(app).get("/api/v1/clock");

    expect(response.status).toBe(404);
    expect(response.headers["x-cache"]).toBe("MISS");
    expect(response.body).toEqual({ error: "Clock data not synthesized yet. Try again later." });
  });

  it("should return 200 HIT with valid ClockResponse data", async () => {
    const validData = {
      minutes_to_midnight: 15.5,
      hazard_rate: 0.258333,
      tc_date: "2027-07-02T00:00:00.000Z",
      tc_decimal: 2027.5,
      stress_score: 85.5,
      data_quality: "full",
      last_updated: new Date().toISOString(),
      cache_ttl_seconds: 86400,
    };

    (redis.get as any).mockResolvedValue(JSON.stringify(validData));

    const response = await request(app).get("/api/v1/clock");

    expect(response.status).toBe(200);
    expect(response.headers["x-cache"]).toBe("HIT");
    expect(response.body).toEqual(validData);
  });

  it("should return 500 if Redis data fails validation", async () => {
    const invalidData = {
      minutes_to_midnight: "this_should_be_number",
    };

    (redis.get as any).mockResolvedValue(JSON.stringify(invalidData));

    const response = await request(app).get("/api/v1/clock");

    expect(response.status).toBe(500); // Validation fails in controller and caught by try/catch
    expect(response.body).toEqual({ error: "Internal Server Error serving clock data" });
  });
});
