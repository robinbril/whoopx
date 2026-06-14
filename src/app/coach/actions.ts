"use server";

import { getWhoopClient } from "@/lib/whoop/client";
import { askClaudeSeat, SeatUnavailableError } from "@/lib/ai/claudeSeat";
import type { TodayOutT } from "@/lib/whoop/schemas/today";

const SYSTEM_PROMPT = [
  "You are the in-app AI coach for a WHOOP-style fitness and recovery tracker.",
  "You speak to one athlete about their own biometrics: recovery, sleep, strain, HRV, resting heart rate.",
  "Be direct, warm, and specific. Ground every claim in the numbers you are given; never invent data you do not have.",
  "Keep replies short: 2 to 4 sentences, or a tight bulleted plan when the user asks 'what should I do'.",
  "When recovery is low, steer toward rest and lighter strain; when it is high, encourage pushing. Explain the why in one clause.",
  "No medical claims, no diagnoses. If asked something outside training/recovery, answer briefly and steer back.",
  "Write in plain text only. Do not use markdown, asterisks, or em dashes; the chat renders raw text.",
].join(" ");

function fmt(n: number | null | undefined, suffix = ""): string {
  return n == null ? "n/a" : `${Math.round(n)}${suffix}`;
}

function hours(ms: number | null | undefined): string {
  if (ms == null) return "n/a";
  const h = ms / 3_600_000;
  return `${h.toFixed(1)}h`;
}

function buildContext(today: TodayOutT): string {
  const r = today.recovery;
  const s = today.sleep;
  const st = today.strain;
  return [
    `Today's WHOOP data (${today.date}):`,
    `- Recovery: ${fmt(r.score, "%")} (${r.state ?? "unknown"}), HRV ${fmt(r.hrv_ms, "ms")}, resting HR ${fmt(r.rhr_bpm, " bpm")}`,
    `- Sleep: ${fmt(s.performance_pct, "%")} performance, ${hours(s.total_sleep_ms)} total`,
    `- Strain: ${st.score == null ? "n/a" : st.score.toFixed(1)} of 21, ${fmt(st.avg_hr_bpm, " bpm")} avg HR, ${st.workouts_count ?? 0} workouts`,
  ].join("\n");
}

/**
 * Build the full user prompt: today's biometrics as context, then the athlete's
 * question. Falls back to a context-free prompt if data can't be loaded.
 */
async function buildUserPrompt(message: string): Promise<string> {
  try {
    const c = await getWhoopClient();
    const today = await c.getToday();
    return `${buildContext(today)}\n\nThe athlete asks: ${message}`;
  } catch {
    return `The athlete asks: ${message}`;
  }
}

export async function sendCoachMessage(message: string): Promise<string> {
  const trimmed = message.trim();
  if (trimmed === "") return "Ask me anything about your recovery, sleep, or training.";

  const userPrompt = await buildUserPrompt(trimmed);

  try {
    return await askClaudeSeat(userPrompt, SYSTEM_PROMPT);
  } catch (err) {
    // Seat unavailable or failed: fall back to the WHOOP coach / demo reply so
    // the chat never dead-ends.
    if (!(err instanceof SeatUnavailableError)) {
      console.error("[coach] seat call failed, falling back:", (err as Error).message);
    }
    try {
      const c = await getWhoopClient();
      const r = await c.askCoach(trimmed);
      if ("preview" in r) {
        return "Coach is in preview mode right now. Try again in a moment.";
      }
      return r.response_text ?? "I couldn't reach the coach right now. Try again shortly.";
    } catch {
      return "I couldn't reach the coach right now. Try again shortly.";
    }
  }
}
