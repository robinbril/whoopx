interface MembershipBadgeProps {
  status: string;
  active: boolean;
}

export function MembershipBadge({ status, active }: MembershipBadgeProps) {
  const label = active ? "WHOOP Pro" : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
      style={{
        background: active
          ? "linear-gradient(90deg, var(--color-strain)/20, var(--color-sleep)/20)"
          : "var(--color-surface-3)",
        color: active ? "var(--color-strain)" : "var(--color-muted)",
        border: active
          ? "1px solid color-mix(in srgb, var(--color-strain) 30%, transparent)"
          : "1px solid var(--color-line-soft)",
      }}
    >
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-strain)" }}
        />
      )}
      {label}
    </span>
  );
}
