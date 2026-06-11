import type {
  Briefing,
  Category,
  CopilotReply,
  Coverage,
  Engine,
  Job,
  LensReport,
  PulseGraph,
  SuggestResult,
  User,
} from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const TOKEN_KEY = "neuzo_auth_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  opts: { suppressAuthRedirect?: boolean } = {},
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    const isAuthEndpoint = endpoint === "/auth/login" || endpoint === "/auth/signup";
    if (res.status === 401 && !isAuthEndpoint) {
      // Stale/expired token: always clear it. Only force a redirect for
      // interactive calls — session restore (me) returns null and lets the
      // router decide, so a stale token never hijacks the public landing page.
      localStorage.removeItem(TOKEN_KEY);
      if (!opts.suppressAuthRedirect) {
        window.location.assign("/auth");
      }
      throw new Error("Session expired. Please log in again.");
    }
    let msg = "API request failed";
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(msg);
  }

  return res;
}

/* --- Adapters --- */

function adaptUser(raw: { id: number | string; email: string; full_name?: string }): User {
  return {
    id: String(raw.id),
    email: raw.email,
    name: raw.full_name || raw.email.split("@")[0],
  };
}

function adaptSource(raw: { id: string | number; url?: string; source_url?: string }): { id: string; url: string } {
  return {
    id: String(raw.id),
    url: (raw.url || raw.source_url || ""),
  };
}

function adaptCategory(raw: {
  id?: string | number;
  category_id: string;
  name: string;
  icon_name: string;
  is_custom?: boolean;
  sources?: { id: string | number; url?: string; source_url?: string; name?: string }[];
  defaultSources?: string[];
}): Category {
  let sources: { id: string; url: string }[];
  if (raw.sources && raw.sources.length > 0) {
    sources = raw.sources.map((s) => adaptSource(s));
  } else if (raw.defaultSources && raw.defaultSources.length > 0) {
    sources = raw.defaultSources.map((url) => ({ id: url, url }));
  } else {
    sources = [];
  }
  return {
    id: raw.category_id,
    name: raw.name,
    slug: raw.category_id,
    icon: raw.icon_name,
    custom: !!raw.is_custom,
    sources,
  };
}

const STEP_ORDER = ["fetch_articles", "gemma_curate", "semantic_verify", "compose_report"];

function deriveAgentActions(step: string): { ts: string; tool: string; detail: string }[] {
  const s = (step || "").toLowerCase();
  let count = 0;
  if (/querying|receiving|fetching|crawling/i.test(s)) count = 2;
  else if (/verifying|detecting|cross/i.test(s)) count = 3;
  else if (/synth|generating|composing|drafting/i.test(s)) count = 4;
  else if (/curating|filtering|dedup/i.test(s)) count = 2;
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return STEP_ORDER.slice(0, count).map((tool) => ({ ts: now, tool, detail: "" }));
}

function adaptJob(raw: Record<string, unknown>): Job {
  const status = (raw.status as string) || "Processing";

  let agentActions: { ts: string; tool: string; detail: string }[] = [];
  if (Array.isArray(raw.agentActions) && raw.agentActions.length > 0) {
    agentActions = (raw.agentActions as string[]).map((s) => ({ ts: "", tool: String(s), detail: "" }));
  } else if (status === "Complete") {
    agentActions = STEP_ORDER.map((tool) => ({ ts: "", tool, detail: "" }));
  } else if (raw.step) {
    agentActions = deriveAgentActions(raw.step as string);
  }

  let articles: Job["articles"] = [];
  if (Array.isArray(raw.articles)) {
    articles = (raw.articles as Record<string, unknown>[]).map((a) => ({
      id: String(a.id ?? ""),
      title: String(a.title ?? ""),
      source: String(a.source ?? ""),
      url: String(a.url ?? ""),
      confidence: typeof a.confidence === "number" ? a.confidence : 0,
      crossRefs: typeof a.crossRefs === "number" ? a.crossRefs : 0,
      excerpt: String(a.excerpt ?? ""),
      publishedAt: String(a.publishedAt ?? ""),
      sentiment: typeof a.sentiment === "number" ? a.sentiment : 0,
      tone: (a.tone as "factual" | "analytical" | "emotive") ?? "factual",
    }));
  }

  const sources: string[] = Array.isArray(raw.usedSources)
    ? (raw.usedSources as string[])
    : Array.isArray(raw.sources)
      ? (raw.sources as string[])
      : [];

  return {
    id: String(raw.jobId ?? raw.job_id ?? raw.id ?? ""),
    category: String(raw.category ?? raw.category_name ?? ""),
    categorySlug: String(raw.categorySlug ?? raw.category_id ?? raw.category ?? ""),
    engine: (raw.engine as Engine) ?? "auto",
    status: status as Job["status"],
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    articleCount: typeof raw.articlesCount === "number" ? raw.articlesCount : typeof raw.articles_count === "number" ? raw.articles_count : articles.length,
    verifiedCount: typeof raw.verifiedCount === "number" ? raw.verifiedCount : typeof raw.verified_count === "number" ? raw.verified_count : 0,
    avgConfidence: typeof raw.avgConfidence === "number" ? raw.avgConfidence : typeof raw.avg_confidence === "number" ? raw.avg_confidence : 0,
    sources,
    articles,
    agentActions,
    partial: typeof raw.partial === "string" ? raw.partial : "",
    error: typeof raw.message === "string" && status === "Error" ? raw.message : undefined,
  };
}

/* ---------------- Auth ---------------- */

export async function login(email: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  return adaptUser(data.user);
}

export async function signup(email: string, password: string): Promise<User> {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  return adaptUser(data.user);
}

export async function me(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await apiFetch("/auth/me", {}, { suppressAuthRedirect: true });
    const data = await res.json();
    return adaptUser(data);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/* ---------------- Categories & sources ---------------- */

export async function getCategories(): Promise<Category[]> {
  const res = await apiFetch("/categories");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(adaptCategory);
}

export async function createCategory(name: string, icon: string, sources: string[]): Promise<Category> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "category";
  await apiFetch("/categories", {
    method: "POST",
    body: JSON.stringify({ category_id: slug, name, icon_name: icon }),
  });
  for (const url of sources) {
    try {
      await apiFetch(`/sources/${slug}`, {
        method: "POST",
        body: JSON.stringify({ source_url: url, source_type: "web", reliability_score: 0.8 }),
      });
    } catch {
      // ignore per-source failures
    }
  }
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug) ?? {
    id: slug,
    name,
    slug,
    icon,
    custom: true,
    sources: sources.map((url) => ({ id: url, url })),
  };
}

export async function addSource(categoryId: string, url: string): Promise<Category> {
  await apiFetch(`/sources/${categoryId}`, {
    method: "POST",
    body: JSON.stringify({ source_url: url, source_type: "web", reliability_score: 0.8 }),
  });
  const cats = await getCategories();
  return cats.find((c) => c.id === categoryId || c.slug === categoryId) ?? { id: categoryId, name: categoryId, slug: categoryId, icon: "Newspaper", sources: [] };
}

export async function removeSource(categoryId: string, sourceId: string): Promise<Category> {
  await apiFetch(`/sources/by-id/${sourceId}`, { method: "DELETE" });
  const cats = await getCategories();
  return cats.find((c) => c.id === categoryId || c.slug === categoryId) ?? { id: categoryId, name: categoryId, slug: categoryId, icon: "Newspaper", sources: [] };
}

export async function suggest(prompt: string): Promise<SuggestResult> {
  const res = await apiFetch("/categories/suggest", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  return {
    name: data.name,
    icon: data.icon_name,
    sources: (data.recommended_sources || []).map((s: { url: string; name?: string }) => ({
      url: s.url,
      recommended: true,
    })),
  };
}

/* ---------------- Jobs ---------------- */

export async function startJob(category: Category, sources: string[], engine: Engine): Promise<Job> {
  const res = await apiFetch("/jobs/start", {
    method: "POST",
    body: JSON.stringify({ category: category.slug, sources, engine }),
  });
  const data = await res.json();
  return {
    id: String(data.jobId),
    category: category.name,
    categorySlug: category.slug,
    engine,
    status: "Processing",
    createdAt: new Date().toISOString(),
    articleCount: 0,
    verifiedCount: 0,
    avgConfidence: 0,
    sources,
    articles: [],
    agentActions: [],
    partial: "",
  };
}

export async function getJobStatus(id: string): Promise<Job> {
  const res = await apiFetch(`/jobs/${id}/status`);
  const data = await res.json();
  return adaptJob(data as Record<string, unknown>);
}

export async function getJob(id: string): Promise<Job> {
  return getJobStatus(id);
}

export async function getHistory(): Promise<Job[]> {
  const res = await apiFetch("/jobs/history");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.job_id ?? row.id ?? ""),
    category: String(row.category_name ?? row.category ?? ""),
    categorySlug: String(row.category_id ?? row.categorySlug ?? row.category ?? ""),
    engine: (row.engine as Engine) ?? "auto",
    status: (row.status as Job["status"]) ?? "Complete",
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    articleCount: typeof row.articles_count === "number" ? row.articles_count : 0,
    verifiedCount: typeof row.verified_count === "number" ? row.verified_count : 0,
    avgConfidence: 0,
    sources: [],
    articles: [],
    agentActions: [],
  }));
}

/** Authenticated blob download with Content-Disposition filename parsing. */
async function blobDownload(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired. Please log in again.");
    throw new Error(`Download failed with status ${res.status}`);
  }

  let filename = fallbackName;
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
    }
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadReport(job: Job): Promise<void> {
  await blobDownload(`/jobs/${job.id}/download`, `neuzo-${job.categorySlug}-${job.id}.docx`);
}

export async function exportReport(jobId: string, fmt: "md" | "json"): Promise<void> {
  await blobDownload(`/jobs/${jobId}/export/${fmt}`, `neuzo-report.${fmt}`);
}

/* ---------------- Agentic feature endpoints ---------------- */

export async function getGraph(id: string): Promise<PulseGraph> {
  const res = await apiFetch(`/jobs/${id}/graph`);
  return res.json();
}

export async function getLens(id: string): Promise<LensReport> {
  const res = await apiFetch(`/jobs/${id}/lens`);
  return res.json();
}

export async function getBriefing(): Promise<Briefing> {
  const res = await apiFetch("/briefing");
  return res.json();
}

export async function copilot(id: string, message: string): Promise<CopilotReply> {
  const res = await apiFetch(`/jobs/${id}/copilot`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function getCoverage(): Promise<Coverage> {
  const res = await apiFetch("/analytics/coverage");
  return res.json();
}

export async function health(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return { ok: data.status === "healthy" };
  } catch {
    return { ok: false };
  }
}
