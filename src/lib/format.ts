/** Metric formatting helpers matching WHOOP's in-app conventions. */

/** Strain: 0-21 scale, one decimal (e.g. 12.4). */
export function formatStrain(value: number): string {
  return value.toFixed(1);
}

/** Recovery: integer percent (e.g. 67). */
export function formatRecovery(value: number): string {
  return String(Math.round(value));
}

/** HRV: integer milliseconds. */
export function formatHrv(ms: number): string {
  return String(Math.round(ms));
}

/** Resting heart rate: integer bpm. */
export function formatRhr(bpm: number): string {
  return String(Math.round(bpm));
}

/** Generic percent with sign (e.g. 89%). */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Duration from total minutes -> "7h 12m" / "48m". */
export function formatDurationMin(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Duration from milliseconds -> "7h 12m". */
export function formatDurationMs(ms: number): string {
  return formatDurationMin(ms / 60000);
}

/** Compact "7:12" clock-style sleep duration. */
export function formatClock(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Time of day in 24h (NL): "23:11". */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Respiratory rate: one decimal (e.g. 14.8). */
export function formatRespiratory(value: number): string {
  return value.toFixed(1);
}

/** Day label like "SATURDAY 14 JUN" (WHOOP top bar style). */
export function formatDayLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${day} ${month}`.toUpperCase();
}

/** Time-of-day greeting. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 6) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
