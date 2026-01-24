"""
Database connection and management module for Neuzo
Handles MySQL database connections and operations
"""

import mysql.connector
from mysql.connector import Error, pooling
import yaml
import os
from typing import Optional, Dict, List, Any
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages MySQL database connections and operations"""
    
    def __init__(self, config_path: str = "config.yaml"):
        """Initialize database manager with configuration"""
        self.config = self._load_config(config_path)
        self.connection_pool = self._create_connection_pool()
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load database configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                return config.get('database', {})
        except Exception as e:
            logger.error(f"Error loading database config: {e}")
            # Return default configuration
            return {
                'host': 'localhost',
                'port': 3306,
                'database': 'neuzo_db',
                'user': 'root',
                'password': ''
            }
    
    def _create_connection_pool(self) -> pooling.MySQLConnectionPool:
        """Create a connection pool for better performance"""
        try:
            pool = pooling.MySQLConnectionPool(
                pool_name="neuzo_pool",
                pool_size=5,
                pool_reset_session=True,
                host=self.config.get('host', 'localhost'),
                port=self.config.get('port', 3306),
                database=self.config.get('database', 'neuzo_db'),
                user=self.config.get('user', 'root'),
                password=self.config.get('password', ''),
                autocommit=False
            )
            logger.info("Database connection pool created successfully")
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
    
    def execute_query(self, query: str, params: tuple = None, fetch: bool = True) -> Optional[List[tuple]]:
        """Execute a SELECT query and return results"""
        with self.get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(query, params or ())
                if fetch:
                    return cursor.fetchall()
                return None
            except Error as e:
                logger.error(f"Query execution error: {e}")
                raise
            finally:
                cursor.close()
    
    def execute_update(self, query: str, params: tuple = None) -> int:
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


# Singleton instance
_db_instance: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    """Get or create database manager singleton"""
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseManager()
    return _db_instance


def init_database():
    """Initialize database with schema if needed"""
    db = get_db()
    
    # Check if database is accessible
    if not db.test_connection():
        logger.error("Cannot connect to database")
        raise ConnectionError("Database connection failed")
    
    logger.info("Database initialized successfully")
    return db
