import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { TickGauge } from "@/components/viz/TickGauge";
import { CountUp } from "@/components/viz/CountUp";
import { StressTimeline } from "@/components/viz/StressTimeline";
import { StackedBar } from "@/components/viz/StackedBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { CoachTip } from "@/components/CoachTip";
import { formatDurationMin } from "@/lib/format";

function stressLabel(v: number): string {
  if (v < 1) return "Low";
  if (v < 2) return "Moderate";
  return "High";
}

function stressColor(v: number): string {
  if (v < 1) return "var(--color-recovery-green)";
  if (v < 2) return "var(--color-recovery-yellow)";
  return "var(--color-recovery-red)";
}

const ZONES = [
  { upTo: 1, color: "var(--color-recovery-green)" },
  { upTo: 2, color: "var(--color-recovery-yellow)" },
  { upTo: 3, color: "var(--color-recovery-red)" },
];

export default async function StressPage() {
  const client = await getWhoopClient();
  const s = await client.getStress();

  const breakdown = [
    { label: "High", value: s.breakdown.high_min, color: "var(--color-recovery-red)", display: formatDurationMin(s.breakdown.high_min) },
    { label: "Medium", value: s.breakdown.medium_min, color: "var(--color-recovery-yellow)", display: formatDurationMin(s.breakdown.medium_min) },
    { label: "Low", value: s.breakdown.low_min, color: "var(--color-recovery-green)", display: formatDurationMin(s.breakdown.low_min) },
  ];

  return (
    <>
      <TopBar title="Stress" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex justify-center">
          <TickGauge value={s.current} max={3} zones={ZONES} size={232}>
            <span className="tabular text-[2.7rem] font-bold leading-none" style={{ color: stressColor(s.current) }}>
              <CountUp value={s.current} decimals={1} />
            </span>
            <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              {stressLabel(s.current)}
            </span>
          </TickGauge>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <StatTile label="Avg" value={s.avg.toFixed(1)} />
          <StatTile label="Peak" value={s.max.toFixed(1)} color={stressColor(s.max)} />
          <StatTile label="Avg HR" value={s.avg_hr_bpm ?? 0} unit="bpm" />
        </div>

        <Card className="mt-3">
          <CardLabel>Today · stress through the day</CardLabel>
          <div className="mt-4">
            <StressTimeline samples={s.samples} />
          </div>
        </Card>

        <Card className="mt-3">
          <CardLabel>Time in each zone</CardLabel>
          <div className="mt-4">
            <StackedBar segments={breakdown} />
          </div>
        </Card>

        <CoachTip
          message={`Your stress averaged ${s.avg.toFixed(1)} today (${stressLabel(s.avg).toLowerCase()}), peaking at ${s.max.toFixed(1)}. ${s.max >= 2 ? "A wind-down or breathwork this evening would help." : "A nicely balanced day."}`}
          source="Based on today's stress monitor"
          prompt={`My stress averaged ${s.avg.toFixed(1)} today and peaked at ${s.max.toFixed(1)}. How can I manage it better?`}
        />
      </div>
    </>
  );
}
