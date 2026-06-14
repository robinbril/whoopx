import Link from "next/link";
import { ChevronRight, TrendingUp, Lightbulb, CalendarDays, HeartPulse, Activity, Gauge, Flame, NotebookPen, Zap, User } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface MenuRow {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ROWS: MenuRow[] = [
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/report", label: "Weekly Report", icon: CalendarDays },
  { href: "/workouts", label: "Workouts", icon: Activity },
  { href: "/stress", label: "Stress", icon: Gauge },
  { href: "/cardio-load", label: "Cardio Load", icon: Flame },
  { href: "/health-monitor", label: "Health Monitor", icon: HeartPulse },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/strength", label: "Strength", icon: Zap },
  { href: "/profile", label: "Profile", icon: User },
];

export default function MorePage() {
  return (
    <>
      <TopBar title="More" />
      <div className="px-4 pb-12 pt-6">
        <Card className="p-0 overflow-hidden">
          {ROWS.map((row, i) => {
            const Icon = row.icon;
            const isLast = i === ROWS.length - 1;
            return (
              <Link
                key={row.href}
                href={row.href}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 active:bg-surface-2 transition-colors",
                  !isLast && "border-b border-line-soft",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                  <Icon size={18} className="text-muted" />
                </span>
                <span className="flex-1 text-[15px] font-medium text-fg">{row.label}</span>
                <ChevronRight size={18} className="text-dim" />
              </Link>
            );
          })}
        </Card>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-faint">
          Demo data. Add your WHOOP login in .env.local to go live.
        </p>
      </div>
    </>
  );
}
