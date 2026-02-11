"""
통합 캐시 서비스
Redis 기반 캐싱과 메모리 캐싱을 통합 관리
"""

import json
import logging
from typing import Optional, Any, Dict
from functools import wraps
import asyncio
import hashlib
from ..data.redis_manager import redis_manager

logger = logging.getLogger(__name__)


class CacheService:
    """통합 캐시 서비스"""
    
    # 캐시 TTL 설정 (초)
    CACHE_TTL = {
        "partner_config": 300,      # 5분
        "hospital_config": 180,     # 3분
        "mediarc_config": 300,      # 5분
        "default_hospital": 600,    # 10분
    }
    
    @staticmethod
    def _make_cache_key(prefix: str, *args) -> str:
        """캐시 키 생성"""
        key_parts = [str(arg) for arg in args if arg is not None]
        key_data = f"{prefix}:{':'.join(key_parts)}"
        # 긴 키는 해시로 축약
        if len(key_data) > 200:
            hash_key = hashlib.md5(key_data.encode()).hexdigest()
            return f"{prefix}:hash:{hash_key}"
        return key_data
    
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        """캐시에서 값 조회"""
        try:
            cached_value = await redis_manager.get(key)
            if cached_value:
                return json.loads(cached_value)
        except Exception as e:
            logger.warning(f"캐시 조회 실패 (key: {key}): {e}")
        return None
    
    @staticmethod
    async def set(key: str, value: Any, ttl: int = 300) -> bool:
        """캐시에 값 저장"""
        try:
            json_value = json.dumps(value, ensure_ascii=False, default=str)
            await redis_manager.setex(key, ttl, json_value)
            return True
        except Exception as e:
            logger.warning(f"캐시 저장 실패 (key: {key}): {e}")
            return False
    
    @staticmethod
    async def delete(key: str) -> bool:
        """캐시에서 값 삭제"""
        try:
            await redis_manager.delete(key)
            return True
        except Exception as e:
            logger.warning(f"캐시 삭제 실패 (key: {key}): {e}")
            return False
    
    @staticmethod
    async def invalidate_pattern(pattern: str) -> int:
        """패턴에 맞는 캐시 키들 무효화"""
        try:
            keys = await redis_manager.keys(pattern)
            if keys:
                await redis_manager.delete(*keys)
                logger.info(f"캐시 무효화 완료: {len(keys)}개 키 삭제 (패턴: {pattern})")
                return len(keys)
        except Exception as e:
            logger.warning(f"캐시 패턴 무효화 실패 (패턴: {pattern}): {e}")
        return 0
    
    @classmethod
    async def get_partner_config(cls, partner_id: str) -> Optional[Dict[str, Any]]:
        """파트너 설정 캐시 조회"""
        key = cls._make_cache_key("partner_config", partner_id)
        return await cls.get(key)
    
    @classmethod
    async def set_partner_config(cls, partner_id: str, config: Dict[str, Any]) -> bool:
        """파트너 설정 캐시 저장"""
        key = cls._make_cache_key("partner_config", partner_id)
        return await cls.set(key, config, cls.CACHE_TTL["partner_config"])
    
    @classmethod
    async def get_hospital_config(cls, partner_id: str, hospital_id: str) -> Optional[Dict[str, Any]]:
        """병원 설정 캐시 조회"""
        key = cls._make_cache_key("hospital_config", partner_id, hospital_id)
        return await cls.get(key)
    
    @classmethod
    async def set_hospital_config(cls, partner_id: str, hospital_id: str, config: Dict[str, Any]) -> bool:
        """병원 설정 캐시 저장"""
        key = cls._make_cache_key("hospital_config", partner_id, hospital_id)
        return await cls.set(key, config, cls.CACHE_TTL["hospital_config"])
    
    @classmethod
    async def invalidate_partner_cache(cls, partner_id: str) -> int:
        """특정 파트너의 모든 캐시 무효화"""
        patterns = [
            f"partner_config:{partner_id}*",
            f"hospital_config:{partner_id}*",
            f"mediarc_config:{partner_id}*",
            f"default_hospital:{partner_id}*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += await cls.invalidate_pattern(pattern)
        
        return total_deleted


def cached_async(cache_type: str, ttl: Optional[int] = None):
    """비동기 함수용 캐시 데코레이터"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 캐시 키 생성
            cache_key = CacheService._make_cache_key(
                f"{cache_type}:{func.__name__}",
                *args,
                *[f"{k}={v}" for k, v in sorted(kwargs.items())]
            )
            
            # 캐시에서 조회
            cached_result = await CacheService.get(cache_key)
            if cached_result is not None:
                logger.debug(f"캐시 히트: {cache_key}")
                return cached_result
            
            # 함수 실행
            result = await func(*args, **kwargs)
            
            # 결과 캐시 저장
            cache_ttl = ttl or CacheService.CACHE_TTL.get(cache_type, 300)
            await CacheService.set(cache_key, result, cache_ttl)
            logger.debug(f"캐시 저장: {cache_key}")
            
            return result
        return wrapper
    return decorator