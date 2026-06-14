import type { CommunitiesOutT } from "../schemas/communities";

export const DEMO_COMMUNITIES: CommunitiesOutT = {
  total_count: 1,
  offset: 0,
  team_type_filter: "ALL",
  leaderboard_metric: "recovery",
  period: "week",
  communities: [
    {
      id: 8812,
      name: "The Group",
      avatar_url: null,
      banner_url: null,
      about: "5 friends tracking together",
      private: true,
      member_count: 5,
      owner_id: 10042801,
      team_type: "COMMUNITY",
      membership: {
        member_type: "OWNER",
        notification_setting: "ALL",
        unread_count: 0,
        online: false,
        joined_at: "2025-09-01T10:00:00Z",
        last_online: "2026-06-14T08:00:00Z",
      },
      rank: {
        rank: 2,
        score: 67,
        metric: "recovery",
        period: "week",
      },
    },
  ],
};
