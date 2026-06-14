import type { StrainOutT } from "../schemas/strain";

export const DEMO_STRAIN: StrainOutT = {
  date: "2026-06-14",
  score: 12.4,
  target: {
    value: 13.0,
    optimal_lower: 11.0,
    optimal_upper: 15.0,
  },
  calories: 2340,
  avg_hr_bpm: 72,
  max_hr_bpm: 164,
  zone_durations: {
    zone_0_ms: 34200000,  // ~9.5h light
    zone_1_ms: 7200000,   // 2h zone 1
    zone_2_ms: 3600000,   // 1h zone 2
    zone_3_ms: 1800000,   // 30m zone 3
    zone_4_ms: 900000,    // 15m zone 4
    zone_5_ms: 180000,    // 3m zone 5
  },
  workouts_count: 1,
  steps: 9140,
  strength_activity_time_ms: 0,
};
