import * as Icons from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "./ui/utils";

/* ---- Icon map: resolve backend icon_name strings to lucide components ---- */
const ICON_MAP: Record<string, keyof typeof Icons> = {
  // Lucide native names
  Globe: "Globe",
  Cpu: "Cpu",
  TrendingUp: "TrendingUp",
  FlaskConical: "FlaskConical",
  Newspaper: "Newspaper",
  Leaf: "Leaf",
  Trophy: "Trophy",
  HeartPulse: "HeartPulse",
  Rocket: "Rocket",
  Sparkles: "Sparkles",
  Flame: "Flame",
  Code: "Code",
  // Heroicon-style names returned by the backend
  NewspaperIcon: "Newspaper",
  CpuChipIcon: "Cpu",
  GlobeAltIcon: "Globe",
  ChartBarIcon: "TrendingUp",
  HealthIcon: "HeartPulse",
  FireIcon: "Flame",
  SparklesIcon: "Sparkles",
  CodeBracketIcon: "Code",
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const key = ICON_MAP[name] ?? "Newspaper";
  const Cmp = Icons[key] as Icons.LucideIcon;
  return <Cmp className={className} strokeWidth={1.5} />;
}

/* ---- Neuzo masthead wordmark ---- */
export function Logo({ className }: { className?: string }) {
  return <span className={cn("font-display font-black tracking-tight", className)}>Neuzo</span>;
}

/* ---- Preview-data flag: never present mock data as real ---- */
export function PreviewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent",
        className,
      )}
      title="Rendered from local fixtures — the live backend is not connected."
    >
      <Icons.FlaskConical className="h-3 w-3" />
      preview data
    </span>
  );
}

/* ---- Confidence chip (mono ledger) ---- */
export function ConfidenceChip({ value, className }: { value: number; className?: string }) {
  const color =
    value >= 0.7 ? "text-conf-high border-conf-high/40"
    : value >= 0.5 ? "text-conf-mid border-conf-mid/40"
    : "text-conf-low border-conf-low/40";
  return (
    <span className={cn("inline-flex items-center border px-2 py-0.5 font-mono text-xs", color, className)}>
      {Math.round(value * 100)}%
    </span>
  );
}

/* ---- Status chip per job status ---- */
export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    Complete: "text-conf-high border-conf-high/40",
    Processing: "text-conf-mid border-conf-mid/40",
    Pending: "text-muted-foreground border-border",
    Error: "text-destructive border-destructive/40",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-xs", map[status] ?? map.Pending)}>
      {status === "Processing" && <span className="h-1.5 w-1.5 rounded-full bg-conf-mid blink" />}
      {status}
    </span>
  );
}

/* ---- Eyebrow / kicker ---- */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("kicker", className)}>{children}</span>;
}
