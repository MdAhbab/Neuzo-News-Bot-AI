from typing import Optional, List, Dict, Any
import json
import secrets
import hashlib
import logging
from database import get_db

# Use bcrypt for secure password hashing
try:
    import bcrypt as bcrypt_lib
    USE_BCRYPT = True
except ImportError:
    USE_BCRYPT = False
    logging.warning("bcrypt not installed, falling back to SHA-256 (not recommended for production)")

logger = logging.getLogger(__name__)


def _prepare_password(password: str) -> bytes:
    """
    Prepare password for bcrypt by encoding and pre-hashing if too long.
    Bcrypt has a 72-byte limit, so we hash long passwords with SHA-256 first.
    This is a standard pattern (used by Dropbox, etc.)
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Pre-hash with SHA-256 and encode as hex (64 chars, well under 72)
        password_bytes = hashlib.sha256(password_bytes).hexdigest().encode('utf-8')
    return password_bytes


class User:
    """User model for authentication and management"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt (secure) or SHA-256 with salt (fallback)"""
        if USE_BCRYPT:
            prepared_pwd = _prepare_password(password)
            salt = bcrypt_lib.gensalt()
            hashed = bcrypt_lib.hashpw(prepared_pwd, salt)
            return hashed.decode('utf-8')
        else:
            # Fallback to SHA-256 with salt
            salt = secrets.token_hex(16)
            pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
            return f"{salt}${pwd_hash}"
    
    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        """Verify password against stored hash"""
        if USE_BCRYPT:
            try:
                prepared_pwd = _prepare_password(password)
                stored_bytes = stored_hash.encode('utf-8')
                return bcrypt_lib.checkpw(prepared_pwd, stored_bytes)
            except Exception:
                # If bcrypt fails, try legacy SHA-256 format for migration
                if '$' in stored_hash and len(stored_hash.split('$')) == 2:
                    try:
                        salt, pwd_hash = stored_hash.split('$')
                        check_hash = hashlib.sha256((password + salt).encode()).hexdigest()
                        return check_hash == pwd_hash
                    except ValueError:
                        pass
                return False
        else:
            try:
                salt, pwd_hash = stored_hash.split('$')
                check_hash = hashlib.sha256((password + salt).encode()).hexdigest()
                return check_hash == pwd_hash
            except ValueError:
                return False
    
    @staticmethod
    def create(email: str, password: str, full_name: Optional[str] = None) -> Optional[int]:
        """Create a new user"""
        db = get_db()
        try:
            password_hash = User.hash_password(password)
            query = """
                INSERT INTO users (email, password_hash, full_name)
                VALUES (%s, %s, %s)
            """
            user_id = db.execute_update(query, (email, password_hash, full_name))
            logger.info(f"User created: {email}")
            return user_id
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None
    
    @staticmethod
    def authenticate(email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user and return user data"""
        db = get_db()
        try:
            query = """
                SELECT id, email, password_hash, full_name, is_active
                FROM users
                WHERE email = %s AND is_active = TRUE
            """
            results = db.execute_query(query, (email,))
            
            if not results:
                return None
            
            user = results[0]
            if User.verify_password(password, user['password_hash']):
                # Update last login
                update_query = "UPDATE users SET last_login = NOW() WHERE id = %s"
                db.execute_update(update_query, (user['id'],))
                
                return {
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name']
                }
            return None
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return None
    
    @staticmethod
    def get_by_id(user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        db = get_db()
        query = """
            SELECT id, email, full_name, created_at, last_login
            FROM users
            WHERE id = %s AND is_active = TRUE
        """
        results = db.execute_query(query, (user_id,))
        return results[0] if results else None


class Category:
    """Category model for news categories"""
    
    @staticmethod
    def get_all(include_custom: bool = True) -> List[Dict[str, Any]]:
        """Get all active categories"""
        db = get_db()
        query = """
            SELECT id, category_id, name, icon_name, is_custom
            FROM categories
            WHERE is_active = TRUE
        """
        if not include_custom:
            query += " AND is_custom = FALSE"
        query += " ORDER BY is_custom ASC, name ASC"
        
        return db.execute_query(query)
    
    @staticmethod
    def get_by_category_id(category_id: str) -> Optional[Dict[str, Any]]:
        """Get category by category_id"""
        db = get_db()
        query = """
            SELECT id, category_id, name, icon_name, is_custom
            FROM categories
            WHERE category_id = %s AND is_active = TRUE
        """
        results = db.execute_query(query, (category_id,))
        return results[0] if results else None
    
    @staticmethod
    def create(category_id: str, name: str, icon_name: str = 'NewspaperIcon', 
               created_by: Optional[int] = None) -> Optional[int]:
        """Create a new custom category"""
        db = get_db()
        try:
            query = """
                INSERT INTO categories (category_id, name, icon_name, is_custom, created_by)
                VALUES (%s, %s, %s, TRUE, %s)
            """
            cat_id = db.execute_update(query, (category_id, name, icon_name, created_by))
            logger.info(f"Category created: {name}")
            return cat_id
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            return None


class NewsSource:
    """News source model"""
    
    @staticmethod
    def get_by_category(category_id: str) -> List[Dict[str, Any]]:
        """Get all active sources for a category"""
        db = get_db()
        query = """
            SELECT ns.id, ns.source_url, ns.source_name, ns.source_type, 
                   ns.reliability_score, ns.last_checked
            FROM news_sources ns
            JOIN categories c ON ns.category_id = c.id
            WHERE c.category_id = %s AND ns.is_active = TRUE
            ORDER BY ns.reliability_score DESC, ns.source_name ASC
        """
        return db.execute_query(query, (category_id,))
    
    @staticmethod
    def add_source(category_id: str, source_url: str, source_name: Optional[str] = None,
                   source_type: str = 'web', reliability_score: float = 0.80) -> Optional[int]:
        """Add a new source to a category"""
        db = get_db()
        try:
            # Get category database ID
            category = Category.get_by_category_id(category_id)
            if not category:
                return None
            
            query = """
                INSERT INTO news_sources 
                (category_id, source_url, source_name, source_type, reliability_score)
                VALUES (%s, %s, %s, %s, %s)
            """
            source_id = db.execute_update(
                query, 
                (category['id'], source_url, source_name, source_type, reliability_score)
            )
            logger.info(f"Source added: {source_url} to category {category_id}")
            return source_id
        except Exception as e:
            logger.error(f"Error adding source: {e}")
            return None
    
    @staticmethod
    def get_urls_grouped_by_category() -> Dict[str, List[str]]:
        """Get all active source URLs grouped by category_id (single query)"""
        db = get_db()
        query = """
            SELECT c.category_id, ns.source_url
            FROM news_sources ns
            JOIN categories c ON ns.category_id = c.id
            WHERE ns.is_active = TRUE AND c.is_active = TRUE
            ORDER BY ns.reliability_score DESC, ns.source_name ASC
        """
        grouped: Dict[str, List[str]] = {}
        for row in db.execute_query(query):
            grouped.setdefault(row['category_id'], []).append(row['source_url'])
        return grouped

    @staticmethod
    def get_objects_grouped_by_category() -> Dict[str, List[Dict[str, Any]]]:
        """Get active sources (id, url, name) grouped by category_id (single query)"""
        db = get_db()
        query = """
            SELECT c.category_id, ns.id, ns.source_url, ns.source_name
            FROM news_sources ns
            JOIN categories c ON ns.category_id = c.id
            WHERE ns.is_active = TRUE AND c.is_active = TRUE
            ORDER BY ns.reliability_score DESC, ns.source_name ASC
        """
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for row in db.execute_query(query):
            grouped.setdefault(row['category_id'], []).append({
                'id': row['id'],
                'url': row['source_url'],
                'name': row['source_name'] or row['source_url'],
            })
        return grouped

    @staticmethod
    def deactivate(source_id: int) -> bool:
        """Soft-delete a source by setting is_active = FALSE"""
        db = get_db()
        try:
            db.execute_update(
                "UPDATE news_sources SET is_active = FALSE WHERE id = %s",
                (source_id,)
            )
            logger.info(f"Source deactivated: id={source_id}")
            return True
        except Exception as e:
            logger.error(f"Error deactivating source {source_id}: {e}")
            return False

    @staticmethod
    def update_last_checked(source_id: int):
        """Update last checked timestamp for a source"""
        db = get_db()
        query = "UPDATE news_sources SET last_checked = NOW() WHERE id = %s"
        db.execute_update(query, (source_id,))


class Job:
    """Job/Report model"""

    @staticmethod
    def decode_list(value: Optional[str]) -> List[str]:
        """
        Decode a stored list column. New rows are JSON arrays; rows written
        by older versions were comma-joined strings.
        """
        if not value:
            return []
        try:
            decoded = json.loads(value)
            if isinstance(decoded, list):
                return [str(item) for item in decoded]
        except (json.JSONDecodeError, TypeError):
            pass
        return value.split(',')

    @staticmethod
    def create(job_id: str, user_id: int, category_id: str, sources_used: List[str],
               engine: Optional[str] = None) -> Optional[int]:
        """Create a new job"""
        db = get_db()
        try:
            # Get category database ID
            category = Category.get_by_category_id(category_id)
            if not category:
                return None

            query = """
                INSERT INTO jobs (job_id, user_id, category_id, status, sources_used, engine)
                VALUES (%s, %s, %s, 'Pending', %s, %s)
            """
            j_id = db.execute_update(
                query,
                (job_id, user_id, category['id'], json.dumps(sources_used), engine)
            )
            logger.info(f"Job created: {job_id}")
            return j_id
        except Exception as e:
            logger.error(f"Error creating job: {e}")
            return None
    
    @staticmethod
    def update_status(job_id: str, status: str, current_step: Optional[str] = None,
                     error_message: Optional[str] = None):
        """Update job status (error_message is preserved unless explicitly set)"""
        db = get_db()
        if error_message is not None:
            query = """
                UPDATE jobs
                SET status = %s, current_step = %s, error_message = %s
                WHERE job_id = %s
            """
            db.execute_update(query, (status, current_step, error_message, job_id))
        else:
            query = """
                UPDATE jobs
                SET status = %s, current_step = %s
                WHERE job_id = %s
            """
            db.execute_update(query, (status, current_step, job_id))

    @staticmethod
    def complete(job_id: str, report_path: str, report_name: str, agent_actions: List[str],
                 articles_count: Optional[int] = None, verified_count: Optional[int] = None,
                 articles_json: Optional[str] = None,
                 avg_confidence: Optional[float] = None,
                 engine: Optional[str] = None):
        """Mark job as complete and persist per-article results"""
        db = get_db()
        query = """
            UPDATE jobs
            SET status = 'Complete', report_path = %s, report_name = %s,
                agent_actions = %s, articles_count = %s, verified_count = %s,
                articles_json = %s, avg_confidence = %s, engine = COALESCE(%s, engine),
                completed_at = NOW()
            WHERE job_id = %s
        """
        db.execute_update(query, (
            report_path, report_name, json.dumps(agent_actions),
            articles_count, verified_count,
            articles_json, avg_confidence, engine,
            job_id,
        ))
        logger.info(f"Job completed: {job_id}")
    
    @staticmethod
    def get_by_job_id(job_id: str) -> Optional[Dict[str, Any]]:
        """Get job by job_id"""
        db = get_db()
        query = """
            SELECT j.*, c.category_id, c.name as category_name
            FROM jobs j
            JOIN categories c ON j.category_id = c.id
            WHERE j.job_id = %s
        """
        results = db.execute_query(query, (job_id,))
        return results[0] if results else None
    
    @staticmethod
    def get_user_jobs(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get jobs for a user"""
        db = get_db()
        query = """
            SELECT j.*, c.category_id, c.name as category_name
            FROM jobs j
            JOIN categories c ON j.category_id = c.id
            WHERE j.user_id = %s
            ORDER BY j.created_at DESC
            LIMIT %s
        """
        return db.execute_query(query, (user_id, limit))
    
    @staticmethod
    def get_recent_jobs(hours: int = 24, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent jobs within specified hours"""
        db = get_db()
        query = """
            SELECT j.*, c.category_id, c.name as category_name, u.email
            FROM jobs j
            JOIN categories c ON j.category_id = c.id
            JOIN users u ON j.user_id = u.id
            WHERE j.created_at >= DATE_SUB(NOW(), INTERVAL %s HOUR)
            ORDER BY j.created_at DESC
            LIMIT %s
        """
        return db.execute_query(query, (hours, limit))
