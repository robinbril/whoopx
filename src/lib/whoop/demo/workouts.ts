import type { WorkoutListOutT } from "../schemas/workouts";

export const DEMO_WORKOUTS: WorkoutListOutT = [
  {
    id: "wo-001",
    sport_name: "Running",
    start: "2026-06-14T08:30:00+02:00",
    end: "2026-06-14T09:18:00+02:00",
    duration_ms: 2880000,   // 48 min
    strain: 13.2,
    avg_hr_bpm: 142,
    max_hr_bpm: 164,
    calories: 520,
    distance_m: 7400,
  },
  {
    id: "wo-002",
    sport_name: "Cycling",
    start: "2026-06-12T17:00:00+02:00",
    end: "2026-06-12T18:05:00+02:00",
    duration_ms: 3900000,   // 65 min
    strain: 14.8,
    avg_hr_bpm: 148,
    max_hr_bpm: 171,
    calories: 640,
    distance_m: 28500,
  },
  {
    id: "wo-003",
    sport_name: "Strength Training",
    start: "2026-06-11T07:45:00+02:00",
    end: "2026-06-11T08:45:00+02:00",
    duration_ms: 3600000,   // 60 min
    strain: 10.1,
    avg_hr_bpm: 118,
    max_hr_bpm: 152,
    calories: 310,
    distance_m: null,
  },
  {
    id: "wo-004",
    sport_name: "Running",
    start: "2026-06-09T07:10:00+02:00",
    end: "2026-06-09T08:00:00+02:00",
    duration_ms: 3000000,   // 50 min
    strain: 12.7,
    avg_hr_bpm: 139,
    max_hr_bpm: 161,
    calories: 480,
    distance_m: 7800,
  },
  {
    id: "wo-005",
    sport_name: "Soccer",
    start: "2026-06-07T14:00:00+02:00",
    end: "2026-06-07T15:30:00+02:00",
    duration_ms: 5400000,   // 90 min
    strain: 15.9,
    avg_hr_bpm: 152,
    max_hr_bpm: 178,
    calories: 780,
    distance_m: null,
  },
];
