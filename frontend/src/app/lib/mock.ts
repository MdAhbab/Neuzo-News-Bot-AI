import type {
  Article,
  Briefing,
  Category,
  CopilotReply,
  Job,
  LensReport,
  PulseGraph,
  SuggestResult,
} from "./types";

/* Deterministic pseudo-random so fixtures stay stable across renders. */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "c-world",
    name: "World",
    slug: "world",
    icon: "Globe",
    sources: [
      { id: "s1", url: "https://www.reuters.com/world" },
      { id: "s2", url: "https://apnews.com/hub/world-news" },
    ],
  },
  {
    id: "c-tech",
    name: "Technology",
    slug: "technology",
    icon: "Cpu",
    sources: [
      { id: "s3", url: "https://arstechnica.com" },
      { id: "s4", url: "https://www.theverge.com" },
    ],
  },
  {
    id: "c-markets",
    name: "Markets",
    slug: "markets",
    icon: "TrendingUp",
    sources: [{ id: "s5", url: "https://www.ft.com/markets" }],
  },
  {
    id: "c-science",
    name: "Science",
    slug: "science",
    icon: "FlaskConical",
    sources: [{ id: "s6", url: "https://www.nature.com/news" }],
  },
];

const HEADLINES: Record<string, string[]> = {
  world: [
    "Coalition brokers fragile ceasefire after week of talks",
    "Election observers report record turnout in regional vote",
    "Aid corridor reopens as flooding recedes in delta region",
    "Summit ends with pledge on cross-border data accords",
    "Port strike enters fourth day, supply routes rerouted",
    "Heritage city granted protected status by council",
  ],
  technology: [
    "On-device models close gap with cloud assistants",
    "Open-source RSS crawler gains semantic dedupe layer",
    "Chipmaker unveils low-power inference accelerator",
    "Browser vendors align on local-first sync standard",
    "Researchers publish MiniLM benchmark for newsroom NLP",
    "Privacy regulator clears federated learning pilot",
  ],
  markets: [
    "Bond yields steady as inflation print lands in line",
    "Energy majors lead index on demand revisions",
    "Currency basket firms ahead of central bank decision",
    "Small caps outperform on rate-cut expectations",
    "Commodities mixed as freight costs normalize",
    "Earnings beat lifts industrials, tempers caution",
  ],
  science: [
    "Lab demonstrates room-stable catalyst for clean fuel",
    "Telescope survey maps faint dwarf galaxies",
    "Trial shows promise for targeted gene therapy",
    "Climate model refines regional rainfall forecasts",
    "Materials team prints self-healing polymer lattice",
    "Microbiome study links diet to recovery markers",
  ],
};

const SOURCE_NAMES = [
  "Reuters",
  "AP",
  "Financial Times",
  "Ars Technica",
  "The Verge",
  "Nature",
  "Bloomberg",
  "Guardian",
];

const TONES: Article["tone"][] = ["factual", "analytical", "emotive"];

export function buildArticles(slug: string, count: number, seed: number): Article[] {
  const rand = rng(seed + hash(slug));
  const pool = HEADLINES[slug] ?? HEADLINES.world;
  return Array.from({ length: count }).map((_, i) => {
    const confidence = Math.round((0.42 + rand() * 0.55) * 100) / 100;
    const sentiment = Math.round((rand() * 2 - 1) * 100) / 100;
    return {
      id: `${slug}-a${i}`,
      title: pool[i % pool.length],
      source: SOURCE_NAMES[Math.floor(rand() * SOURCE_NAMES.length)],
      url: `https://example.com/${slug}/${i}`,
      confidence: Math.min(0.98, confidence),
      crossRefs: 1 + Math.floor(rand() * 5),
      excerpt:
        "Cross-verified across multiple outlets using semantic similarity; corroborating passages aligned on the core claim while diverging on attribution detail.",
      publishedAt: new Date(Date.now() - i * 3.6e6).toISOString(),
      sentiment,
      tone: TONES[Math.floor(rand() * TONES.length)],
    };
  });
}

export function buildReportProse(category: string, articles: Article[]): string {
  const lines = [
    `# ${category} — Verified Brief`,
    ``,
    `A cross-source synthesis assembled by the Neuzo agent. ${articles.length} candidate stories were fetched, deduplicated, and scored for corroboration using all-MiniLM-L6-v2 semantic similarity.`,
    ``,
    ...articles.slice(0, 4).map(
      (a) =>
        `## ${a.title}\n${a.source} · confidence ${Math.round(
          a.confidence * 100,
        )}% · ${a.crossRefs} corroborating sources\n\n${a.excerpt}`,
    ),
  ];
  return lines.join("\n");
}

/* ---- Agentic feature fixtures ---- */

export function buildGraph(job: Job): PulseGraph {
  const nodes: PulseGraph["nodes"] = [];
  const edges: PulseGraph["edges"] = [];
  const rand = rng(hash(job.id));
  const sources = Array.from(new Set(job.articles.map((a) => a.source)));
  sources.forEach((s, i) =>
    nodes.push({
      id: `src-${i}`,
      label: s,
      type: "source",
      weight: 0.5 + rand() * 0.5,
    }),
  );
  job.articles.forEach((a, i) => {
    nodes.push({
      id: `art-${i}`,
      label: a.title,
      type: "article",
      weight: 0.4 + a.confidence * 0.6,
      confidence: a.confidence,
      articleId: a.id,
    });
    const srcIdx = sources.indexOf(a.source);
    if (srcIdx >= 0)
      edges.push({ from: `src-${srcIdx}`, to: `art-${i}`, strength: 0.6 + rand() * 0.4 });
    // cross-corroboration links between articles
    if (i > 0 && rand() > 0.45)
      edges.push({
        from: `art-${i}`,
        to: `art-${Math.floor(rand() * i)}`,
        strength: 0.3 + rand() * 0.6,
      });
  });
  return { nodes, edges };
}

export function buildLens(job: Job): LensReport {
  const sentiments = job.articles.map((a) => a.sentiment);
  const balance =
    sentiments.reduce((s, v) => s + v, 0) / (sentiments.length || 1);
  const spread =
    Math.sqrt(
      sentiments.reduce((s, v) => s + (v - balance) ** 2, 0) /
        (sentiments.length || 1),
    ) || 0;
  return {
    balance: Math.round(balance * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    articles: job.articles.map((a) => ({
      id: a.id,
      sentiment: a.sentiment,
      tone: a.tone,
    })),
  };
}

export function buildBriefing(categories: Category[]): Briefing {
  const rand = rng(hash(new Date().toDateString()));
  const stories = categories.slice(0, 4).flatMap((c, ci) => {
    const arts = buildArticles(c.slug, 2, ci + 1);
    return arts.map((a) => ({
      id: `${c.slug}-brief-${a.id}`,
      category: c.name,
      headline: a.title,
      summary:
        "The agent merged corroborating reports into a two-sentence digest, preserving only claims confirmed by at least two independent sources.",
      whyItMatters:
        "Signals a shift watchers in this category have flagged as a leading indicator for the week ahead.",
      confidence: a.confidence,
    }));
  });
  return {
    greeting: greeting(),
    date: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    stories: stories.slice(0, 6),
    toolTrace: [
      { ts: t(), tool: "list_categories", detail: "Loaded 4 subscribed categories" },
      { ts: t(), tool: "fetch_recent", detail: "Pulled 38 candidate articles (24h)" },
      { ts: t(), tool: "semantic_cluster", detail: "Clustered into 11 stories" },
      { ts: t(), tool: "rank_confidence", detail: "Selected top 6 by corroboration" },
      { ts: t(), tool: "compose_digest", detail: "gemma4:e4b drafted summaries" },
    ],
  };
}

const COPILOT_BANK: { q: RegExp; reply: CopilotReply }[] = [
  {
    q: /weak|corroborat|reliab/i,
    reply: {
      steps: [
        { tool: "search_archive", detail: "query: corroboration < 0.55" },
        { tool: "compare_sources", detail: "ranked 3 stories by source overlap" },
      ],
      answer:
        "The weakest corroboration is the markets piece on currency basket movement — only a single source confirmed the central-bank timing, so its confidence sits at 0.51. I'd treat the timing detail as provisional.",
    },
  },
  {
    q: /summary|tldr|overview|about/i,
    reply: {
      steps: [
        { tool: "get_article", detail: "loaded top 4 by confidence" },
        { tool: "compare_sources", detail: "aligned shared claims" },
      ],
      answer:
        "Across this report the strongest, best-corroborated thread is the on-device model story (0.91, 4 sources). Most pieces lean factual in tone; one runs emotive and is worth reading critically.",
    },
  },
];

export function answerCopilot(question: string): CopilotReply {
  const hit = COPILOT_BANK.find((c) => c.q.test(question));
  if (hit) return hit.reply;
  return {
    steps: [
      { tool: "search_archive", detail: `query: ${question.slice(0, 40)}` },
      { tool: "get_article", detail: "retrieved 2 relevant passages" },
    ],
    answer:
      "Based on the verified passages in this report, the corroborated answer leans toward the higher-confidence sources. Ask about a specific story for a sharper breakdown.",
  };
}

export const SUGGEST_BANK: Record<string, SuggestResult> = {
  default: {
    name: "Climate",
    icon: "Leaf",
    sources: [
      { url: "https://www.carbonbrief.org", recommended: true },
      { url: "https://insideclimatenews.org", recommended: true },
      { url: "https://www.nature.com/subjects/climate-change", recommended: false },
    ],
  },
};

export function suggestCategory(prompt: string): SuggestResult {
  const p = prompt.toLowerCase();
  if (/sport|football|nba/.test(p))
    return {
      name: "Sports",
      icon: "Trophy",
      sources: [
        { url: "https://www.espn.com", recommended: true },
        { url: "https://www.theathletic.com", recommended: true },
        { url: "https://www.bbc.com/sport", recommended: false },
      ],
    };
  if (/health|medic|wellness/.test(p))
    return {
      name: "Health",
      icon: "HeartPulse",
      sources: [
        { url: "https://www.statnews.com", recommended: true },
        { url: "https://www.nih.gov/news-events", recommended: true },
        { url: "https://www.who.int/news", recommended: false },
      ],
    };
  if (/space|astro|cosmo/.test(p))
    return {
      name: "Space",
      icon: "Rocket",
      sources: [
        { url: "https://www.nasa.gov/news", recommended: true },
        { url: "https://spacenews.com", recommended: true },
        { url: "https://www.esa.int", recommended: false },
      ],
    };
  return {
    ...SUGGEST_BANK.default,
    name: prompt.trim() ? prompt.trim().replace(/\b\w/g, (m) => m.toUpperCase()) : "Climate",
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function t() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
