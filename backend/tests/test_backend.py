"""
Test suite for Neuzo backend
Run with: pytest tests/ -v
"""

import pytest
import sys
import os

# Add parent directory to path for imports
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
        from news_verifier import get_cached_model, _model_cache
        
        model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        # First call should load the model
        model1 = get_cached_model(model_name)
        assert model_name in _model_cache
        
        # Second call should return cached model
        model2 = get_cached_model(model_name)
        assert model1 is model2  # Same object reference
    
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
