"""
News Verification Agent
Verifies news articles using NLP and cross-referencing

The sentence-transformers/torch stack is imported lazily so that importing
this module (e.g. when the API server starts) stays cheap; the model is only
loaded into memory when the first verification job runs, and is then cached
process-wide.
"""

from typing import Dict, List, Optional
import logging
import re

import numpy as np

logger = logging.getLogger(__name__)

# Module-level model cache for singleton pattern
_model_cache: Dict[str, object] = {}

# Flag set once we know sentence_transformers is unavailable
_SENTENCE_TRANSFORMERS_AVAILABLE: Optional[bool] = None


class _HashingEncoder:
    """
    Pure-numpy fallback encoder used when sentence_transformers / torch are
    not installed.  Implements a bag-of-words TF-IDF-style encoding via a
    simple hash trick, then L2-normalises so cosine similarity still works.
    Results are lower quality than transformer embeddings but keep
    cross-corroboration functional.
    """

    DIM = 512

    def encode(self, texts: List[str], show_progress_bar: bool = False) -> np.ndarray:  # noqa: ARG002
        matrix = np.zeros((len(texts), self.DIM), dtype=np.float32)
        for i, text in enumerate(texts):
            tokens = re.findall(r"[a-z]+", text.lower())
            for token in tokens:
                idx = hash(token) % self.DIM
                matrix[i, idx] += 1.0
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms


def get_cached_model(model_name: str):
    """
    Get or load a cached SentenceTransformer model (singleton pattern).
    Falls back to a pure-numpy hashing encoder when sentence_transformers
    or torch cannot be imported.
    """
    global _SENTENCE_TRANSFORMERS_AVAILABLE

    if model_name in _model_cache:
        return _model_cache[model_name]

    # Determine availability on first call
    if _SENTENCE_TRANSFORMERS_AVAILABLE is None:
        try:
            from sentence_transformers import SentenceTransformer  # noqa: F401
            _SENTENCE_TRANSFORMERS_AVAILABLE = True
        except ImportError:
            _SENTENCE_TRANSFORMERS_AVAILABLE = False
            logger.warning(
                "sentence_transformers is not installed (torch may also be missing). "
                "Falling back to a pure-numpy hashing encoder for news verification. "
                "Install sentence-transformers for higher-quality cross-corroboration."
            )

    if _SENTENCE_TRANSFORMERS_AVAILABLE:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading NLP model: {model_name}...")
        _model_cache[model_name] = SentenceTransformer(model_name)
        logger.info(f"Model {model_name} loaded and cached")
    else:
        _model_cache[model_name] = _HashingEncoder()
        logger.info("Using hashing encoder fallback for model slot: %s", model_name)

    return _model_cache[model_name]


class VerificationResult:
    """Result of news verification"""

    def __init__(self, article, verified: bool, confidence: float,
                 similar_sources: Optional[List[Dict]] = None):
        self.article = article
        self.verified = verified
        self.confidence = confidence
        self.similar_sources = similar_sources or []

    def __repr__(self):
        return f"VerificationResult(verified={self.verified}, confidence={self.confidence:.2f})"


class NewsVerificationAgent:
    """Agent responsible for verifying news articles using NLP"""

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
                 similarity_threshold: float = 0.7):
        """
        Initialize the verification agent

        Args:
            model_name: Name of the sentence transformer model
            similarity_threshold: Confidence threshold for marking an article verified
        """
        self.model_name = model_name
        self.model = get_cached_model(model_name)
        self.similarity_threshold = similarity_threshold

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

        logger.info(f"Verifying {len(articles)} articles...")

        embeddings = self._generate_embeddings(articles)
        similarity_matrix = self._calculate_similarity_matrix(embeddings)

        results = []
        for i, article in enumerate(articles):
            result = self._verify_single_article(
                article, i, articles, similarity_matrix, verification_depth
            )
            results.append(result)

        verified_count = sum(1 for r in results if r.verified)
        logger.info(f"Verification complete: {verified_count}/{len(articles)} articles verified")

        return results

    def _generate_embeddings(self, articles: List) -> np.ndarray:
        """Generate embeddings for articles"""
        # Combine title and description for better context
        texts = [f"{article.title}. {article.description}" for article in articles]
        return self.model.encode(texts, show_progress_bar=False)

    @staticmethod
    def _calculate_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
        """Calculate cosine similarity matrix with numpy (no sklearn needed)"""
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = embeddings / norms
        return normalized @ normalized.T

    def _verify_single_article(self, article, index: int, all_articles: List,
                               similarity_matrix: np.ndarray,
                               verification_depth: int) -> VerificationResult:
        """Verify a single article"""

        similarities = similarity_matrix[index]

        # Find most similar articles (excluding itself)
        similar_indices = np.argsort(similarities)[::-1][1:verification_depth + 1]

        similar_sources = []
        similarity_scores = []

        for sim_idx in similar_indices:
            similarity_score = similarities[sim_idx]
            # Lower threshold for surfacing related coverage (0.3 vs 0.7)
            if similarity_score > 0.3:
                similar_article = all_articles[sim_idx]
                similar_sources.append({
                    'title': similar_article.title,
                    'source': similar_article.source,
                    'url': similar_article.url,
                    'similarity': float(similarity_score)
                })
                similarity_scores.append(similarity_score)

        # Scoring: base confidence for well-formed content, boosted by how
        # strongly other outlets corroborate the story.
        has_content = bool(article.title and article.description)

        if has_content:
            base_confidence = 0.6
            if similarity_scores:
                avg_similarity = float(np.mean(similarity_scores))
                confidence = min(base_confidence + (avg_similarity * 0.4), 1.0)
            else:
                confidence = base_confidence
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
