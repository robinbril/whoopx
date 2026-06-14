import type { SleepOutT } from "../schemas/sleep";

export const DEMO_SLEEP: SleepOutT = {
  date: "2026-06-14",
  started_at: "2026-06-13T23:04:00+02:00",
  ended_at: "2026-06-14T07:09:00+02:00",
  total_sleep_ms: 25920000,   // 7h12m
  time_in_bed_ms: 27900000,   // 7h45m
  efficiency_pct: 92.9,
  performance_pct: 89,
  consistency_pct: 76,
  debt_ms: 1800000,            // 30m
  latency_ms: null,
  stages: {
    rem_ms: 5400000,           // 1h30m (20.8%)
    rem_pct: 20.8,
    light_ms: 13320000,        // 3h42m (51.4%)
    light_pct: 51.4,
    sws_ms: 5760000,           // 1h36m (22.2%)
    sws_pct: 22.2,
    wake_ms: 1440000,          // 24m (5.6%)
    wake_pct: 5.6,
  },
  hypnogram: [
    { started_at: "2026-06-13T23:04:00+02:00", ended_at: "2026-06-13T23:34:00+02:00", stage: "LIGHT" },
    { started_at: "2026-06-13T23:34:00+02:00", ended_at: "2026-06-14T00:44:00+02:00", stage: "SWS" },
    { started_at: "2026-06-14T00:44:00+02:00", ended_at: "2026-06-14T01:44:00+02:00", stage: "REM" },
    { started_at: "2026-06-14T01:44:00+02:00", ended_at: "2026-06-14T01:52:00+02:00", stage: "AWAKE" },
    { started_at: "2026-06-14T01:52:00+02:00", ended_at: "2026-06-14T03:22:00+02:00", stage: "LIGHT" },
    { started_at: "2026-06-14T03:22:00+02:00", ended_at: "2026-06-14T04:10:00+02:00", stage: "SWS" },
    { started_at: "2026-06-14T04:10:00+02:00", ended_at: "2026-06-14T05:10:00+02:00", stage: "REM" },
    { started_at: "2026-06-14T05:10:00+02:00", ended_at: "2026-06-14T05:26:00+02:00", stage: "AWAKE" },
    { started_at: "2026-06-14T05:26:00+02:00", ended_at: "2026-06-14T07:00:00+02:00", stage: "LIGHT" },
    { started_at: "2026-06-14T07:00:00+02:00", ended_at: "2026-06-14T07:09:00+02:00", stage: "REM" },
  ],
  disturbances: 2,
  sleep_hr: {
    avg_bpm: 52,
    min_bpm: 44,
  },
  sleep_hrv_ms: null,
  respiratory_rate: null,
};
