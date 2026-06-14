import Link from "next/link";
import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { formatDurationMs, formatStrain } from "@/lib/format";
import { strainLabel } from "@/lib/recovery";
import { Dumbbell } from "lucide-react";

function formatWorkoutDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${weekday} ${day} ${month} · ${time}`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export default async function WorkoutsPage() {
  const client = await getWhoopClient();
  const workouts = await client.getWorkouts();

  return (
    <>
      <TopBar title="Workouts" back />
      <div className="px-4 pb-12 pt-6 space-y-3">
        {workouts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Dumbbell size={36} className="text-faint" />
            <p className="text-sm text-muted">No workouts recorded yet.</p>
            <p className="text-xs text-dim">Workouts will appear here once synced from your WHOOP.</p>
          </div>
        )}

        {workouts.map((w) => {
          const strain = w.strain ?? 0;
          return (
            <Link
              key={w.id}
              href={`/workouts/${w.id}`}
              className="block transition-transform active:scale-[0.99]"
            >
            <Card>
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-fg truncate">{w.sport_name}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{formatWorkoutDate(w.start)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="tabular text-xl font-bold leading-none"
                    style={{ color: "var(--color-strain)" }}
                  >
                    {formatStrain(strain)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">
                    {strainLabel(strain)}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5">
                <StatPair label="Duration" value={formatDurationMs(w.duration_ms)} />
                {w.avg_hr_bpm != null && (
                  <StatPair label="Avg HR" value={`${w.avg_hr_bpm} bpm`} />
                )}
                {w.max_hr_bpm != null && (
                  <StatPair label="Max HR" value={`${w.max_hr_bpm} bpm`} />
                )}
                {w.calories != null && (
                  <StatPair label="Calories" value={`${w.calories.toLocaleString("en-US")} cal`} />
                )}
                {w.distance_m != null && (
                  <StatPair label="Distance" value={formatDistance(w.distance_m)} />
                )}
              </div>
            </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <p className="tabular mt-0.5 text-[14px] font-semibold text-fg">{value}</p>
    </div>
  );
}
