import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  className?: string;
}

export function StatTile({ label, value, unit, color, className }: StatTileProps) {
  return (
    <div className={cn("rounded-2xl border border-line-soft bg-surface px-4 py-3.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
    </div>
  );
}
