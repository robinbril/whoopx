"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { House, Sparkles, Users, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof House;
  match: (path: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House, match: (p) => p === "/" || ["/recovery", "/strain", "/sleep"].includes(p) },
  { href: "/coach", label: "Coach", icon: Sparkles, match: (p) => p.startsWith("/coach") },
  { href: "/community", label: "Community", icon: Users, match: (p) => p.startsWith("/community") },
  { href: "/more", label: "More", icon: LayoutGrid, match: (p) => p.startsWith("/more") || ["/trends", "/journal", "/strength", "/workouts", "/settings"].includes(p) },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 border-t border-line-soft bg-ink/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-[440px] items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center gap-1 rounded-xl py-1.5 outline-none"
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute -top-2 h-[3px] w-7 rounded-full bg-strain"
                  />
                )}
                <Icon
                  size={23}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={cn("transition-colors", active ? "text-fg" : "text-dim")}
                />
                <span
                  className={cn(
                    "text-[10.5px] font-medium tracking-wide transition-colors",
                    active ? "text-fg" : "text-dim",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
