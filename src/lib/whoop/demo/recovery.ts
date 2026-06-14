import type { RecoveryOutT } from "../schemas/recovery";

export const DEMO_RECOVERY: RecoveryOutT = {
  date: "2026-06-14",
  score: 67,
  state: "GREEN",
  hrv: {
    ms: 48.2,
    baseline_ms: 46.8,
    delta_pct: 3.0,
  },
  rhr: {
    bpm: 54,
    baseline_bpm: 55,
    delta_pct: -1.8,
  },
  respiratory_rate: 15.2,
  spo2_pct: 97.4,
  skin_temp_c: 34.1,
  sleep_performance_pct: 89,
  contributors: [
    { name: "Sleep Performance", direction: "positive", detail: "89% sleep performance" },
    { name: "HRV", direction: "positive", detail: "48ms (+3% vs baseline)" },
    { name: "RHR", direction: "positive", detail: "54 bpm (1 below baseline)" },
  ],
  calibration_state: "CALIBRATED",
};
