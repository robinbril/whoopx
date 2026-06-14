"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

/** Animated number that counts up from 0 to value on mount/value change. */
export function CountUp({ value, decimals = 0, duration = 1.2, className }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const node = useRef(value);

  useEffect(() => {
    const controls = animate(node.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        node.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
