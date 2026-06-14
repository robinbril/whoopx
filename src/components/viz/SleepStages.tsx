"use client";

import { motion } from "framer-motion";
import { formatDurationMin } from "@/lib/format";

interface SleepStagesProps {
  /** minutes per stage */
  deep: number;
  rem: number;
  light: number;
  awake: number;
}

const ORDER = [
  { key: "deep", label: "Deep (SWS)", color: "var(--color-sleep-deep)" },
  { key: "rem", label: "REM", color: "var(--color-sleep-rem)" },
  { key: "light", label: "Light", color: "var(--color-sleep-light)" },
  { key: "awake", label: "Awake", color: "var(--color-sleep-awake)" },
] as const;

export function SleepStages({ deep, rem, light, awake }: SleepStagesProps) {
  const map = { deep, rem, light, awake };
  const total = deep + rem + light + awake || 1;

  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-3">
        {ORDER.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${(map[s.key] / total) * 100}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 }}
            style={{ background: s.color }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        {ORDER.map((s) => (
          <div key={s.key} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular text-sm font-semibold text-fg">{formatDurationMin(map[s.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
