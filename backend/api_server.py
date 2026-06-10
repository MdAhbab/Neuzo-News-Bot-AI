"""
Backend API server for Neuzo
Flask-based REST API for authentication, categories, and news processing
"""

import json
import logging
import os
import secrets
import threading
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from config import get_output_dir, load_config
from database import init_database
from models import Category, Job, NewsSource, User

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Configuration: environment first, then config.yaml, then defaults
_session_cfg = load_config().get('session', {})
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max request size
app.config['SESSION_EXPIRY_HOURS'] = int(
    os.getenv('SESSION_EXPIRY_HOURS', _session_cfg.get('expiry_hours', 24))
)

# Rate limiting setup
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"],
        storage_uri=os.getenv('REDIS_URL', 'memory://')
    )
    RATE_LIMITING_ENABLED = True
    logger.info("Rate limiting enabled")
except ImportError:
    RATE_LIMITING_ENABLED = False
    logger.warning("flask-limiter not installed, rate limiting disabled")

# Session storage with expiration
# Structure: {token: {'user_id': int, 'expires': datetime, 'created_at': datetime}}
active_sessions: Dict[str, Dict[str, Any]] = {}
_last_session_cleanup = datetime.now()
_session_lock = threading.Lock()

# Redis session storage (optional, for production)
redis_client = None
try:
    import redis
    redis_url = os.getenv('REDIS_URL')
    if redis_url:
        redis_client = redis.from_url(redis_url)
        logger.info("Redis session storage enabled")
except ImportError:
    pass


def create_session(user_id: int) -> str:
    """Create a new session token with expiration"""
    token = secrets.token_urlsafe(32)
    expiry_hours = app.config['SESSION_EXPIRY_HOURS']
    expires = datetime.now() + timedelta(hours=expiry_hours)

    if redis_client:
        redis_client.setex(
            f"session:{token}",
            timedelta(hours=expiry_hours),
            json.dumps({
                'user_id': user_id,
                'expires': expires.isoformat(),
                'created_at': datetime.now().isoformat()
            })
        )
    else:
        with _session_lock:
            active_sessions[token] = {
                'user_id': user_id,
                'expires': expires,
                'created_at': datetime.now()
            }

    return token


def get_session(token: str) -> Optional[Dict[str, Any]]:
    """Get session data if valid and not expired"""
    if redis_client:
        data = redis_client.get(f"session:{token}")
        if data:
            try:
                session = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                redis_client.delete(f"session:{token}")
                return None
            session['expires'] = datetime.fromisoformat(session['expires'])
            if session['expires'] > datetime.now():
                return session
            redis_client.delete(f"session:{token}")
    else:
        with _session_lock:
            session = active_sessions.get(token)
            if session and session['expires'] > datetime.now():
                return session
            if session:
                del active_sessions[token]
    return None


def delete_session(token: str):
    """Delete a session"""
    if redis_client:
        redis_client.delete(f"session:{token}")
    else:
        with _session_lock:
            active_sessions.pop(token, None)


def cleanup_expired_sessions():
    """Drop expired in-memory sessions (Redis handles its own TTL)"""
    global _last_session_cleanup
    if redis_client:
        return
    now = datetime.now()
    with _session_lock:
        if now - _last_session_cleanup < timedelta(minutes=15):
            return
        _last_session_cleanup = now
        expired = [t for t, s in active_sessions.items() if s['expires'] < now]
        for token in expired:
            del active_sessions[token]
    if expired:
        logger.info(f"Cleaned up {len(expired)} expired sessions")


# Job processing steps
PROCESSING_STEPS = [
    "Initiating agent for {category}...",
    "Querying news pool...",
    "Receiving and parsing articles...",
    "Verifying news against references...",
    "Detecting duplicate and related stories...",
    "Synthesising final report...",
    "Generating document..."
]

VALID_ENGINES = {'auto', 'newsapi', 'crawler'}

# Initialize database
try:
    init_database()
    logger.info("Database initialized successfully")
except Exception as e:
    logger.error(f"Database initialization failed: {e}")
    raise


def _fetch_articles(config: dict, engine: str, api_category: str,
                    sources: list, time_window: int, max_items: int):
    """
    Fetch articles using the configured provider.

    Returns (articles, provider_used). 'auto' tries NewsAPI first and falls
    back to the local crawler on quota errors, missing key, or empty results.
    """
    from news_fetcher import NewsAPIQuotaError, NewsFetcherAgent

    api_key = config.get('news_api', {}).get('api_key', '')
    has_key = bool(api_key and 'YOUR_' not in api_key)

    def crawl():
        from news_crawler import LocalNewsCrawler
        ollama_cfg = config.get('ollama', {})
        crawler = LocalNewsCrawler(
            ollama_host=ollama_cfg.get('host', 'http://localhost:11434'),
            ollama_model=ollama_cfg.get('model', 'gemma4:e4b'),
            ollama_enabled=ollama_cfg.get('enabled', True),
            ollama_timeout=int(ollama_cfg.get('timeout_seconds', 60)),
            max_items=max_items,
        )
        return crawler.fetch_news(api_category, sources=sources, hours=max(time_window, 24))

    if engine == 'crawler' or (engine == 'auto' and not has_key):
        return crawl(), 'crawler'

    try:
        fetcher = NewsFetcherAgent(api_key=api_key, max_items=max_items)
        articles = fetcher.fetch_news(api_category, hours=time_window)
        if articles or engine == 'newsapi':
            return articles, 'newsapi'
        logger.info("NewsAPI returned no articles; falling back to local crawler")
        return crawl(), 'crawler'
    except NewsAPIQuotaError as e:
        if engine == 'newsapi':
            raise
        logger.warning(f"NewsAPI quota hit ({e}); falling back to local crawler")
        return crawl(), 'crawler'


def process_job_background(job_id: str, category_name: str, sources: list,
                           engine: str = 'auto'):
    """Background job processor - fetches and processes real news"""
    try:
        from document_generator import DocumentGenerator
        from news_verifier import NewsVerificationAgent

        config = load_config()

        # Step 1: Initialize
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[0].format(category=category_name))
        logger.info(f"Job {job_id}: Initiating agent (engine={engine})")

        time_window = config.get('time_window_hours', 1)
        max_items = config.get('agents', {}).get('max_news_items', 20)

        # Map display names to API categories
        category_map = {
            'Technology': 'technology',
            'Business': 'business',
            'Science': 'science',
            'Healthcare': 'health',
            'Sports': 'sports',
            'World News': 'general'
        }
        api_category = category_map.get(category_name, category_name.lower())

        # Step 2: Fetch news
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[1].format(category=category_name))
        articles, provider_used = _fetch_articles(
            config, engine, api_category, sources, time_window, max_items
        )
        logger.info(f"Job {job_id}: Fetched {len(articles)} articles via {provider_used}")

        if not articles:
            Job.update_status(
                job_id, 'Error',
                error_message='No articles could be fetched. Check the NewsAPI quota '
                              'or add sources with RSS feeds and try again.'
            )
            return

        # Step 3: Parse articles
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[2].format(category=category_name))

        # Step 4: Verify news
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[3].format(category=category_name))
        threshold = config.get('nlp', {}).get('similarity_threshold', 0.7)
        model_name = config.get('nlp', {}).get('model_name',
                                               'sentence-transformers/all-MiniLM-L6-v2')
        verifier = NewsVerificationAgent(model_name=model_name, similarity_threshold=threshold)
        verification_results = verifier.verify_news(articles)
        verified_count = sum(1 for r in verification_results if r.verified)
        logger.info(f"Job {job_id}: Verified {verified_count} articles")

        # Step 5: Detect duplicates
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[4].format(category=category_name))

        # Step 6: Synthesize
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[5].format(category=category_name))

        # Step 7: Generate document
        Job.update_status(job_id, 'Processing', PROCESSING_STEPS[6].format(category=category_name))
        doc_gen = DocumentGenerator(output_dir=str(get_output_dir()),
                                    verification_threshold=threshold)
        report_path = doc_gen.generate_report(category_name, verification_results)
        report_name = os.path.basename(report_path)

        # Mark job as complete
        agent_actions = [
            step.format(category=category_name).replace(
                'Querying news pool...', f'Queried news pool via {provider_used}...'
            )
            for step in PROCESSING_STEPS
        ]
        Job.complete(job_id, report_path, report_name, agent_actions,
                     articles_count=len(articles), verified_count=verified_count)
        logger.info(f"Job {job_id} completed - {len(verification_results)} articles processed")

    except Exception as e:
        logger.error(f"Job processing error: {e}", exc_info=True)
        Job.update_status(job_id, 'Error', error_message=str(e))


# Middleware for authentication
def require_auth(f):
    """Decorator to require authentication with session expiration check"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        cleanup_expired_sessions()
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Unauthorized - No token provided'}), 401

        session = get_session(token)
        if not session:
            return jsonify({'error': 'Session expired. Please log in again.'}), 401

        request.user_id = session['user_id']
        return f(*args, **kwargs)
    return wrapper


# ============= Authentication Endpoints =============

# Rate limit decorator helper (no-op if rate limiting is disabled)
def rate_limit(limit_string):
    """Apply rate limit if available, otherwise no-op"""
    def decorator(f):
        if RATE_LIMITING_ENABLED:
            return limiter.limit(limit_string)(f)
        return f
    return decorator


@app.route('/api/auth/signup', methods=['POST'])
@rate_limit("5 per minute")
def signup():
    """User registration endpoint with rate limiting"""
    try:
        data = request.json or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        full_name = data.get('full_name', '').strip() if data.get('full_name') else None

        # Validation
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400

        user_id = User.create(email, password, full_name)
        if user_id:
            token = create_session(user_id)

            logger.info(f"New user registered: {email}")
            return jsonify({
                'success': True,
                'token': token,
                'user': {'id': user_id, 'email': email, 'full_name': full_name},
                'expires_in_hours': app.config['SESSION_EXPIRY_HOURS']
            }), 201
        else:
            return jsonify({'error': 'User already exists or creation failed'}), 400

    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/auth/login', methods=['POST'])
@rate_limit("10 per minute")
def login():
    """User login endpoint with rate limiting"""
    try:
        data = request.json or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        user = User.authenticate(email, password)
        if user:
            token = create_session(user['id'])

            logger.info(f"User logged in: {email}")
            return jsonify({
                'success': True,
                'token': token,
                'user': user,
                'expires_in_hours': app.config['SESSION_EXPIRY_HOURS']
            }), 200
        else:
            logger.warning(f"Failed login attempt for: {email}")
            return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """User logout endpoint"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    delete_session(token)
    logger.info(f"User logged out: user_id={request.user_id}")
    return jsonify({'success': True}), 200


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Return the authenticated user (used for session restore on page load)"""
    try:
        user = User.get_by_id(request.user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'full_name': user['full_name']
        }), 200
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Category Endpoints =============

@app.route('/api/categories', methods=['GET'])
@require_auth
def get_categories():
    """Get all categories with their default sources"""
    try:
        categories = Category.get_all()
        sources_by_category = NewsSource.get_urls_grouped_by_category()

        for cat in categories:
            cat['defaultSources'] = sources_by_category.get(cat['category_id'], [])

        return jsonify(categories), 200

    except Exception as e:
        logger.error(f"Get categories error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/categories', methods=['POST'])
@require_auth
def create_category():
    """Create a new custom category"""
    try:
        data = request.json or {}
        category_id = data.get('category_id', '').strip()
        name = data.get('name', '').strip()
        icon_name = data.get('icon_name', 'NewspaperIcon')

        if not category_id or not name:
            return jsonify({'error': 'Category ID and name required'}), 400

        cat_id = Category.create(category_id, name, icon_name, request.user_id)
        if cat_id:
            return jsonify({'success': True, 'id': cat_id}), 201
        else:
            return jsonify({'error': 'Category creation failed (it may already exist)'}), 400

    except Exception as e:
        logger.error(f"Create category error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= News Source Endpoints =============

@app.route('/api/sources/<category_id>', methods=['GET'])
@require_auth
def get_sources(category_id: str):
    """Get sources for a category"""
    try:
        sources = NewsSource.get_by_category(category_id)
        return jsonify(sources), 200

    except Exception as e:
        logger.error(f"Get sources error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/sources/<category_id>', methods=['POST'])
@require_auth
def add_source(category_id: str):
    """Add a source to a category"""
    try:
        data = request.json or {}
        source_url = data.get('source_url', '').strip()
        source_name = data.get('source_name')
        source_type = data.get('source_type', 'web')
        reliability_score = data.get('reliability_score', 0.80)

        if not source_url:
            return jsonify({'error': 'Source URL required'}), 400

        if source_type not in ('web', 'rss', 'api'):
            return jsonify({'error': 'Invalid source type'}), 400

        try:
            reliability_score = max(0.0, min(float(reliability_score), 1.0))
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid reliability score'}), 400

        source_id = NewsSource.add_source(
            category_id,
            source_url,
            source_name,
            source_type,
            reliability_score
        )
        if source_id:
            logger.info(f"Source added: {source_url} ({source_type}) to category {category_id}")
            return jsonify({'success': True, 'id': source_id}), 201
        else:
            return jsonify({'error': 'Failed to add source'}), 400

    except Exception as e:
        logger.error(f"Add source error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Job Endpoints =============

@app.route('/api/jobs/start', methods=['POST'])
@require_auth
def start_job():
    """Start a new news processing job"""
    try:
        data = request.json or {}
        category_id = data.get('category')
        sources = data.get('sources', [])
        engine = data.get('engine', 'auto')

        if not category_id or not sources:
            return jsonify({'error': 'Category and sources required'}), 400

        if engine not in VALID_ENGINES:
            return jsonify({'error': f"Invalid engine. Use one of: {', '.join(sorted(VALID_ENGINES))}"}), 400

        # Get category name
        category = Category.get_by_category_id(category_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        category_name = category['name']

        # Generate job ID
        job_id = f"job-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"

        # Create job in database
        db_job_id = Job.create(job_id, request.user_id, category_id, sources)

        if db_job_id:
            thread = threading.Thread(
                target=process_job_background,
                args=(job_id, category_name, sources, engine),
                daemon=True
            )
            thread.start()

            return jsonify({
                'jobId': job_id,
                'status': 'Pending',
                'message': 'Job initiated.'
            }), 201
        else:
            return jsonify({'error': 'Job creation failed'}), 400

    except Exception as e:
        logger.error(f"Start job error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/jobs/<job_id>/status', methods=['GET'])
@require_auth
def get_job_status(job_id: str):
    """Get job status"""
    try:
        job = Job.get_by_job_id(job_id)

        if not job:
            return jsonify({'error': 'Job not found'}), 404

        if job['user_id'] != request.user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        response = {
            'jobId': job['job_id'],
            'status': job['status'],
            'step': job['current_step']
        }

        if job['status'] == 'Complete':
            response['reportUrl'] = f"/api/jobs/{job_id}/download"
            response['reportName'] = job['report_name']
            response['usedSources'] = Job.decode_list(job['sources_used'])
            response['agentActions'] = Job.decode_list(job['agent_actions'])
            response['articlesCount'] = job.get('articles_count')
            response['verifiedCount'] = job.get('verified_count')
        elif job['status'] == 'Error':
            response['message'] = job['error_message']

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Get job status error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/jobs/<job_id>/download', methods=['GET'])
@require_auth
def download_report(job_id: str):
    """Download generated report"""
    try:
        job = Job.get_by_job_id(job_id)

        if not job:
            return jsonify({'error': 'Job not found'}), 404

        if job['user_id'] != request.user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        if job['status'] != 'Complete' or not job['report_path']:
            return jsonify({'error': 'Report not available'}), 404

        if os.path.exists(job['report_path']):
            return send_file(
                job['report_path'],
                as_attachment=True,
                download_name=job['report_name']
            )
        else:
            return jsonify({'error': 'Report file not found'}), 404

    except Exception as e:
        logger.error(f"Download report error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/jobs/history', methods=['GET'])
@require_auth
def get_job_history():
    """Get user's job history"""
    try:
        limit = max(1, min(request.args.get('limit', 50, type=int), 200))
        jobs = Job.get_user_jobs(request.user_id, limit)

        # Strip server-side paths from the payload
        for job in jobs:
            job.pop('report_path', None)

        return jsonify(jobs), 200

    except Exception as e:
        logger.error(f"Get job history error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Health Check =============

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }), 200


# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal error: {e}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes')
    app.run(host='127.0.0.1' if not debug else '0.0.0.0', port=port, debug=debug)
