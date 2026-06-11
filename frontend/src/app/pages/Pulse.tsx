import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import * as api from "../lib/api";
import type { PulseGraph as Graph } from "../lib/types";
import { PulseGraph } from "../components/canvas/PulseGraph";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Eyebrow } from "../components/common";

export default function Pulse() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    if (jobId) api.getGraph(jobId).then(setGraph);
  }, [jobId]);

  return (
    <div>
      <button onClick={() => navigate(`/app/jobs/${jobId}`)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to report
      </button>
      <div className="double-rule py-4">
        <div className="flex items-center gap-3">
          <Eyebrow>Neuzo Pulse</Eyebrow>
        </div>
        <h1 className="mt-2 font-display font-black leading-[0.98] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
          Verification graph
        </h1>
      </div>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Sources sized by reliability, articles colored by confidence, edges weighted by corroboration.
        Drag to rotate · hover for detail · click an article to open it.
      </p>

      <div className="mt-6 h-[60vh] overflow-hidden border border-border bg-card">
        {graph ? (
          <ErrorBoundary>
            <PulseGraph graph={graph} onSelectArticle={() => navigate(`/app/jobs/${jobId}`)} />
          </ErrorBoundary>
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-foreground" /> source</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-conf-high" /> confidence ≥ 70%</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-conf-mid" /> 50–70%</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-conf-low" /> &lt; 50%</span>
      </div>
    </div>
  );
}
