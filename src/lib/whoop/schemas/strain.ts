import { z } from "zod";
import { HrZoneDurations } from "./primitives";

export const StrainOut = z.object({
  date: z.iso.date(),
  score: z.number().nullable(),
  // Recovery-calibrated daily strain target. Raw API stores 0–1 fractions;
  // projection multiplies by 21 to give the 0–21 strain-scale value.
  target: z.object({
    value: z.number().nullable(),
    optimal_lower: z.number().nullable(),
    optimal_upper: z.number().nullable(),
  }),
  calories: z.number().int().nullable(),
  avg_hr_bpm: z.number().nullable(),
  max_hr_bpm: z.number().nullable(),
  zone_durations: HrZoneDurations,
  workouts_count: z.number().int(),
  steps: z.number().int().nullable(),
  strength_activity_time_ms: z.number().int().nullable(),
});
export type StrainOutT = z.infer<typeof StrainOut>;
