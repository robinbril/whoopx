import { CardLabel } from "@/components/ui/Card";

interface WeekHeaderProps {
  startDate: string;
  endDate: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function WeekHeader({ startDate, endDate }: WeekHeaderProps) {
  return (
    <div className="px-1 pt-2">
      <CardLabel>Week of</CardLabel>
      <p className="mt-0.5 text-[15px] font-semibold text-fg">
        {fmtDate(startDate)} &ndash; {fmtDate(endDate)}
      </p>
    </div>
  );
}
