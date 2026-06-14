import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { RecoveryRing } from "@/components/viz/RecoveryRing";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { CoachTip } from "@/components/CoachTip";
import { formatHrv, formatRhr, formatRespiratory, formatPercent } from "@/lib/format";
import { recoveryZone } from "@/lib/recovery";

function insight(score: number): string {
  const z = recoveryZone(score);
  if (z === "green") return "Your body is primed and ready to perform. A strong day to take on strain.";
  if (z === "yellow") return "You're moderately recovered. Train, but keep an eye on how you feel.";
  return "Your body is asking for recovery. Prioritise rest, sleep and low strain today.";
}

export default async function RecoveryPage() {
  const client = await getWhoopClient();
  const r = await client.getRecovery();
  const score = r.score ?? 0;

  return (
    <>
      <TopBar title="Recovery" back />
      <div className="px-4 pb-12 pt-6">
        <div className="flex justify-center">
          <RecoveryRing value={score} size={232} />
        </div>

        <p className="mx-auto mt-6 max-w-[20rem] text-center text-sm leading-relaxed text-muted">
          {insight(score)}
        </p>

        <Card className="mt-7">
          <CardLabel>What drove your recovery</CardLabel>
          <ul className="mt-3.5 space-y-3">
            {r.contributors.map((c) => (
              <li key={c.name} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: c.direction === "positive" ? "var(--color-recovery-green)" : c.direction === "negative" ? "var(--color-recovery-red)" : "var(--color-dim)" }}
                />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-right text-xs text-dim">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="HRV" value={formatHrv(r.hrv.ms ?? 0)} unit="ms" color="var(--color-recovery-green)" />
          <StatTile label="Resting HR" value={formatRhr(r.rhr.bpm ?? 0)} unit="bpm" />
          <StatTile label="SpO₂" value={(r.spo2_pct ?? 0).toFixed(1)} unit="%" />
          <StatTile label="Skin temp" value={(r.skin_temp_c ?? 0).toFixed(1)} unit="°C" />
          <StatTile label="Respiratory" value={formatRespiratory(r.respiratory_rate ?? 0)} unit="rpm" />
          <StatTile label="Sleep" value={formatPercent(r.sleep_performance_pct ?? 0)} />
        </div>

        <CoachTip
          message={
            recoveryZone(score) === "green"
              ? `Recovery is high at ${score}%. Your body can take on a hard session today.`
              : recoveryZone(score) === "yellow"
                ? `Recovery is moderate at ${score}%. Train, but keep the intensity measured.`
                : `Recovery is low at ${score}%. Prioritise rest, hydration and sleep today.`
          }
          source="Based on today's recovery"
          prompt={`My recovery is ${score}% today with HRV ${formatHrv(r.hrv.ms ?? 0)}ms. What training should I do?`}
        />
      </div>
    </>
  );
}
