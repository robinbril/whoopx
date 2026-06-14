import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VitalCardProps {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  unit: string;
  valueColor?: string;
  context: string;
  className?: string;
}

export function VitalCard({
  icon,
  iconBg,
  label,
  value,
  unit,
  valueColor,
  context,
  className,
}: VitalCardProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line-soft bg-surface p-5 flex flex-col gap-3",
        className,
      )}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</p>
        <p
          className="tabular mt-0.5 text-[1.85rem] font-bold leading-none"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
          <span className="ml-1 text-sm font-medium text-muted">{unit}</span>
        </p>
      </div>

      <p className="text-xs text-dim leading-snug">{context}</p>
    </div>
  );
}
