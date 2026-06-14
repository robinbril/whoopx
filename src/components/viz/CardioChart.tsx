"use client";

import { motion } from "framer-motion";

interface Pt {
  date: string;
  load: number;
}

interface CardioChartProps {
  series: Pt[];
  band: { lower: number; upper: number };
  color?: string;
  height?: number;
}

const W = 320;
const PAD = { t: 10, r: 6, b: 20, l: 6 };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cardio-load line with a shaded adaptive band (goose CardioLoadDetailSurface). */
export function CardioChart({ series, band, color = "var(--color-strain)", height = 170 }: CardioChartProps) {
  if (series.length === 0) return <div style={{ height }} />;

  const H = height;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const loads = series.map((s) => s.load);
  const lo = Math.min(...loads, band.lower);
  const hi = Math.max(...loads, band.upper);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const range = max - min || 1;

  const x = (i: number) => r2(PAD.l + (i / (series.length - 1)) * innerW);
  const y = (v: number) => r2(PAD.t + innerH - ((v - min) / range) * innerH);

  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s.load)}`).join(" ");
  const bandTop = y(band.upper);
  const bandBottom = y(band.lower);

  const labelIdx = [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <rect
          x={PAD.l}
          y={bandTop}
          width={innerW}
          height={Math.max(0, bandBottom - bandTop)}
          fill={color}
          fillOpacity={0.1}
        />
        <line x1={PAD.l} x2={W - PAD.r} y1={bandTop} y2={bandTop} stroke={color} strokeOpacity={0.3} strokeDasharray="3 3" />
        <line x1={PAD.l} x2={W - PAD.r} y1={bandBottom} y2={bandBottom} stroke={color} strokeOpacity={0.3} strokeDasharray="3 3" />
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
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].load)} r={3.5} fill={color} />
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] text-dim tabular">
        {labelIdx.map((i) => (
          <span key={i}>{series[i].date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
