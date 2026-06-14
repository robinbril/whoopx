"use client";

import { ProgressRing } from "./ProgressRing";
import { CountUp } from "./CountUp";
import { STRAIN_MAX, strainFraction, strainLabel } from "@/lib/recovery";

interface StrainRingProps {
  value: number;
  size?: number;
  showLabel?: boolean;
}

export function StrainRing({ value, size = 220, showLabel = true }: StrainRingProps) {
  return (
    <ProgressRing
      fraction={strainFraction(value)}
      color="var(--color-strain)"
      size={size}
      strokeWidth={Math.round(size * 0.072)}
    >
      <div className="tabular text-strain">
        <CountUp value={value} decimals={1} className="text-[2.85rem] font-bold leading-none" />
      </div>
      {showLabel && (
        <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          {strainLabel(value)} · /{STRAIN_MAX}
        </span>
      )}
    </ProgressRing>
  );
}
