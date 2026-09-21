import yf from "yahoo-finance2";
const YF = (yf as any).default || yf;
const yahooFinance = new YF({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
import { db } from "../db";
import { dailyPrices } from "../db/schema";
import { sql } from "drizzle-orm";

const AI_BASKET_TICKERS = ["MSFT", "NVDA", "GOOGL", "META", "AMZN", "AAPL", "AMD"];
const HISTORY_DAYS = 700;

export class IngestionService {
  public async ingestDailyPrices(): Promise<void> {
    const period1 = new Date();
    period1.setDate(period1.getDate() - HISTORY_DAYS);

    for (const ticker of AI_BASKET_TICKERS) {
      try {
        // Query historical with validateResult disabled if needed
        const results = (await yahooFinance.historical(
          ticker,
          {
            period1: period1,
            period2: new Date(),
            interval: "1d",
          },
          { validateResult: false }
        )) as any[];

        if (!results || results.length === 0) {
          console.warn(`No historical data found for ${ticker}`);
          continue;
        }

        const insertData = results.map((row: any) => ({
          ticker,
          tradeDate: (row.date instanceof Date ? row.date : new Date(row.date))
            .toISOString()
            .split("T")[0],
          open: row.open.toString(),
          high: row.high.toString(),
          low: row.low.toString(),
          close: row.close.toString(),
          adjClose: (row.adjClose ?? row.close).toString(),
          volume: Number(row.volume),
        }));

        await db
          .insert(dailyPrices)
          .values(insertData)
          .onConflictDoUpdate({
            target: [dailyPrices.ticker, dailyPrices.tradeDate],
            set: {
              open: sql`EXCLUDED.open`,
              high: sql`EXCLUDED.high`,
              low: sql`EXCLUDED.low`,
              close: sql`EXCLUDED.close`,
              adjClose: sql`EXCLUDED.adj_close`,
              volume: sql`EXCLUDED.volume`,
            },
          });

        console.log(`Successfully ingested ${insertData.length} records for ${ticker}`);
      } catch (error) {
        console.error(`Error ingesting data for ${ticker}:`, error);
        throw error;
      }
    }
  }
}