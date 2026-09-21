import { useQuery } from "@tanstack/react-query";
import { AnalyticsResponse } from "../types/analytics";

const fetchAnalyticsData = async (): Promise<AnalyticsResponse> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/v1/analytics/history`);
  
  if (!res.ok) {
    if (res.status === 404) {
      return { history: [], latest_lppls: null, latest_hazard: null, latest_stress: null };
    }
    throw new Error("Failed to fetch analytics history");
  }

  const data = await res.json();
  return data as AnalyticsResponse;
};

export function useAnalyticsData() {
  return useQuery<AnalyticsResponse, Error>({
    queryKey: ["analytics-history"],
    queryFn: fetchAnalyticsData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
