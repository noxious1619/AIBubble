"use client";

import { useState, useEffect } from "react";
import { useAnalyticsData } from "../hooks/useAnalyticsData";
import { X, Download, Terminal } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AnalyticsDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useAnalyticsData();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const exportToCsv = () => {
    if (!data || data.history.length === 0) return;

    const headers = "date,minutes_to_midnight,stress_score,tc_decimal\n";
    const csvContent = data.history
      .map(
        (row) =>
          `${row.date},${row.minutes_to_midnight},${row.stress_score},${row.tc_decimal}`
      )
      .join("\n");

    const blob = new Blob([headers + csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "doomsday-history.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[500px] bg-card border-l border-gray-800 z-50 transform transition-transform duration-300 ease-in-out font-mono flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-2 text-secondary">
            <Terminal className="w-5 h-5" />
            <h2 className="uppercase tracking-widest font-bold text-sm">
              Terminal / Analytics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="p-6 text-text-muted animate-pulse">Loading data...</div>
          ) : !data || data.history.length === 0 ? (
            <div className="p-6 text-text-muted">No historical data available.</div>
          ) : (
            <>
              {/* Sticky Chart Section */}
              <section className="shrink-0 p-6 border-b border-gray-800 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-text-primary uppercase tracking-widest text-xs">
                    Hazard Trajectory (30d)
                  </h3>
                  <button
                    onClick={exportToCsv}
                    className="flex items-center gap-2 text-xs text-secondary hover:text-white transition-colors bg-secondary/10 px-3 py-1 rounded"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>
                </div>
                
                <div className="h-64 w-full bg-background/50 rounded-lg p-4 border border-gray-800">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.history}>
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                          stroke="#404050" 
                          fontSize={10} 
                          tickMargin={10}
                        />
                        <YAxis 
                          domain={[0, 12]} 
                          stroke="#404050" 
                          fontSize={10} 
                          width={30}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#12121A', borderColor: '#404050', fontSize: '12px' }}
                          labelFormatter={(label) => new Date(label as string).toLocaleString()}
                        />
                        <Line
                          type="monotone"
                          dataKey="minutes_to_midnight"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "var(--primary)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              {/* Scrollable Variables Section */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-10">
                {/* Math Breakdown Section (LPPLS) */}
                {data.latest_lppls && (
                  <section>
                    <h3 className="text-text-primary uppercase tracking-widest text-xs mb-4">
                      Latest LPPLS Coefficients
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "t_c (Critical Time)", value: data.latest_lppls.tc.toFixed(6) },
                        { label: "m (Growth Exp)", value: data.latest_lppls.m.toFixed(6) },
                        { label: "ω (Oscillation Freq)", value: data.latest_lppls.omega.toFixed(6) },
                        { label: "φ (Phase Shift)", value: data.latest_lppls.phi.toFixed(6) },
                        { label: "A (Linear Baseline)", value: data.latest_lppls.A.toFixed(6) },
                        { label: "B (Amplitude)", value: data.latest_lppls.B.toFixed(6) },
                        { label: "C1 (Cosine Amp)", value: data.latest_lppls.C1.toFixed(6) },
                        { label: "C2 (Sine Amp)", value: data.latest_lppls.C2.toFixed(6) },
                        { label: "Confidence Score", value: (data.latest_lppls.confidence_score * 100).toFixed(2) + "%" },
                      ].map((coef, i) => (
                        <div key={i} className="bg-background/50 p-3 rounded-md border border-gray-800">
                          <div className="text-gray-400 text-[10px] uppercase mb-1">{coef.label}</div>
                          <div className="text-text-primary text-sm">{coef.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Stress Index Components — sourced from stress_index_snapshots */}
                {data.latest_stress ? (
                  <section>
                    <h3 className="text-text-primary uppercase tracking-widest text-xs mb-4">
                      Stress Index Components
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Forward P/E Score", value: data.latest_stress.forward_pe_score.toFixed(2) + " / 100" },
                        { label: "HHI (Concentration)", value: data.latest_stress.hhi_score.toFixed(2) + " / 100" },
                        { label: "Correlation Score", value: data.latest_stress.correlation_score.toFixed(2) + " / 100" },
                        { label: "CapEx Deficit Score", value: data.latest_stress.capex_deficit_score.toFixed(2) + " / 100" },
                        { label: "Composite Stress", value: data.latest_stress.composite_score.toFixed(2) + " / 100" },
                      ].map((coef, i) => (
                        <div key={i} className="bg-background/50 p-3 rounded-md border border-gray-800">
                          <div className="text-gray-400 text-[10px] uppercase mb-1">{coef.label}</div>
                          <div className="text-text-primary text-sm">{coef.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section>
                    <h3 className="text-text-primary uppercase tracking-widest text-xs mb-4">
                      Stress Index Components
                    </h3>
                    <p className="text-text-muted text-xs">No stress snapshot data linked to this run.</p>
                  </section>
                )}

                {/* Hazard Synthesis Metrics — sourced from hazard_rate_log columns */}
                {data.latest_hazard ? (
                  <section className="mb-6">
                    <h3 className="text-text-primary uppercase tracking-widest text-xs mb-4">
                      Hazard Synthesis Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "T Prox (Time Proximity)", value: data.latest_hazard.t_prox.toFixed(6) },
                        { label: "Raw Hazard Rate", value: data.latest_hazard.raw_hazard.toFixed(6) },
                        { label: "Sigmoid Hazard", value: data.latest_hazard.sigmoid_hazard.toFixed(6) },
                      ].map((coef, i) => (
                        <div key={i} className="bg-background/50 p-3 rounded-md border border-gray-800">
                          <div className="text-gray-400 text-[10px] uppercase mb-1">{coef.label}</div>
                          <div className="text-text-primary text-sm">{coef.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="mb-6">
                    <h3 className="text-text-primary uppercase tracking-widest text-xs mb-4">
                      Hazard Synthesis Metrics
                    </h3>
                    <p className="text-text-muted text-xs">No hazard synthesis data available for this run.</p>
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
