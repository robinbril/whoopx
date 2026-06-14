import type { LucideIcon } from "lucide-react";

export interface InsightCardData {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  body: string;
  accentColor: string;
}

interface InsightCardProps {
  data: InsightCardData;
}

export function InsightCard({ data }: InsightCardProps) {
  const { icon: Icon, iconColor, title, body, accentColor } = data;

  return (
    <div
      className="flex gap-4 rounded-[18px] border border-line-soft bg-surface p-5"
      style={{
        background: `color-mix(in oklab, ${accentColor} 5%, var(--color-surface))`,
        borderColor: `color-mix(in oklab, ${accentColor} 20%, var(--color-line-soft))`,
      }}
    >
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `color-mix(in oklab, ${iconColor} 16%, transparent)`,
          color: iconColor,
        }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: `color-mix(in oklab, ${iconColor} 80%, var(--color-muted))` }}
        >
          {title}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-fg">{body}</p>
      </div>
    </div>
  );
}
