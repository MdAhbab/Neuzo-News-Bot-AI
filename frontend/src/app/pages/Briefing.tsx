import { ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import * as api from "../lib/api";
import type { Briefing as BriefingData } from "../lib/types";
import { ConfidenceChip, Eyebrow } from "../components/common";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

export default function Briefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  const load = () =>
    api
      .getBriefing()
      .then(setData)
      .catch(() => toast.error("Couldn't load the briefing."));
  useEffect(() => {
    load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    setData(null);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="double-rule flex flex-wrap items-end justify-between gap-4 py-4">
        <div>
          <Eyebrow>Daily briefing</Eyebrow>
          {data ? (
            <>
              <h1 className="mt-2 font-display font-black leading-[1] tracking-[-0.02em]" style={{ fontSize: "clamp(1.9rem,3.5vw,3rem)" }}>
                {data.greeting}.
              </h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{data.date}</p>
            </>
          ) : (
            <Skeleton className="mt-3 h-10 w-64 rounded-none bg-card" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={refresh} disabled={refreshing} className="rounded-sm bg-accent text-accent-foreground hover:opacity-90">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Regenerate
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
        {!data && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-none bg-card" />)}

        {data?.stories.map((s, i) => (
          <motion.article
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="kicker">{s.category}</span>
              <ConfidenceChip value={s.confidence} />
            </div>
            <h3 className="mt-3 font-display text-xl font-bold leading-snug">{s.headline}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>
            <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-foreground">
              <span className="font-mono text-xs text-primary">why it matters · </span>
              {s.whyItMatters}
            </p>
          </motion.article>
        ))}
      </div>

      {data && (
        <div className="mt-8 border border-border bg-card">
          <button onClick={() => setTraceOpen((o) => !o)} className="flex w-full items-center gap-2 px-5 py-4 text-left">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="font-display font-semibold">How this was made</span>
            <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${traceOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {traceOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <ul className="space-y-2 px-5 pb-5 font-mono text-xs">
                  {data.toolTrace.map((t, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="text-muted-foreground">{t.ts}</span>
                      <span className="text-accent">{t.tool}</span>
                      <span className="text-muted-foreground">· {t.detail}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
