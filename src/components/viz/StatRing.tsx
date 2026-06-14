"use client";

import { ProgressRing } from "./ProgressRing";
import { CountUp } from "./CountUp";

interface StatRingProps {
  value: number;
  max: number;
  color: string;
  size: number;
  decimals?: number;
  suffix?: string;
  glow?: boolean;
}

function numClass(size: number): string {
  if (size >= 200) return "text-[2.7rem]";
  if (size >= 150) return "text-4xl";
  if (size >= 100) return "text-2xl";
  return "text-lg";
}

/** Generic value ring used for compact metric summaries. */
export function StatRing({ value, max, color, size, decimals = 0, suffix, glow = true }: StatRingProps) {
  return (
    <ProgressRing fraction={value / max} color={color} size={size} strokeWidth={Math.max(6, Math.round(size * 0.075))} glow={glow}>
      <span className="tabular font-bold leading-none" style={{ color }}>
        <CountUp value={value} decimals={decimals} className={numClass(size)} />
        {suffix && <span className="text-[0.55em] font-semibold">{suffix}</span>}
      </span>
    </ProgressRing>
  );
}
