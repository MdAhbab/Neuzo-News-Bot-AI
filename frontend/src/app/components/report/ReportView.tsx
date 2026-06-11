import { ChevronDown, Download, Eye, EyeOff, FileDown, Network, ScrollText, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as api from "../../lib/api";
import type { Article, Job, LensReport, PulseGraph as Graph } from "../../lib/types";
import { ConfidenceChip, Eyebrow } from "../common";
import { PulseGraph } from "../canvas/PulseGraph";
import { ErrorBoundary } from "../ErrorBoundary";
import { Copilot } from "../Copilot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

type Tab = "sources" | "agent" | "lens" | "pulse";

function sentimentBar(s: number) {
  if (s > 0.2) return "var(--conf-high)";
  if (s < -0.2) return "var(--conf-low)";
  return "var(--conf-mid)";
}

export function ReportView({ job }: { job: Job }) {
  const [lensOn, setLensOn] = useState(false);
  const [tab, setTab] = useState<Tab>("sources");
  const [lens, setLens] = useState<LensReport | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    let active = true;
    api.getLens(job.id).then((l) => active && setLens(l)).catch(() => active && setLens(null));
    return () => {
      active = false;
    };
  }, [job.id]);
  useEffect(() => {
    if (tab === "pulse" && !graph) api.getGraph(job.id).then(setGraph).catch(() => {});
  }, [tab, graph, job.id]);

  const exportAs = async (fmt: "md" | "json") => {
    try {
      await api.exportReport(job.id, fmt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const download = async () => {
    try {
      await api.downloadReport(job);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const scrollToArticle = (articleId: string) => {
    const el = document.getElementById(`article-${articleId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-primary");
    setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1600);
  };

  const verifiedPct = Math.round((job.verifiedCount / Math.max(1, job.articleCount)) * 100);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      {/* MAIN */}
      <div>
        <header className="double-rule py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>{job.category} desk</Eyebrow>
            <span className="font-mono text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</span>
          </div>
          <h1 className="mt-3 font-display font-black leading-[0.98] tracking-[-0.02em]" style={{ fontSize: "clamp(1.9rem,4vw,3.2rem)" }}>
            {job.category} — Verified Brief
          </h1>
        </header>

        {/* verification ledger */}
        <div className="mt-6 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
          <div className="bg-card p-4">
            <div className="kicker">verified / total</div>
            <div className="mt-1 font-display text-2xl font-bold">
              {job.verifiedCount}
              <span className="text-muted-foreground">/{job.articleCount}</span>
            </div>
          </div>
          <div className="bg-card p-4">
            <div className="kicker">avg confidence</div>
            <div className="mt-1 font-display text-2xl font-bold text-primary">{Math.round(job.avgConfidence * 100)}%</div>
          </div>
          <div className="col-span-2 bg-card p-4 sm:col-span-1">
            <div className="kicker">verified share</div>
            <div className="mt-3 h-1.5 overflow-hidden bg-secondary">
              <div className="h-full bg-conf-high" style={{ width: `${verifiedPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Stories</h2>
          <button
            onClick={() => setLensOn((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors",
              lensOn ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {lensOn ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Lens {lensOn ? "on" : "off"}
          </button>
        </div>

        <div className="mt-4 divide-y divide-border border-y border-border">
          {job.articles.map((a) => (
            <ArticleCard key={a.id} article={a} lensOn={lensOn} />
          ))}
        </div>
      </div>

      {/* RIGHT RAIL */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="border border-border bg-card p-5">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90">
              <Download className="h-4 w-4" /> Export report
              <ChevronDown className="h-4 w-4 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-44">
              <DropdownMenuItem onClick={download}>
                <Download className="mr-2 h-4 w-4" /> Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("md")}>
                <FileDown className="mr-2 h-4 w-4" /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("json")}>
                <FileDown className="mr-2 h-4 w-4" /> JSON (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mt-5 grid grid-cols-4 gap-px border border-border bg-border">
            {([
              ["sources", ScrollText],
              ["agent", Wrench],
              ["lens", Eye],
              ["pulse", Network],
            ] as const).map(([t, Ic]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  tab === t ? "bg-card text-primary" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Ic className="h-4 w-4" />
                {t}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[220px]">
            {tab === "sources" && (
              <ul className="space-y-2">
                {job.sources.map((s, i) => (
                  <li key={i} className="truncate border border-border bg-background px-3 py-2 font-mono text-xs">
                    {s.replace(/^https?:\/\//, "")}
                  </li>
                ))}
              </ul>
            )}
            {tab === "agent" && (
              <ul className="space-y-2 font-mono text-xs">
                {job.agentActions.map((a, i) => (
                  <li key={i} className="border border-border bg-background px-3 py-2">
                    <span className="text-muted-foreground">{a.ts}</span> <span className="text-accent">{a.tool}</span>
                    <div className="text-muted-foreground">{a.detail}</div>
                  </li>
                ))}
              </ul>
            )}
            {tab === "lens" && <LensPanel lens={lens} />}
            {tab === "pulse" && (
              <div className="h-[260px] overflow-hidden border border-border bg-background">
                {graph ? (
                  <ErrorBoundary>
                    <PulseGraph graph={graph} onSelectArticle={scrollToArticle} />
                  </ErrorBoundary>
                ) : (
                  <div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">building graph…</div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <Copilot jobId={job.id} />
    </div>
  );
}

function ArticleCard({ article, lensOn }: { article: Article; lensOn: boolean }) {
  return (
    <article
      id={`article-${article.id}`}
      className="py-5 transition-all"
      style={lensOn ? { borderLeft: `3px solid ${sentimentBar(article.sentiment)}`, paddingLeft: "1rem" } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl font-bold leading-snug">{article.title}</h3>
        <ConfidenceChip value={article.confidence} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{article.excerpt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{article.source}</span>
        <span>·</span>
        <span>{article.crossRefs} cross-refs</span>
        {lensOn && (
          <>
            <span>·</span>
            <span className="text-accent">{article.tone}</span>
            <span>
              sentiment {article.sentiment > 0 ? "+" : ""}
              {article.sentiment.toFixed(2)}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function LensPanel({ lens }: { lens: LensReport | null }) {
  const counts = useMemo(() => {
    if (!lens) return { factual: 0, analytical: 0, emotive: 0 };
    return lens.articles.reduce(
      (acc, a) => ({ ...acc, [a.tone]: acc[a.tone] + 1 }),
      { factual: 0, analytical: 0, emotive: 0 } as Record<string, number>,
    );
  }, [lens]);

  if (!lens) return <div className="font-mono text-xs text-muted-foreground">analyzing tone…</div>;
  const pos = ((lens.balance + 1) / 2) * 100;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>emotive</span>
          <span>balanced</span>
          <span>factual</span>
        </div>
        <div className="relative h-2" style={{ background: "linear-gradient(90deg, var(--conf-low), var(--conf-mid), var(--conf-high))" }}>
          <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-foreground" style={{ left: `${pos}%` }} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          clusters {lens.balance >= 0 ? "factual-leaning" : "emotive-leaning"} · spread {lens.spread.toFixed(2)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-px border border-border bg-border">
        {(["factual", "analytical", "emotive"] as const).map((t) => (
          <div key={t} className="bg-card p-2 text-center">
            <div className="font-mono text-lg text-primary">{counts[t]}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
