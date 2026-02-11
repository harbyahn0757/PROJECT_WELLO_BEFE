"""
Redis 기반 웰노 채팅 세션 및 히스토리 관리
"""
import json
import redis
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from ..core.config import settings

class ChatSessionManager:
    """Redis 기반 채팅 히스토리 관리자"""
    
    def __init__(self, redis_url: str = None):
        if redis_url is None:
            redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
        
        try:
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=3,
                socket_connect_timeout=3
            )
            self.redis_client.ping()
            print(f"✅ [ChatRedis] 연결 성공: {redis_url}")
        except Exception as e:
            print(f"❌ [ChatRedis] 연결 실패: {e}")
            self.redis_client = None
    
    def _get_history_key(self, uuid: str, hospital_id: str, partner_id: str = "welno") -> str:
        """채팅 히스토리 키 생성 (파트너별 격리)"""
        return f"welno:chat:history:{partner_id}:{uuid}:{hospital_id}"
    
    def add_message(self, uuid: str, hospital_id: str, role: str, content: str, partner_id: str = "welno"):
        """메시지 추가 (JSON 리스트 형태)"""
        if not self.redis_client:
            return
        
        key = self._get_history_key(uuid, hospital_id, partner_id)
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
        
        # 리스트에 추가 (오른쪽 추가)
        self.redis_client.rpush(key, json.dumps(message, ensure_ascii=False))
        # 1시간 TTL 설정 (상담 세션 유지 시간)
        self.redis_client.expire(key, 3600)
    
    def get_history(self, uuid: str, hospital_id: str, partner_id: str = "welno") -> List[Dict[str, Any]]:
        """전체 히스토리 조회"""
        if not self.redis_client:
            return []
        
        key = self._get_history_key(uuid, hospital_id, partner_id)
        messages_json = self.redis_client.lrange(key, 0, -1)
        
        history = []
        for msg_json in messages_json:
            try:
                history.append(json.loads(msg_json))
            except:
                continue
        return history
    
    def clear_history(self, uuid: str, hospital_id: str, partner_id: str = "welno"):
        """히스토리 초기화"""
        if not self.redis_client:
            return
        key = self._get_history_key(uuid, hospital_id, partner_id)
        self.redis_client.delete(key)

# 싱글톤 인스턴스
chat_session_manager = ChatSessionManager()
