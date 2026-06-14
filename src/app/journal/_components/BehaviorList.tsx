import { CheckCircle2, XCircle } from "lucide-react";
import type { JournalOutT } from "@/lib/whoop/schemas/journal";

type Behavior = JournalOutT["behaviors"][number];

interface BehaviorListProps {
  behaviors: Behavior[];
}

function BehaviorRow({ behavior }: { behavior: Behavior }) {
  const hasYesNo = behavior.answered_yes !== null;
  const hasMagnitude = behavior.magnitude_label !== null;

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="shrink-0">
        {hasYesNo ? (
          behavior.answered_yes ? (
            <CheckCircle2
              size={20}
              className="text-recovery-green"
              aria-label="Yes"
            />
          ) : (
            <XCircle size={20} className="text-recovery-red" aria-label="No" />
          )
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold tabular text-fg">
            {behavior.magnitude_value ?? "–"}
          </span>
        )}
      </span>

      <span className="flex-1 text-sm text-fg">{behavior.title}</span>

      {hasMagnitude && (
        <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-medium text-muted">
          {behavior.magnitude_label}
        </span>
      )}

      {hasYesNo && !hasMagnitude && (
        <span
          className="shrink-0 text-[11px] font-semibold"
          style={{
            color: behavior.answered_yes
              ? "var(--color-recovery-green)"
              : "var(--color-recovery-red)",
          }}
        >
          {behavior.answered_yes ? "Yes" : "No"}
        </span>
      )}
    </li>
  );
}

export function BehaviorList({ behaviors }: BehaviorListProps) {
  return (
    <ul className="mt-3 divide-y divide-line-soft">
      {behaviors.map((b) => (
        <BehaviorRow key={b.behavior_tracker_id} behavior={b} />
      ))}
    </ul>
  );
}
