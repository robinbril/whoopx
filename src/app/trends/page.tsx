import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { TrendChart } from "@/components/viz/TrendChart";
import { getWhoopClient } from "@/lib/whoop/client";
import { METRICS } from "@/lib/whoop/schemas/trend";
import type { TrendOutT } from "@/lib/whoop/schemas/trend";
import { cn } from "@/lib/utils";
import { AnalysisTable } from "./_components/AnalysisTable";

// The five most useful metrics to surface in the toggle pill bar.
const PILL_METRICS = ["HRV", "RHR", "RECOVERY", "DAY_STRAIN", "SLEEP_PERFORMANCE"] as const;
type PillMetric = typeof PILL_METRICS[number];

function isPillMetric(m: string): m is PillMetric {
  return (PILL_METRICS as readonly string[]).includes(m);
}

// Color per metric.
function metricColor(metric: string): string {
  switch (metric) {
    case "HRV":
    case "RECOVERY":
      return "var(--color-recovery-green)";
    case "SLEEP_PERFORMANCE":
      return "var(--color-sleep)";
    default:
      return "var(--color-strain)";
  }
}

// Human-readable label for pill.
function metricLabel(metric: string): string {
  switch (metric) {
    case "HRV": return "HRV";
    case "RHR": return "RHR";
    case "RECOVERY": return "Recovery";
    case "DAY_STRAIN": return "Strain";
    case "SLEEP_PERFORMANCE": return "Sleep";
    default: return metric;
  }
}

// Unit label shown next to the value.
function metricUnit(metric: string): string {
  switch (metric) {
    case "HRV": return "ms";
    case "RHR": return "bpm";
    case "RECOVERY":
    case "SLEEP_PERFORMANCE": return "%";
    default: return "";
  }
}

// Pick the "week" segment, fall back to first segment.
function weekSegment(trend: TrendOutT) {
  return trend.segments.find((s) => s.label === "week") ?? trend.segments[0] ?? null;
}

// Map segment points to TrendChart [{label, value}].
function toChartPoints(trend: TrendOutT): { label: string; value: number }[] {
  const seg = weekSegment(trend);
  if (!seg) return [];
  return seg.points
    .filter((p): p is typeof p & { value: number } => p.value !== null)
    .map((p) => ({
      label: new Date(p.date).toLocaleDateString("en-US", { weekday: "short" }),
      value: p.value,
    }));
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const { metric: rawMetric = "HRV" } = await searchParams;

  // Validate: must be a known METRICS value, otherwise default to HRV.
  const metric = (METRICS as readonly string[]).includes(rawMetric) ? rawMetric : "HRV";
  const safeMetric = metric as typeof METRICS[number];

  const client = await getWhoopClient();
  const trend = await client.getTrend(safeMetric);

  const seg = weekSegment(trend);
  const points = toChartPoints(trend);
  const color = metricColor(metric);
  const unit = seg?.unit ?? metricUnit(metric);

  const latest = points[points.length - 1]?.value ?? null;
  const avg = seg?.avg != null ? Math.round(seg.avg * 10) / 10 : null;

  return (
    <>
      <TopBar title="Trends" back />
      <div className="px-4 pb-12 pt-6 space-y-4">
        {/* Metric pill toggle */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {PILL_METRICS.map((m) => {
            const active = metric === m;
            return (
              <Link
                key={m}
                href={`/trends?metric=${m}`}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-strain text-white"
                    : "bg-surface-2 text-muted border border-line-soft",
                )}
              >
                {metricLabel(m)}
              </Link>
            );
          })}
        </div>

        {/* Summary stats */}
        {(latest !== null || avg !== null) && (
          <div className="flex gap-4">
            {latest !== null && (
              <div>
                <CardLabel>Latest</CardLabel>
                <p
                  className="tabular mt-1 text-3xl font-bold leading-none"
                  style={{ color }}
                >
                  {Number.isInteger(latest) ? latest : latest.toFixed(1)}
                  {unit && (
                    <span className="ml-1 text-sm font-medium text-muted">{unit}</span>
                  )}
                </p>
              </div>
            )}
            {avg !== null && (
              <div>
                <CardLabel>7-day avg</CardLabel>
                <p className="tabular mt-1 text-3xl font-bold leading-none text-fg">
                  {Number.isInteger(avg) ? avg : avg.toFixed(1)}
                  {unit && (
                    <span className="ml-1 text-sm font-medium text-muted">{unit}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chart card */}
        <Card>
          <CardLabel>{metricLabel(metric)} · last 7 days</CardLabel>
          <div className="mt-4">
            {points.length > 0 ? (
              <TrendChart data={points} color={color} unit={unit} height={180} />
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-dim">
                No data for this period.
              </div>
            )}
          </div>
          {seg && (
            <div className="mt-4 flex gap-5">
              {seg.min !== null && (
                <div>
                  <CardLabel>Low</CardLabel>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-fg">
                    {seg.min.toFixed(1)} {unit}
                  </p>
                </div>
              )}
              {seg.max !== null && (
                <div>
                  <CardLabel>High</CardLabel>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-fg">
                    {seg.max.toFixed(1)} {unit}
                  </p>
                </div>
              )}
              {seg.delta_pct !== null && (
                <div>
                  <CardLabel>vs prev</CardLabel>
                  <p
                    className="tabular mt-0.5 text-[14px] font-semibold"
                    style={{ color: seg.delta_pct >= 0 ? "var(--color-recovery-green)" : "var(--color-recovery-red)" }}
                  >
                    {seg.delta_pct >= 0 ? "+" : ""}{seg.delta_pct.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Period-delta analysis table */}
        <AnalysisTable trend={trend} metric={metric} color={color} unit={unit} />

        {/* All available metrics as a compact list */}
        <Card>
          <CardLabel>All metrics</CardLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {METRICS.map((m) => {
              const isActive = metric === m;
              const isPill = isPillMetric(m);
              return (
                <Link
                  key={m}
                  href={`/trends?metric=${m}`}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                    isActive
                      ? "border-strain bg-strain/10 text-strain"
                      : isPill
                        ? "border-line-soft bg-surface-2 text-muted"
                        : "border-line-soft bg-surface-3 text-dim",
                  )}
                >
                  {m.replace(/_/g, " ")}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
