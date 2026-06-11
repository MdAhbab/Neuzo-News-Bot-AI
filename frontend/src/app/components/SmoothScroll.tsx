import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

let lenisInstance: Lenis | null = null;
export const getLenis = () => lenisInstance;

/**
 * Single Lenis instance driving smooth scroll, synced to the GSAP ticker so
 * ScrollTrigger scrubbing stays in lockstep. Disabled under reduced-motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const location = useLocation();

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisInstance = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, [reduced]);

  // reset scroll + refresh triggers on route change
  useEffect(() => {
    lenisInstance?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [location.pathname]);

  return <>{children}</>;
}
