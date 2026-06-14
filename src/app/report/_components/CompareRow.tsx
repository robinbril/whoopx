import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CardLabel } from "@/components/ui/Card";
import type { CompareMetricRow } from "@/lib/whoop/schemas/compare";

interface CompareRowProps {
  row: CompareMetricRow;
}

/** For RHR, a lower value is better, so the color logic is inverted. */
function isPositive(metric: string, deltaPct: number): boolean {
  if (metric === "RHR") return deltaPct < 0;
  return deltaPct > 0;
}

function metricLabel(metric: string): string {
  switch (metric) {
    case "RECOVERY": return "Recovery";
    case "SLEEP_PERFORMANCE": return "Sleep";
    case "DAY_STRAIN": return "Strain";
    case "HRV": return "HRV";
    case "RHR": return "Resting HR";
    default: return metric.replace(/_/g, " ");
  }
}

function metricColor(metric: string): string {
  switch (metric) {
    case "RECOVERY":
    case "HRV":
      return "var(--color-recovery-green)";
    case "SLEEP_PERFORMANCE":
      return "var(--color-sleep)";
    default:
      return "var(--color-strain)";
  }
}

export function CompareRow({ row }: CompareRowProps) {
  const { metric, a_avg, b_avg, delta_pct, unit } = row;
  if (a_avg === null || b_avg === null || delta_pct === null) return null;

  const good = isPositive(metric, delta_pct);
  const neutral = Math.abs(delta_pct) < 0.5;
  const signColor = neutral
    ? "var(--color-muted)"
    : good
      ? "var(--color-recovery-green)"
      : "var(--color-recovery-red)";

  const Icon = neutral ? Minus : good ? TrendingUp : TrendingDown;

  const fmtVal = (v: number) =>
    metric === "DAY_STRAIN"
      ? v.toFixed(1)
      : metric === "HRV"
        ? Math.round(v).toString()
        : Math.round(v).toString();

  const displayUnit = unit ?? (metric === "HRV" ? "ms" : metric === "RHR" ? "bpm" : "%");

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line-soft last:border-0">
      <div
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: metricColor(metric) }}
      />
      <span className="flex-1 text-[13px] font-medium text-fg">{metricLabel(metric)}</span>
      <span className="tabular text-[13px] text-muted">
        {fmtVal(b_avg)}{displayUnit}
        <span className="mx-1 text-dim">/</span>
        {fmtVal(a_avg)}{displayUnit}
      </span>
      <div className="flex items-center gap-1 min-w-[52px] justify-end" style={{ color: signColor }}>
        <Icon size={14} strokeWidth={2.5} />
        <span className="tabular text-[12px] font-semibold">
          {delta_pct > 0 ? "+" : ""}{delta_pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function CompareSectionHeader() {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="flex-1" />
      <CardLabel className="text-right">
        <span className="text-dim">prev</span>
        <span className="mx-1 text-faint">/</span>
        this wk
      </CardLabel>
      <div className="min-w-[52px]" />
    </div>
  );
}
