export interface AnalyticsHistoryItem {
  date: string;
  minutes_to_midnight: number;
  stress_score: number;
  tc_decimal: number;
}

export interface LPPLSCoefficients {
  tc: number;
  m: number;
  omega: number;
  phi: number;
  A: number;
  B: number;
  C1: number;
  C2: number;
  confidence_score: number;
}

export interface HazardSynthesisMetrics {
  t_prox: number;
  raw_hazard: number;
  sigmoid_hazard: number;
}

export interface StressIndexComponents {
  forward_pe_score: number;
  hhi_score: number;
  correlation_score: number;
  capex_deficit_score: number;
  composite_score: number;
}

export interface AnalyticsResponse {
  history: AnalyticsHistoryItem[];
  latest_lppls: LPPLSCoefficients | null;
  latest_hazard: HazardSynthesisMetrics | null;
  latest_stress: StressIndexComponents | null;
}
