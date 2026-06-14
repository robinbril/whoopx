import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { StrainRing } from "@/components/viz/StrainRing";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { CoachTip } from "@/components/CoachTip";
import { StackedBar } from "@/components/viz/StackedBar";
import { formatDurationMin, formatStrain } from "@/lib/format";

const ZONE_COLORS = ["#4f8bd6", "#26e07a", "#f7c13a", "#ff8a3d", "#fb4b4b"];

export default async function StrainPage() {
  const client = await getWhoopClient();
  const s = await client.getStrain();
  const min = (ms: number | null) => (ms ?? 0) / 60000;

  const zone = (ms: number | null, i: number, label: string) => {
    const v = min(ms);
    return { label, value: v, color: ZONE_COLORS[i], display: formatDurationMin(v) };
  };
  const zones = [
    zone(s.zone_durations.zone_1_ms, 0, "Zone 1"),
    zone(s.zone_durations.zone_2_ms, 1, "Zone 2"),
    zone(s.zone_durations.zone_3_ms, 2, "Zone 3"),
    zone(s.zone_durations.zone_4_ms, 3, "Zone 4"),
    zone(s.zone_durations.zone_5_ms, 4, "Zone 5"),
  ];

  return (
    <>
      <TopBar title="Strain" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex justify-center">
          <StrainRing value={s.score ?? 0} size={232} />
        </div>

        {s.target.optimal_lower != null && s.target.optimal_upper != null && (
          <p className="mt-5 text-center text-sm text-muted">
            Optimal{" "}
            <span className="font-semibold text-fg tabular">
              {formatStrain(s.target.optimal_lower)}&ndash;{formatStrain(s.target.optimal_upper)}
            </span>
            {s.target.value != null && (
              <>
                {" "}&middot; target <span className="font-semibold text-strain tabular">{formatStrain(s.target.value)}</span>
              </>
            )}
          </p>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3">
          <StatTile label="Calories" value={(s.calories ?? 0).toLocaleString("en-US")} unit="cal" />
          <StatTile label="Avg HR" value={s.avg_hr_bpm ?? 0} unit="bpm" />
          <StatTile label="Max HR" value={s.max_hr_bpm ?? 0} unit="bpm" />
          <StatTile label="Steps" value={(s.steps ?? 0).toLocaleString("en-US")} />
        </div>

        <Card className="mt-3">
          <CardLabel>Heart rate zones</CardLabel>
          <div className="mt-4">
            <StackedBar segments={zones} />
          </div>
        </Card>

        <CoachTip
          message={`You're at ${formatStrain(s.score ?? 0)} day strain. ${(s.score ?? 0) > (s.target.value ?? 14) ? "Above your target, ease off to protect tomorrow's recovery." : "Right in a productive range for today."}`}
          source="Based on today's strain"
          prompt={`My day strain is ${formatStrain(s.score ?? 0)} with a target of ${s.target.value != null ? formatStrain(s.target.value) : "n/a"}. Is that optimal for my recovery?`}
        />
      </div>
    </>
  );
}
