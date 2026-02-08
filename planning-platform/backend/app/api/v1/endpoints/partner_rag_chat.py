"""
파트너 RAG 채팅 API

파트너사에서 제공하는 검진 데이터와 웰노 RAG 지식베이스를 통합하여
개인화된 건강 상담을 제공하는 API입니다.

기존 질병예측 리포트 API와 호환되는 방식을 지원합니다.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Union, List
import logging
import json

from ....services.partner_rag_chat_service import PartnerRagChatService
from ....middleware.partner_auth import verify_partner_api_key, PartnerAuthInfo
from ....utils.partner_config import get_partner_config_by_api_key
from ....utils.security_utils import (
    generate_secure_session_id, 
    log_partner_access,
    validate_session_ownership
)

logger = logging.getLogger(__name__)
router = APIRouter()

# 서비스 인스턴스
partner_rag_service = PartnerRagChatService()


class PartnerChatMessageRequest(BaseModel):
    """파트너 채팅 메시지 요청"""
    uuid: str = Field(..., description="사용자 고유 ID")
    hospital_id: str = Field(..., description="병원/파트너 ID") 
    message: str = Field(..., description="사용자 메시지")
    session_id: Optional[str] = Field(None, description="세션 ID (선택사항)")
    
    # 파트너 검진 데이터 (선택사항)
    health_data: Optional[Dict[str, Any]] = Field(None, description="파트너 제공 검진 데이터")
    patient_info: Optional[Dict[str, Any]] = Field(None, description="환자 정보")
    checkup_results: Optional[List[Dict[str, Any]]] = Field(None, description="검진 결과")


class PartnerWarmupRequest(BaseModel):
    """파트너 세션 웜업 요청"""
    uuid: str = Field(..., description="사용자 고유 ID")
    hospital_id: str = Field(..., description="병원/파트너 ID")
    health_data: Optional[Dict[str, Any]] = Field(None, description="파트너 제공 검진 데이터")
    patient_info: Optional[Dict[str, Any]] = Field(None, description="환자 정보")
    checkup_results: Optional[List[Dict[str, Any]]] = Field(None, description="검진 결과")


@router.post("/partner/warmup")
async def warmup_partner_session(
    request: PartnerWarmupRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key),
    http_request: Request = None
):
    """
    위젯 로드 시 세션 웜업 및 개인화된 인사말 생성
    """
    client_ip = http_request.client.host if http_request else "unknown"
    referer = (http_request.headers.get("referer") or http_request.headers.get("origin") or "").strip() or None if http_request else None

    # 위젯 모드 점검: 병원 ID 수신 여부 로그
    logger.info(
        f"🟢 [파트너 RAG API] 웜업 요청(위젯) partner_id={partner_info.partner_id} uuid={request.uuid} hospital_id={request.hospital_id}"
    )
    
    try:
        # 보안 세션 ID 생성
        session_id = generate_secure_session_id(
            partner_id=partner_info.partner_id,
            uuid=request.uuid,
            hospital_id=request.hospital_id
        )
        
        # 파트너 데이터 통합
        partner_health_data = request.health_data
        if not partner_health_data and (request.patient_info or request.checkup_results):
            partner_health_data = {
                "patient_info": request.patient_info,
                "checkup_results": request.checkup_results
            }
        
        # 서비스 호출 (웜업 실행)
        result = await partner_rag_service.handle_partner_warmup(
            partner_info=partner_info,
            uuid=request.uuid,
            hospital_id=request.hospital_id,
            session_id=session_id,
            partner_health_data=partner_health_data
        )
        
        # 감사 로그 (위젯 모드 점검: hospital_id 포함)
        log_partner_access(
            partner_id=partner_info.partner_id,
            action="warmup",
            session_id=session_id,
            client_ip=client_ip,
            success=True,
            additional_info={"uuid": request.uuid, "hospital_id": request.hospital_id, "referer": referer}
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "greeting": result.get("greeting"),
            "has_data": result.get("has_data", False)
        }
        
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 웜업 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class LegacyPartnerRequest(BaseModel):
    """기존 방식 호환을 위한 요청 모델"""
    api_key: str = Field(..., description="파트너 API Key")
    uuid: str = Field(..., description="사용자 고유 ID")
    hospital_id: Optional[str] = Field("partner", description="병원/파트너 ID")
    message: str = Field(..., description="사용자 메시지")
    session_id: Optional[str] = Field(None, description="세션 ID")
    
    # 검진 데이터 (다양한 형식 지원)
    data: Optional[Union[Dict[str, Any], str]] = Field(None, description="검진 데이터 (암호화 가능)")
    health_data: Optional[Dict[str, Any]] = Field(None, description="건강 데이터")
    user_info: Optional[Dict[str, Any]] = Field(None, description="사용자 정보")


@router.post("/partner/message")
async def send_partner_message(
    request: PartnerChatMessageRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key),
    http_request: Request = None
):
    """
    파트너 검진 데이터를 통합한 RAG 채팅 메시지 전송 (스트리밍 응답)
    
    Authorization 헤더 또는 X-API-Key 헤더에 파트너 API Key를 포함해야 합니다.
    """
    client_ip = http_request.client.host if http_request else "unknown"
    referer = (http_request.headers.get("referer") or http_request.headers.get("origin") or "").strip() or None if http_request else None
    
    try:
        # 보안 강화된 세션 ID 생성
        session_id = generate_secure_session_id(
            partner_id=partner_info.partner_id,
            uuid=request.uuid,
            hospital_id=request.hospital_id,
            existing_session_id=request.session_id
        )
        
        logger.info(
            f"📨 [파트너 RAG API] 메시지 요청 partner_id={partner_info.partner_id} hospital_id={request.hospital_id} msg={request.message[:50]}..."
        )
        
        # 감사 로그 기록
        log_partner_access(
            partner_id=partner_info.partner_id,
            action="send_message",
            session_id=session_id,
            client_ip=client_ip,
            success=True,
            additional_info={
                "uuid": request.uuid,
                "hospital_id": request.hospital_id,
                "has_health_data": bool(request.health_data),
                "referer": referer
            }
        )
        
        # 파트너 검진 데이터 통합
        partner_health_data = None
        if request.health_data:
            partner_health_data = request.health_data
        elif request.patient_info or request.checkup_results:
            partner_health_data = {
                "patient_info": request.patient_info,
                "checkup_results": request.checkup_results
            }
        
        # 스트리밍 응답 생성
        return StreamingResponse(
            partner_rag_service.handle_partner_message_stream(
                partner_info=partner_info,
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                message=request.message,
                session_id=session_id,
                partner_health_data=partner_health_data
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Partner-ID": partner_info.partner_id
            }
        )
    
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 메시지 처리 실패: {str(e)}")
        
        # 실패 감사 로그 기록
        log_partner_access(
            partner_id=partner_info.partner_id,
            action="send_message",
            session_id=session_id if 'session_id' in locals() else "unknown",
            client_ip=client_ip,
            success=False,
            additional_info={"error": str(e), "referer": referer}
        )
        
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/partner/message/legacy")
async def send_partner_message_legacy(request: Request):
    """
    기존 질병예측 리포트 API 방식과 호환되는 파트너 RAG 채팅 엔드포인트
    
    요청 본문에 api_key를 포함하는 방식을 지원합니다.
    """
    try:
        # 요청 본문 파싱
        body = await request.json()
        api_key = body.get('api_key')
        
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="api_key가 요청 본문에 포함되어야 합니다."
            )
        
        # API Key로 파트너 정보 조회
        partner_config = get_partner_config_by_api_key(api_key)
        if not partner_config:
            raise HTTPException(
                status_code=403,
                detail="유효하지 않은 API Key입니다."
            )
        
        partner_info = PartnerAuthInfo(
            partner_id=partner_config["partner_id"],
            partner_name=partner_config["partner_name"],
            config=partner_config["config"]
        )
        
        # 요청 데이터 추출
        uuid = body.get('uuid')
        hospital_id = body.get('hospital_id', 'partner')
        message = body.get('message')
        session_id = body.get('session_id')
        
        if not uuid or not message:
            raise HTTPException(
                status_code=400,
                detail="uuid와 message는 필수 항목입니다."
            )
        
        # 검진 데이터 추출 (다양한 형식 지원)
        partner_health_data = None
        
        # 1. health_data 필드
        if body.get('health_data'):
            partner_health_data = body['health_data']
        
        # 2. data 필드 (암호화된 데이터 포함)
        elif body.get('data'):
            data = body['data']
            if isinstance(data, str):
                # 암호화된 데이터인 경우 복호화 시도
                try:
                    from ....utils.partner_encryption import decrypt_user_data
                    decrypted_data = decrypt_user_data(data, partner_info.partner_id)
                    if decrypted_data:
                        partner_health_data = decrypted_data
                except Exception as e:
                    logger.warning(f"⚠️ [파트너 RAG API] 데이터 복호화 실패: {e}")
            else:
                partner_health_data = data
        
        # 3. user_info 등 개별 필드
        elif body.get('user_info') or body.get('checkup_results'):
            partner_health_data = {
                "user_info": body.get('user_info'),
                "checkup_results": body.get('checkup_results'),
                "medical_history": body.get('medical_history')
            }
        
        # 보안 강화된 세션 ID 생성
        session_id = generate_secure_session_id(
            partner_id=partner_info.partner_id,
            uuid=uuid,
            hospital_id=hospital_id,
            existing_session_id=session_id
        )

        # 위젯 모드 점검: 병원 ID 수신 여부 로그 (Legacy 경로)
        logger.info(
            f"📨 [파트너 RAG API Legacy] 메시지 요청 partner_id={partner_info.partner_id} hospital_id={hospital_id} msg={message[:50]}..."
        )
        
        # 스트리밍 응답 생성
        return StreamingResponse(
            partner_rag_service.handle_partner_message_stream(
                partner_info=partner_info,
                uuid=uuid,
                hospital_id=hospital_id,
                message=message,
                session_id=session_id,
                partner_health_data=partner_health_data
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Partner-ID": partner_info.partner_id
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API Legacy] 처리 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class PartnerSessionRequest(BaseModel):
    """파트너 세션 요청"""
    session_id: str = Field(..., description="세션 ID")


@router.post("/partner/session/info")
async def get_partner_session_info(
    request: PartnerSessionRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key),
    http_request: Request = None
):
    """
    파트너 세션 정보 조회 (보안 강화)
    """
    client_ip = http_request.client.host if http_request else "unknown"
    referer = (http_request.headers.get("referer") or http_request.headers.get("origin") or "").strip() or None if http_request else None
    
    try:
        session_metadata = partner_rag_service.get_partner_session_metadata(request.session_id)
        
        if not session_metadata:
            # 실패 감사 로그
            log_partner_access(
                partner_id=partner_info.partner_id,
                action="get_session_info",
                session_id=request.session_id,
                client_ip=client_ip,
                success=False,
                additional_info={"error": "session_not_found", "referer": referer}
            )
            raise HTTPException(
                status_code=404,
                detail="세션 정보를 찾을 수 없습니다."
            )
        
        # 강화된 세션 소유권 검증
        if not validate_session_ownership(session_metadata, partner_info.partner_id):
            # 권한 없음 감사 로그
            log_partner_access(
                partner_id=partner_info.partner_id,
                action="get_session_info",
                session_id=request.session_id,
                client_ip=client_ip,
                success=False,
                additional_info={"error": "unauthorized_access", "session_owner": session_metadata.get("partner_id"), "referer": referer}
            )
            raise HTTPException(
                status_code=403,
                detail="해당 세션에 접근할 권한이 없습니다."
            )
        
        # 성공 감사 로그
        log_partner_access(
            partner_id=partner_info.partner_id,
            action="get_session_info",
            session_id=request.session_id,
            client_ip=client_ip,
            success=True,
            additional_info={"referer": referer}
        )
        
        return {
            "success": True,
            "session_id": request.session_id,
            "partner_info": {
                "partner_id": partner_info.partner_id,
                "partner_name": partner_info.partner_name
            },
            "metadata": session_metadata
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 세션 정보 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partner/status")
async def get_partner_status(
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너 상태 및 설정 정보 조회
    """
    try:
        return {
            "success": True,
            "partner_info": {
                "partner_id": partner_info.partner_id,
                "partner_name": partner_info.partner_name,
                "iframe_allowed": partner_info.iframe_allowed,
                "allowed_domains": partner_info.allowed_domains
            },
            "service_status": {
                "rag_service": "available",
                "redis_connected": partner_rag_service.redis_client is not None,
                "api_version": "v1"
            }
        }
    
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 상태 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 기존 엔드포인트들도 파트너 버전으로 제공
class PartnerSurveyTriggerRequest(BaseModel):
    """파트너 문진 트리거 확인 요청"""
    uuid: str
    hospital_id: str
    session_id: str


@router.post("/partner/check-survey-trigger")
async def check_partner_survey_trigger(
    request: PartnerSurveyTriggerRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너용 문진 트리거 여부 확인
    """
    try:
        # 기존 RAG 서비스의 문진 트리거 로직 활용
        should_trigger = await partner_rag_service.should_trigger_survey(
            uuid=request.uuid,
            hospital_id=request.hospital_id,
            session_id=request.session_id
        )
        
        return {
            "success": True,
            "partner_id": partner_info.partner_id,
            "should_trigger": should_trigger["should_trigger"],
            "reason": should_trigger.get("reason", ""),
            "message_count": should_trigger.get("message_count", 0)
        }
    
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 문진 트리거 확인 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class PartnerSummarizeRequest(BaseModel):
    """파트너 채팅 요약 요청"""
    uuid: str
    hospital_id: str
    session_id: Optional[str] = None


@router.post("/partner/summarize")
async def summarize_partner_chat(
    request: PartnerSummarizeRequest,
    partner_info: PartnerAuthInfo = Depends(verify_partner_api_key)
):
    """
    파트너용 채팅 종료 시 요약 및 페르소나 저장
    """
    try:
        # 파트너 세션 메타데이터 포함하여 요약
        result = await partner_rag_service.summarize_and_store_persona(
            uuid=request.uuid,
            hospital_id=request.hospital_id
        )
        
        # 파트너 정보 추가
        result["partner_id"] = partner_info.partner_id
        result["partner_name"] = partner_info.partner_name
        
        return result
        
    except Exception as e:
        logger.error(f"❌ [파트너 RAG API] 요약 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))