"""
Database connection and management module for Neuzo
Handles MySQL database connections and operations
"""

import logging
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from mysql.connector import Error, pooling

from config import load_config

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages MySQL database connections and operations"""

    def __init__(self):
        self.config: Dict[str, Any] = load_config().get("database", {})
        self.connection_pool = self._create_connection_pool()

    def _create_connection_pool(self) -> pooling.MySQLConnectionPool:
        """Create a connection pool for better performance"""
        pool_size = int(self.config.get("pool_size", 5))
        # mysql-connector allows at most 32 pooled connections; keep it sane
        pool_size = max(1, min(pool_size, 16))
        try:
            pool = pooling.MySQLConnectionPool(
                pool_name="neuzo_pool",
                pool_size=pool_size,
                pool_reset_session=True,
                host=self.config.get("host", "localhost"),
                port=self.config.get("port", 3306),
                database=self.config.get("database", "neuzo_db"),
                user=self.config.get("user", "root"),
                password=self.config.get("password", ""),
                autocommit=False,
            )
            logger.info("Database connection pool created (size=%d)", pool_size)
            return pool
        except Error as e:
            logger.error(f"Error creating connection pool: {e}")
            raise

    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        connection = None
        try:
            connection = self.connection_pool.get_connection()
            yield connection
        except Error as e:
            logger.error(f"Database connection error: {e}")
            if connection:
                connection.rollback()
            raise
        finally:
            if connection and connection.is_connected():
                connection.close()

    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results as dictionaries"""
        with self.get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(query, params or ())
                return cursor.fetchall()
            except Error as e:
                logger.error(f"Query execution error: {e}")
                raise
            finally:
                cursor.close()

    def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """Execute an INSERT, UPDATE, or DELETE query"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, params or ())
                conn.commit()
                return cursor.lastrowid or cursor.rowcount
            except Error as e:
                logger.error(f"Update execution error: {e}")
                conn.rollback()
                raise
            finally:
                cursor.close()

    def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """Execute multiple INSERT/UPDATE queries in batch"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.executemany(query, params_list)
                conn.commit()
                return cursor.rowcount
            except Error as e:
                logger.error(f"Batch execution error: {e}")
                conn.rollback()
                raise
            finally:
                cursor.close()

    def test_connection(self) -> bool:
        """Test database connection"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                cursor.close()
                return result is not None
        except Error as e:
            logger.error(f"Connection test failed: {e}")
            return False

    def column_exists(self, table: str, column: str) -> bool:
        """Check whether a column exists on a table in the current schema"""
        query = """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """
        rows = self.execute_query(query, (table, column))
        return bool(rows and rows[0]["cnt"])


# Singleton instance
_db_instance: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    """Get or create database manager singleton"""
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseManager()
    return _db_instance


# Idempotent migrations for databases created with an older schema.
# (table, column, ALTER statement)
_MIGRATIONS = [
    ("jobs", "articles_count",
     "ALTER TABLE jobs ADD COLUMN articles_count INT DEFAULT NULL"),
    ("jobs", "verified_count",
     "ALTER TABLE jobs ADD COLUMN verified_count INT DEFAULT NULL"),
    ("jobs", "articles_json",
     "ALTER TABLE jobs ADD COLUMN articles_json TEXT NULL"),
    ("jobs", "avg_confidence",
     "ALTER TABLE jobs ADD COLUMN avg_confidence DECIMAL(4,3) NULL"),
    ("jobs", "lens_json",
     "ALTER TABLE jobs ADD COLUMN lens_json TEXT NULL"),
    ("jobs", "engine",
     "ALTER TABLE jobs ADD COLUMN engine VARCHAR(20) NULL"),
]


def run_migrations(db: DatabaseManager):
    """Apply additive schema migrations missing from older installs"""
    for table, column, statement in _MIGRATIONS:
        try:
            if not db.column_exists(table, column):
                db.execute_update(statement)
                logger.info("Migration applied: %s.%s", table, column)
        except Error as e:
            logger.warning("Migration for %s.%s failed: %s", table, column, e)


def init_database() -> DatabaseManager:
    """Initialize database connection and apply pending migrations"""
    db = get_db()

    if not db.test_connection():
        logger.error("Cannot connect to database")
        raise ConnectionError("Database connection failed")

    run_migrations(db)
    logger.info("Database initialized successfully")
    return db
