import { RecoveryRing } from "@/components/viz/RecoveryRing";
import { StrainRing } from "@/components/viz/StrainRing";
import { SleepRing } from "@/components/viz/SleepRing";
import { CardLabel } from "@/components/ui/Card";

interface HeadlineAveragesProps {
  avgRecovery: number;
  avgStrain: number;
  avgSleep: number;
}

function RingLabel({ children }: { children: React.ReactNode }) {
  return (
    <CardLabel className="mt-2 text-center">{children}</CardLabel>
  );
}

export function HeadlineAverages({ avgRecovery, avgStrain, avgSleep }: HeadlineAveragesProps) {
  return (
    <div className="flex items-start justify-around gap-2 py-2">
      <div className="flex flex-col items-center">
        <RecoveryRing value={Math.round(avgRecovery)} size={108} showLabel={false} />
        <RingLabel>Recovery</RingLabel>
      </div>
      <div className="flex flex-col items-center">
        <StrainRing value={Math.round(avgStrain * 10) / 10} size={108} showLabel={false} />
        <RingLabel>Strain</RingLabel>
      </div>
      <div className="flex flex-col items-center">
        <SleepRing value={Math.round(avgSleep)} size={108} showLabel={false} />
        <RingLabel>Sleep</RingLabel>
      </div>
    </div>
  );
}
