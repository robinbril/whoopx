import { z } from "zod";

/** Cardio load (training load): ATL/CTL fitness-fatigue model. */
export const CardioLoadOut = z.object({
  date: z.string(),
  load: z.number(),
  status: z.string(),
  atl: z.number(),
  ctl: z.number(),
  form: z.number(),
  band: z.object({ lower: z.number(), upper: z.number() }),
  series: z.array(z.object({ date: z.string(), load: z.number() })),
  breakdown: z.array(z.object({ status: z.string(), days: z.number() })),
});

export type CardioLoadOutT = z.infer<typeof CardioLoadOut>;
