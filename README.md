# WHOOPX

A 1:1 WHOOP companion as a web app. Recovery, strain, sleep, your team's leaderboard, an AI coach, trends, stress, cardio load and more, in the WHOOP dark look. Runs on realistic demo data out of the box; point it at your own WHOOP account to go live.

Built with Next.js 16, React 19, TypeScript, Tailwind v4 and Framer Motion. Installable as a PWA.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. On your phone, open the same URL on your network and "Add to Home Screen" for the full app feel.

## Screens

- **Today**: recovery ring, strain and sleep summary, an Ask-Coach prompt, and a chronological day timeline.
- **Recovery / Strain / Sleep**: full detail with rings, HRV/RHR/SpO2, HR zones, sleep stages, hypnogram, a Tonight schedule card, and a per-metric coaching tip.
- **Community**: your teams, a leaderboard ranking friends by recovery/strain/sleep, and a you-vs-last-week compare.
- **Coach**: an AI chat. Every metric screen can hand off a prefilled question.
- **Trends**: per-metric charts with a period-delta analysis table.
- **Stress**: a tick-gauge, a 24h color-coded timeline, and per-zone breakdown.
- **Cardio Load**: an ATL/CTL training-load view with an adaptive band and status breakdown.
- **Health Monitor**: a consolidated vitals grid.
- **Weekly Report**, **Insights**, **Workouts** (with per-workout detail), **Journal**, **Strength**, **Profile**.

## Go live with your own data

By default the app runs in demo mode. To pull your real WHOOP data, including your team and group:

1. Copy `.env.example` to `.env.local`.
2. Set:

   ```
   WHOOP_MODE=live
   WHOOP_EMAIL=you@example.com
   WHOOP_PASSWORD=your-whoop-password
   ```

3. Restart the dev server.

The app authenticates against WHOOP using AWS Cognito (the same flow the iOS app uses), caches tokens in `.whoop-tokens.json` (gitignored), and refreshes them automatically. Credentials stay on your machine. See `LIVE-SETUP.md` for details.

> Note: this talks to WHOOP's private app API, not the official developer API, because the official one does not expose teams, friends or leaderboards. It is your own account and data, but it is not an officially supported integration, so use it at your own discretion.

## Architecture

- `src/lib/whoop/`: the data layer. `client.ts` (Cognito auth + typed endpoints), `schemas/` (zod), `demo/` (fixtures). `getWhoopClient()` returns a live or demo client based on `WHOOP_MODE`.
- `src/components/viz/`: rings, gauges, charts, stacked bars, hypnogram.
- `src/app/`: the screens.

The WHOOP API client is ported from the open-source [totem](https://github.com/briangaoo/totem) project; several feature ideas are adapted from the open-source [goose](https://github.com/b-nnett/goose) companion.
