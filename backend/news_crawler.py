"""
Local Agentic News Crawler

A self-hosted alternative to NewsAPI. Given a category and the user's selected
source URLs, the crawler:

  1. Discovers RSS/Atom feeds on each source domain (via <link rel="alternate">
     tags and common feed paths), caching discoveries per process.
  2. Fetches and parses feeds concurrently with strict timeouts.
  3. Optionally asks a local Ollama model (default: gemma4:e4b) to act as an
     editorial agent: filter articles for category relevance and write a clean
     two-sentence summary for each kept article.

Everything degrades gracefully: if Ollama is offline the raw articles are
returned unfiltered; if a source has no feed it is skipped with a log entry.
The Ollama model is used here and nowhere else in the application.
"""

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests

from news_fetcher import NewsArticle, parse_rss_feed, REQUEST_HEADERS, RSS_FEEDS

logger = logging.getLogger(__name__)

# Common feed locations tried when a page doesn't advertise its feed
COMMON_FEED_PATHS = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/feeds/posts/default"]

# Process-wide cache of discovered feeds: {domain: [feed_url, ...]}
_feed_cache: Dict[str, List[str]] = {}

_FEED_LINK_RE = re.compile(
    r'<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]*>', re.IGNORECASE
)
_HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)


class OllamaClient:
    """Minimal client for a locally hosted Ollama server"""

    def __init__(self, host: str = "http://localhost:11434",
                 model: str = "gemma4:e4b", timeout: int = 60):
        self.host = host.rstrip("/")
        self.model = model
        self.timeout = timeout

    def is_available(self) -> bool:
        """Check that the server responds and the model is present"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=3)
            response.raise_for_status()
            models = [m.get("name", "") for m in response.json().get("models", [])]
            if any(m == self.model or m.startswith(self.model.split(":")[0]) for m in models):
                return True
            logger.warning("Ollama is running but model %s is not installed", self.model)
            return False
        except requests.RequestException as e:
            logger.info("Ollama not reachable (%s); crawler will skip AI filtering", e)
            return False

    def generate(self, prompt: str, json_mode: bool = False) -> Optional[str]:
        """Run a single non-streaming generation"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 512},
        }
        if json_mode:
            payload["format"] = "json"
        try:
            response = requests.post(
                f"{self.host}/api/generate", json=payload, timeout=self.timeout
            )
            response.raise_for_status()
            return response.json().get("response", "")
        except requests.RequestException as e:
            logger.warning("Ollama generation failed: %s", e)
            return None


class LocalNewsCrawler:
    """Agentic, on-device news crawler with optional Ollama curation"""

    def __init__(self, ollama_host: str = "http://localhost:11434",
                 ollama_model: str = "gemma4:e4b", ollama_enabled: bool = True,
                 ollama_timeout: int = 60, max_items: int = 20,
                 max_workers: int = 4):
        self.max_items = max_items
        self.max_workers = max_workers
        self.ollama: Optional[OllamaClient] = None
        if ollama_enabled:
            client = OllamaClient(ollama_host, ollama_model, ollama_timeout)
            if client.is_available():
                self.ollama = client

    # ---------- Feed discovery ----------

    def discover_feeds(self, source_url: str) -> List[str]:
        """Find RSS/Atom feed URLs for a source website (cached per domain)"""
        parsed = urlparse(source_url if "//" in source_url else f"https://{source_url}")
        domain = parsed.netloc
        if not domain:
            return []
        if domain in _feed_cache:
            return _feed_cache[domain]

        base = f"{parsed.scheme or 'https'}://{domain}"
        feeds: List[str] = []

        # 1. Look for advertised feeds on the page itself
        try:
            response = requests.get(source_url, headers=REQUEST_HEADERS, timeout=8)
            if response.ok:
                for link_tag in _FEED_LINK_RE.findall(response.text):
                    href = _HREF_RE.search(link_tag)
                    if href:
                        feeds.append(urljoin(source_url, href.group(1)))
        except requests.RequestException as e:
            logger.debug("Feed discovery request failed for %s: %s", source_url, e)

        # 2. Probe common feed paths if nothing was advertised
        if not feeds:
            for path in COMMON_FEED_PATHS:
                candidate = base + path
                try:
                    with requests.get(candidate, headers=REQUEST_HEADERS,
                                      timeout=5, stream=True) as head:
                        content_type = head.headers.get("Content-Type", "")
                        if head.ok and ("xml" in content_type or "rss" in content_type):
                            feeds.append(candidate)
                            break
                except requests.RequestException:
                    continue

        feeds = list(dict.fromkeys(feeds))[:3]  # dedupe, keep at most 3 per domain
        _feed_cache[domain] = feeds
        if feeds:
            logger.info("Discovered %d feed(s) for %s", len(feeds), domain)
        else:
            logger.info("No feeds found for %s", domain)
        return feeds

    # ---------- Fetching ----------

    def fetch_news(self, category: str, sources: Optional[List[str]] = None,
                   hours: int = 24) -> List[NewsArticle]:
        """
        Crawl the given sources (or category fallback feeds) and return articles.

        Args:
            category: News category name (used for AI relevance filtering)
            sources: User-selected source URLs; falls back to curated feeds
            hours: Preferred recency window (soft constraint)
        """
        from_time = datetime.now() - timedelta(hours=hours)

        feed_urls: List[str] = []
        if sources:
            with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
                futures = {pool.submit(self.discover_feeds, src): src for src in sources}
                for future in as_completed(futures):
                    feed_urls.extend(future.result())

        if not feed_urls:
            # Use curated category feeds when discovery yields nothing
            key = category.lower()
            feed_urls = RSS_FEEDS.get(key, RSS_FEEDS["general"])
            logger.info("Using curated fallback feeds for category %s", category)

        articles = self._fetch_feeds(feed_urls, from_time, max_entries=15)

        # Relax the time window if it filtered everything out
        if not articles:
            articles = self._fetch_feeds(feed_urls, from_time=None, max_entries=10)

        articles = self._dedupe(articles)
        articles.sort(key=lambda a: a.published_at or datetime.min, reverse=True)
        articles = articles[: self.max_items * 2]  # keep headroom for AI filtering

        if self.ollama and articles:
            articles = self._curate_with_ollama(category, articles)

        articles = articles[: self.max_items]
        logger.info("Crawler returning %d articles for %s", len(articles), category)
        return articles

    def _fetch_feeds(self, feed_urls: List[str], from_time: Optional[datetime],
                     max_entries: int) -> List[NewsArticle]:
        """Fetch and parse a set of feeds concurrently"""
        articles: List[NewsArticle] = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            futures = [pool.submit(parse_rss_feed, url, from_time, max_entries)
                       for url in feed_urls]
            for future in as_completed(futures):
                articles.extend(future.result())
        return articles

    @staticmethod
    def _dedupe(articles: List[NewsArticle]) -> List[NewsArticle]:
        """Remove duplicates by URL and normalized title"""
        seen = set()
        unique: List[NewsArticle] = []
        for article in articles:
            key = article.url or article.title.strip().lower()
            if key and key not in seen:
                seen.add(key)
                unique.append(article)
        return unique

    # ---------- Ollama curation ----------

    def _curate_with_ollama(self, category: str,
                            articles: List[NewsArticle]) -> List[NewsArticle]:
        """
        Ask the local model to keep only category-relevant articles and write
        a clean summary for each. Falls back to the raw list on any failure.
        """
        logger.info("Curating %d articles with local model...", len(articles))

        # Batch in small groups to keep each prompt within a 4B model's depth
        batch_size = 6
        curated: List[NewsArticle] = []

        for start in range(0, len(articles), batch_size):
            batch = articles[start:start + batch_size]
            listing = "\n".join(
                f'{i}. TITLE: {a.title}\n   EXCERPT: {(a.description or a.content or "")[:300]}'
                for i, a in enumerate(batch)
            )
            prompt = (
                "You are a news editor. For each numbered article below, decide if it is "
                f'relevant to the "{category}" news category and write a factual summary '
                "of at most 2 sentences based only on the given text.\n\n"
                f"{listing}\n\n"
                'Respond with JSON only, shaped as {"articles": [{"index": <number>, '
                '"relevant": <true|false>, "summary": "<summary>"}]} with one entry per article.'
            )

            raw = self.ollama.generate(prompt, json_mode=True)
            decisions = self._parse_decisions(raw, len(batch))

            if decisions is None:
                # Model unavailable/unparseable mid-run: keep batch as-is
                curated.extend(batch)
                continue

            for i, article in enumerate(batch):
                decision = decisions.get(i)
                if decision is None:
                    curated.append(article)
                    continue
                if not decision.get("relevant", True):
                    continue
                summary = (decision.get("summary") or "").strip()
                if len(summary) > 40:
                    article.description = summary
                curated.append(article)

        kept = len(curated)
        logger.info("Local model kept %d/%d articles", kept, len(articles))
        # Safety net: if the model rejected nearly everything, distrust it
        if kept < max(3, len(articles) // 4):
            logger.warning("Model filtered too aggressively; using uncurated list")
            return articles
        return curated

    @staticmethod
    def _parse_decisions(raw: Optional[str], batch_len: int) -> Optional[Dict[int, Dict]]:
        """Parse the model's JSON response into {index: decision}"""
        if not raw:
            return None
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Some models wrap JSON in code fences despite instructions
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                return None
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                return None

        entries = data.get("articles", data if isinstance(data, list) else [])
        if not isinstance(entries, list):
            return None

        decisions: Dict[int, Dict] = {}
        for entry in entries:
            if isinstance(entry, dict) and isinstance(entry.get("index"), int):
                if 0 <= entry["index"] < batch_len:
                    decisions[entry["index"]] = entry
        return decisions or None
