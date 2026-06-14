import { z } from "zod";

// GET /weightlifting-service/v2/exercise (catalog)
// GET /weightlifting-service/v3/exercise/{id} (single exercise)
// GET /weightlifting-service/v3/exercise/{id}/exercise_history
// GET /weightlifting-service/v3/prs

export const LiftCatalogOut = z.object({
  total_in_catalog: z.literal(372),
  matched: z.number().int(),
  truncated: z.boolean(),
  exercises: z.array(z.object({
    exercise_id: z.string(),
    name: z.string(),
    muscle_groups: z.array(z.string()),
    primary_muscle: z.string(),
    equipment: z.string(),
    movement_pattern: z.string(),
    laterality: z.string(),
  })),
});
export type LiftCatalogOutT = z.infer<typeof LiftCatalogOut>;
