interface AvatarProps {
  initials: string;
}

export function Avatar({ initials }: AvatarProps) {
  return (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg"
      style={{
        background:
          "linear-gradient(135deg, var(--color-strain) 0%, var(--color-sleep) 100%)",
      }}
      aria-label={`Avatar: ${initials}`}
    >
      {initials}
    </div>
  );
}
