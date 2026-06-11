import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useJobPolling } from "../hooks/useJobPolling";
import { ReportView } from "../components/report/ReportView";
import { Eyebrow } from "../components/common";
import { Button } from "../components/ui/button";

const STEP_LABELS = [
  { tool: "fetch_articles", label: "Fetching articles", tech: "sources" },
  { tool: "gemma_curate", label: "Curating", tech: "gemma4:e4b" },
  { tool: "semantic_verify", label: "Verifying", tech: "all-MiniLM-L6-v2" },
  { tool: "compose_report", label: "Composing report", tech: ".docx" },
];

export default function Job() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { job, error } = useJobPolling(jobId);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center border border-destructive/40 bg-destructive/10 text-destructive">
          <X className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Something broke</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate("/app")} className="rounded-sm bg-secondary text-secondary-foreground hover:bg-secondary/70">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={() => window.location.reload()} className="rounded-sm bg-primary text-primary-foreground hover:opacity-90">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (job.status === "Error") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-destructive">Job failed</h1>
        <p className="mt-2 text-muted-foreground">{job.error ?? "The agent hit an error while verifying."}</p>
        <Button onClick={() => navigate("/app")} className="mt-6 rounded-sm bg-primary text-primary-foreground hover:opacity-90">
          Start over
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {job.status === "Complete" ? (
        <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <button onClick={() => navigate("/app/history")} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Archive
          </button>
          <ReportView job={job} />
        </motion.div>
      ) : (
        <Processing key="processing" job={job} />
      )}
    </AnimatePresence>
  );
}

function Processing({ job }: { job: ReturnType<typeof useJobPolling>["job"] }) {
  const navigate = useNavigate();
  if (!job) return null;
  const doneTools = new Set(job.agentActions.map((a) => a.tool));
  const activeIdx = STEP_LABELS.findIndex((s) => !doneTools.has(s.tool));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Eyebrow>{job.category} desk</Eyebrow>
        <button onClick={() => navigate("/app/history")} className="ml-auto text-sm text-muted-foreground hover:text-foreground" title="Keeps running — find it in the Archive">
          Dismiss
        </button>
      </div>
      <h1 className="mt-3 font-display font-black leading-[1] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem,3.5vw,2.6rem)" }}>
        The agent is at work
      </h1>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        Fetching, curating and cross-verifying. This keeps running in the background — you can leave.
      </p>

      {/* timeline */}
      <div className="mt-8 space-y-1">
        {STEP_LABELS.map((s, i) => {
          const done = doneTools.has(s.tool);
          const active = i === activeIdx;
          return (
            <div key={s.tool} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full border ${
                    done ? "border-conf-high bg-conf-high/10 text-conf-high" : active ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : active ? <span className="h-2.5 w-2.5 rounded-full bg-accent blink" /> : <span className="font-mono text-xs">{i + 1}</span>}
                </div>
                {i < STEP_LABELS.length - 1 && <div className={`h-10 w-px ${done ? "bg-conf-high/40" : "bg-border"}`} />}
              </div>
              <div className="pt-1">
                <div className={`font-display font-semibold ${active || done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                <div className="font-mono text-xs text-accent">{s.tech}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* counters */}
      <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border">
        <div className="bg-card p-4">
          <div className="kicker">articles</div>
          <div className="font-display text-2xl font-bold">{job.articleCount}</div>
        </div>
        <div className="bg-card p-4">
          <div className="kicker">verified</div>
          <div className="font-display text-2xl font-bold text-conf-high">{job.verifiedCount}</div>
        </div>
      </div>

      {/* live partial */}
      <div className="mt-6 border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary blink" /> live draft
        </div>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
          {job.partial || "…"}
          <span className="inline-block h-3 w-1.5 bg-primary align-middle blink" />
        </pre>
      </div>
    </motion.div>
  );
}
