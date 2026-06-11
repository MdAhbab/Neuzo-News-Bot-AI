import { motion } from "motion/react";
import { Download, FileSearch, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as api from "../lib/api";
import type { Job } from "../lib/types";
import { Eyebrow, StatusChip } from "../components/common";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function History() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    api.getHistory().then(setJobs);
  }, []);

  return (
    <div>
      <div className="double-rule py-4">
        <Eyebrow>The archive</Eyebrow>
        <h1 className="mt-2 font-display font-black leading-[0.98] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
          Filed reports
        </h1>
      </div>

      <div className="mt-8">
        {!jobs && (
          <div className="space-y-px border border-border bg-border">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-none bg-card" />)}
          </div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No reports yet. Commission your first verified brief.</p>
            <Button onClick={() => navigate("/app")} className="rounded-sm bg-primary text-primary-foreground hover:opacity-90">
              Go to the desk
            </Button>
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <div className="divide-y divide-border border-y border-border">
            {jobs.map((j, i) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="group flex items-center gap-4 px-1 py-4 transition-colors hover:bg-secondary/40"
              >
                <button onClick={() => navigate(`/app/jobs/${j.id}`)} className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left">
                  <span className="font-display text-lg font-semibold">{j.category}</span>
                  <StatusChip status={j.status} />
                  <span className="font-mono text-xs text-muted-foreground">{j.verifiedCount}/{j.articleCount} verified</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{relative(j.createdAt)}</span>
                </button>
                {j.status === "Complete" && (
                  <button onClick={() => api.downloadReport(j)} className="border border-border p-2 text-muted-foreground hover:text-primary" title="Download report">
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => navigate(`/app/jobs/${j.id}`)} className="border border-border p-2 text-muted-foreground hover:text-foreground" title="Open">
                  <FileSearch className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
