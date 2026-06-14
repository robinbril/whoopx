import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { ExerciseGroup } from "./_components/ExerciseGroup";

export default async function StrengthPage() {
  const client = await getWhoopClient();
  const catalog = await client.getStrengthActivities();

  const primaryMuscles = Array.from(
    new Set(catalog.exercises.map((e) => e.primary_muscle)),
  );

  const byMuscle = primaryMuscles.map((muscle) => ({
    muscle,
    exercises: catalog.exercises.filter((e) => e.primary_muscle === muscle),
  }));

  return (
    <>
      <TopBar title="Strength Trainer" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-4xl font-bold text-strain">
            {catalog.total_in_catalog}
          </span>
          <span className="text-sm font-medium text-muted">exercises in catalog</span>
        </div>

        {catalog.truncated && (
          <p className="mt-1 text-xs text-dim">
            Showing {catalog.matched} matched. Connect your WHOOP account to browse all.
          </p>
        )}

        <div className="mt-5 space-y-3">
          {byMuscle.map(({ muscle, exercises }) => (
            <Card key={muscle}>
              <CardLabel>{muscle.replace(/_/g, " ")}</CardLabel>
              <ExerciseGroup exercises={exercises} />
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
