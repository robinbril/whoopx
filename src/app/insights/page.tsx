import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { formatDurationMs, formatStrain, formatHrv } from "@/lib/format";
import { recoveryColor, recoveryZone, strainLabel } from "@/lib/recovery";
import {
  TrendingUp,
  TrendingDown,
  Moon,
  Activity,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import { InsightCard } from "./_components/InsightCard";
import type { InsightCardData } from "./_components/InsightCard";

// RHR is "better" when it goes down; flip the sign for ranking.
function rhrNormalised(deltaPct: number): number {
  return -deltaPct;
}

export default async function InsightsPage() {
  const client = await getWhoopClient();

  const [recovery, sleep, strain, compare] = await Promise.all([
    client.getRecovery(),
    client.getSleep(),
    client.getStrain(),
    client.getCompare({ window: "week" }),
  ]);

  // Colour helpers
  const recColor = recoveryColor(recovery.score ?? 0);
  const strainColor = "var(--color-strain)";
  const sleepColor = "var(--color-sleep)";

  const cards: InsightCardData[] = [];

  // 1. Weekly recovery trend (biggest single headline).
  const recMetric = compare.metrics.find((m) => m.metric === "RECOVERY");
  if (recMetric?.delta_pct != null && recMetric.a_avg != null) {
    const up = recMetric.delta_pct >= 0;
    const absPct = Math.abs(recMetric.delta_pct).toFixed(1);
    const avg = Math.round(recMetric.a_avg);
    cards.push({
      icon: up ? TrendingUp : TrendingDown,
      iconColor: up ? "var(--color-recovery-green)" : "var(--color-recovery-red)",
      accentColor: up ? "var(--color-recovery-green)" : "var(--color-recovery-red)",
      title: "Recovery this week",
      body: up
        ? `Your average recovery is up ${absPct}% versus last week, sitting at ${avg}% for the current 7-day window.`
        : `Your average recovery dropped ${absPct}% compared to last week. This week's average is ${avg}%, which may call for lighter sessions.`,
    });
  }

  // 2. HRV vs personal baseline.
  const hrv = recovery.hrv;
  if (hrv.ms != null && hrv.delta_pct != null) {
    const up = hrv.delta_pct >= 0;
    const absPct = Math.abs(hrv.delta_pct).toFixed(1);
    const ms = formatHrv(hrv.ms);
    cards.push({
      icon: HeartPulse,
      iconColor: up ? "var(--color-recovery-green)" : "var(--color-recovery-yellow)",
      accentColor: up ? "var(--color-recovery-green)" : "var(--color-recovery-yellow)",
      title: "HRV vs baseline",
      body: up
        ? `HRV is ${ms}ms, ${absPct}% above your personal baseline. Your nervous system is well-recovered.`
        : `HRV is ${ms}ms, ${absPct}% below your baseline. Give your nervous system extra recovery time before a hard push.`,
    });
  }

  // 3. Sleep debt.
  const debtMs = sleep.debt_ms ?? 0;
  const debtMin = Math.round(debtMs / 60000);
  if (debtMin > 0) {
    cards.push({
      icon: Moon,
      iconColor: sleepColor,
      accentColor: sleepColor,
      title: "Sleep debt",
      body: `You are carrying ${formatDurationMs(debtMs)} of sleep debt. An extra ${formatDurationMs(Math.min(debtMs, 60 * 60000))} tonight would meaningfully close the gap.`,
    });
  } else {
    cards.push({
      icon: Moon,
      iconColor: "var(--color-recovery-green)",
      accentColor: "var(--color-recovery-green)",
      title: "Sleep debt",
      body: `No sleep debt detected. Your recent sleep total keeps you in balance, which is a strong support for recovery.`,
    });
  }

  // 4. Strain vs optimal range.
  const strainScore = strain.score ?? 0;
  const lo = strain.target.optimal_lower;
  const hi = strain.target.optimal_upper;
  if (lo != null && hi != null) {
    const inRange = strainScore >= lo && strainScore <= hi;
    const above = strainScore > hi;
    cards.push({
      icon: Activity,
      iconColor: inRange ? "var(--color-recovery-green)" : above ? "var(--color-recovery-red)" : "var(--color-recovery-yellow)",
      accentColor: inRange ? "var(--color-recovery-green)" : strainColor,
      title: "Day strain",
      body: inRange
        ? `Today's strain of ${formatStrain(strainScore)} sits inside your optimal range of ${formatStrain(lo)} to ${formatStrain(hi)}. ${strainLabel(strainScore)} load, well-placed.`
        : above
          ? `Strain of ${formatStrain(strainScore)} exceeds your optimal ceiling of ${formatStrain(hi)}. Prioritise sleep and low-intensity activity tomorrow to protect recovery.`
          : `Strain of ${formatStrain(strainScore)} is below your optimal lower bound of ${formatStrain(lo)}. A ${strainLabel(strainScore)} day is fine as a recovery day.`,
    });
  }

  // 5. Sleep consistency.
  const consistency = sleep.consistency_pct ?? 0;
  cards.push({
    icon: Moon,
    iconColor: consistency >= 75 ? "var(--color-sleep)" : "var(--color-recovery-yellow)",
    accentColor: "var(--color-sleep)",
    title: "Sleep consistency",
    body: consistency >= 75
      ? `Your sleep schedule consistency is ${Math.round(consistency)}%, a strong signal for circadian rhythm. Keeping your wake time stable reinforces this.`
      : `Sleep consistency is ${Math.round(consistency)}%. Irregular bed and wake times reduce restorative sleep quality, even when total duration looks adequate.`,
  });

  // 6. Standout metric from compare (largest absolute delta, excluding recovery already shown).
  const ranked = [...compare.metrics]
    .filter((m) => m.metric !== "RECOVERY" && m.delta_pct != null)
    .sort((a, b) => {
      const aNorm = a.metric === "RHR" ? rhrNormalised(a.delta_pct!) : a.delta_pct!;
      const bNorm = b.metric === "RHR" ? rhrNormalised(b.delta_pct!) : b.delta_pct!;
      return Math.abs(bNorm) - Math.abs(aNorm);
    });

  const standout = ranked[0];
  if (standout?.delta_pct != null && standout.a_avg != null) {
    const metricLabels: Record<string, string> = {
      SLEEP_PERFORMANCE: "Sleep performance",
      DAY_STRAIN: "Day strain",
      HRV: "HRV",
      RHR: "Resting heart rate",
    };
    const label = metricLabels[standout.metric] ?? standout.metric;
    // For RHR a lower value is better, so flip the narrative.
    const improving =
      standout.metric === "RHR"
        ? standout.delta_pct < 0
        : standout.delta_pct > 0;
    const absPct = Math.abs(standout.delta_pct).toFixed(1);
    const avg =
      standout.unit === "ms"
        ? `${Math.round(standout.a_avg)}ms`
        : standout.unit === "bpm"
          ? `${Math.round(standout.a_avg)}bpm`
          : standout.unit === "%"
            ? `${Math.round(standout.a_avg)}%`
            : formatStrain(standout.a_avg);
    cards.push({
      icon: improving ? TrendingUp : TrendingDown,
      iconColor: improving ? "var(--color-recovery-green)" : "var(--color-recovery-red)",
      accentColor: improving ? "var(--color-recovery-green)" : "var(--color-recovery-red)",
      title: `Biggest weekly shift`,
      body: improving
        ? `${label} improved the most this week, moving ${absPct}% in the right direction. This week's average is ${avg}.`
        : `${label} declined the most this week, down ${absPct}% versus the prior period. Current average: ${avg}.`,
    });
  }

  // 7. Resting heart rate trend.
  const rhrMetric = compare.metrics.find((m) => m.metric === "RHR");
  if (rhrMetric?.delta_pct != null && rhrMetric.a_avg != null) {
    const improving = rhrMetric.delta_pct < 0;
    const absPct = Math.abs(rhrMetric.delta_pct).toFixed(1);
    const avgBpm = Math.round(rhrMetric.a_avg);
    // Only add if not already the standout card.
    const alreadyShown = standout?.metric === "RHR";
    if (!alreadyShown) {
      cards.push({
        icon: HeartPulse,
        iconColor: improving ? "var(--color-recovery-green)" : "var(--color-recovery-yellow)",
        accentColor: improving ? "var(--color-recovery-green)" : "var(--color-recovery-yellow)",
        title: "Resting heart rate",
        body: improving
          ? `Resting HR averaged ${avgBpm}bpm this week, ${absPct}% lower than last week. Cardiovascular adaptation is moving in the right direction.`
          : `Resting HR averaged ${avgBpm}bpm, ${absPct}% higher than last week. Fatigue, stress or illness can elevate RHR temporarily.`,
      });
    }
  }

  // Sort: put cards with green recovery colour first, then others.
  // Keep the order as-is since we already built them most-notable first.
  // Cap at 8 cards.
  const visible = cards.slice(0, 8);

  return (
    <>
      <TopBar title="Insights" back />
      <div className="px-4 pb-12 pt-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "color-mix(in oklab, var(--color-strain) 15%, transparent)", color: "var(--color-strain)" }}
          >
            <Sparkles size={14} />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Derived from your data
          </p>
        </div>

        <div className="space-y-3">
          {visible.map((card, i) => (
            <InsightCard key={i} data={card} />
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-faint">
          Updated from this week vs last week.
        </p>
      </div>
    </>
  );
}
