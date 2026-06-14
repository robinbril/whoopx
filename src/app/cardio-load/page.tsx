import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { CountUp } from "@/components/viz/CountUp";
import { CardioChart } from "@/components/viz/CardioChart";
import { StackedBar } from "@/components/viz/StackedBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { CoachTip } from "@/components/CoachTip";

const STATUS_COLOR: Record<string, string> = {
  Productive: "var(--color-recovery-green)",
  Maintaining: "var(--color-strain)",
  Peaking: "var(--color-sleep-rem)",
  Detraining: "var(--color-recovery-yellow)",
  Calibrating: "var(--color-dim)",
  Overreaching: "var(--color-recovery-red)",
  Fatigued: "var(--color-recovery-red)",
};

function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? "var(--color-strain)";
}

export default async function CardioLoadPage() {
  const client = await getWhoopClient();
  const c = await client.getCardioLoad();

  const breakdown = c.breakdown.map((b) => ({
    label: b.status,
    value: b.days,
    color: statusColor(b.status),
    display: `${b.days}d`,
  }));

  return (
    <>
      <TopBar title="Cardio Load" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex flex-col items-center pt-2">
          <span className="tabular text-[3.4rem] font-bold leading-none" style={{ color: statusColor(c.status) }}>
            <CountUp value={c.load} decimals={1} />
          </span>
          <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            {c.status} &middot; cardio load
          </span>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <StatTile label="Fitness" value={c.ctl.toFixed(1)} />
          <StatTile label="Fatigue" value={c.atl.toFixed(1)} />
          <StatTile
            label="Form"
            value={`${c.form > 0 ? "+" : ""}${c.form.toFixed(1)}`}
            color={c.form >= 0 ? "var(--color-recovery-green)" : "var(--color-recovery-red)"}
          />
        </div>

        <Card className="mt-3">
          <CardLabel>Last 30 days</CardLabel>
          <div className="mt-4">
            <CardioChart series={c.series} band={c.band} />
          </div>
        </Card>

        {breakdown.length > 0 && (
          <Card className="mt-3">
            <CardLabel>Status breakdown</CardLabel>
            <div className="mt-4">
              <StackedBar segments={breakdown} />
            </div>
          </Card>
        )}

        <CoachTip
          message={`Your cardio load is ${c.load.toFixed(1)} and you're ${c.status.toLowerCase()}. Form is ${c.form > 0 ? "+" : ""}${c.form.toFixed(1)}, fitness building faster than fatigue.`}
          source="Based on your 30-day training load"
          prompt={`My cardio load is ${c.load.toFixed(1)}, status ${c.status}, form ${c.form.toFixed(1)}. How should I train this week?`}
        />
      </div>
    </>
  );
}
