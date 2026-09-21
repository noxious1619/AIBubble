import axios, { AxiosError } from "axios";
import { ZodError } from "zod";
import {
  PythonSolveResponse,
  PythonSolveResponseSchema,
} from "../types/api";
import { UpstreamError } from "../errors/UpstreamError";

export class LPPLSClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PYTHON_ENGINE_URL || "http://python-engine:8000";
  }

  /**
   * Sends raw daily price rows to the Python engine to solve for LPPLS parameters.
   *
   * @param rows Array of objects containing trade_date and adj_close
   * @returns The fitted LPPLS parameters validated through Zod
   * @throws UpstreamError on network failure, timeout, or invalid response schema
   */
  public async solve(
    rows: { trade_date: string; adj_close: number }[]
  ): Promise<PythonSolveResponse> {
    const prices: number[] = [];
    const dates: string[] = [];

    for (const row of rows) {
      prices.push(row.adj_close);
      // Assuming trade_date is a valid ISO string or can be extracted.
      // Drizzle might return Date objects or strings depending on configuration.
      const dateStr =
        typeof row.trade_date === "string"
          ? row.trade_date
          : (row.trade_date as Date).toISOString().split("T")[0];
      dates.push(dateStr);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/solve`,
        { prices, dates },
        { timeout: 30000 } // 30-second strict timeout
      );

      // Validate the response using Zod
      const parsedData = PythonSolveResponseSchema.parse(response.data);
      return parsedData;
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === "ZodError") {
        throw new UpstreamError(
          "Invalid response schema from Python engine.",
          error,
          "VALIDATION_ERROR"
        );
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const code = axiosError.code;
        const message = axiosError.message || "";
        
        // Handle timeouts explicitly
        if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ERR_CANCELED" || message.toLowerCase().includes("timeout")) {
          throw new UpstreamError(
            "Python engine request timed out after 30 seconds.",
            error,
            "TIMEOUT_ERROR"
          );
        }

        throw new UpstreamError(
          `Python engine responded with error: ${message}`,
          error,
          "HTTP_ERROR"
        );
      }

      throw new UpstreamError(
        "An unexpected error occurred while communicating with the Python engine.",
        error,
        "UNKNOWN_ERROR"
      );
    }
  }
}
