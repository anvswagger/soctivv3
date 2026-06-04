import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * CountUp animates from 0 to `end` exactly once on mount and then
 * displays the current `end` value whenever it changes.
 *
 * Earlier versions re-ran the requestAnimationFrame loop on every
 * `end` change, which (combined with realtime/auth re-renders) caused
 * the count to flutter up and down dozens of times per second.
 */
export function CountUp({
  end,
  duration = 1.2,
  decimals = 0,
  className,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    // Respect user motion preferences - jump straight to the final value.
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(end);
      hasAnimatedRef.current = true;
      return;
    }

    // If we've already finished the intro animation, just snap to the new value.
    if (hasAnimatedRef.current) {
      setDisplayValue(end);
      return;
    }

    startTimeRef.current = performance.now();
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (end - startValue) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        hasAnimatedRef.current = true;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
    // We intentionally do NOT re-run this effect on `end` changes after the
    // initial mount - that was the source of the constant re-animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString("ar-SA");

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
