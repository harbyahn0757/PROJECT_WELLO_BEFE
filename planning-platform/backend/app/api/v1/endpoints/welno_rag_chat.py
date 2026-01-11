"""
웰노 RAG 채팅 API
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from ....services.welno_rag_chat_service import WelnoRagChatService

logger = logging.getLogger(__name__)
router = APIRouter()

# 서비스 인스턴스
rag_chat_service = WelnoRagChatService()


class ChatMessageRequest(BaseModel):
    uuid: str
    hospital_id: str
    message: str
    session_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    success: bool
    answer: str
    sources: list
    session_id: str
    message_count: int
    trigger_survey: bool
    error: Optional[str] = None


@router.post("/message")
async def send_message(request: ChatMessageRequest):
    """
    사용자 메시지 전송 및 RAG 응답 스트리밍 생성
    """
    try:
        session_id = request.session_id or f"{request.uuid}_{request.hospital_id}_{int(__import__('time').time())}"
        
        return StreamingResponse(
            rag_chat_service.handle_user_message_stream(
                uuid=request.uuid,
                hospital_id=request.hospital_id,
                message=request.message,
                session_id=session_id
            ),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        logger.error(f"❌ [RAG 채팅] 메시지 처리 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SurveyTriggerCheckRequest(BaseModel):
    uuid: str
    hospital_id: str
    session_id: str


@router.post("/check-survey-trigger")
async def check_survey_trigger(request: SurveyTriggerCheckRequest):
    """
    문진 트리거 여부 확인
    """
    try:
        should_trigger = await rag_chat_service.should_trigger_survey(
            uuid=request.uuid,
            hospital_id=request.hospital_id,
            session_id=request.session_id
        )
        
        return {
            "success": True,
            "should_trigger": should_trigger["should_trigger"],
            "reason": should_trigger.get("reason", ""),
            "message_count": should_trigger.get("message_count", 0)
        }
    
    except Exception as e:
        logger.error(f"❌ [RAG 채팅] 문진 트리거 확인 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SummarizeRequest(BaseModel):
    uuid: str
    hospital_id: str


@router.post("/summarize")
async def summarize_chat(request: SummarizeRequest):
    """
    채팅 종료 시 요약 및 페르소나 저장
    """
    try:
        result = await rag_chat_service.summarize_and_store_persona(
            uuid=request.uuid,
            hospital_id=request.hospital_id
        )
        return result
    except Exception as e:
        logger.error(f"❌ [RAG 채팅] 요약 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
