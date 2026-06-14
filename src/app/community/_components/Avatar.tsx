import { cn } from "@/lib/utils";

interface AvatarProps {
  firstName: string;
  lastName: string;
  /** Highlight the current user's avatar with the strain accent ring. */
  you?: boolean;
  size?: number;
  className?: string;
}

// Deterministic palette so a given person always gets the same circle color.
const PALETTE = [
  "#3d7fff",
  "#26e07a",
  "#f7c13a",
  "#7d6bff",
  "#fb4b4b",
  "#5b8ff9",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase();
}

/** Circular initials avatar with a deterministic tint. */
export function Avatar({ firstName, lastName, you, size = 40, className }: AvatarProps) {
  const tint = you ? "var(--color-strain)" : colorFor(`${firstName} ${lastName}`);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: tint,
        background: `color-mix(in oklab, ${tint} 18%, transparent)`,
        border: `1.5px solid color-mix(in oklab, ${tint} 45%, transparent)`,
      }}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
