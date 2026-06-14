"use client";

import { motion } from "framer-motion";

export interface BarSegment {
  label: string;
  value: number;
  color: string;
  /** Pre-formatted value shown in the legend (server-side formatting). */
  display?: string;
}

export function StackedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-3">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
            style={{ background: s.color }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular text-sm font-semibold">{s.display ?? String(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
