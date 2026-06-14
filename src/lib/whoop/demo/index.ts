import type { WhoopClientInterface, DateRange } from "../client";
import type { TodayOutT } from "../schemas/today";
import type { RecoveryOutT } from "../schemas/recovery";
import type { SleepOutT } from "../schemas/sleep";
import type { StrainOutT } from "../schemas/strain";
import type { WorkoutListOutT } from "../schemas/workouts";
import type { TrendOutT } from "../schemas/trend";
import type { METRICS } from "../schemas/trend";
import type { ProfileOutT } from "../schemas/profile";
import type { CommunitiesOutT } from "../schemas/communities";
import type { LeaderboardOutT } from "../schemas/leaderboard";
import type { CompareOutT } from "../schemas/compare";
import type { JournalOutT } from "../schemas/journal";
import type { LiftCatalogOutT } from "../schemas/strength";
import type { CoachAskOutT } from "../schemas/coach";
import type { StressOutT } from "../schemas/stress";
import type { CardioLoadOutT } from "../schemas/cardio";

import { DEMO_TODAY } from "./today";
import { DEMO_RECOVERY } from "./recovery";
import { DEMO_SLEEP } from "./sleep";
import { DEMO_STRAIN } from "./strain";
import { DEMO_WORKOUTS } from "./workouts";
import { DEMO_TRENDS } from "./trends";
import { DEMO_PROFILE } from "./profile";
import { DEMO_COMMUNITIES } from "./communities";
import { DEMO_LEADERBOARD } from "./leaderboard";
import { DEMO_COMPARE } from "./compare";
import { DEMO_JOURNAL } from "./journal";
import { DEMO_LIFT_CATALOG } from "./strength";
import { DEMO_STRESS } from "./stress";
import { DEMO_CARDIO } from "./cardio";

class DemoWhoopClient implements WhoopClientInterface {
  async getToday(): Promise<TodayOutT> { return DEMO_TODAY; }

  async getDay(date: string): Promise<TodayOutT> {
    return { ...DEMO_TODAY, date, current_state: { state: null, sport_name: null, started_at: null } };
  }

  async getRecovery(_date?: string): Promise<RecoveryOutT> { return DEMO_RECOVERY; }

  async getSleep(_date?: string): Promise<SleepOutT> { return DEMO_SLEEP; }

  async getStrain(_date?: string): Promise<StrainOutT> { return DEMO_STRAIN; }

  async getWorkouts(_range?: DateRange, _limit?: number): Promise<WorkoutListOutT> {
    return DEMO_WORKOUTS;
  }

  async getTrend(metric: typeof METRICS[number], _endDate?: string): Promise<TrendOutT> {
    return DEMO_TRENDS[metric] ?? DEMO_TRENDS["HRV"];
  }

  async getProfile(): Promise<ProfileOutT> { return DEMO_PROFILE; }

  async getCommunities(): Promise<CommunitiesOutT> { return DEMO_COMMUNITIES; }

  async getLeaderboard(_communityId: number): Promise<LeaderboardOutT> { return DEMO_LEADERBOARD; }

  async getCompare(): Promise<CompareOutT> { return DEMO_COMPARE; }

  async askCoach(message: string): Promise<CoachAskOutT> {
    return {
      conversation_id: "demo-conv-001",
      turn_id: "demo-turn-001",
      response_text: `Demo coach reply to: "${message.slice(0, 60)}". Your HRV is 48ms, solid baseline, recovery at 67%.`,
      turn_status: "COMPLETED",
      polled_iterations: 3,
      timed_out: false,
    };
  }

  async getJournal(_date?: string): Promise<JournalOutT> { return DEMO_JOURNAL; }

  async getStrengthActivities(): Promise<LiftCatalogOutT> { return DEMO_LIFT_CATALOG; }

  async getStress(_date?: string): Promise<StressOutT> { return DEMO_STRESS; }

  async getCardioLoad(): Promise<CardioLoadOutT> { return DEMO_CARDIO; }
}

export function createDemoClient(): WhoopClientInterface {
  return new DemoWhoopClient();
}
