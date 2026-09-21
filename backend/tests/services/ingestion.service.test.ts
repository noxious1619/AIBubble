import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngestionService } from "../../src/services/ingestion.service";
import yahooFinance from "yahoo-finance2";
import { db } from "../../src/db";

// Mock external dependencies
vi.mock("yahoo-finance2", () => ({
  default: {
    historical: vi.fn(),
  },
}));

// Mock DB
vi.mock("../../src/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  },
}));

describe("IngestionService", () => {
  let ingestionService: IngestionService;

  beforeEach(() => {
    ingestionService = new IngestionService();
    vi.clearAllMocks();
  });

  it("should fetch data from yahoo-finance2 and upsert it into the database", async () => {
    const mockHistoricalData = [
      {
        date: new Date("2024-01-01T00:00:00Z"),
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        adjClose: 102,
        volume: 10000,
      },
    ];

    // Mock yahooFinance to return data for MSFT and nothing for the rest
    (yahooFinance.historical as any).mockImplementation(async (ticker: string) => {
      if (ticker === "MSFT") return mockHistoricalData;
      return [];
    });

    await ingestionService.ingestDailyPrices();

    // Verify yahooFinance was called for the 7 tickers
    expect(yahooFinance.historical).toHaveBeenCalledTimes(7);
    
    // Verify db.insert was called for the ticker that had data (MSFT)
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.values).toHaveBeenCalledWith([
      {
        ticker: "MSFT",
        tradeDate: "2024-01-01",
        open: "100",
        high: "105",
        low: "95",
        close: "102",
        adjClose: "102",
        volume: 10000,
      },
    ]);
    expect(db.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});
