import type { TodayOutT } from "../schemas/today";

export const DEMO_TODAY: TodayOutT = {
  date: "2026-06-14",
  recovery: {
    score: 67,
    state: "GREEN",
    hrv_ms: 48.2,
    rhr_bpm: 54,
  },
  sleep: {
    performance_pct: 89,
    total_sleep_ms: 25920000, // 7h12m
    time_in_bed_ms: 27900000, // 7h45m
    efficiency_pct: 92.9,
    stages: {
      rem_ms: 5400000,    // 1h30m
      light_ms: 13320000, // 3h42m
      sws_ms: 5760000,    // 1h36m
      wake_ms: 1440000,   // 24m
    },
    started_at: "2026-06-13T23:04:00+02:00",
    ended_at: "2026-06-14T07:09:00+02:00",
  },
  strain: {
    score: 12.4,
    calories: 2340,
    avg_hr_bpm: 72,
    max_hr_bpm: 164,
    workouts_count: 1,
  },
  current_state: {
    state: "idle",
    sport_name: null,
    started_at: null,
  },
};
