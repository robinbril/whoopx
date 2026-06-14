import type { CardioLoadOutT } from "../schemas/cardio";

const START = Date.parse("2026-05-16T00:00:00Z");

const series = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(START + i * 86_400_000).toISOString().slice(0, 10);
  const ramp = 5.6 + (i / 29) * 4.0; // builds 5.6 -> 9.6
  const wiggle = Math.sin(i * 1.2) * 0.5 + Math.sin(i * 0.5) * 0.3;
  return { date, load: Math.round((ramp + wiggle) * 10) / 10 };
});

const ctl = series[series.length - 1].load;
const atl = Math.round((ctl - 1.3) * 10) / 10;
const form = Math.round((ctl - atl) * 10) / 10;

export const DEMO_CARDIO: CardioLoadOutT = {
  date: series[series.length - 1].date,
  load: ctl,
  status: "Productive",
  atl,
  ctl,
  form,
  band: { lower: Math.round((ctl - 2) * 10) / 10, upper: Math.round((ctl + 2) * 10) / 10 },
  series,
  breakdown: [
    { status: "Productive", days: 13 },
    { status: "Maintaining", days: 9 },
    { status: "Detraining", days: 5 },
    { status: "Peaking", days: 3 },
  ],
};
