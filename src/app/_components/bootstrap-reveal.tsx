"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type BootstrapRevealProps = Readonly<{
  children: ReactNode;
}>;

export function BootstrapReveal({ children }: BootstrapRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
