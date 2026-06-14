import type { LucideIcon } from "lucide-react";

export interface TimelineItem {
  timeLabel: string;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  color: string;
}

/** Chronological "what happened today" feed (goose HomeTimelineSection pattern). */
export function TodayTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-7">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">Today</p>
      <ul className="space-y-2.5">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <li
              key={i}
              className="flex items-center gap-3 rounded-[16px] border border-line-soft p-3.5"
              style={{
                background: `linear-gradient(135deg, color-mix(in oklab, ${it.color} 7%, var(--color-surface)), var(--color-surface))`,
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in oklab, ${it.color} 16%, transparent)`, color: it.color }}
              >
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.label}</p>
                <p className="truncate text-xs text-dim">{it.sublabel}</p>
              </div>
              <span className="tabular shrink-0 text-xs text-dim">{it.timeLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
