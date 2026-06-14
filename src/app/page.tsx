import Link from "next/link";
import { Sparkles, ChevronRight, HeartPulse, Moon, Footprints, Bike, Dumbbell, Activity } from "lucide-react";
import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { RecoveryRing } from "@/components/viz/RecoveryRing";
import { StatRing } from "@/components/viz/StatRing";
import { TodayTimeline, type TimelineItem } from "@/components/TodayTimeline";
import { greeting, formatDurationMin, formatDurationMs, formatStrain, formatTime, formatHrv, formatRhr } from "@/lib/format";
import { recoveryColor, recoveryLabel, recoveryZone, strainLabel, STRAIN_MAX } from "@/lib/recovery";

function sportIcon(name: string): typeof Activity {
  const n = name.toLowerCase();
  if (n.includes("run")) return Footprints;
  if (n.includes("cycl") || n.includes("bike") || n.includes("ride")) return Bike;
  if (n.includes("strength") || n.includes("lift") || n.includes("weight")) return Dumbbell;
  return Activity;
}

export default async function HomePage() {
  const client = await getWhoopClient();
  const [today, profile, workouts] = await Promise.all([
    client.getToday(),
    client.getProfile(),
    client.getWorkouts(),
  ]);
  const { recovery, sleep, strain } = today;

  const rec = recovery.score ?? 0;
  const strainScore = strain.score ?? 0;
  const sleepPct = sleep.performance_pct ?? 0;
  const sleepMin = (sleep.total_sleep_ms ?? 0) / 60000;

  const entries: { ts: number; item: TimelineItem }[] = [];
  if (sleep.ended_at) {
    const wake = new Date(sleep.ended_at);
    entries.push({
      ts: wake.getTime() + 1,
      item: { timeLabel: formatTime(wake), label: "Recovery", sublabel: `${rec}% recovery · ${recoveryLabel(rec)}`, icon: HeartPulse, color: recoveryColor(rec) },
    });
    entries.push({
      ts: wake.getTime(),
      item: { timeLabel: formatTime(wake), label: "Sleep", sublabel: `${formatDurationMin(sleepMin)} · ${sleepPct}% performance`, icon: Moon, color: "var(--color-sleep)" },
    });
  }
  for (const w of workouts) {
    if (!w.start || !w.start.startsWith(today.date)) continue;
    const start = new Date(w.start);
    const strainTxt = w.strain != null ? ` · ${formatStrain(w.strain)} strain` : "";
    entries.push({
      ts: start.getTime(),
      item: { timeLabel: formatTime(start), label: w.sport_name, sublabel: `${formatDurationMs(w.duration_ms)}${strainTxt}`, icon: sportIcon(w.sport_name), color: "var(--color-strain)" },
    });
  }
  entries.sort((a, b) => b.ts - a.ts);
  const timeline = entries.map((e) => e.item);

  return (
    <>
      <TopBar />
      <div className="px-4 pb-10 pt-4">
        <p className="text-sm text-muted">{greeting()}</p>
        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{profile.first_name}</h2>

        <Link href="/recovery" className="mt-5 flex flex-col items-center">
          <RecoveryRing value={rec} size={236} />
        </Link>

        <p className="mx-auto mt-5 max-w-[20rem] text-center text-sm leading-relaxed text-muted">
          Recovery is{" "}
          <span className="font-semibold" style={{ color: recoveryColor(rec) }}>
            {recoveryLabel(rec).toLowerCase()}
          </span>{" "}
          today. HRV {formatHrv(recovery.hrv_ms ?? 0)}ms, resting HR {formatRhr(recovery.rhr_bpm ?? 0)} bpm.{" "}
          {recoveryZone(rec) === "green"
            ? "A good day to take on strain."
            : recoveryZone(rec) === "yellow"
              ? "Train, but keep it measured."
              : "Prioritise rest and recovery."}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Link
            href="/strain"
            className="flex flex-col items-center gap-3 rounded-[18px] border border-line-soft bg-surface p-4 transition active:scale-[0.99]"
          >
            <StatRing value={strainScore} max={STRAIN_MAX} color="var(--color-strain)" size={108} decimals={1} />
            <div className="text-center">
              <p className="text-sm font-semibold">Strain</p>
              <p className="text-xs text-dim">{strainLabel(strainScore)}</p>
            </div>
          </Link>

          <Link
            href="/sleep"
            className="flex flex-col items-center gap-3 rounded-[18px] border border-line-soft bg-surface p-4 transition active:scale-[0.99]"
          >
            <StatRing value={sleepPct} max={100} color="var(--color-sleep)" size={108} suffix="%" />
            <div className="text-center">
              <p className="text-sm font-semibold">Sleep</p>
              <p className="text-xs text-dim">{formatDurationMin(sleepMin)}</p>
            </div>
          </Link>
        </div>

        <Link
          href="/coach"
          className="mt-3 flex items-center gap-3 rounded-[18px] border border-line-soft bg-surface p-4 transition active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-strain/15 text-strain">
            <Sparkles size={20} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Ask your Coach</p>
            <p className="text-xs text-dim">Personalised insights from today&rsquo;s data</p>
          </div>
          <ChevronRight size={18} className="text-dim" />
        </Link>

        <TodayTimeline items={timeline} />

        <p className="mt-8 text-center text-xs text-dim">
          Demo data. Add your WHOOP login in .env.local to go live.
        </p>
      </div>
    </>
  );
}
