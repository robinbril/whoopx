# WHOOPX

A 1:1 WHOOP companion: recovery, strain, sleep, trends, coach, journal, strength, and your team's leaderboard. Built on Next.js. Runs on realistic demo data out of the box; point it at your own WHOOP account to go live.

## Run

```
npm run dev
```

Open http://localhost:3000. On your phone, open the same URL on the network and "Add to Home Screen" for the full app feel (it's an installable PWA).

## Go live with your own WHOOP data

By default the app runs in demo mode. To pull YOUR real data, including your team/group:

1. Copy `.env.example` to `.env.local`.
2. Set:

   ```
   WHOOP_MODE=live
   WHOOP_EMAIL=you@example.com
   WHOOP_PASSWORD=your-whoop-password
   ```

3. Restart the dev server.

What happens: the app authenticates against WHOOP using AWS Cognito (the same flow the iOS app uses), caches the tokens in `.whoop-tokens.json` (gitignored), and refreshes them automatically. After the first login it won't ask again until the refresh token expires.

### Notes

- Credentials stay on your machine. Nothing is sent anywhere except WHOOP's own API.
- This talks to WHOOP's private app API, not the official developer API, because the official one does not expose teams/friends/leaderboards. It's your own account and data, but it isn't an officially supported integration, so use it at your own discretion.
- If your account uses MFA, headless server login will stop at the challenge. Disable MFA on the account or seed a valid `.whoop-tokens.json` once.
- Optional env: `WHOOP_USER_ID`, `WHOOP_TIMEZONE`, `WHOOP_INSTALLATION_ID`.

## Architecture

- `src/lib/whoop/`: the data layer. `client.ts` (Cognito auth + typed endpoints), `schemas/` (zod), `demo/` (fixtures). `getWhoopClient()` returns a live or demo client based on `WHOOP_MODE`.
- `src/components/viz/`: the rings, charts, stacked bars, hypnogram.
- `src/app/`: the screens (Today, Recovery, Strain, Sleep, Community, Coach, Trends, Workouts, Journal, Strength, Profile).
