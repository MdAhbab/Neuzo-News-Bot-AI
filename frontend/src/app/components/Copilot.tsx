import { AnimatePresence, motion } from "motion/react";
import { MessageSquare, Search, FileText, GitCompare, Send, X, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { CopilotStep } from "../lib/types";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

interface Msg {
  id: string;
  role: "user" | "agent";
  text: string;
  steps?: CopilotStep[];
  streaming?: boolean;
}

const TOOL_ICON = {
  search_archive: Search,
  get_article: FileText,
  compare_sources: GitCompare,
} as const;

export function Copilot({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "seed",
      role: "agent",
      text: "Ask me anything about this report — corroboration strength, source overlap, tone. I'll show my work.",
    },
  ]);
  const reduced = usePrefersReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { id: "u" + Date.now(), role: "user", text: q }]);
    const reply = await api.copilot(jobId, q);
    const id = "a" + Date.now();
    setMsgs((m) => [...m, { id, role: "agent", text: "", steps: reply.steps, streaming: true }]);

    if (reduced) {
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: reply.answer, streaming: false } : x)));
      setBusy(false);
      return;
    }
    let i = 0;
    const tick = () => {
      i += 2;
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: reply.answer.slice(0, i) } : x)));
      if (i < reply.answer.length) setTimeout(tick, 16);
      else {
        setMsgs((m) => m.map((x) => (x.id === id ? { ...x, streaming: false } : x)));
        setBusy(false);
      }
    };
    setTimeout(tick, 300);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" /> Ask Neuzo
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 38 }}
            >
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-sm bg-accent/10 text-accent">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-display font-bold">Report Copilot</div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {msgs.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                    {m.role === "user" ? (
                      <div className="max-w-[85%] rounded-sm bg-primary/10 px-4 py-2 text-sm text-foreground">{m.text}</div>
                    ) : (
                      <div className="max-w-[92%] space-y-2">
                        {m.steps && (
                          <div className="space-y-1.5 border border-border bg-background p-3">
                            {m.steps.map((s, i) => {
                              const Ic = TOOL_ICON[s.tool];
                              return (
                                <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-accent blink" />
                                  <Ic className="h-3 w-3 text-accent" />
                                  <span className="text-muted-foreground">
                                    <span className="text-accent">{s.tool}</span> · {s.detail}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {m.text && (
                          <div className="border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground">
                            {m.text}
                            {m.streaming && <span className="ml-0.5 inline-block h-3 w-1.5 bg-primary align-middle blink" />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-4">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {["Which story is weakest?", "Summarize this report"].map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      disabled={busy}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(input);
                  }}
                  className="flex items-center gap-2 border border-border bg-background px-3 py-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about this report…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button type="submit" disabled={busy} className="text-primary disabled:opacity-50" aria-label="Send">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
