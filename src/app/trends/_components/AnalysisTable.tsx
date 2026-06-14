import { Card, CardLabel } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { TrendOutT } from "@/lib/whoop/schemas/trend";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalysisRow {
  label: string;
  delta: number;
  deltaDisplay: string;
  isPercent: boolean;
  sparkPoints: number[];
}

interface AnalysisTableProps {
  trend: TrendOutT;
  metric: string;
  color: string;
  unit: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// For lower-is-better metrics a negative delta is good (green).
const LOWER_IS_BETTER = new Set([
  "RHR",
  "SLEEP_DEBT_POST",
  "STRESS",
  "STRESS_DURING_SLEEP",
  "STRESS_DURING_NON_STRAIN",
]);

function lowerIsBetter(metric: string): boolean {
  return LOWER_IS_BETTER.has(metric) || metric.includes("DEBT");
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function sparkify(points: { value: number | null }[]): number[] {
  return points.flatMap((p) => (p.value !== null ? [p.value] : []));
}

/** Format a signed delta as "+3.2%" or "+4.1 ms" etc. */
function formatDelta(delta: number, isPercent: boolean, unit: string): string {
  const sign = delta >= 0 ? "+" : "";
  if (isPercent) return `${sign}${delta.toFixed(1)}%`;
  const abs = Math.abs(delta);
  const formatted = Number.isInteger(delta) ? delta.toString() : delta.toFixed(1);
  return `${sign}${formatted}${unit ? ` ${unit}` : ""}`;
}

function buildRows(trend: TrendOutT, unit: string): AnalysisRow[] {
  const rows: AnalysisRow[] = [];

  const weekSeg = trend.segments.find((s) => s.label === "week");
  const monthSeg = trend.segments.find((s) => s.label === "month");

  // Row 1 — "Last 7 days": latest value vs 7-day average.
  if (weekSeg) {
    const validPts = weekSeg.points.filter(
      (p): p is typeof p & { value: number } => p.value !== null,
    );
    const latest = validPts[validPts.length - 1]?.value;
    const weekAvg = weekSeg.avg;

    if (latest !== undefined && weekAvg !== null) {
      const delta = latest - weekAvg;
      const isPercent = unit === "%" ;
      rows.push({
        label: "Last 7 days",
        delta,
        deltaDisplay: formatDelta(delta, isPercent, isPercent ? "" : unit),
        isPercent,
        sparkPoints: sparkify(weekSeg.points),
      });
    }
  }

  // Row 2 — "vs prev 7 days": compares week avg against first-7-days avg from the month segment.
  if (monthSeg && weekSeg) {
    const allValid = monthSeg.points.filter(
      (p): p is typeof p & { value: number } => p.value !== null,
    );
    if (allValid.length >= 14) {
      const prev7 = allValid.slice(0, 7);
      const last7 = allValid.slice(-7);
      const prevAvg = avg(prev7.map((p) => p.value));
      const lastAvg = avg(last7.map((p) => p.value));
      const isPercent = unit === "%";
      const delta = lastAvg - prevAvg;

      rows.push({
        label: "vs prev 7 days",
        delta,
        deltaDisplay: formatDelta(delta, isPercent, isPercent ? "" : unit),
        isPercent,
        sparkPoints: sparkify(monthSeg.points),
      });
    } else if (monthSeg.delta_pct !== null) {
      // Fall back to the pre-computed delta_pct from the segment.
      rows.push({
        label: "vs prev period",
        delta: monthSeg.delta_pct,
        deltaDisplay: `${monthSeg.delta_pct >= 0 ? "+" : ""}${monthSeg.delta_pct.toFixed(1)}%`,
        isPercent: true,
        sparkPoints: sparkify(monthSeg.points),
      });
    }
  } else if (weekSeg && weekSeg.delta_pct !== null) {
    // Only a week segment available — show its delta_pct.
    rows.push({
      label: "vs prev period",
      delta: weekSeg.delta_pct,
      deltaDisplay: `${weekSeg.delta_pct >= 0 ? "+" : ""}${weekSeg.delta_pct.toFixed(1)}%`,
      isPercent: true,
      sparkPoints: sparkify(weekSeg.points),
    });
  }

  // Row 3 — "14-day avg vs 7-day avg" when month segment exists.
  if (monthSeg && weekSeg) {
    const monthAvg = monthSeg.avg;
    const weekAvg = weekSeg.avg;
    if (monthAvg !== null && weekAvg !== null) {
      const isPercent = unit === "%";
      const delta = weekAvg - monthAvg;
      rows.push({
        label: "7-day vs 14-day avg",
        delta,
        deltaDisplay: formatDelta(delta, isPercent, isPercent ? "" : unit),
        isPercent,
        sparkPoints: sparkify(monthSeg.points),
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Sparkline SVG (pure, no client JS)
// ---------------------------------------------------------------------------

interface SparklineProps {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}

function Sparkline({ points, color, width = 80, height = 24 }: SparklineProps) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((v) => height - ((v - min) / range) * (height - 4) - 2);

  const d = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${xs[xs.length - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`}
        fill={`url(#spark-grad-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Arrow icons (inline SVG — no client component needed)
// ---------------------------------------------------------------------------

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Neutral({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component (Server Component — no interactivity)
// ---------------------------------------------------------------------------

export function AnalysisTable({ trend, metric, color, unit }: AnalysisTableProps) {
  const rows = buildRows(trend, unit);
  const isLower = lowerIsBetter(metric);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardLabel>Analysis</CardLabel>
      <div className="mt-3 divide-y divide-line-soft">
        {rows.map((row) => {
          const positive = row.delta > 0;
          const neutral = Math.abs(row.delta) < 0.05;
          // For lower-is-better: a negative delta is good (green).
          const isGood = neutral ? false : isLower ? row.delta < 0 : row.delta > 0;
          const isBad = neutral ? false : isLower ? row.delta > 0 : row.delta < 0;

          const deltaColor = neutral
            ? "text-muted"
            : isGood
              ? "text-recovery-green"
              : isBad
                ? "text-recovery-red"
                : "text-muted";

          const ArrowIcon = neutral ? Neutral : positive ? ArrowUp : ArrowDown;

          return (
            <div
              key={row.label}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              {/* Period label */}
              <span className="min-w-[110px] shrink-0 text-[12px] font-medium text-muted">
                {row.label}
              </span>

              {/* Delta with arrow */}
              <span
                className={cn(
                  "flex items-center gap-0.5 tabular text-[13px] font-semibold",
                  deltaColor,
                )}
              >
                <ArrowIcon />
                {row.deltaDisplay}
              </span>

              {/* Sparkline — push to the right */}
              <span className="ml-auto shrink-0">
                <Sparkline
                  points={row.sparkPoints}
                  color={color}
                  width={80}
                  height={24}
                />
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
