import { z } from "zod";

// GET /community-service/v1/leaderboards/communities/{id}/{windowSeg}/{metric}/{stat}
// windowSeg: "{date}" for day, "average/week" or "average/month" for aggregates.
// stat: "score" for recovery, "performance" for sleep, "day_strain" for strain.
// Query (week/month only): startDate, endDate, includeCompliance=true, complianceCutoff=70, teamType=COMMUNITY

export const LeaderboardOut = z.object({
  community_id: z.number().int(),
  community_name: z.string().nullable(),
  window: z.enum(["day", "week", "month"]),
  metric: z.enum(["recovery", "sleep", "strain"]),
  date_label: z.string(),
  average: z.number().nullable(),
  total_compliant: z.number().int().nullable(),
  total_empty: z.number().int().nullable(),
  records: z.array(z.object({
    rank: z.number().int(),
    user_id: z.number().int(),
    first_name: z.string(),
    last_name: z.string(),
    value: z.number().nullable(),
    secondary_value: z.number().nullable().describe(
      "HRV for recovery; performance for sleep; calories for strain.",
    ),
  })),
  your_position: z.object({
    rank: z.number().int().nullable(),
    value: z.number().nullable(),
    in_window: z.boolean().describe("False if you have no data point for this window."),
  }),
});
export type LeaderboardOutT = z.infer<typeof LeaderboardOut>;
