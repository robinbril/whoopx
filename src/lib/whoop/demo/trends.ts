import type { TrendOutT } from "../schemas/trend";
import type { METRICS } from "../schemas/trend";

// 14-day HRV points for the demo user ending 2026-06-14.
const HRV_POINTS = [
  { date: "2026-06-01", value: 43.1, value_display: "43" },
  { date: "2026-06-02", value: 44.8, value_display: "45" },
  { date: "2026-06-03", value: 46.2, value_display: "46" },
  { date: "2026-06-04", value: 41.9, value_display: "42" },
  { date: "2026-06-05", value: 45.5, value_display: "46" },
  { date: "2026-06-06", value: 47.0, value_display: "47" },
  { date: "2026-06-07", value: 44.3, value_display: "44" },
  { date: "2026-06-08", value: 50.1, value_display: "50" },
  { date: "2026-06-09", value: 49.4, value_display: "49" },
  { date: "2026-06-10", value: 46.6, value_display: "47" },
  { date: "2026-06-11", value: 48.8, value_display: "49" },
  { date: "2026-06-12", value: 47.5, value_display: "48" },
  { date: "2026-06-13", value: 49.1, value_display: "49" },
  { date: "2026-06-14", value: 48.2, value_display: "48" },
];

const RHR_POINTS = [
  { date: "2026-06-01", value: 57, value_display: "57" },
  { date: "2026-06-02", value: 56, value_display: "56" },
  { date: "2026-06-03", value: 55, value_display: "55" },
  { date: "2026-06-04", value: 58, value_display: "58" },
  { date: "2026-06-05", value: 55, value_display: "55" },
  { date: "2026-06-06", value: 54, value_display: "54" },
  { date: "2026-06-07", value: 56, value_display: "56" },
  { date: "2026-06-08", value: 53, value_display: "53" },
  { date: "2026-06-09", value: 54, value_display: "54" },
  { date: "2026-06-10", value: 55, value_display: "55" },
  { date: "2026-06-11", value: 54, value_display: "54" },
  { date: "2026-06-12", value: 53, value_display: "53" },
  { date: "2026-06-13", value: 54, value_display: "54" },
  { date: "2026-06-14", value: 54, value_display: "54" },
];

const RECOVERY_POINTS = [
  { date: "2026-06-01", value: 58, value_display: "58%" },
  { date: "2026-06-02", value: 62, value_display: "62%" },
  { date: "2026-06-03", value: 71, value_display: "71%" },
  { date: "2026-06-04", value: 52, value_display: "52%" },
  { date: "2026-06-05", value: 68, value_display: "68%" },
  { date: "2026-06-06", value: 74, value_display: "74%" },
  { date: "2026-06-07", value: 60, value_display: "60%" },
  { date: "2026-06-08", value: 80, value_display: "80%" },
  { date: "2026-06-09", value: 78, value_display: "78%" },
  { date: "2026-06-10", value: 65, value_display: "65%" },
  { date: "2026-06-11", value: 72, value_display: "72%" },
  { date: "2026-06-12", value: 69, value_display: "69%" },
  { date: "2026-06-13", value: 73, value_display: "73%" },
  { date: "2026-06-14", value: 67, value_display: "67%" },
];

const DAY_STRAIN_POINTS = [
  { date: "2026-06-01", value: 11.2, value_display: "11.2" },
  { date: "2026-06-02", value: 14.6, value_display: "14.6" },
  { date: "2026-06-03", value: 9.8, value_display: "9.8" },
  { date: "2026-06-04", value: 13.1, value_display: "13.1" },
  { date: "2026-06-05", value: 15.9, value_display: "15.9" },
  { date: "2026-06-06", value: 10.4, value_display: "10.4" },
  { date: "2026-06-07", value: 12.0, value_display: "12.0" },
  { date: "2026-06-08", value: 13.8, value_display: "13.8" },
  { date: "2026-06-09", value: 11.5, value_display: "11.5" },
  { date: "2026-06-10", value: 14.2, value_display: "14.2" },
  { date: "2026-06-11", value: 10.9, value_display: "10.9" },
  { date: "2026-06-12", value: 12.7, value_display: "12.7" },
  { date: "2026-06-13", value: 13.3, value_display: "13.3" },
  { date: "2026-06-14", value: 12.4, value_display: "12.4" },
];

const SLEEP_PERF_POINTS = [
  { date: "2026-06-01", value: 84, value_display: "84%" },
  { date: "2026-06-02", value: 88, value_display: "88%" },
  { date: "2026-06-03", value: 91, value_display: "91%" },
  { date: "2026-06-04", value: 80, value_display: "80%" },
  { date: "2026-06-05", value: 86, value_display: "86%" },
  { date: "2026-06-06", value: 92, value_display: "92%" },
  { date: "2026-06-07", value: 85, value_display: "85%" },
  { date: "2026-06-08", value: 90, value_display: "90%" },
  { date: "2026-06-09", value: 93, value_display: "93%" },
  { date: "2026-06-10", value: 87, value_display: "87%" },
  { date: "2026-06-11", value: 89, value_display: "89%" },
  { date: "2026-06-12", value: 91, value_display: "91%" },
  { date: "2026-06-13", value: 88, value_display: "88%" },
  { date: "2026-06-14", value: 89, value_display: "89%" },
];

function makeTrend(
  metric: typeof METRICS[number],
  points: { date: string; value: number; value_display: string }[],
  unit: string | null,
  avg: number,
): TrendOutT {
  return {
    metric,
    end_date: "2026-06-14",
    segments: [
      {
        label: "week",
        start_date: "2026-06-08",
        end_date: "2026-06-14",
        avg,
        min: Math.min(...points.slice(-7).map((p) => p.value)),
        max: Math.max(...points.slice(-7).map((p) => p.value)),
        delta_pct: 3.2,
        unit,
        points: points.slice(-7),
      },
      {
        label: "month",
        start_date: "2026-06-01",
        end_date: "2026-06-14",
        avg: points.reduce((s, p) => s + p.value, 0) / points.length,
        min: Math.min(...points.map((p) => p.value)),
        max: Math.max(...points.map((p) => p.value)),
        delta_pct: 1.8,
        unit,
        points,
      },
    ],
    cardio_fitness_level: null,
  };
}

const HRV_TREND = makeTrend("HRV", HRV_POINTS, "ms", 48.2);
const RHR_TREND = makeTrend("RHR", RHR_POINTS, "bpm", 54);
const RECOVERY_TREND = makeTrend("RECOVERY", RECOVERY_POINTS, "%", 67);
const DAY_STRAIN_TREND = makeTrend("DAY_STRAIN", DAY_STRAIN_POINTS, null, 12.6);
const SLEEP_PERF_TREND = makeTrend("SLEEP_PERFORMANCE", SLEEP_PERF_POINTS, "%", 89);

// Deterministic generic fallback for metrics not explicitly modelled
// (no Math.random: that would differ between server and client and break hydration).
function genericTrend(metric: typeof METRICS[number]): TrendOutT {
  const points = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 5, 8 + i)).toISOString().slice(0, 10),
    value: 10 + Math.round((Math.sin(i * 1.7) + 1) * 4),
    value_display: null,
  }));
  const avg = points.reduce((s, p) => s + p.value, 0) / points.length;
  return {
    metric,
    end_date: "2026-06-14",
    segments: [
      {
        label: "week",
        start_date: "2026-06-08",
        end_date: "2026-06-14",
        avg: Math.round(avg * 10) / 10,
        min: Math.min(...points.map((p) => p.value)),
        max: Math.max(...points.map((p) => p.value)),
        delta_pct: 2.1,
        unit: null,
        points,
      },
    ],
    cardio_fitness_level: null,
  };
}

// Keyed map for the demo client to look up by metric name.
export const DEMO_TRENDS: Record<typeof METRICS[number], TrendOutT> & Partial<Record<string, TrendOutT>> = {
  HRV: HRV_TREND,
  RHR: RHR_TREND,
  RECOVERY: RECOVERY_TREND,
  DAY_STRAIN: DAY_STRAIN_TREND,
  CALORIES: genericTrend("CALORIES"),
  STEPS: genericTrend("STEPS"),
  AVERAGE_HR: genericTrend("AVERAGE_HR"),
  HOURS_V_NEED: genericTrend("HOURS_V_NEED"),
  HOURS_V_NEEDED_PERCENT: genericTrend("HOURS_V_NEEDED_PERCENT"),
  TIME_IN_BED: genericTrend("TIME_IN_BED"),
  SLEEP_PERFORMANCE: SLEEP_PERF_TREND,
  SLEEP_EFFICIENCY: genericTrend("SLEEP_EFFICIENCY"),
  SLEEP_CONSISTENCY: genericTrend("SLEEP_CONSISTENCY"),
  SLEEP_DEBT_POST: genericTrend("SLEEP_DEBT_POST"),
  RESTORATIVE_SLEEP: genericTrend("RESTORATIVE_SLEEP"),
  HR_ZONES_1_3: genericTrend("HR_ZONES_1_3"),
  HR_ZONES_4_5: genericTrend("HR_ZONES_4_5"),
  RESPIRATORY_RATE: genericTrend("RESPIRATORY_RATE"),
  STRENGTH_ACTIVITY_TIME: genericTrend("STRENGTH_ACTIVITY_TIME"),
  STRESS: genericTrend("STRESS"),
  STRESS_DURING_SLEEP: genericTrend("STRESS_DURING_SLEEP"),
  STRESS_DURING_NON_STRAIN: genericTrend("STRESS_DURING_NON_STRAIN"),
  VO2_MAX: genericTrend("VO2_MAX"),
  BODY_COMPOSITION: genericTrend("BODY_COMPOSITION"),
  WEIGHT: genericTrend("WEIGHT"),
};
