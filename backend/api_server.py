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
from database import get_db, init_database
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
        default_limits=["5000 per day", "1000 per hour"],
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

        # Build per-article result list with sentiment/tone
        from text_analysis import sentiment as ta_sentiment, tone as ta_tone
        article_dicts = []
        for i, r in enumerate(verification_results):
            article = r.article
            text_for_analysis = f"{article.title}. {article.description or ''}"
            pub_iso = (
                article.published_at.isoformat()
                if article.published_at else ""
            )
            article_dicts.append({
                'id': f"a{i}",
                'title': article.title,
                'source': article.source,
                'url': article.url,
                'confidence': round(r.confidence, 3),
                'crossRefs': len(r.similar_sources),
                'excerpt': (article.description or "")[:300],
                'publishedAt': pub_iso,
                'sentiment': round(ta_sentiment(text_for_analysis), 3),
                'tone': ta_tone(text_for_analysis),
                'similar': [
                    {
                        'source': s.get('source', ''),
                        'title': s.get('title', ''),
                        'similarity': round(float(s.get('similarity', 0)), 3),
                    }
                    for s in r.similar_sources
                ],
            })

        confidences = [d['confidence'] for d in article_dicts]
        avg_conf = round(sum(confidences) / len(confidences), 3) if confidences else None

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
        Job.complete(
            job_id, report_path, report_name, agent_actions,
            articles_count=len(articles), verified_count=verified_count,
            articles_json=json.dumps(article_dicts),
            avg_confidence=avg_conf,
            engine=provider_used,
        )
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
        source_objects_by_category = NewsSource.get_objects_grouped_by_category()

        for cat in categories:
            cat['defaultSources'] = sources_by_category.get(cat['category_id'], [])
            cat['sources'] = source_objects_by_category.get(cat['category_id'], [])

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


@app.route('/api/categories/suggest', methods=['POST'])
@require_auth
def suggest_category():
    """Use NLP to suggest a category name, icon, and sources based on a prompt"""
    try:
        data = request.json or {}
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return jsonify({'error': 'Prompt required'}), 400
            
        from news_crawler import OllamaClient
        from config import load_config
        
        config = load_config()
        ollama_cfg = config.get('ollama', {})
        client = OllamaClient(
            host=ollama_cfg.get('host', 'http://localhost:11434'),
            model=ollama_cfg.get('model', 'gemma4:e4b'),
            timeout=int(ollama_cfg.get('timeout_seconds', 60))
        )
        
        if not client.is_available():
            return jsonify({'error': 'Ollama AI is not running or model is not available.'}), 503
            
        system_prompt = (
            "You are an AI assistant that helps users create news categories.\n"
            f"The user wants a news category for: '{prompt}'\n"
            "Return a JSON object with EXACTLY this structure:\n"
            "{\n"
            '  "category_id": "short_snake_case_id",\n'
            '  "name": "Display Name",\n'
            '  "icon_name": "One of: CpuChipIcon, GlobeAltIcon, ChartBarIcon, HealthIcon, FireIcon, SparklesIcon, NewspaperIcon, CodeBracketIcon",\n'
            '  "recommended_sources": [\n'
            '    { "url": "https://...", "name": "..." },\n'
            '    { "url": "https://...", "name": "..." },\n'
            '    { "url": "https://...", "name": "..." }\n'
            "  ]\n"
            "}\n"
            "Include 3-5 real, reputable news website URLs. ONLY output the raw JSON."
        )
        
        raw_response = client.generate(system_prompt, json_mode=True)
        if not raw_response:
            return jsonify({'error': 'Failed to generate suggestions.'}), 500
            
        import json
        try:
            # Clean up the response in case the model wraps it in markdown blocks
            clean_response = raw_response.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response[7:]
            if clean_response.startswith('```'):
                clean_response = clean_response[3:]
            if clean_response.endswith('```'):
                clean_response = clean_response[:-3]
                
            suggestion = json.loads(clean_response.strip())
            
            # Basic validation
            if 'category_id' not in suggestion or 'name' not in suggestion or 'recommended_sources' not in suggestion:
                raise ValueError("Missing required fields")
                
            return jsonify(suggestion), 200
        except Exception as e:
            logger.error(f"Failed to parse Ollama response: {e}\nRaw: {raw_response}")
            return jsonify({'error': 'AI generated invalid data format.'}), 500
            
    except Exception as e:
        logger.error(f"Suggest category error: {e}")
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
        db_job_id = Job.create(job_id, request.user_id, category_id, sources, engine)

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
@rate_limit("120 per minute")
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
            response['articlesCount'] = job.get('articles_count') or 0
            response['verifiedCount'] = job.get('verified_count') or 0
            response['avgConfidence'] = float(job['avg_confidence']) if job.get('avg_confidence') is not None else 0.0
            response['engine'] = job.get('engine') or 'auto'
            try:
                response['articles'] = json.loads(job['articles_json']) if job.get('articles_json') else []
            except (json.JSONDecodeError, TypeError):
                response['articles'] = []
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

        result = []
        for job in jobs:
            job.pop('report_path', None)
            job.pop('articles_json', None)
            job.pop('lens_json', None)
            # Ensure engine is surfaced
            if 'engine' not in job or job['engine'] is None:
                job['engine'] = 'auto'
            result.append(job)

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Get job history error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Source Management =============

@app.route('/api/sources/by-id/<int:source_id>', methods=['DELETE'])
@require_auth
def delete_source_by_id(source_id: int):
    """Soft-delete a news source (set is_active=FALSE)"""
    try:
        success = NewsSource.deactivate(source_id)
        if success:
            return jsonify({'success': True}), 200
        return jsonify({'error': 'Failed to deactivate source'}), 400
    except Exception as e:
        logger.error(f"Delete source error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Job Graph / Lens / Copilot =============

def _load_job_articles(job_id: str, user_id: int):
    """
    Helper: load job and its articles_json.
    Returns (job, articles_list) or raises a tuple (response, status_code).
    """
    job = Job.get_by_job_id(job_id)
    if not job:
        raise ValueError('not_found')
    if job['user_id'] != user_id:
        raise PermissionError('forbidden')
    try:
        articles = json.loads(job['articles_json']) if job.get('articles_json') else []
    except (json.JSONDecodeError, TypeError):
        articles = []
    return job, articles


@app.route('/api/jobs/<job_id>/graph', methods=['GET'])
@require_auth
def get_job_graph(job_id: str):
    """Return a graph of sources and articles derived from persisted article data"""
    try:
        try:
            job, articles = _load_job_articles(job_id, request.user_id)
        except ValueError:
            return jsonify({'error': 'Job not found'}), 404
        except PermissionError:
            return jsonify({'error': 'Unauthorized'}), 403

        nodes = []
        edges = []
        source_conf: dict = {}  # source_name -> list of confidences

        for art in articles:
            source_conf.setdefault(art['source'], []).append(art['confidence'])

        # Source nodes
        source_node_ids = {}
        for idx, (src, confs) in enumerate(source_conf.items()):
            node_id = f"s{idx}"
            source_node_ids[src] = node_id
            avg = round(sum(confs) / len(confs), 3) if confs else 0.6
            nodes.append({
                'id': node_id,
                'label': src,
                'type': 'source',
                'weight': round(0.4 + avg * 0.6, 3),
                'confidence': avg,
            })

        # Article nodes + source→article edges
        for art in articles:
            nodes.append({
                'id': art['id'],
                'label': art['title'][:80],
                'type': 'article',
                'weight': round(0.4 + art['confidence'] * 0.6, 3),
                'confidence': art['confidence'],
                'articleId': art['id'],
            })
            src_node = source_node_ids.get(art['source'])
            if src_node:
                edges.append({
                    'from': src_node,
                    'to': art['id'],
                    'strength': art['confidence'],
                })

        # Article↔article edges from similar list
        article_id_set = {a['id'] for a in articles}
        for art in articles:
            for sim in art.get('similar', []):
                # Find a matching article node by source+title prefix
                for other in articles:
                    if other['id'] == art['id']:
                        continue
                    if (other['source'] == sim.get('source') and
                            other['title'][:40] == sim.get('title', '')[:40]):
                        edge_key = tuple(sorted([art['id'], other['id']]))
                        if edge_key not in article_id_set:
                            article_id_set.add(str(edge_key))
                            edges.append({
                                'from': art['id'],
                                'to': other['id'],
                                'strength': sim.get('similarity', 0.0),
                            })
                        break

        return jsonify({'nodes': nodes, 'edges': edges}), 200

    except Exception as e:
        logger.error(f"Get job graph error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/jobs/<job_id>/lens', methods=['GET'])
@require_auth
def get_job_lens(job_id: str):
    """Return bias/tone lens data for a job, caching result in lens_json"""
    try:
        try:
            job, articles = _load_job_articles(job_id, request.user_id)
        except ValueError:
            return jsonify({'error': 'Job not found'}), 404
        except PermissionError:
            return jsonify({'error': 'Unauthorized'}), 403

        # Return cached lens if available
        if job.get('lens_json'):
            try:
                return jsonify(json.loads(job['lens_json'])), 200
            except (json.JSONDecodeError, TypeError):
                pass

        if not articles:
            lens = {'balance': 0.0, 'spread': 0.0, 'articles': []}
            return jsonify(lens), 200

        from text_analysis import sentiment as ta_sentiment, tone as ta_tone

        per_article = []
        for art in articles:
            text = f"{art.get('title', '')}. {art.get('excerpt', '')}"
            per_article.append({
                'id': art['id'],
                'sentiment': art.get('sentiment', round(ta_sentiment(text), 3)),
                'tone': art.get('tone', ta_tone(text)),
            })

        sentiments = [a['sentiment'] for a in per_article]
        balance = round(sum(sentiments) / len(sentiments), 3)

        # Population std dev
        mean = balance
        variance = sum((s - mean) ** 2 for s in sentiments) / len(sentiments)
        spread = round(variance ** 0.5, 3)

        lens = {'balance': balance, 'spread': spread, 'articles': per_article}

        # Persist to lens_json
        db = get_db()
        try:
            db.execute_update(
                "UPDATE jobs SET lens_json = %s WHERE job_id = %s",
                (json.dumps(lens), job_id)
            )
        except Exception:
            pass  # Non-fatal

        return jsonify(lens), 200

    except Exception as e:
        logger.error(f"Get job lens error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/jobs/<job_id>/copilot', methods=['POST'])
@require_auth
def job_copilot(job_id: str):
    """Answer a question about a job's articles using retrieval + optional LLM"""
    try:
        try:
            job, articles = _load_job_articles(job_id, request.user_id)
        except ValueError:
            return jsonify({'error': 'Job not found'}), 404
        except PermissionError:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.json or {}
        message = data.get('message', '').strip()
        if not message:
            return jsonify({'error': 'message required'}), 400

        # Lexical overlap ranking
        query_words = set(message.lower().split())

        def overlap(art):
            text_words = set((art.get('title', '') + ' ' + art.get('excerpt', '')).lower().split())
            return len(query_words & text_words)

        ranked = sorted(articles, key=overlap, reverse=True)
        top_hits = [a for a in ranked if overlap(a) > 0][:5]

        steps = [{'tool': 'search_archive', 'detail': f"Searched {len(articles)} articles for: {message[:80]}"}]

        if top_hits:
            steps.append({'tool': 'get_article', 'detail': f"Retrieved: {top_hits[0]['title'][:80]}"})

        if len(top_hits) >= 2:
            steps.append({'tool': 'compare_sources', 'detail': f"Compared {len(top_hits)} sources on this topic"})

        # Try Ollama first
        answer = None
        config = load_config()
        ollama_cfg = config.get('ollama', {})
        try:
            from news_crawler import OllamaClient
            client = OllamaClient(
                host=ollama_cfg.get('host', 'http://localhost:11434'),
                model=ollama_cfg.get('model', 'gemma4:e4b'),
                timeout=int(ollama_cfg.get('timeout_seconds', 60)),
            )
            if client.is_available():
                context = "\n\n".join(
                    f"[{a['source']}] {a['title']}: {a['excerpt']}"
                    for a in top_hits
                ) if top_hits else "No relevant articles found."
                prompt = (
                    f"You are a news analyst. A user asks: \"{message}\"\n\n"
                    f"Relevant articles:\n{context}\n\n"
                    "Answer concisely in 2-3 sentences, citing the sources above."
                )
                answer = client.generate(prompt)
        except Exception as e:
            logger.warning(f"Copilot Ollama call failed: {e}")

        if not answer:
            if top_hits:
                strongest = max(top_hits, key=lambda a: a.get('confidence', 0))
                weakest = min(top_hits, key=lambda a: a.get('confidence', 0))
                titles = "; ".join(f'"{a["title"][:50]}"' for a in top_hits[:3])
                answer = (
                    f"Based on {len(top_hits)} retrieved article(s) — {titles} — "
                    f"the strongest corroboration comes from {strongest['source']} "
                    f"(confidence {strongest.get('confidence', 0):.2f}) and the weakest "
                    f"from {weakest['source']} (confidence {weakest.get('confidence', 0):.2f}). "
                    f"Cross-reference count: {sum(a.get('crossRefs', 0) for a in top_hits)}."
                )
            else:
                answer = f"No articles in this report directly match your query: \"{message}\"."

        return jsonify({'steps': steps, 'answer': answer}), 200

    except Exception as e:
        logger.error(f"Copilot error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ============= Briefing =============

def _build_briefing(user_id: int) -> dict:
    """Gather recent complete jobs and build a briefing payload"""
    from datetime import timezone

    config = load_config()
    ollama_cfg = config.get('ollama', {})

    # Collect articles from jobs completed in the last 7 days
    recent_jobs = Job.get_user_jobs(user_id, limit=20)
    now = datetime.now()
    all_articles = []
    tool_trace = [{'ts': now.isoformat(), 'tool': 'list_jobs',
                   'detail': f"Found {len(recent_jobs)} recent job(s)"}]

    for job in recent_jobs:
        if job.get('status') != 'Complete':
            continue
        try:
            created = job.get('created_at')
            if created:
                if hasattr(created, 'replace'):
                    age = (now - created.replace(tzinfo=None)).days
                else:
                    age = 999
                if age > 7:
                    continue
        except Exception:
            pass

        try:
            arts = json.loads(job['articles_json']) if job.get('articles_json') else []
        except (json.JSONDecodeError, TypeError):
            arts = []

        for art in arts:
            art['_category'] = job.get('category_name', '')
            art['_category_id'] = job.get('category_id', '')
        all_articles.extend(arts)

    tool_trace.append({
        'ts': datetime.now().isoformat(),
        'tool': 'load_articles',
        'detail': f"Loaded {len(all_articles)} articles across recent jobs",
    })

    # Pick top ~6 by confidence
    top = sorted(all_articles, key=lambda a: a.get('confidence', 0), reverse=True)[:6]

    # Try Ollama for summaries
    ollama_client = None
    try:
        from news_crawler import OllamaClient
        client = OllamaClient(
            host=ollama_cfg.get('host', 'http://localhost:11434'),
            model=ollama_cfg.get('model', 'gemma4:e4b'),
            timeout=int(ollama_cfg.get('timeout_seconds', 60)),
        )
        if client.is_available():
            ollama_client = client
    except Exception:
        pass

    stories = []
    for story_idx, art in enumerate(top):
        excerpt = art.get('excerpt', '')
        title = art.get('title', '')
        source = art.get('source', '')
        category = art.get('_category', '')
        confidence = art.get('confidence', 0.0)

        if ollama_client:
            try:
                sum_prompt = (
                    f"Summarise this news article in exactly 2 sentences:\n"
                    f"Title: {title}\nExcerpt: {excerpt[:400]}"
                )
                summary = ollama_client.generate(sum_prompt) or excerpt[:200]
                why_prompt = (
                    f"In one sentence, why does this story matter?\n"
                    f"Title: {title}\nExcerpt: {excerpt[:300]}"
                )
                why = ollama_client.generate(why_prompt) or f"Reported by {source}."
            except Exception:
                summary = excerpt[:200] or title
                why = f"Reported by {source}."
        else:
            summary = excerpt[:200] or title
            why = (
                f"Reported by {source} with {art.get('crossRefs', 0)} "
                "corroborating source(s)."
            )

        stories.append({
            'id': f"brief-{story_idx}-{art.get('id', '')}",
            'category': category,
            'headline': title,
            'summary': summary,
            'whyItMatters': why,
            'confidence': confidence,
        })

    tool_trace.append({
        'ts': datetime.now().isoformat(),
        'tool': 'rank_stories',
        'detail': f"Selected top {len(stories)} stories by confidence",
    })

    hour = datetime.now().hour
    if hour < 12:
        greeting = "Good morning"
    elif hour < 18:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    return {
        'greeting': greeting,
        'date': now.date().isoformat(),
        'stories': stories,
        'toolTrace': tool_trace,
    }


@app.route('/api/briefing', methods=['GET'])
@require_auth
def get_briefing():
    """Return a personalised briefing from recent completed jobs"""
    try:
        return jsonify(_build_briefing(request.user_id)), 200
    except Exception as e:
        logger.error(f"Get briefing error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/briefing/generate', methods=['POST'])
@require_auth
def generate_briefing():
    """Force-regenerate the briefing (same logic, no cache)"""
    try:
        return jsonify(_build_briefing(request.user_id)), 200
    except Exception as e:
        logger.error(f"Generate briefing error: {e}")
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
