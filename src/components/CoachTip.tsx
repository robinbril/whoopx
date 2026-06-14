import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

interface CoachTipProps {
  message: string;
  source: string;
  /** Prefilled prompt the Coach chat auto-sends. */
  prompt: string;
}

/** Inline coaching card with an Ask Coach CTA that deep-links a prefilled prompt. */
export function CoachTip({ message, source, prompt }: CoachTipProps) {
  return (
    <div
      className="mt-3 rounded-[18px] border p-4"
      style={{
        borderColor: "color-mix(in oklab, var(--color-strain) 26%, transparent)",
        background: "color-mix(in oklab, var(--color-strain) 7%, transparent)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-strain/15 text-strain">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-fg">{message}</p>
          <p className="mt-1 text-[11px] text-dim">{source}</p>
          <Link
            href={`/coach?q=${encodeURIComponent(prompt)}`}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-strain"
          >
            Ask Coach <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
