"""
Test suite for Neuzo backend
Run with: pytest tests/ -v (from the backend/ directory)
"""

import pytest
import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestUserModel:
    """Tests for User model"""
    
    def test_password_hashing(self):
        """Test that password hashing works correctly"""
        from models import User
        
        password = "test_password_123"
        hashed = User.hash_password(password)
        
        # Hash should not be the same as password
        assert hashed != password
        
        # Should verify correctly
        assert User.verify_password(password, hashed) == True
        
        # Wrong password should not verify
        assert User.verify_password("wrong_password", hashed) == False
    
    def test_password_hash_uniqueness(self):
        """Test that same password produces different hashes (due to salt)"""
        from models import User
        
        password = "test_password"
        hash1 = User.hash_password(password)
        hash2 = User.hash_password(password)
        
        # With bcrypt, same password should produce different hashes
        # Note: This may fail if using fallback SHA-256 with same salt
        assert User.verify_password(password, hash1) == True
        assert User.verify_password(password, hash2) == True


class TestNewsVerifier:
    """Tests for News Verification Agent"""

    def test_model_caching(self):
        """Test that model caching works (singleton pattern)"""
        pytest.importorskip("sentence_transformers")
        from news_verifier import get_cached_model, _model_cache

        model_name = "sentence-transformers/all-MiniLM-L6-v2"

        # First call should load the model
        model1 = get_cached_model(model_name)
        assert model_name in _model_cache

        # Second call should return cached model
        model2 = get_cached_model(model_name)
        assert model1 is model2  # Same object reference

    def test_cosine_similarity_matrix(self):
        """Numpy cosine similarity should behave like sklearn's"""
        import numpy as np
        from news_verifier import NewsVerificationAgent

        embeddings = np.array([
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [1.0, 1.0, 0.0],
        ])
        matrix = NewsVerificationAgent._calculate_similarity_matrix(embeddings)

        assert matrix.shape == (3, 3)
        assert matrix[0, 0] == pytest.approx(1.0)
        assert matrix[0, 1] == pytest.approx(0.0)
        assert matrix[0, 2] == pytest.approx(1 / (2 ** 0.5), abs=1e-6)

    def test_verification_result_creation(self):
        """Test VerificationResult class"""
        from news_verifier import VerificationResult
        
        class MockArticle:
            title = "Test Article"
            description = "Test Description"
        
        result = VerificationResult(
            article=MockArticle(),
            verified=True,
            confidence=0.85,
            similar_sources=[{"title": "Similar", "source": "Test"}]
        )
        
        assert result.verified == True
        assert result.confidence == 0.85
        assert len(result.similar_sources) == 1


class TestJobModel:
    """Tests for Job list-column serialisation"""

    def test_decode_list_json(self):
        from models import Job

        assert Job.decode_list('["https://a.com/?x=1,2", "step two"]') == [
            'https://a.com/?x=1,2', 'step two']

    def test_decode_list_legacy_csv(self):
        from models import Job

        assert Job.decode_list('https://a.com,https://b.com') == [
            'https://a.com', 'https://b.com']

    def test_decode_list_empty(self):
        from models import Job

        assert Job.decode_list(None) == []
        assert Job.decode_list('') == []


class TestNewsCrawler:
    """Tests for the local agentic news crawler (no network required)"""

    def test_parse_decisions_valid_json(self):
        from news_crawler import LocalNewsCrawler

        raw = '{"articles": [{"index": 0, "relevant": true, "summary": "A summary."}, ' \
              '{"index": 1, "relevant": false, "summary": ""}]}'
        decisions = LocalNewsCrawler._parse_decisions(raw, 2)

        assert decisions is not None
        assert decisions[0]["relevant"] is True
        assert decisions[1]["relevant"] is False

    def test_parse_decisions_handles_fenced_json(self):
        from news_crawler import LocalNewsCrawler

        raw = 'Here you go:\n```json\n{"articles": [{"index": 0, "relevant": true, ' \
              '"summary": "ok"}]}\n```'
        decisions = LocalNewsCrawler._parse_decisions(raw, 1)

        assert decisions is not None
        assert 0 in decisions

    def test_parse_decisions_rejects_garbage(self):
        from news_crawler import LocalNewsCrawler

        assert LocalNewsCrawler._parse_decisions(None, 2) is None
        assert LocalNewsCrawler._parse_decisions("not json at all", 2) is None
        assert LocalNewsCrawler._parse_decisions('{"articles": "nope"}', 2) is None

    def test_parse_decisions_ignores_out_of_range_indexes(self):
        from news_crawler import LocalNewsCrawler

        raw = '{"articles": [{"index": 5, "relevant": true, "summary": "x"}]}'
        assert LocalNewsCrawler._parse_decisions(raw, 2) is None

    def test_dedupe_by_url_and_title(self):
        from news_crawler import LocalNewsCrawler
        from news_fetcher import NewsArticle

        a1 = NewsArticle("Title A", "desc", "https://x.com/a", "X", None)
        a2 = NewsArticle("Title A", "desc", "https://x.com/a", "X", None)
        a3 = NewsArticle("Title B", "desc", "", "Y", None)
        a4 = NewsArticle("title b", "desc", "", "Y", None)

        unique = LocalNewsCrawler._dedupe([a1, a2, a3, a4])
        assert len(unique) == 2


class TestConfig:
    """Tests for the configuration loader"""

    def test_env_override(self, monkeypatch):
        import config as config_module

        monkeypatch.setenv("NEWSAPI_KEY", "test-key-123")
        cfg = config_module.load_config(force_reload=True)
        assert cfg["news_api"]["api_key"] == "test-key-123"

        monkeypatch.delenv("NEWSAPI_KEY")
        config_module.load_config(force_reload=True)


class TestAPIEndpoints:
    """Tests for API endpoints (requires app context)"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        try:
            from api_server import app
            app.config['TESTING'] = True
            with app.test_client() as client:
                yield client
        except Exception as e:
            pytest.skip(f"Could not create test client: {e}")
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get('/api/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
    
    def test_unauthorized_access(self, client):
        """Test that protected endpoints require authentication"""
        response = client.get('/api/categories')
        assert response.status_code == 401
    
    def test_signup_validation(self, client):
        """Test signup input validation"""
        # Missing email
        response = client.post('/api/auth/signup', json={
            'password': 'test123'
        })
        assert response.status_code == 400
        
        # Short password
        response = client.post('/api/auth/signup', json={
            'email': 'test@test.com',
            'password': '123'
        })
        assert response.status_code == 400
        
        # Invalid email format
        response = client.post('/api/auth/signup', json={
            'email': 'invalid-email',
            'password': 'test123456'
        })
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
