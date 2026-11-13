<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- poort:start -->
## Quality gate (poort)

- Klaar = `node .poort/poort.mjs run push` groen. Draai het vóór je "klaar" zegt; ongewijzigde checks zijn cached en kosten niets. Dependencies uit de lockfile installeert poort zelf (prepare). Een run duurt hoogstens 5 minuten; wat niet past, staat als `↷ tijdsbudget` en is werk voor CI.
- Rood: lees alleen de getoonde staart en het logpad, fix alles in één ronde, draai opnieuw.
- `↷ overgeslagen` is geen groen: noem het in je eindrapport.
- UI-wijziging: bekijk de app eerst via de e2e-MCP (`open_session`, `observe`) en schrijf of update een test in `tests/*.e2e.ts` van de e2e-map: één `agent.act` per doel, dan een exacte `expect`.
- e2e-replay rood na een bewuste UI-wijziging: `node .poort/poort.mjs e2e --record`, stage `.e2e/cache/`.
- Nieuwe CI-job of -stap: geef de check die hem lokaal dekt `"ci": "<workflow>#<job>[:<stap>]"`, of zet hem met reden in `ciWaive`. `node .poort/poort.mjs parity` toont wat open staat, `parity --fix` dekt wat ci-job kan naspelen.
- Nooit `--no-verify`. Overslaan alleen met reden en alleen de check die het betreft: `POORT_SKIP=<id> git commit ...` (commit-check) of `POORT_SKIP=<id> git push` (push-check).
- Vóór een PR: commit alles, dan `node .poort/poort.mjs verify`. Het bewijs moet bij de commit horen; niet-gecommitte wijzigingen tellen niet.
<!-- poort:end -->
