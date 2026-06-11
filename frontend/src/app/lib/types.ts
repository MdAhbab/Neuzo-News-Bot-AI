export type JobStatus = "Pending" | "Processing" | "Complete" | "Error";
export type Engine = "auto" | "newsapi" | "crawler";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Source {
  id: string;
  url: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string; // backend icon_name string
  custom?: boolean;
  sources: Source[];
}

export interface Article {
  id: string;
  title: string;
  source: string;
  url: string;
  confidence: number; // 0..1
  crossRefs: number;
  excerpt: string;
  publishedAt: string;
  // Lens
  sentiment: number; // -1..1
  tone: "factual" | "analytical" | "emotive";
}

export interface Job {
  id: string;
  category: string;
  categorySlug: string;
  engine: Engine;
  status: JobStatus;
  createdAt: string;
  articleCount: number;
  verifiedCount: number;
  avgConfidence: number;
  sources: string[];
  articles: Article[];
  agentActions: AgentAction[];
  partial?: string;
  error?: string;
}

export interface AgentAction {
  ts: string;
  tool: string;
  detail: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "source" | "article";
  weight: number; // reliability or size
  confidence?: number;
  articleId?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  strength: number; // 0..1
}

export interface PulseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BriefingStory {
  id: string;
  category: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  confidence: number;
}

export interface Briefing {
  greeting: string;
  date: string;
  stories: BriefingStory[];
  toolTrace: AgentAction[];
}

export interface LensReport {
  balance: number; // -1..1 cluster center
  spread: number; // 0..1
  articles: { id: string; sentiment: number; tone: Article["tone"] }[];
}

export interface CopilotStep {
  tool: "search_archive" | "get_article" | "compare_sources";
  detail: string;
}

export interface CopilotReply {
  steps: CopilotStep[];
  answer: string;
}

export interface SuggestResult {
  name: string;
  icon: string;
  sources: { url: string; recommended: boolean }[];
}
