"use client";

import { motion } from "framer-motion";
import { clamp } from "@/lib/utils";

interface ProgressRingProps {
  /** 0..1 fill fraction. */
  fraction: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  track?: string;
  glow?: boolean;
  delay?: number;
  children?: React.ReactNode;
}

/** Animated circular progress ring (WHOOP recovery/strain style). */
export function ProgressRing({
  fraction,
  color,
  size = 200,
  strokeWidth = 16,
  track = "var(--color-surface-3)",
  glow = true,
  delay = 0,
  children,
}: ProgressRingProps) {
  const f = clamp(fraction, 0, 1);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - f);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
          style={glow ? { filter: `drop-shadow(0 0 7px ${color})` } : undefined }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
