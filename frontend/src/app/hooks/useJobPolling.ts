import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { Job } from "../lib/types";

/** Polls job status every 2.5s, tolerating 3 consecutive failures (per spec). */
export function useJobPolling(jobId: string | undefined) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fails = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const j = await api.getJobStatus(jobId);
        if (!active) return;
        fails.current = 0;
        setJob(j);
        if (j.status === "Processing" || j.status === "Pending") {
          timer = setTimeout(poll, 2500);
        }
      } catch (e) {
        fails.current += 1;
        if (fails.current >= 3) {
          setError(e instanceof Error ? e.message : "Lost connection to the job.");
        } else if (active) {
          timer = setTimeout(poll, 2500);
        }
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  return { job, error };
}
