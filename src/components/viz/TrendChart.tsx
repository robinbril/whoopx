"use client";

import { useId } from "react";
import { motion } from "framer-motion";

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  color?: string;
  unit?: string;
  height?: number;
  /** Force a y-range; otherwise derived from data with headroom. */
  domain?: [number, number];
}

const W = 320;
const PAD = { t: 12, r: 6, b: 22, l: 6 };

/** Lightweight responsive SVG line chart (viewBox-scaled, no resize observers). */
export function TrendChart({ data, color = "var(--color-strain)", unit = "", height = 180, domain }: TrendChartProps) {
  const gradId = useId();
  if (data.length === 0) return <div style={{ height }} />;

  const H = height;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const values = data.map((d) => d.value);
  const min = domain ? domain[0] : Math.min(...values);
  const max = domain ? domain[1] : Math.max(...values);
  const span = max - min || 1;
  const pad = domain ? 0 : span * 0.18;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const x = (i: number) => PAD.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - lo) / range) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const last = data[data.length - 1];
  const tickEvery = Math.ceil(data.length / 4);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* baseline grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + innerH * t}
          y2={PAD.t + innerH * t}
          stroke="var(--color-line-soft)"
          strokeWidth={1}
        />
      ))}

      <motion.path
        d={area}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />

      <circle cx={x(data.length - 1)} cy={y(last.value)} r={3.5} fill={color} />

      {/* x labels */}
      {data.map((d, i) =>
        i % tickEvery === 0 || i === data.length - 1 ? (
          <text
            key={d.label + i}
            x={x(i)}
            y={H - 6}
            fill="var(--color-dim)"
            fontSize={11}
            textAnchor={i === data.length - 1 ? "end" : i === 0 ? "start" : "middle"}
          >
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
