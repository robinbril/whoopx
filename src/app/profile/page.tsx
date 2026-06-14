import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/Stat";
import { Avatar } from "./_components/Avatar";
import { MembershipBadge } from "./_components/MembershipBadge";

function formatFitnessLevel(level: string | null): string {
  if (!level) return "Unknown";
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
}

export default async function ProfilePage() {
  const client = await getWhoopClient();
  const profile = await client.getProfile();

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  return (
    <>
      <TopBar title="Profile" back />
      <div className="px-4 pb-12 pt-6">
        {/* Avatar + identity */}
        <div className="flex flex-col items-center gap-3">
          <Avatar initials={initials} />
          <div className="text-center">
            <h2 className="text-xl font-bold text-fg">{fullName}</h2>
            <p className="text-sm text-muted">@{profile.username}</p>
            {location && (
              <p className="mt-0.5 text-xs text-dim">{location}</p>
            )}
          </div>
          <MembershipBadge status={profile.membership.status} active={profile.membership.in_effect} />
        </div>

        {/* Body stats */}
        <Card className="mt-6">
          <CardLabel>Body stats</CardLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile
              label="Height"
              value={profile.height.cm ?? "–"}
              unit="cm"
            />
            <StatTile
              label="Weight"
              value={profile.weight.kg !== null ? profile.weight.kg.toFixed(1) : "–"}
              unit="kg"
            />
            <StatTile
              label="Max HR"
              value={profile.bio_data.max_hr_bpm}
              unit="bpm"
              color="var(--color-recovery-red)"
            />
            <StatTile
              label="Resting HR"
              value={profile.bio_data.resting_hr_bpm}
              unit="bpm"
              color="var(--color-recovery-green)"
            />
            {profile.bio_data.min_hr_bpm !== null && (
              <StatTile
                label="Min HR"
                value={profile.bio_data.min_hr_bpm}
                unit="bpm"
              />
            )}
            <StatTile
              label="Fitness"
              value={formatFitnessLevel(profile.fitness_level)}
            />
          </div>
        </Card>

        {/* Settings row */}
        <Card className="mt-3">
          <CardLabel>Preferences</CardLabel>
          <ul className="mt-3 space-y-0 divide-y divide-line-soft text-sm">
            <li className="flex items-center justify-between py-2.5">
              <span className="text-muted">Units</span>
              <span className="font-medium text-fg">Metric</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-muted">Mode</span>
              <span className="font-medium text-fg">Demo</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-muted">Timezone</span>
              <span className="tabular font-medium text-fg">{profile.timezone_offset}</span>
            </li>
          </ul>
        </Card>

        {/* Connect card */}
        <Card className="mt-3 border-strain/30 bg-strain/5">
          <CardLabel className="text-strain">Connect your WHOOP</CardLabel>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This app runs on demo data. To connect your real WHOOP account,
            add the following to{" "}
            <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px] text-fg">
              .env.local
            </code>{" "}
            and restart the server:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-surface-3 px-4 py-3 text-[12px] leading-relaxed text-fg">
            <code>{`WHOOP_MODE=live\nWHOOP_EMAIL=you@example.com\nWHOOP_PASSWORD=yourpassword`}</code>
          </pre>
          <p className="mt-2 text-xs text-dim">
            Uses your personal WHOOP account credentials directly. No third-party access.
          </p>
        </Card>
      </div>
    </>
  );
}
