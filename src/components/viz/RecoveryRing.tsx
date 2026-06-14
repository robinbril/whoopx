"use client";

import { ProgressRing } from "./ProgressRing";
import { CountUp } from "./CountUp";
import { recoveryColor, recoveryLabel } from "@/lib/recovery";

interface RecoveryRingProps {
  value: number;
  size?: number;
  showLabel?: boolean;
}

export function RecoveryRing({ value, size = 220, showLabel = true }: RecoveryRingProps) {
  const color = recoveryColor(value);
  return (
    <ProgressRing fraction={value / 100} color={color} size={size} strokeWidth={Math.round(size * 0.072)}>
      <div className="tabular flex items-baseline" style={{ color }}>
        <CountUp value={value} className="text-[2.85rem] font-bold leading-none" />
        <span className="text-xl font-semibold">%</span>
      </div>
      {showLabel && (
        <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          {recoveryLabel(value)}
        </span>
      )}
    </ProgressRing>
  );
}
