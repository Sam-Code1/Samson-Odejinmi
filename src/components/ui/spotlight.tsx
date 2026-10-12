"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring, useTransform, type SpringOptions } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Cursor-following spotlight (from ibelick / 21st.dev). Changes for this project: `motion/react` instead of
 * `framer-motion` (same library, already installed), a soft ink glow from the theme tokens instead of fixed zinc
 * colours, listeners that are actually removed on unmount, and nothing rendered under prefers-reduced-motion.
 */
type SpotlightProps = {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
};

export function Spotlight({ className, size = 200, springOptions = { bounce: 0 } }: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  const mouseX = useSpring(0, springOptions);
  const mouseY = useSpring(0, springOptions);

  const spotlightLeft = useTransform(mouseX, (x) => `${x - size / 2}px`);
  const spotlightTop = useTransform(mouseY, (y) => `${y - size / 2}px`);

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (parent) {
      parent.style.position = "relative";
      parent.style.overflow = "hidden";
      setParentElement(parent);
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement) return;
      const { left, top } = parentElement.getBoundingClientRect();
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    },
    [mouseX, mouseY, parentElement],
  );

  useEffect(() => {
    if (!parentElement) return;
    const enter = () => setIsHovered(true);
    const leave = () => setIsHovered(false);
    parentElement.addEventListener("mousemove", handleMouseMove);
    parentElement.addEventListener("mouseenter", enter);
    parentElement.addEventListener("mouseleave", leave);
    return () => {
      parentElement.removeEventListener("mousemove", handleMouseMove);
      parentElement.removeEventListener("mouseenter", enter);
      parentElement.removeEventListener("mouseleave", leave);
    };
  }, [parentElement, handleMouseMove]);

  if (reduce) return <div ref={containerRef} aria-hidden className="hidden" />;

  return (
    <motion.div
      ref={containerRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops),transparent_80%)] blur-xl transition-opacity duration-200",
        "from-ink/25 via-blue-soft/15 to-violet/10",
        isHovered ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{ width: size, height: size, left: spotlightLeft, top: spotlightTop }}
    />
  );
}
