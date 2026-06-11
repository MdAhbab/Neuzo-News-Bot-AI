import { BarChart3, Inbox } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as api from "../lib/api";
import type { Coverage } from "../lib/types";
import { Eyebrow } from "../components/common";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

/* Resolve theme tokens to concrete colors for the SVG charts. */
function useChartColors() {
  const [c, setC] = useState({
    primary: "#b3261e",
    accent: "#1d3a5f",
    high: "#1f6f54",
    border: "#d7cdb9",
    muted: "#6d6353",
    card: "#fbf8f1",
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    setC({
      primary: get("--primary", "#b3261e"),
      accent: get("--accent", "#1d3a5f"),
      high: get("--conf-high", "#1f6f54"),
      border: get("--border", "#d7cdb9"),
      muted: get("--muted-foreground", "#6d6353"),
      card: get("--card", "#fbf8f1"),
    });
  }, []);
  return c;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <div className="kicker">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState<Coverage | null>(null);
  const [error, setError] = useState(false);
  const colors = useChartColors();

  useEffect(() => {
    let active = true;
    api
      .getCoverage()
      .then((d) => active && setData(d))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const timeline = useMemo(
    () =>
      (data?.timeline ?? []).map((p) => ({
        ...p,
        label: p.date.slice(5), // MM-DD
      })),
    [data],
  );

  const tooltipStyle = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  };

  return (
    <div>
      <div className="double-rule py-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <Eyebrow>Coverage analytics</Eyebrow>
        </div>
        <h1
          className="mt-2 font-display font-black leading-[0.98] tracking-[-0.02em]"
          style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}
        >
          Your verification record
        </h1>
      </div>

      {error && (
        <div className="mt-10 flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">Couldn't load analytics. The service may be offline.</p>
          <Button onClick={() => window.location.reload()} className="rounded-sm bg-primary text-primary-foreground hover:opacity-90">
            Retry
          </Button>
        </div>
      )}

      {!error && !data && (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-none bg-card" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-none bg-card" />
        </div>
      )}

      {!error && data && data.totals.jobs === 0 && (
        <div className="mt-10 flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No completed reports yet — analytics appear once you've filed a few briefs.</p>
          <Button onClick={() => navigate("/app")} className="rounded-sm bg-primary text-primary-foreground hover:opacity-90">
            Go to the desk
          </Button>
        </div>
      )}

      {!error && data && data.totals.jobs > 0 && (
        <div className="mt-8 space-y-8">
          {/* totals */}
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            <Tile label="reports" value={String(data.totals.jobs)} />
            <Tile label="articles" value={String(data.totals.articles)} />
            <Tile label="verified" value={String(data.totals.verified)} />
            <Tile label="avg confidence" value={`${Math.round(data.totals.avgConfidence * 100)}%`} />
          </div>

          {/* timeline */}
          <section className="border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Reports over time · last 30 days</h2>
            {timeline.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">No activity in the last 30 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="gArticles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gVerified" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.high} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={colors.high} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke={colors.muted} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                  <YAxis stroke={colors.muted} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="articles" stroke={colors.accent} fill="url(#gArticles)" strokeWidth={2} />
                  <Area type="monotone" dataKey="verified" stroke={colors.high} fill="url(#gVerified)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex gap-4 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2" style={{ background: colors.accent }} /> articles</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2" style={{ background: colors.high }} /> verified</span>
            </div>
          </section>

          {/* by category */}
          <section className="border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold">By category</h2>
            <ResponsiveContainer width="100%" height={Math.max(160, data.categories.length * 44)}>
              <BarChart data={data.categories} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={colors.border} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke={colors.muted} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} allowDecimals={false} />
                <YAxis type="category" dataKey="category" stroke={colors.muted} width={96} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.border, opacity: 0.3 }} />
                <Bar dataKey="articles" fill={colors.accent} radius={[0, 2, 2, 0]} />
                <Bar dataKey="verified" fill={colors.high} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 divide-y divide-border border-t border-border">
              {data.categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between py-2 font-mono text-xs">
                  <span className="text-foreground">{c.category}</span>
                  <span className="text-muted-foreground">
                    {c.verified}/{c.articles} verified · {Math.round(c.avgConfidence * 100)}% avg
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
