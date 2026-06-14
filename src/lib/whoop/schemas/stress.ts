import { z } from "zod";

/** Stress on WHOOP's 0-3 monitor scale. Zones: low 0-1, medium 1-2, high 2-3. */
export const StressOut = z.object({
  date: z.string(),
  current: z.number(),
  avg: z.number(),
  max: z.number(),
  avg_hr_bpm: z.number().nullable(),
  confidence: z.number().nullable(),
  breakdown: z.object({
    high_min: z.number(),
    medium_min: z.number(),
    low_min: z.number(),
  }),
  samples: z.array(z.object({ time: z.string(), value: z.number() })),
});

export type StressOutT = z.infer<typeof StressOut>;
