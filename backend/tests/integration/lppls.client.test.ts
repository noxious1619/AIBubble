import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { LPPLSClient } from "../../src/services/lppls.client";
import { UpstreamError } from "../../src/errors/UpstreamError";

describe("LPPLSClient Integration", () => {
  let client: LPPLSClient;
  let mock: MockAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, PYTHON_ENGINE_URL: "http://localhost:8000" };
    client = new LPPLSClient();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
    process.env = originalEnv;
  });

  const mockRows = Array.from({ length: 150 }).map((_, i) => ({
    trade_date: `2024-01-${String((i % 31) + 1).padStart(2, "0")}`,
    adj_close: 100 + i * 0.5,
  }));

  const mockValidResponse = {
    tc: 2027.19178,
    m: 0.4823,
    omega: 9.7341,
    phi: 1.2094,
    A: 14823.4412,
    B: -892.55133,
    C1: -412.330821,
    C2: 201.882047,
    residual_norm: 0.0034182,
    confidence_score: 0.9312,
  };

  it("should successfully parse and return typed output on a valid 200 response", async () => {
    mock.onPost("http://localhost:8000/solve").reply(200, mockValidResponse);

    const result = await client.solve(mockRows);

    expect(result).toEqual(mockValidResponse);
  });

  it("should throw an UpstreamError with timeout code if request exceeds 30 seconds", async () => {
    mock.onPost("http://localhost:8000/solve").timeout();

    await expect(client.solve(mockRows)).rejects.toThrow(UpstreamError);
    await expect(client.solve(mockRows)).rejects.toHaveProperty("code", "TIMEOUT_ERROR");
  });

  it("should throw an UpstreamError if response fails Zod validation", async () => {
    const invalidResponse = {
      ...mockValidResponse,
      confidence_score: "this_should_be_a_number", // Invalid type
    };

    mock.onPost("http://localhost:8000/solve").reply(200, invalidResponse);

    await expect(client.solve(mockRows)).rejects.toThrow(UpstreamError);
    await expect(client.solve(mockRows)).rejects.toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("should throw an UpstreamError on HTTP 500 error", async () => {
    mock.onPost("http://localhost:8000/solve").reply(500, { detail: "Internal Server Error" });

    await expect(client.solve(mockRows)).rejects.toThrow(UpstreamError);
    await expect(client.solve(mockRows)).rejects.toHaveProperty("code", "HTTP_ERROR");
  });
});
