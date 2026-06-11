import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { PulseGraph as Graph, GraphNode } from "../../lib/types";

interface Sim extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function readVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Force-directed verification graph on a 2D canvas. Source nodes are sized by
 * reliability; article nodes are colored by confidence; edges are corroboration
 * links with strength-weighted opacity. Drag to rotate the layout, hover for a
 * tooltip, click an article to scroll the report to it.
 */
export function PulseGraph({
  graph,
  onSelectArticle,
  className,
}: {
  graph: Graph;
  onSelectArticle?: (articleId: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState<{ node: Sim; x: number; y: number } | null>(null);

  const palette = {
    high: readVar("--conf-high", "#1f6f54"),
    mid: readVar("--conf-mid", "#9a6a00"),
    low: readVar("--conf-low", "#b3261e"),
    source: readVar("--foreground", "#1b1714"),
    edge: readVar("--accent", "#1d3a5f"),
    sourceRing: readVar("--primary", "#b3261e"),
  };
  const confColor = (c?: number) => {
    if (c == null) return readVar("--muted-foreground", "#6d6353");
    if (c >= 0.7) return palette.high;
    if (c >= 0.5) return palette.mid;
    return palette.low;
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let dragging = false;
    let last = { x: 0, y: 0 };
    let rot = 0;
    let nodes: Sim[] = [];
    const edges = graph.edges;
    const idx = new Map<string, Sim>();

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    nodes = graph.nodes.map((n, i) => {
      const a = (i / graph.nodes.length) * Math.PI * 2;
      const s: Sim = {
        ...n,
        x: Math.cos(a) * 120 + (Math.random() - 0.5) * 40,
        y: Math.sin(a) * 120 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
      idx.set(n.id, s);
      return s;
    });

    let settle = 0;
    const step = () => {
      // simple force layout: repulsion + spring on edges + centering
      if (settle < 320) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let d2 = dx * dx + dy * dy || 0.01;
            const f = 900 / d2;
            const d = Math.sqrt(d2);
            a.vx += (dx / d) * f;
            a.vy += (dy / d) * f;
            b.vx -= (dx / d) * f;
            b.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const a = idx.get(e.from);
          const b = idx.get(e.to);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const target = 90;
          const f = (d - target) * 0.01 * e.strength;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
        }
        for (const n of nodes) {
          n.vx += -n.x * 0.002;
          n.vy += -n.y * 0.002;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
        }
        settle++;
      }

      if (!reduced && !dragging) rot += 0.0012;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const proj = (n: Sim) => ({
        x: cx + (n.x * cos - n.y * sin),
        y: cy + (n.x * sin + n.y * cos),
      });

      // edges
      for (const e of edges) {
        const a = idx.get(e.from);
        const b = idx.get(e.to);
        if (!a || !b) continue;
        const pa = proj(a);
        const pb = proj(b);
        ctx.globalAlpha = 0.14 + e.strength * 0.45;
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = 0.6 + e.strength * 1.4;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // nodes
      for (const n of nodes) {
        const p = proj(n);
        const isSrc = n.type === "source";
        const r = isSrc ? 6 + n.weight * 8 : 4 + n.weight * 6;
        const color = isSrc ? palette.source : confColor(n.confidence);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        g.addColorStop(0, color);
        g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (isSrc) {
          ctx.strokeStyle = palette.sourceRing;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        (n as Sim & { _sx: number; _sy: number; _r: number })._sx = p.x;
        (n as Sim & { _sx: number; _sy: number; _r: number })._sy = p.y;
        (n as Sim & { _sx: number; _sy: number; _r: number })._r = r;
      }
      raf = requestAnimationFrame(step);
    };

    const pick = (mx: number, my: number) =>
      nodes.find((n) => {
        const sn = n as Sim & { _sx: number; _sy: number; _r: number };
        const dx = sn._sx - mx;
        const dy = sn._sy - my;
        return Math.sqrt(dx * dx + dy * dy) < sn._r + 5;
      }) ?? null;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => (dragging = false);
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (dragging) {
        rot += (e.clientX - last.x) * 0.005;
        last = { x: e.clientX, y: e.clientY };
        setHover(null);
        return;
      }
      const n = pick(mx, my);
      setHover(n ? { node: n, x: mx, y: my } : null);
      canvas.style.cursor = n ? "pointer" : "grab";
    };
    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const n = pick(e.clientX - rect.left, e.clientY - rect.top);
      if (n?.articleId && onSelectArticle) onSelectArticle(n.articleId);
    };

    resize();
    step();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [graph, reduced, onSelectArticle, resolvedTheme]);

  return (
    <div className={"relative " + (className ?? "")}>
      <canvas ref={ref} className="h-full w-full touch-none" style={{ cursor: "grab" }} />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[220px] border border-border bg-card p-3 shadow-lg"
          style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {hover.node.type}
          </div>
          <div className="mt-1 text-sm text-card-foreground line-clamp-2">{hover.node.label}</div>
          {hover.node.confidence != null && (
            <div className="mt-1 font-mono text-xs" style={{ color: confColor(hover.node.confidence) }}>
              confidence {Math.round(hover.node.confidence * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
