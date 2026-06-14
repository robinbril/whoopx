import { z } from "zod";
import { withPreview } from "./primitives";

// POST /ai-conversation-bff/v1/conversation → { metadata: { id }, ... }
// POST /ai-conversation-bff/v1/conversation/{id}/turn → { id, turn_id, ... }
// GET  /ai-conversation-bff/v1/conversation/{id}/turn/{turnId}
//      → { turn_status, messages: [{ role, content|items }] }

export const CoachAskOut = withPreview(z.object({
  conversation_id: z.string(),
  turn_id: z.string(),
  response_text: z.string().nullable(),
  turn_status: z.string(),
  polled_iterations: z.number().int(),
  timed_out: z.boolean(),
}));
export type CoachAskOutT = z.infer<typeof CoachAskOut>;
