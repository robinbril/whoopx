import { z } from "zod";

// ISO-8601 datetime that also accepts Whoop's no-colon offset form ("+0000" /
// "-0700", emitted by journal/pg-range endpoints). z.iso.datetime({ offset: true })
// accepts only "Z" and "±HH:MM". Use this for any field carrying a passthrough
// Whoop timestamp.
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
export const IsoDateTime = z.string().regex(ISO_DATETIME_RE, "invalid ISO-8601 datetime");

export const PgRange = z.object({
  start: IsoDateTime,
  end: IsoDateTime.nullable(),
});

export const HrZoneDurations = z.object({
  zone_0_ms: z.number().int().nullable(),
  zone_1_ms: z.number().int().nullable(),
  zone_2_ms: z.number().int().nullable(),
  zone_3_ms: z.number().int().nullable(),
  zone_4_ms: z.number().int().nullable(),
  zone_5_ms: z.number().int().nullable(),
});
export type HrZoneDurationsT = z.infer<typeof HrZoneDurations>;

export const RecoveryState = z.enum(["GREEN", "YELLOW", "RED"]);
export const SleepStage = z.enum(["AWAKE", "LIGHT", "REM", "SWS"]);
export const Medal = z.enum(["GOLD", "SILVER", "BRONZE"]);
export const Direction = z.enum(["positive", "negative", "neutral"]);
export const CalibrationState = z.enum(["CALIBRATING", "CALIBRATED"]);

// Write-tool preview schema (no external dep since we dropped MCP-server imports).
export const WritePreviewSchema = z.object({
  preview: z.literal(true),
  will_execute: z.object({
    method: z.string(),
    path: z.string(),
    body_summary: z.unknown(),
  }),
  set_confirm_true_to_run: z.literal(true),
});
export type WritePreview = z.infer<typeof WritePreviewSchema>;

export function withPreview<T extends z.ZodTypeAny>(receipt: T) {
  return z.union([WritePreviewSchema, receipt]);
}
