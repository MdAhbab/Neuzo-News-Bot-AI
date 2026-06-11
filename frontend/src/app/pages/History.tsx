import { motion } from "motion/react";
import { Download, FileDown, FileSearch, Inbox, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import * as api from "../lib/api";
import type { Job, JobStatus } from "../lib/types";
import { Eyebrow, StatusChip } from "../components/common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { cn } from "../components/ui/utils";

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUSES: (JobStatus | "All")[] = ["All", "Complete", "Processing", "Error"];

export default function History() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "All">("All");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    api.getHistory().then(setJobs).catch(() => setJobs([]));
  }, []);

  const categories = useMemo(() => {
    const set = new Set((jobs ?? []).map((j) => j.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (status !== "All" && j.status !== status) return false;
      if (category !== "All" && j.category !== category) return false;
      if (q && !`${j.category} ${j.engine}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, query, status, category]);

  const onExport = async (jobId: string, fmt: "md" | "json") => {
    try {
      await api.exportReport(jobId, fmt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const onDownload = async (job: Job) => {
    try {
      await api.downloadReport(job);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <div>
      <div className="double-rule py-4">
        <Eyebrow>The archive</Eyebrow>
        <h1 className="mt-2 font-display font-black leading-[0.98] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
          Filed reports
        </h1>
      </div>

      {/* filter bar */}
      {jobs && jobs.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search category or engine…"
              className="rounded-sm pl-9 font-mono text-sm"
              aria-label="Search reports"
            />
          </div>
          <div className="flex items-center gap-px border border-border">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "px-3 py-2 text-xs transition-colors",
                  status === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {categories.length > 2 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="mt-6">
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

        {jobs && jobs.length > 0 && filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 border border-dashed border-border py-12 text-center">
            <p className="text-muted-foreground">No reports match these filters.</p>
            <button
              onClick={() => { setQuery(""); setStatus("All"); setCategory("All"); }}
              className="font-mono text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="divide-y divide-border border-y border-border">
            {filtered.map((j, i) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
                className="group flex items-center gap-4 px-1 py-4 transition-colors hover:bg-secondary/40"
              >
                <button onClick={() => navigate(`/app/jobs/${j.id}`)} className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left">
                  <span className="font-display text-lg font-semibold">{j.category}</span>
                  <StatusChip status={j.status} />
                  <span className="font-mono text-xs text-muted-foreground">{j.verifiedCount}/{j.articleCount} verified</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{relative(j.createdAt)}</span>
                </button>
                {j.status === "Complete" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="border border-border p-2 text-muted-foreground outline-none hover:text-primary"
                      title="Export report"
                      aria-label="Export report"
                    >
                      <FileDown className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onDownload(j)}>
                        <Download className="mr-2 h-4 w-4" /> Word (.docx)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExport(j.id, "md")}>
                        <FileDown className="mr-2 h-4 w-4" /> Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExport(j.id, "json")}>
                        <FileDown className="mr-2 h-4 w-4" /> JSON (.json)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
