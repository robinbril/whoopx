"use client";

import { motion } from "framer-motion";

interface Sample {
  time: string;
  value: number;
}

function zoneColor(v: number): string {
  if (v < 1) return "var(--color-recovery-green)";
  if (v < 2) return "var(--color-recovery-yellow)";
  return "var(--color-recovery-red)";
}

const W = 320;
const H = 132;
const PAD_T = 8;
const PAD_B = 4;

/** 24h stress bars, color-coded by zone (low/medium/high). */
export function StressTimeline({ samples, max = 3 }: { samples: Sample[]; max?: number }) {
  if (samples.length === 0) return null;
  const innerH = H - PAD_T - PAD_B;
  const slot = W / samples.length;
  const bw = Math.round(slot * 0.6 * 100) / 100;

  const labelEvery = Math.ceil(samples.length / 5);

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {samples.map((s, i) => {
          const h = Math.max(2, (Math.min(s.value, max) / max) * innerH);
          const x = Math.round((i * slot + (slot - bw) / 2) * 100) / 100;
          const y = PAD_T + innerH - h;
          return (
            <motion.rect
              key={i}
              x={x}
              width={bw}
              rx={2}
              fill={zoneColor(s.value)}
              initial={{ height: 0, y: PAD_T + innerH }}
              animate={{ height: h, y }}
              transition={{ duration: 0.6, delay: 0.05 + i * 0.02, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] text-dim tabular">
        {samples.map((s, i) => (i % labelEvery === 0 || i === samples.length - 1 ? <span key={i}>{s.time}</span> : null))}
      </div>
    </div>
  );
}
