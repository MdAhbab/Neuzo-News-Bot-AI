"""
News Fetcher Agent
Fetches news articles from NewsAPI with an RSS fallback.
"""

import logging
import os
from datetime import datetime, timedelta
from time import mktime
from typing import Dict, List, Optional

import feedparser
import requests

logger = logging.getLogger(__name__)

REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


class NewsAPIQuotaError(Exception):
    """Raised when NewsAPI rejects requests due to rate/quota limits"""


class NewsArticle:
    """Represents a news article"""

    def __init__(self, title: str, description: str, url: str,
                 source: str, published_at: Optional[datetime], content: str = ""):
        self.title = title
        self.description = description
        self.url = url
        self.source = source
        self.published_at = published_at
        self.content = content
        self._full_text: Optional[str] = None

    def fetch_full_content(self) -> Optional[str]:
        """
        Attempt to fetch full article content from URL.
        Best-effort; returns None when the site can't be parsed.
        """
        if self._full_text:
            return self._full_text

        try:
            from bs4 import BeautifulSoup

            response = requests.get(self.url, headers=REQUEST_HEADERS, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                element.decompose()

            content_selectors = [
                'article',
                '[class*="article-content"]',
                '[class*="post-content"]',
                '[class*="entry-content"]',
                '[class*="story-body"]',
                'main',
            ]

            content_text = ""
            for selector in content_selectors:
                content = soup.select_one(selector)
                if content:
                    paragraphs = content.find_all('p')
                    content_text = '\n\n'.join(
                        p.get_text().strip() for p in paragraphs if p.get_text().strip()
                    )
                    if len(content_text) > 200:  # Only use if substantial content found
                        break

            if not content_text:
                paragraphs = soup.find_all('p')
                content_text = '\n\n'.join(
                    p.get_text().strip() for p in paragraphs[:10] if p.get_text().strip()
                )

            self._full_text = content_text[:2000] if content_text else None
            return self._full_text

        except Exception as e:
            logger.debug(f"Failed to fetch full content from {self.url}: {e}")
            return None

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'title': self.title,
            'description': self.description,
            'url': self.url,
            'source': self.source,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'content': self.content
        }

    def __repr__(self):
        return f"NewsArticle(title='{self.title[:50]}...', source='{self.source}')"


# RSS fallback feeds per category
RSS_FEEDS: Dict[str, List[str]] = {
    'technology': [
        'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        'https://feeds.bbci.co.uk/news/technology/rss.xml'
    ],
    'business': [
        'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
        'https://feeds.bbci.co.uk/news/business/rss.xml'
    ],
    'science': [
        'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
        'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'
    ],
    'health': [
        'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
        'https://feeds.bbci.co.uk/news/health/rss.xml'
    ],
    'sports': [
        'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
        'https://feeds.bbci.co.uk/sport/rss.xml'
    ],
    'general': [
        'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
        'https://feeds.bbci.co.uk/news/rss.xml'
    ]
}


def parse_rss_feed(feed_url: str, from_time: Optional[datetime] = None,
                   max_entries: int = 10) -> List[NewsArticle]:
    """Parse a single RSS feed into NewsArticle objects (shared with the crawler)"""
    articles: List[NewsArticle] = []
    try:
        feed = feedparser.parse(feed_url)
        source_name = feed.feed.get('title', 'RSS Feed') if feed.feed else 'RSS Feed'

        for entry in feed.entries[:max_entries]:
            pub_date = None
            parsed_time = entry.get('published_parsed') or entry.get('updated_parsed')
            if parsed_time:
                try:
                    pub_date = datetime.fromtimestamp(mktime(parsed_time))
                except (ValueError, OverflowError):
                    pub_date = None

            # Only filter by time when we know the publish date
            if from_time and pub_date and pub_date < from_time:
                continue

            articles.append(NewsArticle(
                title=entry.get('title', 'No title'),
                description=entry.get('summary', ''),
                url=entry.get('link', ''),
                source=source_name,
                published_at=pub_date,
                content=entry.get('summary', '')
            ))
    except Exception as e:
        logger.warning(f"Error fetching RSS feed {feed_url}: {e}")

    return articles


class NewsFetcherAgent:
    """Agent responsible for fetching news from NewsAPI with RSS fallback"""

    def __init__(self, api_key: Optional[str] = None, max_items: int = 20):
        """
        Initialize the news fetcher agent

        Args:
            api_key: NewsAPI key (optional, falls back to NEWS_API_KEY env var)
            max_items: Maximum number of news items to fetch
        """
        self.api_key = api_key or os.getenv('NEWS_API_KEY') or os.getenv('NEWSAPI_KEY')
        self.max_items = max_items
        self.newsapi_client = None

        if self.api_key:
            try:
                from newsapi import NewsApiClient
                self.newsapi_client = NewsApiClient(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize NewsAPI client: {e}")

    def fetch_news(self, category: str, hours: int = 1,
                   language: str = 'en') -> List[NewsArticle]:
        """
        Fetch news articles for a specific category within the time window

        Args:
            category: News category (e.g., 'technology', 'business')
            hours: Number of hours to look back (soft preference; top headlines
                   are returned even when slightly older so reports are never empty)
            language: Language code (default: 'en')

        Returns:
            List of NewsArticle objects
        """
        articles: List[NewsArticle] = []
        from_time = datetime.now() - timedelta(hours=hours)

        logger.info(f"Fetching {category} news from the last {hours} hour(s)...")

        if self.newsapi_client:
            try:
                articles.extend(self._fetch_from_newsapi(category, language))
            except NewsAPIQuotaError:
                raise
            except Exception as e:
                logger.error(f"NewsAPI error: {e}")

        # Fallback to RSS feeds when NewsAPI yields too little
        if len(articles) < 5:
            articles.extend(self._fetch_from_rss(category, from_time))

        # Sort by publication date (newest first) and limit
        articles.sort(key=lambda x: x.published_at or datetime.min, reverse=True)
        articles = articles[:self.max_items]

        logger.info(f"Fetched {len(articles)} articles for {category}")
        return articles

    def _fetch_from_newsapi(self, category: str, language: str) -> List[NewsArticle]:
        """Fetch news from NewsAPI top headlines"""
        articles: List[NewsArticle] = []

        try:
            # NewsAPI doesn't support time filtering on top headlines, so we
            # fetch a single large page and sort/limit locally (1 request).
            response = self.newsapi_client.get_top_headlines(
                category=category,
                language=language,
                page_size=100
            )
        except Exception as e:
            message = str(e).lower()
            if 'rate' in message or 'limit' in message or 'maximum' in message:
                raise NewsAPIQuotaError(str(e)) from e
            raise

        if response.get('status') != 'ok':
            code = str(response.get('code', ''))
            if code in ('rateLimited', 'maximumResultsReached'):
                raise NewsAPIQuotaError(response.get('message', code))
            logger.error(f"NewsAPI returned error: {response}")
            return articles

        logger.info(f"NewsAPI returned {len(response['articles'])} {category} articles")

        for article in response['articles']:
            pub_date = None
            if article.get('publishedAt'):
                try:
                    pub_date = datetime.fromisoformat(
                        article['publishedAt'].replace('Z', '+00:00')
                    ).replace(tzinfo=None)
                except ValueError:
                    pub_date = None

            if not article.get('title') or article.get('title') == '[Removed]':
                continue

            articles.append(NewsArticle(
                title=article.get('title', 'No title'),
                description=article.get('description') or '',
                url=article.get('url', ''),
                source=(article.get('source') or {}).get('name', 'Unknown'),
                published_at=pub_date,
                content=article.get('content') or ''
            ))

        return articles

    def _fetch_from_rss(self, category: str, from_time: datetime) -> List[NewsArticle]:
        """Fetch news from RSS feeds (fallback)"""
        articles: List[NewsArticle] = []
        feeds = RSS_FEEDS.get(category, RSS_FEEDS['general'])

        for feed_url in feeds:
            articles.extend(parse_rss_feed(feed_url, from_time))

        # If the strict time window produced nothing, relax it so the
        # pipeline still has material to verify.
        if not articles:
            logger.info("No RSS articles in time window; relaxing to feed defaults")
            for feed_url in feeds:
                articles.extend(parse_rss_feed(feed_url, from_time=None))

        return articles
