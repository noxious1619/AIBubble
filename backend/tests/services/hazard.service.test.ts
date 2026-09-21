import { describe, it, expect, vi, beforeEach } from "vitest";
import { HazardSynthesisService } from "../../src/services/hazard.service";
import { LPPLSClient } from "../../src/services/lppls.client";
import { db } from "../../src/db";
import { redis } from "../../src/redis";

// Mock DB
vi.mock("../../src/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

// Mock Redis
vi.mock("../../src/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

// Mock LPPLS Client
vi.mock("../../src/services/lppls.client", () => {
  return {
    LPPLSClient: vi.fn().mockImplementation(() => ({
      solve: vi.fn().mockResolvedValue({
        tc: 2027.5,
        m: 0.5,
        omega: 10,
        phi: 1,
        A: 100,
        B: -10,
        C1: 5,
        C2: -5,
        residual_norm: 0.01,
        confidence_score: 0.95,
      }),
    })),
  };
});

describe("HazardSynthesisService", () => {
  let hazardService: HazardSynthesisService;

  beforeEach(() => {
    vi.clearAllMocks();
    hazardService = new HazardSynthesisService();
  });

  it("should synthesize hazard correctly and cache in Redis", async () => {
    // Mock the DB returning 100 fake prices
    const mockPrices = Array.from({ length: 150 }).map((_, i) => ({
      trade_date: `2024-01-${String((i % 31) + 1).padStart(2, "0")}`,
      total_price: "1000.0",
    }));

    (db.execute as any).mockResolvedValue({ rows: mockPrices });

    (db.limit as any).mockResolvedValue([
      { id: 1, compositeScore: "100.00" }, // 100 stress score
    ]);

    (db.returning as any).mockResolvedValue([{ id: 1 }]);

    await hazardService.synthesizeAndCacheHazard();

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(2); // once for lppls_results, once for hazard_rate_log

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      "hazard:current",
      expect.any(String),
      "EX",
      86400
    );

    // Let's verify the payload math indirectly by checking what was sent to Redis
    const redisCall = (redis.set as any).mock.calls[0];
    const payload = JSON.parse(redisCall[1]);
    
    // We mocked tc = 2027.5, which is ~2027-07-02
    expect(payload.tc_decimal).toBe(2027.5);
    expect(payload.stress_score).toBe(100);
    // 12-hour macro cycle math means hours to midnight should be >= 0 and <= 12
    expect(payload.minutes_to_midnight).toBeGreaterThanOrEqual(0);
    expect(payload.minutes_to_midnight).toBeLessThanOrEqual(12);
    expect(payload).toHaveProperty("hazard_rate");
  });

  it("should throw error if not enough historical data", async () => {
    (db.execute as any).mockResolvedValue({ rows: [] });

    await expect(hazardService.synthesizeAndCacheHazard()).rejects.toThrow("Insufficient historical data");
  });
});
