import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export function Card({ className, inset, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line-soft bg-surface",
        inset ? "p-4" : "p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-dim", className)}
      {...props}
    />
  );
}
