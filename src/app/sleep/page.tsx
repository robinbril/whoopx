import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { SleepRing } from "@/components/viz/SleepRing";
import { SleepStages } from "@/components/viz/SleepStages";
import { Hypnogram } from "@/components/viz/Hypnogram";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { CoachTip } from "@/components/CoachTip";
import { formatDurationMin } from "@/lib/format";
import { TonightCard } from "./_components/TonightCard";

/** Format total minutes as "HH:MM" 24-hour string. Minutes-from-midnight may be
 *  negative (prior evening); we normalise into a 0-1439 range first. */
function clockLabel(minutesFromMidnight: number): string {
  const normalised = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const h = Math.floor(normalised / 60);
  const m = normalised % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function SleepPage() {
  const client = await getWhoopClient();
  const s = await client.getSleep();
  const min = (ms: number | null) => (ms ?? 0) / 60000;

  // Tonight schedule derived from debt
  const sleepNeededMin = Math.round(480 + (s.debt_ms ?? 0) / 60000);
  const wakeMin = 7 * 60;           // 07:00 = 420 min from midnight
  const bedtimeMin = wakeMin - sleepNeededMin; // may be negative (prev evening)
  const windDownMin = bedtimeMin - 30;

  return (
    <>
      <TopBar title="Sleep" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex justify-center">
          <SleepRing value={s.performance_pct ?? 0} size={232} />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          <span className="tabular font-semibold text-fg">{formatDurationMin(min(s.total_sleep_ms))}</span> asleep
          {" "}&middot; {formatDurationMin(min(s.time_in_bed_ms))} in bed
        </p>

        <Card className="mt-7">
          <CardLabel>Sleep stages</CardLabel>
          <div className="mt-4">
            <SleepStages
              deep={min(s.stages.sws_ms)}
              rem={min(s.stages.rem_ms)}
              light={min(s.stages.light_ms)}
              awake={min(s.stages.wake_ms)}
            />
          </div>
        </Card>

        <TonightCard
          sleepNeededLabel={formatDurationMin(sleepNeededMin)}
          windDownTime={clockLabel(windDownMin)}
          bedtimeTime={clockLabel(bedtimeMin)}
          wakeTime={clockLabel(wakeMin)}
          schedule={{ windDownMin, bedtimeMin, wakeMin }}
        />

        {s.hypnogram.length > 0 && (
          <Card className="mt-3">
            <CardLabel>Last night</CardLabel>
            <div className="mt-4">
              <Hypnogram segments={s.hypnogram} />
            </div>
          </Card>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="Efficiency" value={(s.efficiency_pct ?? 0).toFixed(0)} unit="%" />
          <StatTile label="Consistency" value={s.consistency_pct ?? 0} unit="%" />
          <StatTile label="Sleep debt" value={formatDurationMin(min(s.debt_ms))} />
          <StatTile label="Disturbances" value={s.disturbances ?? 0} />
          <StatTile label="Sleep HR" value={s.sleep_hr.avg_bpm ?? 0} unit="bpm" />
          <StatTile label="Restorative" value={`${Math.round((s.stages.rem_pct ?? 0) + (s.stages.sws_pct ?? 0))}%`} />
        </div>

        <CoachTip
          message={`You slept ${formatDurationMin(min(s.total_sleep_ms))} at ${s.performance_pct ?? 0}% performance. ${(s.performance_pct ?? 0) >= 85 ? "A strong night for recovery." : "Some room to improve duration and consistency."}`}
          source="Based on last night's sleep"
          prompt={`I slept ${formatDurationMin(min(s.total_sleep_ms))} at ${s.performance_pct ?? 0}% performance. How can I improve my sleep?`}
        />
      </div>
    </>
  );
}
