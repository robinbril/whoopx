import type { CompareOutT } from "@/lib/whoop/schemas/compare";

interface WeekSummaryLineProps {
  compare: CompareOutT;
}

function findDelta(compare: CompareOutT, metric: string): number | null {
  return compare.metrics.find((m) => m.metric === metric)?.delta_pct ?? null;
}

function trend(delta: number | null, inverted = false): "up" | "down" | "steady" {
  if (delta === null || Math.abs(delta) < 1.5) return "steady";
  if (inverted) return delta < 0 ? "up" : "down";
  return delta > 0 ? "up" : "down";
}

export function WeekSummaryLine({ compare }: WeekSummaryLineProps) {
  const recoveryTrend = trend(findDelta(compare, "RECOVERY"));
  const sleepTrend = trend(findDelta(compare, "SLEEP_PERFORMANCE"));
  const strainTrend = trend(findDelta(compare, "DAY_STRAIN"));
  const rhrTrend = trend(findDelta(compare, "RHR"), true);

  const parts: string[] = [];

  if (recoveryTrend === "up") parts.push("recovery was up");
  else if (recoveryTrend === "down") parts.push("recovery dipped");
  else parts.push("recovery held steady");

  if (sleepTrend === "up") parts.push("sleep improved");
  else if (sleepTrend === "down") parts.push("sleep was lighter");
  else parts.push("sleep stayed consistent");

  if (strainTrend === "up") parts.push("load increased");
  else if (strainTrend === "down") parts.push("load eased off");

  if (rhrTrend === "up") parts.push("resting HR trended down");

  const positives = [recoveryTrend, sleepTrend, rhrTrend].filter((t) => t === "up").length;
  const negatives = [recoveryTrend, sleepTrend, rhrTrend].filter((t) => t === "down").length;

  let closing: string;
  if (positives >= 2) closing = "a solid week.";
  else if (negatives >= 2) closing = "something to build on.";
  else closing = "a balanced week overall.";

  const sentence = parts.slice(0, 3).join(", ") + " - " + closing;
  const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  return (
    <p className="text-[13px] leading-relaxed text-muted px-0.5">
      {capitalized}
    </p>
  );
}
