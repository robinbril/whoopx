"use client";

import { motion } from "framer-motion";

interface LeaderboardRowProps {
  index: number;
  children: React.ReactNode;
}

/**
 * Animated wrapper for a single leaderboard row. Staggers in on mount so the
 * board feels alive without any client-side data fetching (data arrives as
 * fully-rendered children from the server component).
 */
export function LeaderboardRow({ index, children }: LeaderboardRowProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.li>
  );
}
