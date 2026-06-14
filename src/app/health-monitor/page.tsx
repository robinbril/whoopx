import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { VitalCard } from "./_components/VitalCard";
import { formatHrv, formatRhr, formatRespiratory } from "@/lib/format";
import {
  HeartPulse,
  Activity,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
} from "lucide-react";

function stressLabel(v: number): string {
  if (v < 1) return "low";
  if (v < 2) return "moderate";
  return "high";
}

function stressColor(v: number): string {
  if (v < 1) return "var(--color-recovery-green)";
  if (v < 2) return "var(--color-recovery-yellow)";
  return "var(--color-recovery-red)";
}

function deltaLabel(pct: number | null | undefined, unit: "pct" | "abs", absVal?: number, absBase?: number): string {
  if (pct == null && absVal == null) return "no baseline";
  if (unit === "abs" && absVal != null && absBase != null) {
    const diff = Math.round(absVal - absBase);
    if (diff === 0) return "at baseline";
    return diff > 0 ? `${diff} above baseline` : `${Math.abs(diff)} below baseline`;
  }
  if (pct == null) return "no baseline";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs baseline`;
}

export default async function HealthMonitorPage() {
  const client = await getWhoopClient();
  const [r, s] = await Promise.all([
    client.getRecovery(),
    client.getStress(),
  ]);

  const iconSize = 17;
  const iconClass = "text-fg opacity-90";

  return (
    <>
      <TopBar title="Health Monitor" back />
      <div className="px-4 pb-12 pt-5">

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dim mb-4">
          Your vitals right now
        </p>

        <div className="grid grid-cols-2 gap-3">

          {/* Resting HR */}
          <VitalCard
            icon={<HeartPulse size={iconSize} className={iconClass} />}
            iconBg="rgba(251,75,75,0.18)"
            label="Resting HR"
            value={formatRhr(r.rhr.bpm ?? 0)}
            unit="bpm"
            context={deltaLabel(r.rhr.delta_pct, "abs", r.rhr.bpm ?? 0, r.rhr.baseline_bpm ?? 0)}
          />

          {/* HRV */}
          <VitalCard
            icon={<Activity size={iconSize} className={iconClass} />}
            iconBg="rgba(38,224,122,0.15)"
            label="HRV"
            value={formatHrv(r.hrv.ms ?? 0)}
            unit="ms"
            valueColor="var(--color-recovery-green)"
            context={deltaLabel(r.hrv.delta_pct, "pct")}
          />

          {/* SpO2 */}
          <VitalCard
            icon={<Droplets size={iconSize} className={iconClass} />}
            iconBg="rgba(91,143,249,0.18)"
            label="SpO₂"
            value={(r.spo2_pct ?? 0).toFixed(1)}
            unit="%"
            context={
              (r.spo2_pct ?? 0) >= 95
                ? "normal range"
                : (r.spo2_pct ?? 0) >= 90
                  ? "slightly low"
                  : "low — check again"
            }
          />

          {/* Respiratory Rate */}
          <VitalCard
            icon={<Wind size={iconSize} className={iconClass} />}
            iconBg="rgba(61,127,255,0.15)"
            label="Resp Rate"
            value={formatRespiratory(r.respiratory_rate ?? 0)}
            unit="rpm"
            context="steady"
          />

          {/* Skin Temp */}
          <VitalCard
            icon={<Thermometer size={iconSize} className={iconClass} />}
            iconBg="rgba(247,193,58,0.15)"
            label="Skin Temp"
            value={(r.skin_temp_c ?? 0).toFixed(1)}
            unit="°C"
            context="within normal range"
          />

          {/* Stress */}
          <VitalCard
            icon={<Gauge size={iconSize} className={iconClass} />}
            iconBg="rgba(157,110,255,0.15)"
            label="Stress"
            value={s.current.toFixed(1)}
            unit="/ 3"
            valueColor={stressColor(s.current)}
            context={`${stressLabel(s.current)} · avg ${s.avg.toFixed(1)} today`}
          />

        </div>
      </div>
    </>
  );
}
