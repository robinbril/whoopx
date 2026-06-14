import type { LiftCatalogOutT } from "../schemas/strength";

export const DEMO_LIFT_CATALOG: LiftCatalogOutT = {
  total_in_catalog: 372,
  matched: 5,
  truncated: true,
  exercises: [
    {
      exercise_id: "BENCH_PRESS",
      name: "Bench Press",
      muscle_groups: ["CHEST", "TRICEPS", "SHOULDERS"],
      primary_muscle: "CHEST",
      equipment: "Barbell",
      movement_pattern: "PUSH",
      laterality: "BILATERAL",
    },
    {
      exercise_id: "SQUAT",
      name: "Back Squat",
      muscle_groups: ["QUADS", "GLUTES", "HAMSTRINGS"],
      primary_muscle: "QUADS",
      equipment: "Barbell",
      movement_pattern: "SQUAT",
      laterality: "BILATERAL",
    },
    {
      exercise_id: "DEADLIFT",
      name: "Deadlift",
      muscle_groups: ["HAMSTRINGS", "GLUTES", "BACK"],
      primary_muscle: "HAMSTRINGS",
      equipment: "Barbell",
      movement_pattern: "HINGE",
      laterality: "BILATERAL",
    },
    {
      exercise_id: "PULL_UP",
      name: "Pull Up",
      muscle_groups: ["BACK", "BICEPS"],
      primary_muscle: "BACK",
      equipment: "Bodyweight",
      movement_pattern: "PULL",
      laterality: "BILATERAL",
    },
    {
      exercise_id: "OVERHEAD_PRESS",
      name: "Overhead Press",
      muscle_groups: ["SHOULDERS", "TRICEPS"],
      primary_muscle: "SHOULDERS",
      equipment: "Barbell",
      movement_pattern: "PUSH",
      laterality: "BILATERAL",
    },
  ],
};
