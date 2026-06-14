import { notFound } from "next/navigation";
import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { StrainRing } from "@/components/viz/StrainRing";
import { StackedBar } from "@/components/viz/StackedBar";
import { formatDurationMs, formatTime, formatStrain } from "@/lib/format";
import { strainLabel } from "@/lib/recovery";
import { estimateHrZones } from "../_components/hrZones";

function formatWorkoutDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${day} ${month}`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await getWhoopClient();
  const workouts = await client.getWorkouts();
  const workout = workouts.find((w) => w.id === id);

  if (!workout) notFound();

  const strain = workout.strain ?? 0;
  const durationMs = workout.duration_ms;
  const startDate = new Date(workout.start);

  const hrZoneSegments = estimateHrZones(durationMs, strain);

  return (
    <>
      <TopBar title={workout.sport_name} back />

      <div className="px-4 pb-14 pt-6 space-y-4">
        {/* Strain ring */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <StrainRing value={strain} size={200} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Workout Strain
          </p>
        </div>

        {/* Date / time + duration */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardLabel>Date</CardLabel>
              <p className="mt-1 text-[15px] font-semibold text-fg">
                {formatWorkoutDate(workout.start)}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {formatTime(startDate)} &middot; {formatDurationMs(durationMs)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <CardLabel>Strain</CardLabel>
              <p
                className="tabular mt-1 text-2xl font-bold leading-none"
                style={{ color: "var(--color-strain)" }}
              >
                {formatStrain(strain)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
                {strainLabel(strain)}
              </p>
            </div>
          </div>
        </Card>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {workout.avg_hr_bpm != null && (
            <StatTile label="Avg HR" value={workout.avg_hr_bpm} unit="bpm" />
          )}
          {workout.max_hr_bpm != null && (
            <StatTile label="Max HR" value={workout.max_hr_bpm} unit="bpm" />
          )}
          {workout.calories != null && (
            <StatTile
              label="Calories"
              value={workout.calories.toLocaleString("en-US")}
              unit="cal"
            />
          )}
          <StatTile label="Duration" value={formatDurationMs(durationMs)} />
          {workout.distance_m != null && (
            <StatTile label="Distance" value={formatDistance(workout.distance_m)} />
          )}
        </div>

        {/* HR zones */}
        <Card>
          <CardLabel>Heart rate zones (est.)</CardLabel>
          <div className="mt-4">
            <StackedBar segments={hrZoneSegments} />
          </div>
        </Card>
      </div>
    </>
  );
}
