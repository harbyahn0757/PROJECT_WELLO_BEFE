"""
파트너 API Key 인증 미들웨어

파트너사의 API Key를 검증하고 Rate Limiting을 적용합니다.
"""

import time
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis

from ..utils.partner_config import get_partner_config_by_api_key
from ..core.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

# Redis 클라이언트 (Rate Limiting용)
try:
    redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
    redis_client = redis.from_url(
        redis_url,
        decode_responses=True,
        socket_timeout=3,
        socket_connect_timeout=3
    )
    redis_client.ping()
    logger.info("✅ [파트너 인증] Redis 연결 성공")
except Exception as e:
    logger.warning(f"⚠️ [파트너 인증] Redis 연결 실패: {e}")
    redis_client = None


class PartnerAuthInfo:
    """파트너 인증 정보"""
    def __init__(self, partner_id: str, partner_name: str, config: Dict[str, Any]):
        self.partner_id = partner_id
        self.partner_name = partner_name
        self.config = config
        self.api_key = config.get("api_key", "")
        self.iframe_allowed = config.get("iframe", {}).get("allowed", False)
        self.allowed_domains = config.get("iframe", {}).get("domains", [])


async def verify_partner_api_key(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> PartnerAuthInfo:
    """
    파트너 API Key 검증 미들웨어
    
    Args:
        request: FastAPI Request 객체
        credentials: HTTP Bearer 토큰 (API Key)
        
    Returns:
        PartnerAuthInfo: 검증된 파트너 정보
        
    Raises:
        HTTPException: 인증 실패 시
    """
    
    # 0. OPTIONS 요청은 인증 절차를 건너뜀 (CORS 프리플라이트 지원)
    if request.method == "OPTIONS":
        return None
    
    # 1. API Key 추출
    api_key = None
    
    # Bearer 토큰에서 추출
    if credentials and credentials.credentials:
        api_key = credentials.credentials
    
    # X-API-Key 헤더에서 추출 (대안)
    if not api_key:
        api_key = request.headers.get("X-API-Key")
    
    if not api_key:
        logger.warning(f"[파트너 인증] API Key 없음 - IP: {request.client.host}")
        raise HTTPException(
            status_code=401,
            detail="API Key가 필요합니다. Authorization 헤더 또는 X-API-Key 헤더에 포함해주세요."
        )
    
    # 2. API Key 검증
    try:
        partner_config = get_partner_config_by_api_key(api_key)
        
        if not partner_config:
            logger.warning(f"[파트너 인증] 유효하지 않은 API Key: {api_key[:10]}...")
            raise HTTPException(
                status_code=403,
                detail="유효하지 않은 API Key입니다."
            )
        
        if not partner_config.get("is_active", False):
            logger.warning(f"[파트너 인증] 비활성화된 파트너: {partner_config.get('partner_id')}")
            raise HTTPException(
                status_code=403,
                detail="비활성화된 파트너입니다."
            )
        
        partner_info = PartnerAuthInfo(
            partner_id=partner_config["partner_id"],
            partner_name=partner_config["partner_name"],
            config=partner_config["config"]
        )
        
        logger.info(f"✅ [파트너 인증] 성공 - {partner_info.partner_id} ({partner_info.partner_name})")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [파트너 인증] 검증 중 오류: {e}")
        raise HTTPException(
            status_code=500,
            detail="인증 처리 중 오류가 발생했습니다."
        )
    
    # 3. Rate Limiting 적용
    if redis_client:
        try:
            await apply_rate_limiting(partner_info.partner_id, request.client.host)
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"⚠️ [파트너 인증] Rate Limiting 처리 실패: {e}")
            # Rate Limiting 실패는 요청을 차단하지 않음
    
    # 4. 도메인 검증 (iframe 사용 시)
    referer = request.headers.get("referer")
    if referer and partner_info.allowed_domains:
        await verify_domain_whitelist(referer, partner_info.allowed_domains, partner_info.partner_id)
    
    # 5. 요청 상태에 파트너 정보 저장
    request.state.partner = partner_info
    
    return partner_info


async def apply_rate_limiting(partner_id: str, client_ip: str) -> None:
    """
    파트너별 Rate Limiting 적용
    
    Args:
        partner_id: 파트너 ID
        client_ip: 클라이언트 IP
        
    Raises:
        HTTPException: Rate Limit 초과 시
    """
    if not redis_client:
        return
    
    current_time = int(time.time())
    window_size = 3600  # 1시간
    max_requests = 1000  # 시간당 최대 요청 수
    
    # 파트너별 Rate Limiting
    partner_key = f"rate_limit:partner:{partner_id}:{current_time // window_size}"
    partner_count = redis_client.incr(partner_key)
    redis_client.expire(partner_key, window_size)
    
    if partner_count > max_requests:
        logger.warning(f"[Rate Limit] 파트너 한도 초과 - {partner_id}: {partner_count}/{max_requests}")
        raise HTTPException(
            status_code=429,
            detail=f"파트너 API 호출 한도를 초과했습니다. (시간당 {max_requests}회 제한)"
        )
    
    # IP별 Rate Limiting (추가 보안)
    ip_key = f"rate_limit:ip:{client_ip}:{current_time // 300}"  # 5분 윈도우
    ip_count = redis_client.incr(ip_key)
    redis_client.expire(ip_key, 300)
    
    if ip_count > 100:  # 5분당 100회 제한
        logger.warning(f"[Rate Limit] IP 한도 초과 - {client_ip}: {ip_count}/100")
        raise HTTPException(
            status_code=429,
            detail="IP별 API 호출 한도를 초과했습니다. (5분당 100회 제한)"
        )
    
    logger.debug(f"[Rate Limit] 통과 - {partner_id}: {partner_count}/{max_requests}, IP {client_ip}: {ip_count}/100")


async def verify_domain_whitelist(referer: str, allowed_domains: list, partner_id: str) -> None:
    """
    도메인 화이트리스트 검증
    
    Args:
        referer: 요청 출처 URL
        allowed_domains: 허용된 도메인 목록
        partner_id: 파트너 ID
        
    Raises:
        HTTPException: 허용되지 않은 도메인에서 요청 시
    """
    if not allowed_domains:
        return  # 도메인 제한 없음
    
    try:
        from urllib.parse import urlparse
        parsed_url = urlparse(referer)
        domain = parsed_url.netloc.lower()
        
        # 서브도메인 포함 검증
        domain_allowed = False
        for allowed_domain in allowed_domains:
            allowed_domain = allowed_domain.lower()
            if domain == allowed_domain or domain.endswith(f".{allowed_domain}"):
                domain_allowed = True
                break
        
        if not domain_allowed:
            logger.warning(f"[도메인 검증] 허용되지 않은 도메인 - {partner_id}: domain={domain} | referer={referer}")
            raise HTTPException(
                status_code=403,
                detail=f"허용되지 않은 도메인에서의 요청입니다: {domain}"
            )
        
        logger.debug(f"[도메인 검증] 통과 - {partner_id}: {domain}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[도메인 검증] 처리 실패 - {partner_id}: {e}")
        # 도메인 검증 실패는 요청을 차단하지 않음


# 편의 함수들
def get_partner_from_request(request: Request) -> Optional[PartnerAuthInfo]:
    """요청에서 파트너 정보 추출"""
    return getattr(request.state, 'partner', None)


# 일반 웰노 도메인 (API Key 없이 채팅 허용)
WELNO_ALLOWED_REFERER_HOSTS = ("welno.kindhabit.com", "welno.xog.co.kr")


async def verify_partner_api_key_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[PartnerAuthInfo]:
    """
    선택적 파트너 API Key 검증.
    - API Key 있으면: 파트너로 검증 후 PartnerAuthInfo 반환.
    - API Key 없으면: Referer가 welno 도메인(welno.kindhabit.com, welno.xog.co.kr)일 때만 None 반환(일반 웰노 모드), 아니면 401.
    """
    api_key = None
    if credentials and credentials.credentials:
        api_key = credentials.credentials
    if not api_key:
        api_key = request.headers.get("X-API-Key")

    if api_key:
        try:
            return await verify_partner_api_key(request, credentials)
        except HTTPException:
            raise

    # API Key 없음 → Referer가 welno 도메인일 때만 통과 (일반 웰노 채팅)
    referer = request.headers.get("referer") or request.headers.get("Referer") or ""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        host = (parsed.netloc or "").lower().split(":")[0]
        if host in WELNO_ALLOWED_REFERER_HOSTS:
            logger.info(f"[파트너 인증] API Key 없음, Welno 도메인 허용 - Referer host: {host}")
            return None
    except Exception as e:
        logger.warning(f"[파트너 인증] Referer 파싱 실패: {e}")

    logger.warning(f"[파트너 인증] API Key 없음, Welno 도메인 아님 - Referer: {referer[:80]}")
    raise HTTPException(
        status_code=401,
        detail="API Key가 필요합니다. Authorization 헤더 또는 X-API-Key 헤더에 포함해주세요."
    )