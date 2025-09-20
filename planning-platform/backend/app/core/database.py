"""
데이터베이스 연결 및 설정 모듈
"""

import psycopg2
import psycopg2.extras
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
import os
from ..core.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    """데이터베이스 연결 및 쿼리 관리자"""
    
    def __init__(self):
        self.connection_params = {
            'host': settings.DB_HOST,
            'port': settings.DB_PORT,
            'database': settings.DB_NAME,
            'user': settings.DB_USER,
            'password': settings.DB_PASSWORD
        }
    
    @contextmanager
    def get_connection(self):
        """데이터베이스 연결 컨텍스트 매니저"""
        conn = None
        try:
            conn = psycopg2.connect(**self.connection_params)
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def get_cursor(self, conn):
        """커서 컨텍스트 매니저"""
        cursor = None
        try:
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            yield cursor
        except Exception as e:
            logger.error(f"Cursor error: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
    
    async def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """SELECT 쿼리 실행"""
        with self.get_connection() as conn:
            with self.get_cursor(conn) as cursor:
                cursor.execute(query, params or ())
                return [dict(row) for row in cursor.fetchall()]
    
    async def execute_one(self, query: str, params: Optional[tuple] = None) -> Optional[Dict[str, Any]]:
        """단일 결과 SELECT 쿼리 실행"""
        with self.get_connection() as conn:
            with self.get_cursor(conn) as cursor:
                cursor.execute(query, params or ())
                row = cursor.fetchone()
                return dict(row) if row else None
    
    async def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """INSERT/UPDATE/DELETE 쿼리 실행"""
        with self.get_connection() as conn:
            with self.get_cursor(conn) as cursor:
                cursor.execute(query, params or ())
                conn.commit()
                return cursor.rowcount

# 전역 데이터베이스 매니저 인스턴스
db_manager = DatabaseManager()
