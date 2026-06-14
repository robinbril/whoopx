import { z } from "zod";

// GET /community-service/v1/communities/memberships
// Query: userId, teamType, includeOwnerDetails, includeUserRank,
//        leaderboardType, period, startDate, endDate, offset, limit

export const CommunityMembership = z.object({
  member_type: z.string().nullable(),
  notification_setting: z.string().nullable(),
  unread_count: z.number().int().nullable(),
  online: z.boolean().nullable(),
  joined_at: z.string().nullable(),
  last_online: z.string().nullable(),
});

export const CommunityRank = z.object({
  rank: z.number().int().nullable(),
  score: z.number().nullable(),
  metric: z.string().nullable(),
  period: z.string().nullable(),
});

export const CommunityRecord = z.object({
  id: z.number().int(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  banner_url: z.string().nullable(),
  about: z.string().nullable(),
  private: z.boolean().nullable(),
  member_count: z.number().int().nullable(),
  owner_id: z.number().int().nullable(),
  team_type: z.string().nullable(),
  membership: CommunityMembership,
  rank: CommunityRank.nullable(),
});

export const CommunitiesOut = z.object({
  total_count: z.number().int(),
  offset: z.number().int(),
  team_type_filter: z.enum(["ALL", "COMMUNITY", "TEAM", "BUSINESS"]),
  leaderboard_metric: z.enum(["strain", "sleep", "recovery"]),
  period: z.enum(["day", "week", "month"]),
  communities: z.array(CommunityRecord),
});
export type CommunitiesOutT = z.infer<typeof CommunitiesOut>;
export type CommunityRecordT = z.infer<typeof CommunityRecord>;
