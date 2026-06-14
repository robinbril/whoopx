import { formatDurationMin } from "@/lib/format";
import type { BarSegment } from "@/components/viz/StackedBar";

/** Zone colors matching WHOOP palette (zone1 = easy blue -> zone5 = red). */
const ZONE_COLORS: [string, string, string, string, string] = [
  "#4f8bd6",
  "#26e07a",
  "#f7c13a",
  "#ff8a3d",
  "#fb4b4b",
];

/**
 * Estimates heart-rate zone distribution from total duration and strain.
 * Strain 0-21 biases how much time falls in upper zones.
 * The distribution sums to 1.0 and is plausible for cardio training.
 */
export function estimateHrZones(durationMs: number, strain: number): BarSegment[] {
  // Normalise strain to 0-1.
  const s = Math.min(Math.max(strain / 21, 0), 1);

  // Base weights for low-effort workout; higher strain shifts mass to zones 3-5.
  const w1 = 0.30 - s * 0.20;
  const w2 = 0.30 - s * 0.10;
  const w3 = 0.20 + s * 0.05;
  const w4 = 0.12 + s * 0.12;
  const w5 = 0.08 + s * 0.13;

  const weights = [w1, w2, w3, w4, w5];
  const totalMin = durationMs / 60000;

  return weights.map((w, i) => {
    const minutes = totalMin * w;
    return {
      label: `Zone ${i + 1}`,
      value: minutes,
      color: ZONE_COLORS[i],
      display: formatDurationMin(minutes),
    };
  });
}
