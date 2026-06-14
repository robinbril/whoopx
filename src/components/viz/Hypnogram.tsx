import { formatTime } from "@/lib/format";

export interface HypnoSegment {
  started_at: string;
  ended_at: string;
  stage: string;
}

const STAGE_COLOR: Record<string, string> = {
  AWAKE: "var(--color-sleep-awake)",
  REM: "var(--color-sleep-rem)",
  LIGHT: "var(--color-sleep-light)",
  SWS: "var(--color-sleep-deep)",
};

/** Single-row sleep stage timeline scaled by duration. */
export function Hypnogram({ segments }: { segments: HypnoSegment[] }) {
  if (segments.length === 0) return null;
  const t0 = new Date(segments[0].started_at).getTime();
  const t1 = new Date(segments[segments.length - 1].ended_at).getTime();
  const span = t1 - t0 || 1;

  return (
    <div>
      <div className="flex h-12 w-full overflow-hidden rounded-xl bg-surface-3">
        {segments.map((s, i) => {
          const w = ((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / span) * 100;
          return (
            <div
              key={i}
              className="h-full"
              style={{ width: `${w}%`, background: STAGE_COLOR[s.stage] ?? "var(--color-sleep-light)" }}
              title={s.stage}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-dim tabular">
        <span>{formatTime(new Date(segments[0].started_at))}</span>
        <span>{formatTime(new Date(segments[segments.length - 1].ended_at))}</span>
      </div>
    </div>
  );
}
