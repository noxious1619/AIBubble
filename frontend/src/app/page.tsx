"use client";

import { useClockData } from "../hooks/useClockData";
import ClockFace from "../components/ClockFace";
import AnalyticsDrawer from "../components/AnalyticsDrawer";
import ShareModal from "../components/ShareModal";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Activity, Loader2, Terminal, Share2 } from "lucide-react";

export default function Dashboard() {
  const { data: clockData, isLoading, isError } = useClockData();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Simple countdown timer to 5:00 PM UTC
  const [countdown, setCountdown] = useState<string>("00:00:00");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date();
      target.setUTCHours(17, 0, 0, 0);

      if (now.getTime() > target.getTime()) {
        // If it's already past 5PM UTC, aim for tomorrow 5PM UTC
        target.setUTCDate(target.getUTCDate() + 1);
      }

      const diffMs = target.getTime() - now.getTime();
      const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diffMs / 1000 / 60) % 60);
      const s = Math.floor((diffMs / 1000) % 60);

      setCountdown(
        `${h.toString().padStart(2, "0")}:${m
          .toString()
          .padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-mono">
        <Loader2 className="animate-spin text-secondary w-8 h-8" />
        <span className="ml-4 text-text-secondary tracking-widest">
          CALIBRATING SENSORS...
        </span>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-screen flex items-center justify-center font-mono flex-col">
        <AlertTriangle className="text-primary w-12 h-12 mb-4 drop-shadow-sharp-glow" />
        <span className="text-primary font-bold text-xl uppercase tracking-widest">
          System Failure
        </span>
        <p className="text-text-muted mt-2">Unable to retrieve clock state.</p>
      </main>
    );
  }

  const isDataAvailable = clockData !== null && clockData !== undefined;

  return (
    <>
      <main className="min-h-screen p-8 max-w-5xl mx-auto flex flex-col items-center">
        <header className="w-full flex justify-between items-center mb-16 border-b border-card pb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-secondary w-6 h-6" />
            <h1 className="font-sans font-bold text-lg tracking-wide uppercase text-text-primary">
              AI Bubble Doomsday Clock
            </h1>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-text-secondary bg-card px-4 py-2 rounded-md">
              <Clock className="w-4 h-4 text-warning" />
              <span>Next Analysis: {countdown} (UTC)</span>
            </div>
            {isDataAvailable && (
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-md transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            )}
            {isDataAvailable && (
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="flex items-center gap-2 bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 px-4 py-2 rounded-md transition-colors"
              >
                <Terminal className="w-4 h-4" />
                <span>Analytics</span>
              </button>
            )}
          </div>
        </header>

      {isDataAvailable ? (
        <div className="w-full flex flex-col md:flex-row gap-12 items-center justify-center">
          <div className="flex-1 flex flex-col items-center">
            <ClockFace minutesToMidnight={clockData.minutes_to_midnight} />
            
            <div className="mt-8 text-center">
              <h2 className="font-mono text-5xl font-bold text-primary drop-shadow-sharp-glow mb-2">
                {clockData.minutes_to_midnight.toFixed(2)}
              </h2>
              <p className="font-sans text-text-secondary uppercase tracking-widest text-sm">
                Hours to Midnight
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-6 w-full max-w-sm">
            <div className="bg-card rounded-lg p-6 border border-gray-800">
              <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-1">
                Raw Hazard Rate
              </h3>
              <p className="text-3xl font-mono text-white">
                {(clockData.hazard_rate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 border border-gray-800">
              <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-1">
                Macro Stress Index
              </h3>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-mono text-secondary">
                  {clockData.stress_score.toFixed(1)}
                </p>
                <span className="text-text-muted mb-1 font-mono">/ 100</span>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border border-gray-800">
              <h3 className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-1">
                Predicted T_c (Crash Window)
              </h3>
              <p className="text-lg font-mono text-warning">
                {new Date(clockData.tc_date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center font-mono flex-col text-center">
          <Clock className="text-text-muted w-16 h-16 mb-4" />
          <h2 className="text-xl text-text-secondary mb-2">
            Awaiting Initial Calibration
          </h2>
          <p className="text-text-muted max-w-md">
            The automated pipeline has not yet synthesized the hazard rate. The
            clock will come online once the daily ingestion and LPPLS engine
            have run.
          </p>
        </div>
      )}
    </main>
      <AnalyticsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} minutesToMidnight={clockData?.minutes_to_midnight} />
    </>
  );
}
