"use client";

import { motion } from "framer-motion";

interface Zone {
  upTo: number;
  color: string;
}

interface TickGaugeProps {
  value: number;
  max: number;
  zones: Zone[];
  size?: number;
  children?: React.ReactNode;
}

const COUNT = 60;
const START = 135; // degrees
const SWEEP = 270;
const DIM = "var(--color-surface-3)";

function colorFor(v: number, zones: Zone[]): string {
  for (const z of zones) if (v <= z.upTo) return z.color;
  return zones[zones.length - 1]?.color ?? DIM;
}

/** Segmented tick gauge (WHOOP/Bevel stress-style) over a 270-degree arc. */
export function TickGauge({ value, max, zones, size = 220, children }: TickGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r2 = size / 2 - 4;
  const r1 = r2 - size * 0.09;
  const frac = Math.min(Math.max(value / max, 0), 1);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: COUNT }).map((_, i) => {
          const t = i / (COUNT - 1);
          const ang = ((START + t * SWEEP) * Math.PI) / 180;
          const round = (n: number) => Math.round(n * 100) / 100;
          const x1 = round(cx + r1 * Math.cos(ang));
          const y1 = round(cy + r1 * Math.sin(ang));
          const x2 = round(cx + r2 * Math.cos(ang));
          const y2 = round(cy + r2 * Math.sin(ang));
          const lit = t <= frac;
          const color = lit ? colorFor(t * max, zones) : DIM;
          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: lit ? 1 : 0.45 }}
              transition={{ duration: 0.35, delay: lit ? 0.2 + i * 0.014 : 0 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
