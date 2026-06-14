import type { CompareOutT } from "../schemas/compare";

// Week A = Jun 8-14 (current), Week B = Jun 1-7 (prior).

export const DEMO_COMPARE: CompareOutT = {
  window: "week",
  a: { start_date: "2026-06-08", end_date: "2026-06-14" },
  b: { start_date: "2026-06-01", end_date: "2026-06-07" },
  metrics: [
    {
      metric: "RECOVERY",
      a_avg: 72.3,
      b_avg: 64.8,
      delta_abs: 7.5,
      delta_pct: 11.6,
      unit: "%",
    },
    {
      metric: "SLEEP_PERFORMANCE",
      a_avg: 87.4,
      b_avg: 82.1,
      delta_abs: 5.3,
      delta_pct: 6.5,
      unit: "%",
    },
    {
      metric: "DAY_STRAIN",
      a_avg: 12.8,
      b_avg: 11.4,
      delta_abs: 1.4,
      delta_pct: 12.3,
      unit: null,
    },
    {
      metric: "HRV",
      a_avg: 48.4,
      b_avg: 44.2,
      delta_abs: 4.2,
      delta_pct: 9.5,
      unit: "ms",
    },
    {
      metric: "RHR",
      a_avg: 54.1,
      b_avg: 56.3,
      delta_abs: -2.2,
      delta_pct: -3.9,
      unit: "bpm",
    },
  ],
};
