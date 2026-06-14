import type { LeaderboardOutT } from "../schemas/leaderboard";

// Community "The Group" (id 8812) — 5 members: Alex, Sven, Daan, Lisa, Mees.
// Recovery leaderboard, day window, 2026-06-14.

export const DEMO_LEADERBOARD: LeaderboardOutT = {
  community_id: 8812,
  community_name: "The Group",
  window: "day",
  metric: "recovery",
  date_label: "2026-06-14",
  average: 68.2,
  total_compliant: 5,
  total_empty: 0,
  records: [
    {
      rank: 1,
      user_id: 10055202,
      first_name: "Sven",
      last_name: "Hoekstra",
      value: 84,
      secondary_value: 58.4,  // HRV ms
    },
    {
      rank: 2,
      user_id: 10042801,
      first_name: "Alex",
      last_name: "Rivera",
      value: 67,
      secondary_value: 48.2,
    },
    {
      rank: 3,
      user_id: 10061390,
      first_name: "Daan",
      last_name: "Vermeer",
      value: 71,
      secondary_value: 52.1,
    },
    {
      rank: 4,
      user_id: 10078441,
      first_name: "Lisa",
      last_name: "de Vries",
      value: 62,
      secondary_value: 44.8,
    },
    {
      rank: 5,
      user_id: 10099302,
      first_name: "Mees",
      last_name: "Bakker",
      value: 57,
      secondary_value: 39.3,
    },
  ],
  your_position: {
    rank: 2,
    value: 67,
    in_window: true,
  },
};
