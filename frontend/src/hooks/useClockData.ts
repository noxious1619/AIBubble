import { useQuery } from "@tanstack/react-query";
import { ClockResponseSchema, ClockResponse } from "../types/api";

const fetchClockData = async (): Promise<ClockResponse | null> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/v1/clock`);
  
  if (res.status === 404) {
    // Pipeline not run yet
    return null;
  }
  
  if (!res.ok) {
    throw new Error("Failed to fetch clock data");
  }

  const data = await res.json();
  return ClockResponseSchema.parse(data);
};

export function useClockData() {
  return useQuery<ClockResponse | null, Error>({
    queryKey: ["clock-data"],
    queryFn: fetchClockData,
    refetchInterval: 60000, // Poll every 60 seconds
  });
}
