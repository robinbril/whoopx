import { z } from "zod";
import { IsoDateTime, withPreview } from "./primitives";

// GET /journal-service/v3/journals/drafts/mobile/{date}

export const JournalBehaviorSchema = z.object({
  behavior_tracker_id: z.number().int(),
  title: z.string(),
  question: z.string(),
  internal_name: z.string(),
  category: z.string(),
  magnitude: z.enum(["bare", "boolean", "magnitude"]),
  status: z.literal("active"),
});
export type JournalBehavior = z.infer<typeof JournalBehaviorSchema>;

export const JournalOut = z.object({
  date: z.iso.date(),
  cycle_id: z.number().int().nullable(),
  journal_entry_id: z.string().nullable(),
  notes: z.string().nullable(),
  behaviors: z.array(z.object({
    behavior_tracker_id: z.number().int(),
    title: z.string(),
    category: z.string(),
    internal_name: z.string(),
    answered_yes: z.boolean().nullable(),
    magnitude_value: z.number().nullable(),
    magnitude_label: z.string().nullable(),
    recorded_at: IsoDateTime.nullable(),
  })),
});
export type JournalOutT = z.infer<typeof JournalOut>;

export const JournalLogOut = withPreview(z.object({
  logged: z.literal(true),
  date: z.iso.date(),
  behaviors_count: z.number().int(),
}));
