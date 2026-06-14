"use client";

import { TriangleAlert } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <TopBar title="Something went wrong" />
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-recovery-red">
          <TriangleAlert size={28} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Couldn&rsquo;t load your data</p>
          <p className="max-w-[18rem] text-sm leading-relaxed text-muted">
            In live mode, check your WHOOP login in .env.local. Otherwise this was a hiccup, try again.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-full bg-strain px-5 py-2.5 text-sm font-semibold text-white transition active:opacity-90"
        >
          Try again
        </button>
      </div>
    </>
  );
}
