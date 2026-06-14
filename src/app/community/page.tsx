import Link from "next/link";
import { ChevronRight, Lock, Users } from "lucide-react";
import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";

function rankAccent(rank: number): string {
  if (rank === 1) return "#f7c13a";
  if (rank === 2) return "#c7ccd6";
  if (rank === 3) return "#cd7f4d";
  return "var(--color-strain)";
}

export default async function CommunityPage() {
  const client = await getWhoopClient();
  const { communities } = await client.getCommunities();

  return (
    <>
      <TopBar title="Community" />
      <div className="px-4 pb-12 pt-6">
        <p className="text-sm leading-relaxed text-muted">
          Your teams, head to head. Recovery, strain and sleep across the people
          you train with.
        </p>

        {communities.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-[18px] border border-line-soft bg-surface p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-dim">
              <Users size={22} />
            </span>
            <p className="text-sm text-muted">You&rsquo;re not in any teams yet.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {communities.map((c) => {
              const rank = c.rank?.rank ?? null;
              return (
                <li key={c.id}>
                  <Link
                    href={`/community/${c.id}`}
                    className="flex items-center gap-4 rounded-[18px] border border-line-soft bg-surface p-4 transition active:scale-[0.99]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-strain/15 text-strain">
                      <Users size={22} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[15px] font-semibold">{c.name}</p>
                        {c.private && <Lock size={12} className="shrink-0 text-dim" />}
                      </div>
                      <p className="mt-0.5 text-xs text-dim">
                        {c.member_count ?? 0} {c.member_count === 1 ? "member" : "members"}
                        {c.team_type && (
                          <>
                            {" · "}
                            <span className="capitalize">{c.team_type.toLowerCase()}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {rank != null && (
                      <span
                        className="tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{
                          color: rankAccent(rank),
                          background: `color-mix(in oklab, ${rankAccent(rank)} 14%, transparent)`,
                        }}
                      >
                        #{rank}
                      </span>
                    )}
                    <ChevronRight size={18} className="shrink-0 text-dim" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
