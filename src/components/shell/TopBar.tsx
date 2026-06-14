"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDayLabel } from "@/lib/format";

interface TopBarProps {
  /** Page title shown centered. When absent, shows the day label. */
  title?: string;
  /** Show a back chevron that pops the route. */
  back?: boolean;
  /** Optional right-side slot (e.g. an avatar or action). */
  right?: React.ReactNode;
}

export function TopBar({ title, back, right }: TopBarProps) {
  const router = useRouter();
  const [day, setDay] = useState("");

  useEffect(() => {
    setDay(formatDayLabel(new Date()));
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line-soft bg-ink/80 px-4 backdrop-blur-xl">
      <div className="flex w-16 items-center">
        {back ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-fg active:bg-surface-2"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <span className="select-none text-[13px] font-semibold tracking-[0.18em] text-strain">
            WHOOP
          </span>
        )}
      </div>

      <h1 className="flex-1 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-muted tabular">
        {title ?? day}
      </h1>

      <div className="flex w-16 items-center justify-end">{right}</div>
    </header>
  );
}
