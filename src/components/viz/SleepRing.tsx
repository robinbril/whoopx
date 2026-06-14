"use client";

import { ProgressRing } from "./ProgressRing";
import { CountUp } from "./CountUp";

interface SleepRingProps {
  value: number;
  size?: number;
  showLabel?: boolean;
}

export function SleepRing({ value, size = 220, showLabel = true }: SleepRingProps) {
  return (
    <ProgressRing fraction={value / 100} color="var(--color-sleep)" size={size} strokeWidth={Math.round(size * 0.072)}>
      <div className="tabular flex items-baseline text-sleep">
        <CountUp value={value} className="text-[2.85rem] font-bold leading-none" />
        <span className="text-xl font-semibold">%</span>
      </div>
      {showLabel && (
        <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Performance</span>
      )}
    </ProgressRing>
  );
}
