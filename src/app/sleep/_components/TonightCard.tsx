import { Moon, BedDouble, Sunrise } from "lucide-react";
import { Card, CardLabel } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface TimeTile {
  label: string;
  time: string;
  icon: React.ReactNode;
}

interface ScheduleBar {
  /** minutes from midnight for wind-down (may be negative, e.g. 21:30 = -150) */
  windDownMin: number;
  bedtimeMin: number;
  wakeMin: number;
}

interface TonightCardProps {
  sleepNeededLabel: string;
  windDownTime: string;
  bedtimeTime: string;
  wakeTime: string;
  /** All times as minutes-from-midnight (wind-down/bedtime may be negative) */
  schedule: ScheduleBar;
}

/** Map a clock-minute value (possibly negative for previous-evening hours) onto
 *  a 0-1 fraction across the window 21:00 -> 09:00 the next day (720 min). */
function toFraction(clockMin: number): number {
  // Window: 21:00 = -180 min before midnight, 09:00 = 540 min after midnight
  const WINDOW_START = -180; // 21:00
  const WINDOW_END = 540;    // 09:00 next day
  const WINDOW_SPAN = WINDOW_END - WINDOW_START; // 720 min
  const clamped = Math.min(Math.max(clockMin, WINDOW_START), WINDOW_END);
  return (clamped - WINDOW_START) / WINDOW_SPAN;
}

function Dot({ label, fraction }: { label: string; fraction: number }) {
  return (
    <div
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-[3px]"
      style={{ left: `${fraction * 100}%` }}
    >
      <div className="h-[7px] w-[7px] rounded-full bg-sleep ring-2 ring-sleep/25" />
      <span className="text-[9px] font-medium text-sleep">{label}</span>
    </div>
  );
}

export function TonightCard({
  sleepNeededLabel,
  windDownTime,
  bedtimeTime,
  wakeTime,
  schedule,
}: TonightCardProps) {
  const tiles: TimeTile[] = [
    {
      label: "Wind-down",
      time: windDownTime,
      icon: <Moon className="h-3.5 w-3.5 text-sleep-rem" />,
    },
    {
      label: "Bedtime",
      time: bedtimeTime,
      icon: <BedDouble className="h-3.5 w-3.5 text-sleep" />,
    },
    {
      label: "Wake",
      time: wakeTime,
      icon: <Sunrise className="h-3.5 w-3.5 text-recovery" />,
    },
  ];

  const windFrac = toFraction(schedule.windDownMin);
  const bedFrac = toFraction(schedule.bedtimeMin);
  const wakeFrac = toFraction(schedule.wakeMin);

  return (
    <Card className="mt-3">
      <CardLabel>Tonight</CardLabel>

      {/* Sleep needed */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-bold text-sleep">
          {sleepNeededLabel}
        </span>
        <span className="text-xs text-muted">sleep needed</span>
      </div>

      {/* Time tiles */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl border border-line-soft bg-surface-2 px-3 py-2.5",
            )}
          >
            <div className="flex items-center gap-1">{tile.icon}
              <span className="text-[10px] font-medium uppercase tracking-wide text-dim">
                {tile.label}
              </span>
            </div>
            <span className="tabular text-sm font-semibold text-fg">
              {tile.time}
            </span>
          </div>
        ))}
      </div>

      {/* Schedule bar */}
      <div className="mt-5 pb-4">
        {/* axis labels */}
        <div className="mb-1.5 flex justify-between text-[9px] text-dim">
          <span>21:00</span>
          <span>00:00</span>
          <span>03:00</span>
          <span>06:00</span>
          <span>09:00</span>
        </div>
        {/* track + dots */}
        <div className="relative h-[1px] w-full bg-line-soft">
          <Dot label={windDownTime} fraction={windFrac} />
          <Dot label={bedtimeTime} fraction={bedFrac} />
          <Dot label={wakeTime} fraction={wakeFrac} />
          {/* filled segment from bedtime to wake */}
          <div
            className="absolute top-0 h-[1px] bg-sleep/40"
            style={{
              left: `${bedFrac * 100}%`,
              width: `${(wakeFrac - bedFrac) * 100}%`,
            }}
          />
        </div>
      </div>
    </Card>
  );
}
