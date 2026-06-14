import type { LiftCatalogOutT } from "@/lib/whoop/schemas/strength";

type Exercise = LiftCatalogOutT["exercises"][number];

interface ExerciseGroupProps {
  exercises: Exercise[];
}

function MuscleChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {label.replace(/_/g, " ")}
    </span>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{exercise.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {exercise.equipment} &middot;{" "}
            <span className="capitalize lowercase">{exercise.movement_pattern.replace(/_/g, " ")}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-strain/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-strain">
          {exercise.laterality === "BILATERAL" ? "Both" : "Single"}
        </span>
      </div>
      {exercise.muscle_groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercise.muscle_groups.map((mg) => (
            <MuscleChip key={mg} label={mg} />
          ))}
        </div>
      )}
    </li>
  );
}

export function ExerciseGroup({ exercises }: ExerciseGroupProps) {
  return (
    <ul className="mt-2 divide-y divide-line-soft">
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.exercise_id} exercise={exercise} />
      ))}
    </ul>
  );
}
