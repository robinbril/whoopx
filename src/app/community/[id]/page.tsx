import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatStrain } from "@/lib/format";
import { recoveryColor } from "@/lib/recovery";
import { Avatar } from "../_components/Avatar";
import { LeaderboardRow } from "../_components/LeaderboardRow";

type Metric = "recovery" | "strain" | "sleep";

const METRICS: { key: Metric; label: string }[] = [
  { key: "recovery", label: "Recovery" },
  { key: "strain", label: "Strain" },
  { key: "sleep", label: "Sleep" },
];

const CURRENT_USER = "Alex";

function metricColor(metric: Metric, value: number): string {
  if (metric === "recovery") return recoveryColor(value);
  if (metric === "sleep") return "var(--color-sleep)";
  return "var(--color-strain)";
}

function metricValue(metric: Metric, value: number | null): { main: string; suffix?: string } {
  if (value == null) return { main: "--" };
  if (metric === "strain") return { main: formatStrain(value), suffix: "/21" };
  return { main: String(Math.round(value)), suffix: "%" };
}

function averageLabel(metric: Metric, average: number | null): string {
  if (average == null) return "--";
  if (metric === "strain") return formatStrain(average);
  return String(Math.round(average));
}

function secondaryLabel(metric: Metric, secondary: number | null): string | null {
  if (secondary == null) return null;
  if (metric === "recovery") return `${Math.round(secondary)}ms HRV`;
  if (metric === "sleep") return `${Math.round(secondary)}% perf`;
  return `${Math.round(secondary)} cal`;
}

function medalAccent(rank: number): string | null {
  if (rank === 1) return "#f7c13a";
  if (rank === 2) return "#c7ccd6";
  if (rank === 3) return "#cd7f4d";
  return null;
}

// Friendly labels for the compare metric keys (RECOVERY, SLEEP_PERFORMANCE, ...).
const COMPARE_LABELS: Record<string, string> = {
  RECOVERY: "Recovery",
  SLEEP_PERFORMANCE: "Sleep",
  DAY_STRAIN: "Strain",
  HRV: "HRV",
  RHR: "Resting HR",
};

function isMetric(value: string): value is Metric {
  return value === "recovery" || value === "strain" || value === "sleep";
}

export default async function CommunityLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ metric?: string }>;
}) {
  const { id } = await params;
  const { metric: metricParam } = await searchParams;
  const metric: Metric = metricParam && isMetric(metricParam) ? metricParam : "recovery";

  const client = await getWhoopClient();
  const board = await client.getLeaderboard(Number(id), { metric });
  const compare = await client.getCompare({ window: "week" });

  return (
    <>
      <TopBar title={board.community_name ?? "Leaderboard"} back />
      <div className="px-4 pb-12 pt-5">
        {/* Header: team average for the active metric */}
        <div className="flex items-end justify-between">
          <div>
            <CardLabel>Team average</CardLabel>
            <p className="tabular mt-1 text-3xl font-bold" style={{ color: metricColor(metric, board.average ?? 0) }}>
              {averageLabel(metric, board.average)}
              {metric !== "strain" && <span className="ml-0.5 text-lg text-muted">%</span>}
            </p>
          </div>
          <p className="pb-1 text-xs text-dim">
            {board.total_compliant ?? board.records.length} tracking · {board.date_label}
          </p>
        </div>

        {/* Metric toggle: three Link pills, server reads ?metric */}
        <div className="mt-4 flex gap-2 rounded-full border border-line-soft bg-surface p-1">
          {METRICS.map((m) => {
            const active = m.key === metric;
            return (
              <Link
                key={m.key}
                href={`/community/${id}?metric=${m.key}`}
                scroll={false}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 text-center text-[13px] font-semibold transition",
                  active ? "bg-surface-3 text-fg" : "text-dim active:bg-surface-2",
                )}
                aria-current={active ? "true" : undefined}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        {/* Ranked member rows */}
        <ul className="mt-4 space-y-2.5">
          {board.records.map((r, i) => {
            const you = r.first_name === CURRENT_USER;
            const medal = medalAccent(r.rank);
            const { main, suffix } = metricValue(metric, r.value);
            const secondary = secondaryLabel(metric, r.secondary_value);
            return (
              <LeaderboardRow key={r.user_id} index={i}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-[16px] border bg-surface px-3.5 py-3",
                    you ? "border-strain/60 ring-1 ring-strain/40" : "border-line-soft",
                  )}
                >
                  {/* Rank with medal accent for top 3 */}
                  <span
                    className="tabular w-6 shrink-0 text-center text-sm font-bold"
                    style={{ color: medal ?? "var(--color-dim)" }}
                  >
                    {r.rank}
                  </span>

                  <Avatar firstName={r.first_name} lastName={r.last_name} you={you} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {r.first_name} {r.last_name}
                      </p>
                      {you && (
                        <span className="shrink-0 rounded bg-strain/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-strain">
                          YOU
                        </span>
                      )}
                    </div>
                    {secondary && <p className="mt-0.5 text-xs text-dim tabular">{secondary}</p>}
                  </div>

                  <p
                    className="tabular shrink-0 text-right text-lg font-bold"
                    style={{ color: metricColor(metric, r.value ?? 0) }}
                  >
                    {main}
                    {suffix && <span className="ml-0.5 text-xs font-medium text-muted">{suffix}</span>}
                  </p>
                </div>
              </LeaderboardRow>
            );
          })}
        </ul>

        {/* Compare card: this week vs last week per metric */}
        <Card className="mt-6">
          <CardLabel>You · this week vs last</CardLabel>
          <ul className="mt-4 space-y-3.5">
            {compare.metrics.map((row) => {
              const delta = row.delta_pct;
              const up = (delta ?? 0) > 0;
              const flat = delta == null || delta === 0;
              const positive = up;
              const deltaColor = flat
                ? "var(--color-dim)"
                : positive
                  ? "var(--color-recovery-green)"
                  : "var(--color-recovery-red)";
              const unit = row.unit ?? "";
              return (
                <li key={row.metric} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{COMPARE_LABELS[row.metric] ?? row.metric}</span>

                  <span className="tabular text-right text-sm font-semibold text-fg">
                    {row.a_avg != null ? row.a_avg.toFixed(unit === "ms" || unit === "bpm" ? 0 : 1) : "--"}
                    {unit && <span className="ml-0.5 text-xs text-muted">{unit}</span>}
                  </span>

                  <span
                    className="tabular flex w-[68px] items-center justify-end gap-0.5 text-right text-xs font-semibold"
                    style={{ color: deltaColor }}
                  >
                    {flat ? (
                      <Minus size={13} />
                    ) : up ? (
                      <ArrowUpRight size={13} />
                    ) : (
                      <ArrowDownRight size={13} />
                    )}
                    {delta != null ? `${up ? "+" : ""}${delta.toFixed(1)}%` : "--"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-line-soft pt-3 text-[11px] text-dim">
            {compare.a.start_date} – {compare.a.end_date} vs {compare.b.start_date} – {compare.b.end_date}
          </p>
        </Card>
      </div>
    </>
  );
}
