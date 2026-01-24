"""
News Verification Agent
Verifies news articles using NLP and cross-referencing
"""

from typing import List, Dict, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Module-level model cache for singleton pattern
_model_cache: Dict[str, SentenceTransformer] = {}


def get_cached_model(model_name: str) -> SentenceTransformer:
    """Get or load a cached model (singleton pattern)"""
    global _model_cache
    if model_name not in _model_cache:
        logger.info(f"Loading NLP model: {model_name}...")
        print(f"🤖 Loading NLP model: {model_name}...")
        _model_cache[model_name] = SentenceTransformer(model_name)
        logger.info(f"Model {model_name} loaded and cached")
        print("✅ NLP model loaded successfully")
    else:
        logger.debug(f"Using cached model: {model_name}")
    return _model_cache[model_name]


class VerificationResult:
    """Result of news verification"""
    
    def __init__(self, article, verified: bool, confidence: float, 
                 similar_sources: List[Dict] = None):
        self.article = article
        self.verified = verified
        self.confidence = confidence
        self.similar_sources = similar_sources or []
        
    def __repr__(self):
        return f"VerificationResult(verified={self.verified}, confidence={self.confidence:.2f})"


class NewsVerificationAgent:
    """Agent responsible for verifying news articles using NLP"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
                 similarity_threshold: float = 0.7, use_cache: bool = True):
        """
        Initialize the verification agent
        
        Args:
            model_name: Name of the sentence transformer model
            similarity_threshold: Threshold for considering articles similar
            use_cache: Whether to use cached model (default: True)
        """
        self.model_name = model_name
        if use_cache:
            self.model = get_cached_model(model_name)
        else:
            print(f"🤖 Loading NLP model: {model_name}...")
            self.model = SentenceTransformer(model_name)
            print("✅ NLP model loaded successfully")
        self.similarity_threshold = similarity_threshold
        self.embeddings_cache = {}
    
    def verify_news(self, articles: List, verification_depth: int = 3) -> List[VerificationResult]:
        """
        Verify news articles by cross-referencing with similar articles
        
        Args:
            articles: List of NewsArticle objects
            verification_depth: Number of similar articles to consider
            
        Returns:
            List of VerificationResult objects
        """
        if not articles:
            return []
        
        print(f"🔬 Verifying {len(articles)} articles...")
        
        # Generate embeddings for all articles
        embeddings = self._generate_embeddings(articles)
        
        # Calculate similarity matrix
        similarity_matrix = self._calculate_similarity_matrix(embeddings)
        
        # Verify each article
        results = []
        for i, article in enumerate(articles):
            result = self._verify_single_article(
                article, i, articles, similarity_matrix, verification_depth
            )
            results.append(result)
        
        # Count verified articles
        verified_count = sum(1 for r in results if r.verified)
        print(f"✅ Verification complete: {verified_count}/{len(articles)} articles verified")
        
        return results
    
    def _generate_embeddings(self, articles: List) -> np.ndarray:
        """Generate embeddings for articles"""
        texts = []
        for article in articles:
            # Combine title and description for better context
            text = f"{article.title}. {article.description}"
            texts.append(text)
        
        # Generate embeddings
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return embeddings
    
    def _calculate_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """Calculate cosine similarity matrix"""
        from sklearn.metrics.pairwise import cosine_similarity
        return cosine_similarity(embeddings)
    
    def _verify_single_article(self, article, index: int, all_articles: List,
                               similarity_matrix: np.ndarray, 
                               verification_depth: int) -> VerificationResult:
        """Verify a single article"""
        
        # Get similarity scores for this article
        similarities = similarity_matrix[index]
        
        # Find most similar articles (excluding itself)
        similar_indices = np.argsort(similarities)[::-1][1:verification_depth+1]
        
        # Collect similar sources
        similar_sources = []
        similarity_scores = []
        
        for sim_idx in similar_indices:
            similarity_score = similarities[sim_idx]
            # Lower threshold for finding similar articles (0.3 instead of 0.7)
            if similarity_score > 0.3:
                similar_article = all_articles[sim_idx]
                similar_sources.append({
                    'title': similar_article.title,
                    'source': similar_article.source,
                    'url': similar_article.url,
                    'similarity': float(similarity_score)
                })
                similarity_scores.append(similarity_score)
        
        # More lenient verification:
        # 1. If article has description and title, consider it verified
        # 2. If at least one similar article found, boost confidence
        has_content = bool(article.title and article.description)
        
        if has_content:
            # Base confidence from content quality
            base_confidence = 0.6
            
            # Boost confidence if similar articles found
            if similarity_scores:
                avg_similarity = np.mean(similarity_scores)
                confidence = min(base_confidence + (avg_similarity * 0.4), 1.0)
            else:
                confidence = base_confidence
            
            # Verify if confidence meets threshold
            verified = confidence >= self.similarity_threshold
        else:
            confidence = 0.0
            verified = False
        
        return VerificationResult(
            article=article,
            verified=verified,
            confidence=confidence,
            similar_sources=similar_sources
        )
    
    def analyze_sentiment(self, text: str) -> Dict[str, float]:
        """
        Analyze sentiment of text (optional enhancement)
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with sentiment scores
        """
        # This is a placeholder for sentiment analysis
        # You can integrate a sentiment model here
        return {
            'positive': 0.0,
            'neutral': 1.0,
            'negative': 0.0
        }
    
    def extract_entities(self, text: str) -> List[str]:
        """
        Extract named entities from text (optional enhancement)
        
        Args:
            text: Text to analyze
            
        Returns:
            List of entities
        """
        # This is a placeholder for entity extraction
        # You can integrate spaCy or another NER model here
        return []
