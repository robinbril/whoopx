/** Recovery zone logic. WHOOP thresholds: >=67 green, 34-66 yellow, <34 red. */

export type RecoveryZone = "green" | "yellow" | "red";

export function recoveryZone(percent: number): RecoveryZone {
  if (percent >= 67) return "green";
  if (percent >= 34) return "yellow";
  return "red";
}

/** CSS color value for a recovery percent (uses theme vars). */
export function recoveryColor(percent: number): string {
  switch (recoveryZone(percent)) {
    case "green":
      return "var(--color-recovery-green)";
    case "yellow":
      return "var(--color-recovery-yellow)";
    case "red":
      return "var(--color-recovery-red)";
  }
}

/** WHOOP-style short label. */
export function recoveryLabel(percent: number): string {
  switch (recoveryZone(percent)) {
    case "green":
      return "High";
    case "yellow":
      return "Moderate";
    case "red":
      return "Low";
  }
}

/** Strain is scored 0-21. Map to a 0-1 fraction of the dial. */
export const STRAIN_MAX = 21;
export function strainFraction(value: number): number {
  return Math.min(Math.max(value / STRAIN_MAX, 0), 1);
}

/** WHOOP strain band labels. */
export function strainLabel(value: number): string {
  if (value < 10) return "Light";
  if (value < 14) return "Moderate";
  if (value < 18) return "Strenuous";
  return "All Out";
}
