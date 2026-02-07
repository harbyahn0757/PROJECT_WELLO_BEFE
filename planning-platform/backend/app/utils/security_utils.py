"""
보안 관련 유틸리티 함수들

파트너 API 세션 보안, 암호화, 해시 등을 담당합니다.
"""

import hashlib
import secrets
import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def generate_secure_session_id(
    partner_id: str, 
    uuid: str, 
    hospital_id: str,
    existing_session_id: Optional[str] = None
) -> str:
    """
    보안이 강화된 세션 ID 생성
    
    Args:
        partner_id: 파트너 식별자
        uuid: 사용자 고유 ID
        hospital_id: 병원/클리닉 ID
        existing_session_id: 기존 세션 ID (있으면 그대로 사용)
        
    Returns:
        str: 예측 불가능한 보안 세션 ID
    """
    
    # 기존 세션 ID가 있으면 그대로 사용 (세션 연속성 보장)
    if existing_session_id:
        logger.debug(f"[보안] 기존 세션 ID 사용: {existing_session_id[:20]}...")
        return existing_session_id
    
    try:
        timestamp = int(time.time())
        
        # 16바이트 랜덤 솔트 생성 (128비트)
        random_salt = secrets.token_hex(16)
        
        # 예측 불가능한 해시 생성을 위한 입력 조합
        hash_input = f"{partner_id}:{uuid}:{hospital_id}:{timestamp}:{random_salt}:{secrets.token_hex(8)}"
        
        # SHA-256 해시 생성 후 앞 16자리 사용
        session_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()[:16]
        
        # 최종 세션 ID: {partner_id}_{hash}_{timestamp}
        secure_session_id = f"{partner_id}_{session_hash}_{timestamp}"
        
        logger.info(f"✅ [보안] 보안 세션 ID 생성 완료 - {partner_id}: {secure_session_id[:30]}...")
        
        return secure_session_id
        
    except Exception as e:
        logger.error(f"❌ [보안] 세션 ID 생성 실패: {e}")
        # 폴백: 기존 방식으로 생성
        fallback_session_id = f"{partner_id}_{uuid}_{hospital_id}_{int(time.time())}"
        logger.warning(f"⚠️ [보안] 폴백 세션 ID 사용: {fallback_session_id}")
        return fallback_session_id


def get_encrypted_redis_key(session_id: str, key_type: str, partner_id: str) -> str:
    """
    Redis 키를 암호화하여 직접 접근 방지
    
    Args:
        session_id: 세션 ID
        key_type: 키 타입 (metadata, data, context)
        partner_id: 파트너 ID (추가 보안)
        
    Returns:
        str: 암호화된 Redis 키
    """
    
    try:
        # 키 해시 생성을 위한 입력 조합 (랜덤 요소 제거하여 일관성 보장)
        key_input = f"{session_id}:{key_type}:{partner_id}"
        
        # SHA-256 해시 생성 후 앞 32자리 사용
        key_hash = hashlib.sha256(key_input.encode('utf-8')).hexdigest()[:32]
        
        # 암호화된 Redis 키 생성
        encrypted_key = f"welno:partner_rag_sec:{key_type}:{key_hash}"
        
        logger.debug(f"[보안] Redis 키 암호화: {key_type} -> {encrypted_key[:50]}...")
        
        return encrypted_key
        
    except Exception as e:
        logger.error(f"❌ [보안] Redis 키 암호화 실패: {e}")
        # 폴백: 기존 방식
        fallback_key = f"welno:partner_rag:{key_type}:{hashlib.md5(session_id.encode()).hexdigest()[:16]}"
        logger.warning(f"⚠️ [보안] 폴백 Redis 키 사용: {fallback_key}")
        return fallback_key


def get_partner_data_from_redis(redis_client, session_id: str, key_type: str) -> Optional[Dict[str, Any]]:
    """
    암호화된 Redis 키를 통해 파트너 데이터 조회
    
    Args:
        redis_client: Redis 클라이언트
        session_id: 세션 ID
        key_type: 키 타입 (metadata, data, context)
        
    Returns:
        Optional[Dict]: 조회된 데이터 또는 None
    """
    
    try:
        # 키 매핑을 통해 암호화된 키 조회
        mapping_key = f"welno:partner_rag:mapping:{session_id}:{key_type}"
        encrypted_key = redis_client.get(mapping_key)
        
        if not encrypted_key:
            logger.debug(f"[보안] {key_type} 키 매핑 없음: {session_id}")
            return None
        
        # 암호화된 키로 실제 데이터 조회
        data_json = redis_client.get(encrypted_key)
        
        if data_json:
            return json.loads(data_json)
            
        return None
        
    except Exception as e:
        logger.warning(f"⚠️ [보안] {key_type} 데이터 조회 실패: {e}")
        return None


def create_session_fingerprint(
    partner_id: str, 
    client_ip: str, 
    user_agent: Optional[str] = None
) -> str:
    """
    세션 지문 생성 (추가 보안 검증용)
    
    Args:
        partner_id: 파트너 ID
        client_ip: 클라이언트 IP
        user_agent: 사용자 에이전트 (선택적)
        
    Returns:
        str: 세션 지문 해시
    """
    
    try:
        fingerprint_input = f"{partner_id}:{client_ip}"
        
        if user_agent:
            # User-Agent의 주요 부분만 사용 (버전 정보 제외)
            ua_parts = user_agent.split(' ')[:3]  # 브라우저 주요 정보만
            fingerprint_input += f":{':'.join(ua_parts)}"
        
        fingerprint = hashlib.sha256(fingerprint_input.encode('utf-8')).hexdigest()[:24]
        
        logger.debug(f"[보안] 세션 지문 생성: {partner_id} -> {fingerprint[:12]}...")
        
        return fingerprint
        
    except Exception as e:
        logger.error(f"❌ [보안] 세션 지문 생성 실패: {e}")
        return hashlib.md5(f"{partner_id}:{client_ip}".encode()).hexdigest()[:16]


def log_partner_access(
    partner_id: str,
    action: str,
    session_id: str,
    client_ip: str,
    success: bool,
    additional_info: Optional[Dict[str, Any]] = None
) -> None:
    """
    파트너 API 접근 감사 로그
    
    Args:
        partner_id: 파트너 ID
        action: 수행된 액션
        session_id: 세션 ID
        client_ip: 클라이언트 IP
        success: 성공 여부
        additional_info: 추가 정보
    """
    
    try:
        # 세션 ID는 해시화하여 로깅 (개인정보 보호)
        session_hash = hashlib.sha256(session_id.encode('utf-8')).hexdigest()[:16]
        
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "partner_id": partner_id,
            "action": action,
            "session_hash": session_hash,
            "client_ip": client_ip,
            "success": success,
            "additional_info": additional_info or {}
        }
        
        # 구조화된 로그 출력
        log_message = (
            f"[AUDIT] {partner_id} | {action} | "
            f"{'SUCCESS' if success else 'FAILED'} | "
            f"{client_ip} | {session_hash}"
        )
        
        if success:
            logger.info(log_message)
        else:
            logger.warning(log_message)
            
        # TODO: 추후 별도 감사 로그 파일이나 DB에 저장
        
    except Exception as e:
        logger.error(f"❌ [보안] 감사 로그 기록 실패: {e}")


def validate_session_ownership(
    session_metadata: Dict[str, Any], 
    partner_id: str
) -> bool:
    """
    세션 소유권 검증
    
    Args:
        session_metadata: 세션 메타데이터
        partner_id: 요청한 파트너 ID
        
    Returns:
        bool: 소유권 검증 결과
    """
    
    try:
        if not session_metadata:
            logger.warning(f"[보안] 세션 메타데이터 없음 - {partner_id}")
            return False
        
        session_partner_id = session_metadata.get("partner_id")
        
        if session_partner_id != partner_id:
            logger.warning(
                f"[보안] 세션 소유권 불일치 - 요청: {partner_id}, "
                f"세션: {session_partner_id}"
            )
            return False
        
        logger.debug(f"[보안] 세션 소유권 검증 통과 - {partner_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ [보안] 세션 소유권 검증 실패: {e}")
        return False


def detect_suspicious_activity(
    partner_id: str,
    client_ip: str,
    action: str,
    session_count: int = 0,
    time_window_minutes: int = 10
) -> bool:
    """
    이상 행동 탐지 (기본 구현)
    
    Args:
        partner_id: 파트너 ID
        client_ip: 클라이언트 IP
        action: 수행된 액션
        session_count: 시간 윈도우 내 세션 수
        time_window_minutes: 시간 윈도우 (분)
        
    Returns:
        bool: 이상 행동 탐지 여부
    """
    
    try:
        # 기본 임계값 설정
        MAX_SESSIONS_PER_WINDOW = 50  # 10분당 최대 50개 세션
        
        if session_count > MAX_SESSIONS_PER_WINDOW:
            logger.warning(
                f"[보안] 이상 행동 탐지 - {partner_id} ({client_ip}): "
                f"{session_count}개 세션 ({time_window_minutes}분 내)"
            )
            return True
        
        # TODO: 추가 이상 행동 패턴 구현
        # - 동일 IP에서 여러 파트너 API 호출
        # - 비정상적인 메시지 패턴
        # - 짧은 시간 내 대량 요청
        
        return False
        
    except Exception as e:
        logger.error(f"❌ [보안] 이상 행동 탐지 실패: {e}")
        return False


# 보안 설정 상수
class SecurityConfig:
    """보안 관련 설정 상수"""
    
    # 세션 관련
    SESSION_TTL_HOURS = 24  # 세션 TTL (시간)
    SESSION_ID_MIN_LENGTH = 32  # 최소 세션 ID 길이
    
    # Redis 키 관련
    REDIS_KEY_PREFIX = "welno:partner_rag_sec"
    KEY_HASH_LENGTH = 32
    
    # Rate Limiting
    MAX_REQUESTS_PER_HOUR = 1000  # 파트너당 시간당 최대 요청
    MAX_REQUESTS_PER_MINUTE_IP = 20  # IP당 분당 최대 요청
    
    # 감사 로그
    AUDIT_LOG_RETENTION_DAYS = 90  # 감사 로그 보관 기간
    
    # 이상 탐지
    MAX_SESSIONS_PER_10MIN = 50  # 10분당 최대 세션 수
    SUSPICIOUS_IP_THRESHOLD = 100  # IP별 의심 임계값


if __name__ == "__main__":
    # 테스트 코드
    print("=== 보안 유틸리티 테스트 ===")
    
    # 세션 ID 생성 테스트
    session_id = generate_secure_session_id("test_partner", "user123", "clinic456")
    print(f"생성된 세션 ID: {session_id}")
    
    # Redis 키 암호화 테스트
    encrypted_key = get_encrypted_redis_key(session_id, "metadata", "test_partner")
    print(f"암호화된 Redis 키: {encrypted_key}")
    
    # 세션 지문 생성 테스트
    fingerprint = create_session_fingerprint("test_partner", "192.168.1.100", "Mozilla/5.0")
    print(f"세션 지문: {fingerprint}")