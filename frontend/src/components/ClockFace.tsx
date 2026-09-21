"use client";

import { motion } from "framer-motion";

export default function ClockFace({
  minutesToMidnight,
}: {
  minutesToMidnight: number;
}) {
  // 12 hours = 0 deg, 6 hours = 180 deg, 0 hours = 360 deg
  const hoursToMidnight = minutesToMidnight; 
  const timeInHours = 12 - hoursToMidnight;
  
  // Hour hand angle (360 degrees per 12 hours)
  const hourAngle = (timeInHours / 12) * 360;
  
  // Minute hand angle (360 degrees per 1 hour)
  // timeInHours % 1 gives the fractional hour (e.g. 0.99 hours)
  const fractionalHour = timeInHours % 1;
  const minuteAngle = fractionalHour * 360;

  // Generate tick marks (12 hours)
  const ticks = Array.from({ length: 12 }).map((_, i) => {
    const tickAngle = i * 30;
    // Map polar to cartesian
    const r1 = 44;
    const r2 = i % 3 === 0 ? 38 : 41; // Make 12, 3, 6, 9 ticks longer
    
    const rad = (tickAngle - 90) * (Math.PI / 180);
    const x1 = 50 + r1 * Math.cos(rad);
    const y1 = 50 + r1 * Math.sin(rad);
    const x2 = 50 + r2 * Math.cos(rad);
    const y2 = 50 + r2 * Math.sin(rad);

    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--text-muted)"
        strokeWidth={i % 3 === 0 ? "2" : "1"}
      />
    );
  });

  return (
    <div className="relative w-full max-w-sm aspect-square mx-auto flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-severe-md"
      >
        {/* Outer Ring */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="var(--card)"
          stroke="var(--text-muted)"
          strokeWidth="2"
        />

        {/* Inner glow circle */}
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="rgba(255,59,59,0.05)"
          className="drop-shadow-sharp-glow"
        />

        {/* Ticks */}
        {ticks}

        {/* Animated Hour Hand (Shorter, thicker) */}
        <motion.g
          initial={{ rotate: -30 }} // start neutral
          animate={{ rotate: hourAngle }}
          transition={{ type: "spring", stiffness: 40, damping: 12, mass: 1.2 }}
          style={{ originX: "50px", originY: "50px" }}
        >
          <circle cx="50" cy="50" r="50" fill="transparent" stroke="none" />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="28"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeLinecap="round"
            className="drop-shadow-sharp-glow"
          />
        </motion.g>

        {/* Animated Minute Hand (Longer, thinner) */}
        <motion.g
          initial={{ rotate: 0 }} // start neutral
          animate={{ rotate: minuteAngle }}
          transition={{ type: "spring", stiffness: 40, damping: 12, mass: 1.2, delay: 0.1 }}
          style={{ originX: "50px", originY: "50px" }}
        >
          <circle cx="50" cy="50" r="50" fill="transparent" stroke="none" />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="12"
            stroke="var(--text-secondary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </motion.g>

        {/* Center Dot */}
        <circle
          cx="50"
          cy="50"
          r="4"
          fill="var(--primary)"
          className="drop-shadow-sharp-glow"
        />
      </svg>
    </div>
  );
}
