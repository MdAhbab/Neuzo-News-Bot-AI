import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Plus, Sparkles, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import * as api from "../lib/api";
import type { Category, Engine } from "../lib/types";
import { CategoryIcon, Eyebrow } from "../components/common";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../components/ui/utils";

const ENGINES: { id: Engine; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Pick the best available engine" },
  { id: "newsapi", label: "NewsAPI", hint: "Hosted API · needs a key" },
  { id: "crawler", label: "Local AI", hint: "On-device RSS crawler · 0 keys" },
];

function isValidUrl(u: string) {
  try {
    new URL(u.startsWith("http") ? u : "https://" + u);
    return true;
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>("crawler");
  const [addOpen, setAddOpen] = useState(false);
  const [sourceInput, setSourceInput] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const selected = categories?.find((c) => c.id === selectedId) ?? null;

  const refresh = async (focusId?: string) => {
    const c = await api.getCategories();
    setCategories(c);
    if (focusId) setSelectedId(focusId);
  };

  const addSource = async () => {
    if (!selected) return;
    const url = sourceInput.trim();
    if (!isValidUrl(url)) return toast.error("Enter a valid URL");
    setSourceInput("");
    try {
      await api.addSource(selected.id, url.startsWith("http") ? url : "https://" + url);
      await refresh(selected.id);
      toast.success("Source added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add source");
    }
  };

  const removeSource = async (sourceId: string) => {
    if (!selected) return;
    try {
      await api.removeSource(selected.id, sourceId);
      await refresh(selected.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove source");
    }
  };

  const generate = async () => {
    if (!selected || selected.sources.length === 0) return;
    setStarting(true);
    try {
      const job = await api.startJob(selected, selected.sources.map((s) => s.url), engine);
      navigate(`/app/jobs/${job.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the report");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="pb-28">
      <div className="double-rule py-4">
        <Eyebrow>The desk</Eyebrow>
        <h1 className="mt-2 font-display font-black leading-[0.98] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
          Commission a verified brief
        </h1>
      </div>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Choose a category, confirm your sources, pick an engine, and dispatch the agent to fetch,
        curate, and cross-verify.
      </p>

      {/* CATEGORIES */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold">Categories</h2>
          <span className="font-mono text-xs text-muted-foreground">{categories ? `${categories.length} available` : "loading…"}</span>
        </div>

        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
          {!categories && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-none bg-card" />)}

          {categories?.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(active ? null : c.id)}
                className={cn(
                  "group relative h-28 bg-card p-4 text-left transition-colors",
                  active ? "ring-2 ring-inset ring-primary" : "hover:bg-secondary/60",
                )}
              >
                <div className={cn("grid h-9 w-9 place-items-center rounded-sm", active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground group-hover:text-foreground")}>
                  <CategoryIcon name={c.icon} className="h-5 w-5" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-display font-semibold">{c.name}</span>
                  {c.custom && <span className="border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-accent">custom</span>}
                </div>
                <span className="font-mono text-xs text-muted-foreground">{c.sources.length} sources</span>
              </button>
            );
          })}

          {categories && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-28 flex-col items-center justify-center gap-2 bg-card text-muted-foreground transition-colors hover:text-primary"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm">Add category</span>
            </button>
          )}
        </div>
      </section>

      {/* SOURCES */}
      <AnimatePresence>
        {selected && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-8 border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold">Sources · {selected.name}</h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSource()}
                  placeholder="https://example.com/feed"
                  className="rounded-sm font-mono text-sm"
                />
                <Button onClick={addSource} className="rounded-sm bg-secondary text-secondary-foreground hover:bg-secondary/70">
                  <Plus className="mr-1.5 h-4 w-4" /> Add source
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.sources.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sources yet — add at least one URL to enable report generation.</p>
                )}
                {selected.sources.map((s) => (
                  <span key={s.id} className="group inline-flex max-w-full items-center gap-2 border border-border bg-background py-1.5 pl-3 pr-2 font-mono text-xs">
                    <span className="truncate">{s.url.replace(/^https?:\/\//, "")}</span>
                    <button onClick={() => removeSource(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove source">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* LAUNCH BAR */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-px border border-border">
            {ENGINES.map((e) => (
              <button
                key={e.id}
                onClick={() => setEngine(e.id)}
                title={e.hint}
                className={cn("relative px-3 py-2 text-sm transition-colors", engine === e.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {engine === e.id && <motion.span layoutId="engine-pill" className="absolute inset-0 bg-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative z-10">{e.label}</span>
              </button>
            ))}
          </div>
          <span className="hidden font-mono text-xs text-muted-foreground sm:block">{ENGINES.find((e) => e.id === engine)?.hint}</span>
          <Button
            onClick={generate}
            disabled={!selected || selected.sources.length === 0 || starting}
            className="ml-auto rounded-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate report
          </Button>
        </div>
      </div>

      <AddCategoryModal open={addOpen} onOpenChange={setAddOpen} onCreated={(id) => refresh(id)} />
    </div>
  );
}

function AddCategoryModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Newspaper");
  const [prompt, setPrompt] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<null | { name: string; icon: string; sources: { url: string; checked: boolean }[] }>(null);
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setTab("manual");
    setName("");
    setIcon("Newspaper");
    setPrompt("");
    setSuggested(null);
  };

  const runSuggest = async () => {
    setSuggesting(true);
    try {
      const r = await api.suggest(prompt);
      setSuggested({ name: r.name, icon: r.icon, sources: r.sources.map((s) => ({ url: s.url, checked: s.recommended })) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setSuggesting(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      let created;
      if (tab === "manual") {
        if (!name.trim()) {
          toast.error("Enter a category name");
          setCreating(false);
          return;
        }
        created = await api.createCategory(name.trim(), icon, []);
      } else {
        if (!suggested) return;
        created = await api.createCategory(suggested.name, suggested.icon, suggested.sources.filter((s) => s.checked).map((s) => s.url));
      }
      toast.success(`Created "${created.name}"`);
      onCreated(created.id);
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create category");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg rounded-sm border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a category</DialogTitle>
          <DialogDescription className="text-muted-foreground">Name it yourself, or let the agent suggest a category and sources.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 border border-border text-sm">
          {(["manual", "ai"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("py-2.5 transition-colors", tab === t ? "bg-secondary text-foreground" : "text-muted-foreground")}>
              {t === "manual" ? "Manual" : "AI Suggest"}
            </button>
          ))}
        </div>

        {tab === "manual" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Climate" className="rounded-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {["Newspaper", "Globe", "Cpu", "TrendingUp", "FlaskConical", "Leaf", "Rocket", "Trophy", "HeartPulse"].map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn("grid h-10 w-10 place-items-center border", icon === ic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                  >
                    <CategoryIcon name={ic} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSuggest()} placeholder="Describe what you want to follow…" className="rounded-sm" />
              <Button onClick={runSuggest} disabled={suggesting} className="rounded-sm bg-accent text-accent-foreground hover:opacity-90">
                {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </Button>
            </div>

            {suggested && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 border border-accent/30 bg-accent/5 p-4">
                <div className="flex items-center gap-2 font-mono text-xs text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> agent suggestion
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={suggested.name} onChange={(e) => setSuggested({ ...suggested, name: e.target.value })} className="rounded-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Recommended sources</Label>
                  {suggested.sources.map((s, i) => (
                    <label key={s.url} className="flex cursor-pointer items-center gap-3 border border-border bg-background px-3 py-2">
                      <Checkbox
                        checked={s.checked}
                        onCheckedChange={(v) => {
                          const next = [...suggested.sources];
                          next[i] = { ...s, checked: !!v };
                          setSuggested({ ...suggested, sources: next });
                        }}
                      />
                      <span className="truncate font-mono text-xs">{s.url.replace(/^https?:\/\//, "")}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        <Button onClick={create} disabled={creating || (tab === "ai" && !suggested)} className="w-full rounded-sm bg-primary text-primary-foreground hover:opacity-90">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Create category
        </Button>
      </DialogContent>
    </Dialog>
  );
}
