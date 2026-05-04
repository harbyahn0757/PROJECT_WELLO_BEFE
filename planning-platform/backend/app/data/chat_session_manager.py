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
            # Slack 알림 — 1개월 chat fail 사고 재발 방지 (모니터링 부재로 인지 못 함)
            # 모듈 임포트 시점에는 이벤트 루프가 없을 수 있음. Py 3.10+ 호환 방식:
            # 실행 중 루프가 있으면 ensure_future, 없으면 logger 만 (FastAPI startup 후엔 보통 루프 존재)
            try:
                import asyncio
                if getattr(settings, "slack_enabled", False) and getattr(settings, "slack_webhook_url", ""):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(_notify_redis_failure_slack(redis_url, str(e)))
                    except RuntimeError:
                        # 실행 중 루프 없음 (모듈 import 시점) — startup 이후 ChatRedis 재시도 시 알림 발화
                        print("⚠️ [ChatRedis] Slack 알림 보류 — 이벤트 루프 미존재 (startup 전)")
            except Exception:
                pass  # Slack 알림 실패가 서비스 시작을 막으면 안 됨

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
        # 24시간 TTL 설정 (재접속 시 이전 대화 유지)
        self.redis_client.expire(key, 86400)

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


async def _notify_redis_failure_slack(redis_url: str, error_message: str) -> None:
    """Redis 연결 실패 시 Slack 알림 (chat history/cache 전체 비활성)."""
    try:
        from ..services.slack_service import get_slack_service, AlertType
        slack = get_slack_service(settings.slack_webhook_url, settings.slack_channel_id)
        await slack.send_error_alert(AlertType.REDIS_FAILURE, {
            "error_type": "ChatRedis 연결 실패 — chat history/cache 전체 비활성",
            "location": "chat_session_manager.__init__",
            "error_message": f"redis_url={redis_url} / err={error_message[:200]}",
            "uuid": "system",
        })
    except Exception:
        pass


# 싱글톤 인스턴스
chat_session_manager = ChatSessionManager()
