import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";

export default function NotFound() {
  return (
    <>
      <TopBar title="Not found" />
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="tabular text-5xl font-bold text-faint">404</p>
        <p className="text-sm text-muted">This screen doesn&rsquo;t exist.</p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-semibold transition active:opacity-90"
        >
          Back to today
        </Link>
      </div>
    </>
  );
}
