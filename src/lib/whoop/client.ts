import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

import { TodayOut, type TodayOutT } from "./schemas/today";
import { RecoveryOut, type RecoveryOutT } from "./schemas/recovery";
import { SleepOut, type SleepOutT } from "./schemas/sleep";
import { StrainOut, type StrainOutT } from "./schemas/strain";
import { WorkoutListOut, type WorkoutListOutT } from "./schemas/workouts";
import { TrendOut, type TrendOutT, METRICS } from "./schemas/trend";
import { ProfileOut, type ProfileOutT } from "./schemas/profile";
import { CommunitiesOut, type CommunitiesOutT } from "./schemas/communities";
import { LeaderboardOut, type LeaderboardOutT } from "./schemas/leaderboard";
import { CompareOut, type CompareOutT } from "./schemas/compare";
import { JournalOut, type JournalOutT } from "./schemas/journal";
import { LiftCatalogOut, type LiftCatalogOutT } from "./schemas/strength";
import { CoachAskOut, type CoachAskOutT } from "./schemas/coach";
import { StressOut, type StressOutT } from "./schemas/stress";
import { CardioLoadOut, type CardioLoadOutT } from "./schemas/cardio";

// ---------------------------------------------------------------------------
// Constants (faithful to totem/src/whoop/constants.ts)
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.prod.whoop.com";
const API_VERSION = "7";
const REQUEST_TIMEOUT_MS = 30_000;

const COGNITO_ENDPOINT = "https://api.prod.whoop.com/auth-service/v3/whoop/";
const COGNITO_USER_AGENT =
  "aws-sdk-swift/1.5.86 ua/2.1 api/cognito_identity_provider#1.5.86 os/ios#26.3.1 lang/swift#5.10 m/D,N,Z,b";

const IOS_APP_VERSION = "5.52.0";
const IOS_BUILD_NUMBER = "595097";
const IOS_BUNDLE_NAME = "com.whoop.iphone";

// ---------------------------------------------------------------------------
// Token store
// ---------------------------------------------------------------------------

const TOKENS_PATH = resolve(".whoop-tokens.json");

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

function readTokens(): StoredTokens | null {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as StoredTokens;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens): void {
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// JWT exp decoder (faithful to totem/src/whoop/cognito.ts:decodeJwtExp)
// ---------------------------------------------------------------------------

function decodeJwtExp(jwt: string): number {
  const parts = jwt.split(".");
  if (parts.length < 2) return 0;
  const part = parts[1]!;
  const padded = part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=");
  const json = Buffer.from(padded, "base64").toString("utf8");
  try {
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Cognito auth (faithful to totem/src/whoop/cognito.ts)
// ---------------------------------------------------------------------------

interface CognitoAuthResult {
  AccessToken: string;
  RefreshToken?: string;
  IdToken: string;
  ExpiresIn: number;
  TokenType: string;
}

interface CognitoResponse {
  AuthenticationResult?: CognitoAuthResult;
  ChallengeName?: string;
  Session?: string;
}

async function callCognito(
  target: "InitiateAuth" | "RespondToAuthChallenge",
  body: object,
): Promise<CognitoResponse> {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
      "amz-sdk-request": "attempt=1; max=1",
      "amz-sdk-invocation-id": randomUUID(),
      "user-agent": COGNITO_USER_AGENT,
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "en-US,en;q=0.9",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { message?: string; __type?: string };
      detail = `${j.__type ?? "error"}: ${j.message ?? text}`;
    } catch { /* not JSON */ }
    throw new Error(`Cognito ${target} failed (${res.status}): ${detail}`);
  }
  return JSON.parse(text) as CognitoResponse;
}

async function loginWithPassword(email: string, password: string): Promise<StoredTokens> {
  const resp = await callCognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
    ClientId: "",
  });
  if (!resp.AuthenticationResult) {
    throw new Error(`Cognito login challenge not supported in server mode: ${resp.ChallengeName ?? "unknown"}`);
  }
  const ar = resp.AuthenticationResult;
  return {
    accessToken: ar.AccessToken,
    refreshToken: ar.RefreshToken ?? "",
    expiresAt: decodeJwtExp(ar.AccessToken) * 1000,
  };
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const resp = await callCognito("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: { REFRESH_TOKEN: refreshToken },
    ClientId: "",
  });
  if (!resp.AuthenticationResult) {
    throw new Error(`Cognito refresh did not return tokens: ${JSON.stringify(resp)}`);
  }
  const ar = resp.AuthenticationResult;
  return {
    accessToken: ar.AccessToken,
    refreshToken: ar.RefreshToken ?? refreshToken,
    expiresAt: decodeJwtExp(ar.AccessToken) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Device headers (faithful to totem/src/whoop/device.ts)
// ---------------------------------------------------------------------------

let cachedInstallationId: string | null = null;

function getInstallationId(): string {
  if (cachedInstallationId) return cachedInstallationId;
  cachedInstallationId = process.env.WHOOP_INSTALLATION_ID ?? randomUUID().toUpperCase();
  return cachedInstallationId;
}

function deviceHeaders(): Record<string, string> {
  const tz = process.env.WHOOP_TIMEZONE?.includes("/")
    ? process.env.WHOOP_TIMEZONE
    : Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

  return {
    "user-agent": "iOS",
    "x-whoop-device-platform": "iOS",
    "x-whoop-ios-version": IOS_APP_VERSION,
    "x-whoop-ios-build-number": IOS_BUILD_NUMBER,
    "x-whoop-bundle-name": IOS_BUNDLE_NAME,
    "x-whoop-installation-identifier": getInstallationId(),
    "x-whoop-time-zone": tz,
    "x-whoop-clock-format": "TWELVE_HOUR",
    currency: "USD",
    locale: "en_US",
    "accept-language": "en",
    accept: "*/*",
    priority: "u=3",
  };
}

// ---------------------------------------------------------------------------
// HTTP transport (faithful to totem/src/whoop/client.ts)
// ---------------------------------------------------------------------------

type QueryValue = string | number | boolean | undefined | null;

class WhoopHttpClient {
  private refreshing: Promise<string> | null = null;
  private tokens: StoredTokens | null = null;

  private async getToken(): Promise<string> {
    // Single-flight refresh to avoid racing parallel requests.
    if (this.refreshing) return this.refreshing;

    const SKEW_MS = 60_000;
    if (this.tokens && Date.now() < this.tokens.expiresAt - SKEW_MS) {
      return this.tokens.accessToken;
    }

    this.refreshing = this.acquireToken().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async acquireToken(): Promise<string> {
    // Try persisted tokens first.
    const stored = this.tokens ?? readTokens();
    const SKEW_MS = 60_000;

    if (stored && stored.refreshToken && Date.now() >= stored.expiresAt - SKEW_MS) {
      const fresh = await refreshTokens(stored.refreshToken);
      writeTokens(fresh);
      this.tokens = fresh;
      return fresh.accessToken;
    }

    if (stored && Date.now() < stored.expiresAt - SKEW_MS) {
      this.tokens = stored;
      return stored.accessToken;
    }

    // Fall back to password login.
    const email = process.env.WHOOP_EMAIL;
    const password = process.env.WHOOP_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "WHOOP_EMAIL and WHOOP_PASSWORD required for initial login. Set them in .env.local.",
      );
    }
    const fresh = await loginWithPassword(email, password);
    writeTokens(fresh);
    this.tokens = fresh;
    return fresh.accessToken;
  }

  async request<T>(
    method: string,
    path: string,
    query: Record<string, QueryValue> = {},
    body?: unknown,
  ): Promise<T> {
    const url = new URL(BASE_URL + path);
    url.searchParams.set("apiVersion", API_VERSION);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }

    const token = await this.getToken();
    const headers: Record<string, string> = {
      ...deviceHeaders(),
      authorization: `Bearer ${token}`,
    };

    let bodyString: string | undefined;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      bodyString = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyString,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401) {
      throw new Error("WHOOP access token expired and refresh failed. Re-authenticate.");
    }
    if (response.status >= 500) {
      throw new Error(`WHOOP server error ${response.status} on ${path}`);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`WHOOP API error ${response.status} on ${path}: ${text.slice(0, 200)}`);
    }
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>("GET", path, query);
  }

  post<T>(path: string, body: unknown, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>("POST", path, query, body);
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangeFromDays(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------------------------------------------------------------------------
// WhoopClient interface
// ---------------------------------------------------------------------------

export interface DateRange {
  start?: string; // ISO timestamp
  end?: string;   // ISO timestamp
}

export interface WhoopClientInterface {
  getToday(): Promise<TodayOutT>;
  getDay(date: string): Promise<TodayOutT>;
  getRecovery(date?: string): Promise<RecoveryOutT>;
  getSleep(date?: string): Promise<SleepOutT>;
  getStrain(date?: string): Promise<StrainOutT>;
  getWorkouts(range?: DateRange, limit?: number): Promise<WorkoutListOutT>;
  getTrend(metric: typeof METRICS[number], endDate?: string): Promise<TrendOutT>;
  getProfile(): Promise<ProfileOutT>;
  getCommunities(opts?: {
    teamType?: "ALL" | "COMMUNITY" | "TEAM" | "BUSINESS";
    metric?: "strain" | "sleep" | "recovery";
    period?: "day" | "week" | "month";
    limit?: number;
    offset?: number;
  }): Promise<CommunitiesOutT>;
  getLeaderboard(communityId: number, opts?: {
    metric?: "recovery" | "sleep" | "strain";
    window?: "day" | "week" | "month";
    date?: string;
  }): Promise<LeaderboardOutT>;
  getCompare(opts?: {
    window?: "week" | "month";
    endA?: string;
    endB?: string;
  }): Promise<CompareOutT>;
  askCoach(message: string, context?: string): Promise<CoachAskOutT>;
  getJournal(date?: string): Promise<JournalOutT>;
  getStrengthActivities(): Promise<LiftCatalogOutT>;
  getStress(date?: string): Promise<StressOutT>;
  getCardioLoad(): Promise<CardioLoadOutT>;
}

// ---------------------------------------------------------------------------
// Live client
// ---------------------------------------------------------------------------

class LiveWhoopClient implements WhoopClientInterface {
  private http = new WhoopHttpClient();

  async getToday(): Promise<TodayOutT> {
    const date = todayIso();
    const [home, sleep, recovery, state] = await Promise.all([
      this.http.get("/home-service/v1/home", { date }),
      this.http.get("/developer/v2/activity/sleep", { limit: "5" }).catch(() => null),
      this.http.get("/developer/v2/recovery", { limit: "5" }).catch(() => null),
      this.http.get("/activities-service/v1/user-state").catch(() => null),
    ]);
    return TodayOut.parse(buildTodayProjection(home, sleep, recovery, state, date));
  }

  async getDay(date: string): Promise<TodayOutT> {
    const dayMs = Date.parse(`${date}T00:00:00.000Z`);
    const start = new Date(dayMs - 86_400_000).toISOString();
    const end = new Date(dayMs + 2 * 86_400_000).toISOString();
    const [home, sleep, recovery] = await Promise.all([
      this.http.get("/home-service/v1/home", { date }),
      this.http.get("/developer/v2/activity/sleep", { start, end, limit: "10" }).catch(() => null),
      this.http.get("/developer/v2/recovery", { start, end, limit: "10" }).catch(() => null),
    ]);
    return TodayOut.parse(buildTodayProjection(home, sleep, recovery, null, date));
  }

  async getRecovery(date?: string): Promise<RecoveryOutT> {
    const d = date ?? todayIso();
    const dayMs = Date.parse(`${d}T00:00:00.000Z`);
    const start = new Date(dayMs - 86_400_000).toISOString();
    const end = new Date(dayMs + 2 * 86_400_000).toISOString();
    const [raw, recoveryV2] = await Promise.all([
      this.http.get<Record<string, unknown>>("/home-service/v1/deep-dive/recovery", { date: d }),
      this.http.get("/developer/v2/recovery", { start, end, limit: "10" }).catch(() => null),
    ]);
    return RecoveryOut.parse(buildRecoveryProjection(raw, d, recoveryV2));
  }

  async getSleep(date?: string): Promise<SleepOutT> {
    const d = date ?? todayIso();
    const raw = await this.http.get<Record<string, unknown>>(
      "/home-service/v1/deep-dive/sleep/last-night",
      { date: d },
    );
    return SleepOut.parse(buildSleepProjection(raw, d));
  }

  async getStrain(date?: string): Promise<StrainOutT> {
    const d = date ?? todayIso();
    const raw = await this.http.get<Record<string, unknown>>(
      "/home-service/v1/deep-dive/strain",
      { date: d },
    );
    return StrainOut.parse(buildStrainDayProjection(raw, d));
  }

  async getWorkouts(range?: DateRange, limit = 10): Promise<WorkoutListOutT> {
    const window = range?.start && range?.end ? range : rangeFromDays(30);
    const raw = await this.http.get<Record<string, unknown>>(
      "/developer/v2/activity/workout",
      { start: window.start, end: window.end, limit: String(Math.min(limit + 10, 25)) },
    );
    return WorkoutListOut.parse(buildWorkoutsProjection(raw, limit));
  }

  async getTrend(metric: typeof METRICS[number], endDate?: string): Promise<TrendOutT> {
    const d = endDate ?? todayIso();
    const raw = await this.http.get<Record<string, unknown>>(
      `/progression-service/v3/trends/${metric}`,
      { endDate: d },
    );
    return TrendOut.parse(buildTrendProjection(raw, metric, d));
  }

  async getProfile(): Promise<ProfileOutT> {
    const userId = process.env.WHOOP_USER_ID;
    const query = userId ? { accountType: "users", id: userId } : {};
    const [bootstrap, hiddenBodyComp, hiddenHealthspan, stealth] = await Promise.all([
      this.http.get<Record<string, unknown>>("/users-service/v2/bootstrap", query),
      this.http.get("/users-service/v1/hidden-metrics/BODY_COMP").catch(() => null),
      this.http.get("/users-service/v1/hidden-metrics/HEALTHSPAN").catch(() => null),
      this.http.get("/users-service/v1/stealth-mode").catch(() => null),
    ]);
    return ProfileOut.parse(buildProfileProjection(bootstrap, hiddenBodyComp, hiddenHealthspan, stealth));
  }

  async getCommunities(opts: {
    teamType?: "ALL" | "COMMUNITY" | "TEAM" | "BUSINESS";
    metric?: "strain" | "sleep" | "recovery";
    period?: "day" | "week" | "month";
    limit?: number;
    offset?: number;
  } = {}): Promise<CommunitiesOutT> {
    const { teamType = "ALL", metric = "strain", period = "week", limit = 50, offset = 0 } = opts;
    const userId = process.env.WHOOP_USER_ID;
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    if (period === "week") startDate.setUTCDate(today.getUTCDate() - 6);
    else if (period === "month") startDate.setUTCDate(today.getUTCDate() - 29);
    const params: Record<string, string> = {
      teamType,
      includeOwnerDetails: "true",
      includeUserRank: "true",
      leaderboardType: metric,
      period,
      startDate: startDate.toISOString().slice(0, 10),
      endDate,
      offset: String(offset),
      limit: String(limit),
    };
    if (userId) params.userId = userId;
    const raw = await this.http.get<Record<string, unknown>>(
      "/community-service/v1/communities/memberships",
      params,
    );
    return CommunitiesOut.parse(buildCommunitiesProjection(raw, teamType, metric, period));
  }

  async getLeaderboard(communityId: number, opts: {
    metric?: "recovery" | "sleep" | "strain";
    window?: "day" | "week" | "month";
    date?: string;
  } = {}): Promise<LeaderboardOutT> {
    const { metric = "recovery", window = "day", date } = opts;
    const d = date ?? todayIso();
    const stat = metric === "recovery" ? "score" : metric === "sleep" ? "performance" : "day_strain";
    const windowSeg = window === "day" ? d : `average/${window}`;
    const userId = process.env.WHOOP_USER_ID;
    const params: Record<string, string> = { teamType: "COMMUNITY" };
    if (window !== "day") {
      const end = new Date(d + "T00:00:00Z");
      const start = new Date(end);
      if (window === "week") start.setUTCDate(end.getUTCDate() - 6);
      else start.setUTCDate(end.getUTCDate() - 29);
      params.startDate = start.toISOString().slice(0, 10);
      params.endDate = end.toISOString().slice(0, 10);
      params.includeCompliance = "true";
      params.complianceCutoff = "70";
    }
    const boardPath = `/community-service/v1/leaderboards/communities/${communityId}/${windowSeg}/${metric}/${stat}`;
    const [board, userRow] = await Promise.all([
      this.http.get<Record<string, unknown>>(boardPath, params),
      userId
        ? this.http.get(`${boardPath}/user/${userId}`, params).catch(() => null)
        : Promise.resolve(null),
    ]);
    return LeaderboardOut.parse(
      buildLeaderboardProjection(communityId, null, window, metric, d, board, userRow),
    );
  }

  async getCompare(opts: {
    window?: "week" | "month";
    endA?: string;
    endB?: string;
  } = {}): Promise<CompareOutT> {
    const { window = "week", endA, endB } = opts;
    const a = endA ?? todayIso();
    const offsetDays = window === "week" ? 7 : 30;
    const b = endB ?? new Date(new Date(a).getTime() - offsetDays * 86_400_000).toISOString().slice(0, 10);
    const metrics = ["RECOVERY", "SLEEP_PERFORMANCE", "DAY_STRAIN", "HRV", "RHR"] as const;

    const results = await Promise.all(
      metrics.flatMap((m) => [
        this.http.get<Record<string, unknown>>(`/progression-service/v3/trends/${m}`, { endDate: a }).then((r) => ({ m, end: a, r })),
        this.http.get<Record<string, unknown>>(`/progression-service/v3/trends/${m}`, { endDate: b }).then((r) => ({ m, end: b, r })),
      ]),
    );

    const metricRows = metrics.map((m) => {
      const aRes = results.find((x) => x.m === m && x.end === a);
      const bRes = results.find((x) => x.m === m && x.end === b);
      const aAvg = extractTrendAvg(aRes?.r ?? null, window);
      const bAvg = extractTrendAvg(bRes?.r ?? null, window);
      const deltaAbs = aAvg !== null && bAvg !== null ? aAvg - bAvg : null;
      const deltaPct = deltaAbs !== null && bAvg !== null && bAvg !== 0
        ? Math.round((deltaAbs / bAvg) * 1000) / 10
        : null;
      return { metric: m, a_avg: aAvg, b_avg: bAvg, delta_abs: deltaAbs, delta_pct: deltaPct, unit: null as string | null };
    });

    const startA = new Date(new Date(a).getTime() - offsetDays * 86_400_000).toISOString().slice(0, 10);
    const startB = new Date(new Date(b).getTime() - offsetDays * 86_400_000).toISOString().slice(0, 10);
    return CompareOut.parse({ window, a: { start_date: startA, end_date: a }, b: { start_date: startB, end_date: b }, metrics: metricRows });
  }

  async askCoach(message: string, context = "HOME"): Promise<CoachAskOutT> {
    const conv = await this.http.post<{ metadata?: { id?: string }; id?: string }>(
      "/ai-conversation-bff/v1/conversation",
      {
        context,
        fingerprint: `CHAT_WITH_AGENT${context}_${todayIso()}`,
        source_type: "CHAT_WITH_AGENT",
        chat_entrypoint_experience: "STANDARD",
        tracking_capabilities: { is_dismiss_tracking_enabled: false, is_seen_tracking_enabled: true },
      },
    );
    const conversationId = conv.metadata?.id ?? conv.id ?? "";
    const turn = await this.http.post<{ id?: string; turn_id?: string }>(
      `/ai-conversation-bff/v1/conversation/${conversationId}/turn`,
      { role: "user", content: message, is_suggestion: false, tracking_capabilities: { is_dismiss_tracking_enabled: false, is_seen_tracking_enabled: true } },
    );
    const turnId = turn.id ?? turn.turn_id ?? "";
    // Poll for response (faithful to totem coach_ask.ts:98-119)
    let responseText: string | null = null;
    let status = "PENDING";
    let stableFor = 0;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 850 + Math.floor(Math.random() * 550)));
      const r = await this.http.get<Record<string, unknown>>(
        `/ai-conversation-bff/v1/conversation/${conversationId}/turn/${turnId}`,
      );
      status = typeof r.turn_status === "string" ? r.turn_status.toUpperCase() : status;
      const latest = extractCoachText(Array.isArray(r.messages) ? r.messages : []);
      if (latest !== null) {
        stableFor = latest === responseText ? stableFor + 1 : 0;
        responseText = latest;
      }
      if (["COMPLETE", "COMPLETED", "DONE", "FINISHED"].includes(status)) break;
      if (responseText !== null && stableFor >= 2) break;
    }
    return CoachAskOut.parse({ conversation_id: conversationId, turn_id: turnId, response_text: responseText, turn_status: status, polled_iterations: 30, timed_out: false });
  }

  async getJournal(date?: string): Promise<JournalOutT> {
    const d = date ?? todayIso();
    const raw = await this.http.get<Record<string, unknown>>(
      `/journal-service/v3/journals/drafts/mobile/${d}`,
    );
    return JournalOut.parse(buildJournalProjection(raw, d));
  }

  async getStrengthActivities(): Promise<LiftCatalogOutT> {
    const raw = await this.http.get<Record<string, unknown>>("/weightlifting-service/v2/exercise");
    return LiftCatalogOut.parse(buildExerciseCatalogProjection(raw));
  }

  async getStress(date?: string): Promise<StressOutT> {
    const d = date ?? todayIso();
    const raw = await this.http.get<Record<string, unknown>>("/health-service/v2/stress-bff/" + d);
    return StressOut.parse(buildStressProjection(raw, d));
  }

  async getCardioLoad(): Promise<CardioLoadOutT> {
    const trend = await this.getTrend("DAY_STRAIN").catch(() => null);
    return CardioLoadOut.parse(buildCardioProjection(trend));
  }
}

// ---------------------------------------------------------------------------
// Minimal projections (passthrough where shapes align; adapt as needed)
// These are intentionally thin: the real projection logic lives in totem's
// src/projections/. We do just enough to satisfy the output schema.
// ---------------------------------------------------------------------------

function buildTodayProjection(
  home: unknown,
  sleep: unknown,
  recovery: unknown,
  state: unknown,
  date: string,
): unknown {
  const h = home as Record<string, unknown> | null;
  const recArr = extractRecords(recovery);
  const sleepArr = extractRecords(sleep);
  const rec0 = recArr[0] as Record<string, unknown> | undefined;
  const slp0 = sleepArr[0] as Record<string, unknown> | undefined;
  const st = state as Record<string, unknown> | null;

  return {
    date,
    recovery: {
      score: asNum(rec0?.score) ?? asNum((h?.recovery as Record<string, unknown>)?.score),
      state: asStr(rec0?.state) ?? asStr((h?.recovery as Record<string, unknown>)?.state),
      hrv_ms: asNum(rec0?.score_hrv),
      rhr_bpm: asNum(rec0?.resting_heart_rate),
    },
    sleep: {
      performance_pct: asNum((slp0?.score as Record<string, unknown>)?.sleep_performance_percentage) ?? asNum((h?.sleep as Record<string, unknown>)?.performancePct),
      total_sleep_ms: asNum((slp0?.score as Record<string, unknown>)?.total_sleep_ms) ?? null,
      time_in_bed_ms: asNum((slp0?.score as Record<string, unknown>)?.in_bed_duration_ms) ?? null,
      efficiency_pct: asNum((slp0?.score as Record<string, unknown>)?.sleep_efficiency_percentage) ?? null,
      stages: {
        rem_ms: asNum(((slp0?.score as Record<string, unknown>)?.stage_summary as Record<string, unknown>)?.rem_sleep_ms) ?? null,
        light_ms: asNum(((slp0?.score as Record<string, unknown>)?.stage_summary as Record<string, unknown>)?.light_sleep_ms) ?? null,
        sws_ms: asNum(((slp0?.score as Record<string, unknown>)?.stage_summary as Record<string, unknown>)?.sws_ms) ?? null,
        wake_ms: asNum(((slp0?.score as Record<string, unknown>)?.stage_summary as Record<string, unknown>)?.awake_ms) ?? null,
      },
      started_at: asStr(slp0?.start) ?? null,
      ended_at: asStr(slp0?.end) ?? null,
    },
    strain: {
      score: asNum((h?.strain as Record<string, unknown>)?.score),
      calories: asNum((h?.strain as Record<string, unknown>)?.kilojoule) ?? null,
      avg_hr_bpm: asNum((h?.strain as Record<string, unknown>)?.averageHeartRate),
      max_hr_bpm: asNum((h?.strain as Record<string, unknown>)?.maxHeartRate),
      workouts_count: asNum((h?.strain as Record<string, unknown>)?.workoutCount) ?? 0,
    },
    current_state: {
      state: asStr(st?.state) ?? null,
      sport_name: asStr((st as Record<string, unknown>)?.sportName) ?? null,
      started_at: asStr((st as Record<string, unknown>)?.startTime) ?? null,
    },
  };
}

function buildRecoveryProjection(
  raw: Record<string, unknown>,
  date: string,
  recoveryV2: unknown,
): unknown {
  const v2 = extractRecords(recoveryV2)[0] as Record<string, unknown> | undefined;
  const r = raw as Record<string, unknown>;
  return {
    date,
    score: asNum(r.score),
    state: asStr(r.state),
    hrv: {
      ms: asNum(v2?.score_hrv) ?? asNum(r.hrv),
      baseline_ms: asNum(r.hrvBaseline),
      delta_pct: asNum(r.hrvDeltaPct),
    },
    rhr: {
      bpm: asNum(v2?.resting_heart_rate) ?? asNum(r.rhr),
      baseline_bpm: asNum(r.rhrBaseline),
      delta_pct: asNum(r.rhrDeltaPct),
    },
    respiratory_rate: asNum((v2?.score as Record<string, unknown>)?.respiratory_rate) ?? asNum(r.respiratoryRate),
    spo2_pct: asNum((v2?.score as Record<string, unknown>)?.spo2_percentage) ?? asNum(r.spo2),
    skin_temp_c: asNum((v2?.score as Record<string, unknown>)?.skin_temp_celsius) ?? asNum(r.skinTemp),
    sleep_performance_pct: asNum(r.sleepPerformance),
    contributors: [],
    calibration_state: asStr(r.calibrationState) ?? null,
  };
}

function buildSleepProjection(raw: Record<string, unknown>, date: string): unknown {
  return {
    date,
    started_at: asStr(raw.start) ?? null,
    ended_at: asStr(raw.end) ?? null,
    total_sleep_ms: asNum(raw.totalSleepMs) ?? null,
    time_in_bed_ms: asNum(raw.timeInBedMs) ?? null,
    efficiency_pct: asNum(raw.sleepEfficiencyPct) ?? null,
    performance_pct: asNum(raw.performancePct) ?? null,
    consistency_pct: asNum(raw.consistencyPct) ?? null,
    debt_ms: asNum(raw.debtMs) ?? null,
    latency_ms: null,
    stages: {
      rem_ms: asNum(raw.remMs) ?? null,
      rem_pct: asNum(raw.remPct) ?? null,
      light_ms: asNum(raw.lightMs) ?? null,
      light_pct: asNum(raw.lightPct) ?? null,
      sws_ms: asNum(raw.swsMs) ?? null,
      sws_pct: asNum(raw.swsPct) ?? null,
      wake_ms: asNum(raw.wakeMs) ?? null,
      wake_pct: asNum(raw.wakePct) ?? null,
    },
    hypnogram: [],
    disturbances: asNum(raw.disturbances) ?? null,
    sleep_hr: { avg_bpm: asNum(raw.avgHr) ?? null, min_bpm: asNum(raw.minHr) ?? null },
    sleep_hrv_ms: null,
    respiratory_rate: null,
  };
}

function buildExerciseCatalogProjection(raw: Record<string, unknown>): unknown {
  // /weightlifting-service/v2/exercise returns an array of exercise objects.
  const exercises = Array.isArray(raw) ? raw : ((raw.exercises as unknown[]) ?? []);
  const items = (exercises as Record<string, unknown>[]).map((e) => ({
    exercise_id: asStr(e.exercise_id) ?? asStr(e.id) ?? "",
    name: asStr(e.name) ?? "",
    muscle_groups: Array.isArray(e.muscle_groups) ? e.muscle_groups as string[] : [],
    primary_muscle: asStr(e.primary_muscle) ?? "",
    equipment: asStr(e.equipment) ?? "",
    movement_pattern: asStr(e.movement_pattern) ?? "",
    laterality: asStr(e.laterality) ?? "BILATERAL",
  }));
  return { total_in_catalog: 372 as const, matched: items.length, truncated: false, exercises: items };
}

function buildCardioProjection(trend: unknown): unknown {
  const t = trend as Record<string, unknown> | null;
  const segs = Array.isArray(t?.segments) ? (t!.segments as Record<string, unknown>[]) : [];
  const byDate = new Map<string, number>();
  for (const seg of segs) {
    const pts = Array.isArray(seg.points)
      ? seg.points
      : Array.isArray(seg.values)
        ? seg.values
        : Array.isArray(seg.data)
          ? seg.data
          : [];
    for (const p of pts as Record<string, unknown>[]) {
      const date = asStr(p.date) ?? asStr(p.day) ?? asStr(p.label) ?? "";
      const val = asNum(p.value) ?? asNum(p.avg) ?? asNum(p.strain);
      if (date !== "" && val != null) byDate.set(date, val);
    }
  }
  const series = [...byDate.entries()]
    .map(([date, load]) => ({ date, load }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const loads = series.map((s) => s.load);
  const ewma = (arr: number[], n: number) => {
    if (arr.length === 0) return 0;
    const k = 2 / (n + 1);
    let v = arr[0];
    for (const x of arr) v = x * k + v * (1 - k);
    return Math.round(v * 10) / 10;
  };
  const ctl = ewma(loads, 28);
  const atl = ewma(loads.slice(-10), 7);
  const form = Math.round((ctl - atl) * 10) / 10;
  const status =
    series.length < 7 ? "Calibrating" : form > 1 ? "Productive" : form < -1.5 ? "Overreaching" : form < 0 ? "Maintaining" : "Peaking";
  return {
    date: series.length ? series[series.length - 1].date : todayIso(),
    load: ctl,
    status,
    atl,
    ctl,
    form,
    band: { lower: Math.round((ctl - 2) * 10) / 10, upper: Math.round((ctl + 2) * 10) / 10 },
    series,
    breakdown: [],
  };
}

function buildStressProjection(raw: Record<string, unknown>, date: string): unknown {
  const rawSamples = Array.isArray(raw.samples) ? raw.samples : Array.isArray(raw.points) ? raw.points : [];
  const samples = (rawSamples as Record<string, unknown>[])
    .map((sm) => ({ time: asStr(sm.time) ?? asStr(sm.timestamp) ?? "", value: asNum(sm.value) ?? asNum(sm.stress) ?? 0 }))
    .filter((sm) => sm.time !== "");
  const vals = samples.map((sm) => sm.value);
  const bd = (raw.breakdown as Record<string, unknown>) ?? {};
  return {
    date,
    current: asNum(raw.current) ?? asNum(raw.score) ?? (vals.length ? vals[vals.length - 1] : 0),
    avg: asNum(raw.average) ?? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0),
    max: asNum(raw.max) ?? (vals.length ? Math.max(...vals) : 0),
    avg_hr_bpm: asNum(raw.average_heart_rate) ?? asNum(raw.avg_hr),
    confidence: asNum(raw.confidence),
    breakdown: {
      high_min: asNum(bd.high_min) ?? 0,
      medium_min: asNum(bd.medium_min) ?? 0,
      low_min: asNum(bd.low_min) ?? 0,
    },
    samples,
  };
}

function buildStrainDayProjection(raw: Record<string, unknown>, date: string): unknown {
  return {
    date,
    score: asNum(raw.score),
    target: {
      value: asNum(raw.strainTarget) != null ? (asNum(raw.strainTarget)! * 21) : null,
      optimal_lower: asNum(raw.optimalLower) != null ? (asNum(raw.optimalLower)! * 21) : null,
      optimal_upper: asNum(raw.optimalUpper) != null ? (asNum(raw.optimalUpper)! * 21) : null,
    },
    calories: asNum(raw.kilojoule) ?? null,
    avg_hr_bpm: asNum(raw.averageHeartRate) ?? null,
    max_hr_bpm: asNum(raw.maxHeartRate) ?? null,
    zone_durations: {
      zone_0_ms: asNum(raw.zone0Ms) ?? null,
      zone_1_ms: asNum(raw.zone1Ms) ?? null,
      zone_2_ms: asNum(raw.zone2Ms) ?? null,
      zone_3_ms: asNum(raw.zone3Ms) ?? null,
      zone_4_ms: asNum(raw.zone4Ms) ?? null,
      zone_5_ms: asNum(raw.zone5Ms) ?? null,
    },
    workouts_count: asNum(raw.workoutCount) ?? 0,
    steps: asNum(raw.steps) ?? null,
    strength_activity_time_ms: asNum(raw.strengthActivityTimeMs) ?? null,
  };
}

function buildWorkoutsProjection(raw: unknown, limit: number): unknown {
  const records = extractRecords(raw);
  return records.slice(0, limit).map((w) => {
    const r = w as Record<string, unknown>;
    return {
      id: asStr(r.id) ?? "",
      sport_name: asStr(r.sport_name) ?? asStr(r.sportName) ?? "Unknown",
      start: asStr(r.start) ?? "",
      end: asStr(r.end) ?? "",
      duration_ms: asNum((r.score as Record<string, unknown>)?.duration_ms) ?? asNum(r.durationMs) ?? 0,
      strain: asNum((r.score as Record<string, unknown>)?.strain) ?? asNum(r.strain),
      avg_hr_bpm: asNum((r.score as Record<string, unknown>)?.average_heart_rate) ?? asNum(r.avgHr),
      max_hr_bpm: asNum((r.score as Record<string, unknown>)?.max_heart_rate) ?? asNum(r.maxHr),
      calories: asNum((r.score as Record<string, unknown>)?.kilojoule) ?? asNum(r.calories),
      distance_m: asNum((r.score as Record<string, unknown>)?.distance_meter) ?? asNum(r.distanceM),
    };
  });
}

function buildTrendProjection(raw: Record<string, unknown>, metric: string, endDate: string): unknown {
  return {
    metric,
    end_date: endDate,
    segments: Array.isArray(raw.segments) ? raw.segments : [],
    cardio_fitness_level: asStr(raw.cardioFitnessLevel) ?? null,
  };
}

function buildProfileProjection(
  bootstrap: Record<string, unknown>,
  _hiddenBodyComp: unknown,
  _hiddenHealthspan: unknown,
  stealth: unknown,
): unknown {
  const user = (bootstrap.user as Record<string, unknown>) ?? bootstrap;
  const profile = (user.profile as Record<string, unknown>) ?? {};
  const membership = (bootstrap.membership as Record<string, unknown>) ?? {};
  return {
    user_id: asNum(user.user_id) ?? asNum(user.id) ?? 0,
    account_id: asNum(user.account_id) ?? asNum(user.id) ?? 0,
    email: asStr(user.email) ?? "",
    username: asStr(profile.username) ?? asStr(user.username) ?? "",
    first_name: asStr(profile.first_name) ?? asStr(user.first_name) ?? "",
    last_name: asStr(profile.last_name) ?? asStr(user.last_name) ?? "",
    birthday: asStr(profile.dob) ?? null,
    gender: asStr(profile.gender) ?? null,
    height: { m: asNum(profile.height), cm: asNum(profile.height_cm), ft: null },
    weight: { kg: asNum(profile.weight), lb: null },
    city: asStr(profile.city) ?? null,
    country: asStr(profile.country_code) ?? null,
    timezone_offset: asStr(profile.timezone_offset) ?? "+00:00",
    bio_data: { max_hr_bpm: asNum(profile.max_heart_rate) ?? 180, resting_hr_bpm: asNum(profile.resting_heart_rate) ?? 55, min_hr_bpm: null },
    fitness_level: asStr(profile.fitness_level) ?? null,
    membership: { status: asStr(membership.status) ?? "active", in_effect: true },
    privacy: {
      stealth_mode: Boolean((stealth as Record<string, unknown>)?.enabled),
      body_comp_hidden: false,
      healthspan_hidden: false,
    },
  };
}

function buildCommunitiesProjection(
  raw: Record<string, unknown>,
  teamType: string,
  metric: string,
  period: string,
): unknown {
  const records = extractRecords(raw) as Record<string, unknown>[];
  return {
    total_count: asNum(raw.total_count) ?? records.length,
    offset: asNum(raw.offset) ?? 0,
    team_type_filter: teamType,
    leaderboard_metric: metric,
    period,
    communities: records.map((c) => ({
      id: asNum(c.id) ?? 0,
      name: asStr(c.name) ?? "",
      avatar_url: asStr(c.avatar_url) ?? null,
      banner_url: asStr(c.banner_url) ?? null,
      about: asStr(c.about) ?? null,
      private: typeof c.private === "boolean" ? c.private : null,
      member_count: asNum(c.member_count) ?? null,
      owner_id: asNum(c.owner_id) ?? null,
      team_type: asStr(c.team_type) ?? null,
      membership: {
        member_type: asStr((c.membership as Record<string, unknown>)?.member_type) ?? null,
        notification_setting: null,
        unread_count: null,
        online: null,
        joined_at: null,
        last_online: null,
      },
      rank: c.rank ? {
        rank: asNum((c.rank as Record<string, unknown>)?.rank) ?? null,
        score: asNum((c.rank as Record<string, unknown>)?.score) ?? null,
        metric: asStr((c.rank as Record<string, unknown>)?.metric) ?? null,
        period: asStr((c.rank as Record<string, unknown>)?.period) ?? null,
      } : null,
    })),
  };
}

function buildLeaderboardProjection(
  communityId: number,
  communityName: string | null,
  window: string,
  metric: string,
  date: string,
  board: Record<string, unknown>,
  userRow: unknown,
): unknown {
  const records = extractRecords(board) as Record<string, unknown>[];
  const ur = userRow as Record<string, unknown> | null;
  return {
    community_id: communityId,
    community_name: communityName,
    window,
    metric,
    date_label: date,
    average: asNum(board.average) ?? null,
    total_compliant: asNum(board.total_compliant) ?? null,
    total_empty: asNum(board.total_empty) ?? null,
    records: records.map((r, i) => ({
      rank: asNum(r.rank) ?? i + 1,
      user_id: asNum(r.user_id) ?? 0,
      first_name: asStr(r.first_name) ?? "",
      last_name: asStr(r.last_name) ?? "",
      value: asNum(r.value) ?? null,
      secondary_value: asNum(r.secondary_value) ?? null,
    })),
    your_position: {
      rank: asNum(ur?.rank) ?? null,
      value: asNum(ur?.value) ?? null,
      in_window: ur != null,
    },
  };
}

function buildJournalProjection(raw: Record<string, unknown>, date: string): unknown {
  const behaviors = Array.isArray(raw.behaviors) ? raw.behaviors : [];
  return {
    date,
    cycle_id: asNum(raw.cycle_id) ?? null,
    journal_entry_id: asStr(raw.journal_entry_id) ?? null,
    notes: asStr(raw.notes) ?? null,
    behaviors: (behaviors as Record<string, unknown>[]).map((b) => ({
      behavior_tracker_id: asNum(b.behavior_tracker_id) ?? 0,
      title: asStr(b.title) ?? "",
      category: asStr(b.category) ?? "",
      internal_name: asStr(b.internal_name) ?? "",
      answered_yes: typeof b.answered_yes === "boolean" ? b.answered_yes : null,
      magnitude_value: asNum(b.magnitude_value) ?? null,
      magnitude_label: asStr(b.magnitude_label) ?? null,
      recorded_at: asStr(b.recorded_at) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function extractRecords(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const d = data as Record<string, unknown> | null;
  if (!d) return [];
  if (Array.isArray(d.records)) return d.records;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

function extractTrendAvg(raw: Record<string, unknown> | null, window: "week" | "month"): number | null {
  if (!raw) return null;
  const segs = Array.isArray(raw.segments) ? raw.segments : [];
  const seg = (segs as Record<string, unknown>[]).find((s) => s.label === window);
  return asNum(seg?.avg);
}

function extractCoachText(msgs: unknown[]): string | null {
  for (const m of msgs) {
    if (typeof m !== "object" || m === null) continue;
    const msg = m as Record<string, unknown>;
    if (msg.role && msg.role !== "assistant") continue;
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.items)) {
      for (const item of msg.items) {
        const it = item as Record<string, unknown>;
        const c = it.content as Record<string, unknown> | undefined;
        if (c && typeof c.text === "string") return c.text;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Demo client (imported lazily to avoid bundling fixtures in live mode)
// ---------------------------------------------------------------------------

async function loadDemoClient(): Promise<WhoopClientInterface> {
  const mod = await import("./demo/index");
  return mod.createDemoClient();
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _client: WhoopClientInterface | null = null;

export async function getWhoopClient(): Promise<WhoopClientInterface> {
  if (_client) return _client;
  if (process.env.WHOOP_MODE === "live") {
    _client = new LiveWhoopClient();
  } else {
    _client = await loadDemoClient();
  }
  return _client;
}
