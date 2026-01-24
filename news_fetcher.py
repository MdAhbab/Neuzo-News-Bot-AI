"""
News Fetcher Agent
Fetches news articles from various sources based on category and time window
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import requests
from newsapi import NewsApiClient
import feedparser
from bs4 import BeautifulSoup


class NewsArticle:
    """Represents a news article"""
    
    def __init__(self, title: str, description: str, url: str, 
                 source: str, published_at: datetime, content: str = ""):
        self.title = title
        self.description = description
        self.url = url
        self.source = source
        self.published_at = published_at
        self.content = content
        self._full_text = None
    
    def fetch_full_content(self) -> Optional[str]:
        """
        Attempt to fetch full article content from URL
        This is a best-effort approach and may not work for all sites
        """
        if self._full_text:
            return self._full_text
            
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(self.url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
                script.decompose()
            
            # Try to find main content - common patterns
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
                    # Get all paragraphs
                    paragraphs = content.find_all('p')
                    content_text = '\n\n'.join(p.get_text().strip() for p in paragraphs if p.get_text().strip())
                    if len(content_text) > 200:  # Only use if substantial content found
                        break
            
            if not content_text:
                # Fallback: get all paragraphs
                paragraphs = soup.find_all('p')
                content_text = '\n\n'.join(p.get_text().strip() for p in paragraphs[:10] if p.get_text().strip())
            
            self._full_text = content_text[:2000] if content_text else None  # Limit to 2000 chars
            return self._full_text
            
        except Exception as e:
            print(f"Failed to fetch full content from {self.url}: {e}")
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


class NewsFetcherAgent:
    """Agent responsible for fetching news from various sources"""
    
    def __init__(self, api_key: Optional[str] = None, max_items: int = 20):
        """
        Initialize the news fetcher agent
        
        Args:
            api_key: NewsAPI key (optional, will check environment variable)
            max_items: Maximum number of news items to fetch
        """
        self.api_key = api_key or os.getenv('NEWS_API_KEY')
        self.max_items = max_items
        self.newsapi_client = None
        
        if self.api_key:
            try:
                self.newsapi_client = NewsApiClient(api_key=self.api_key)
            except Exception as e:
                print(f"Warning: Could not initialize NewsAPI client: {e}")
    
    def fetch_news(self, category: str, hours: int = 1, 
                   language: str = 'en') -> List[NewsArticle]:
        """
        Fetch news articles for a specific category within the time window
        
        Args:
            category: News category (e.g., 'technology', 'business')
            hours: Number of hours to look back
            language: Language code (default: 'en')
            
        Returns:
            List of NewsArticle objects
        """
        articles = []
        
        # Calculate time range
        to_time = datetime.now()
        from_time = to_time - timedelta(hours=hours)
        
        print(f"🔍 Fetching {category} news from the last {hours} hour(s)...")
        
        # Try NewsAPI first
        if self.newsapi_client:
            try:
                articles.extend(self._fetch_from_newsapi(
                    category, from_time, to_time, language
                ))
            except Exception as e:
                print(f"NewsAPI error: {e}")
        
        # Fallback to RSS feeds
        if len(articles) < 5:
            articles.extend(self._fetch_from_rss(category, from_time))
        
        # Sort by publication date (newest first)
        articles.sort(key=lambda x: x.published_at or datetime.min, reverse=True)
        
        # Limit to max_items
        articles = articles[:self.max_items]
        
        print(f"✅ Fetched {len(articles)} articles")
        return articles
    
    def _fetch_from_newsapi(self, category: str, from_time: datetime, 
                           to_time: datetime, language: str) -> List[NewsArticle]:
        """Fetch news from NewsAPI"""
        articles = []
        
        try:
            # Get top headlines - NewsAPI doesn't support time filtering on top headlines
            # So we fetch more and filter ourselves
            response = self.newsapi_client.get_top_headlines(
                category=category,
                language=language,
                page_size=100  # Fetch more to increase chances of recent articles
            )
            
            if response['status'] == 'ok':
                print(f"📡 NewsAPI returned {len(response['articles'])} {category} articles")
                
                for article in response['articles']:
                    # Parse published date
                    pub_date = None
                    if article.get('publishedAt'):
                        try:
                            pub_date = datetime.fromisoformat(
                                article['publishedAt'].replace('Z', '+00:00')
                            )
                            # Convert to naive datetime for comparison
                            pub_date = pub_date.replace(tzinfo=None)
                        except:
                            pub_date = datetime.now()
                    
                    # Don't filter by time - NewsAPI top headlines are already recent
                    # This ensures we always get articles
                    if pub_date:
                        age_hours = (datetime.now() - pub_date).total_seconds() / 3600
                        
                        articles.append(NewsArticle(
                            title=article.get('title', 'No title'),
                            description=article.get('description', ''),
                            url=article.get('url', ''),
                            source=article.get('source', {}).get('name', 'Unknown'),
                            published_at=pub_date,
                            content=article.get('content', '')
                        ))
                        
                        # Print age for debugging
                        if len(articles) <= 5:
                            print(f"  📰 {article.get('title', 'No title')[:50]}... ({age_hours:.1f}h old)")
                            
        except Exception as e:
            print(f"Error fetching from NewsAPI: {e}")
        
        return articles
    
    def _fetch_from_rss(self, category: str, from_time: datetime) -> List[NewsArticle]:
        """Fetch news from RSS feeds (fallback)"""
        articles = []
        
        # RSS feed mappings
        rss_feeds = {
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
            'general': [
                'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
                'https://feeds.bbci.co.uk/news/rss.xml'
            ]
        }
        
        feeds = rss_feeds.get(category, rss_feeds['general'])
        
        for feed_url in feeds:
            try:
                feed = feedparser.parse(feed_url)
                for entry in feed.entries[:10]:
                    # Parse publication date
                    pub_date = datetime.now()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        from time import mktime
                        pub_date = datetime.fromtimestamp(mktime(entry.published_parsed))
                    
                    # Filter by time window
                    if pub_date >= from_time:
                        articles.append(NewsArticle(
                            title=entry.get('title', 'No title'),
                            description=entry.get('summary', ''),
                            url=entry.get('link', ''),
                            source=feed.feed.get('title', 'RSS Feed'),
                            published_at=pub_date,
                            content=entry.get('summary', '')
                        ))
            except Exception as e:
                print(f"Error fetching RSS feed {feed_url}: {e}")
        
        return articles
