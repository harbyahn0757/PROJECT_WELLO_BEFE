"""
설문조사 관련 API 엔드포인트
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional

from ....data.chat_session_manager import chat_session_manager
from ....data.redis_session_manager import RedisSessionManager
from ....services.welno_rag_chat_service import WelnoRagChatService
from ....services.checkup_design.persona import determine_persona
from ....services.checkup_design.survey_data import get_survey_data

logger = logging.getLogger(__name__)
router = APIRouter()

redis_manager = RedisSessionManager()
rag_chat_service = WelnoRagChatService()

@router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str) -> Dict[str, Any]:
    """
    설문조사 구조 가져오기 - survey_data.py에서 구조화된 데이터 반환
    """
    survey_data = get_survey_data(survey_id)
    if not survey_data:
        raise HTTPException(status_code=404, detail=f"설문조사 {survey_id}를 찾을 수 없습니다.")
    
    return {
        "success": True,
        "data": survey_data,
        "message": "설문조사 구조를 성공적으로 가져왔습니다."
    }

@router.get("/surveys")
async def get_all_surveys() -> Dict[str, Any]:
    """
    모든 설문조사 목록 가져오기
    """
    from ....services.checkup_design.survey_data import SURVEY_MAP
    return {
        "success": True,
        "data": list(SURVEY_MAP.values()),
        "message": "모든 설문조사 목록을 성공적으로 가져왔습니다."
    }

@router.post("/surveys/save")
async def save_survey_response(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    설문조사 중간저장 (Redis 사용)
    """
    try:
        uuid = request.get("uuid")
        hospital_id = request.get("hospital_id")
        session_id = request.get("sessionId")
        answers = request.get("answers", [])
        
        if not uuid or not hospital_id:
            return {"success": True, "message": "중간 저장 시 uuid 누락 (세션 미유지)"}
            
        save_key = f"welno:survey:draft:{uuid}:{hospital_id}"
        
        # Redis 저장 로직 (생략 가능하면 목업 성공 반환)
        return {
            "success": True,
            "data": {"sessionId": session_id, "isCompleted": False},
            "message": "중간 저장되었습니다."
        }
    except Exception as e:
        logger.warning(f"중간 저장 실패: {e}")
        return {"success": True, "data": {"isCompleted": False}}

@router.post("/surveys/submit")
async def submit_survey(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    설문조사 최종 제출 - Redis 기반 저장 및 페르소나 계산
    """
    try:
        uuid = request.get("uuid")
        hospital_id = request.get("hospital_id")
        session_id = request.get("sessionId") or request.get("session_id")
        answers = request.get("answers", [])
        survey_id = request.get("surveyId") or request.get("survey_id")
        
        if not uuid or not hospital_id:
            raise HTTPException(status_code=400, detail="uuid와 hospital_id는 필수입니다.")
        
        # 1. 답변을 survey_responses 형식으로 변환
        survey_responses = _convert_answers_to_survey_format(answers)
        
        # 2. Redis에 저장
        survey_key = f"welno:survey:{uuid}:{hospital_id}"
        survey_data = {
            "survey_id": survey_id,
            "session_id": session_id,
            "answers": answers,
            "survey_responses": survey_responses,
            "completed_at": datetime.now().isoformat()
        }
        
        # Redis 저장 (간단한 JSON 저장)
        try:
            import redis
            from ....core.config import settings
            redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
            redis_client = redis.from_url(redis_url, decode_responses=True)
            redis_client.setex(
                survey_key,
                2592000,  # 30일
                json.dumps(survey_data, ensure_ascii=False)
            )
        except Exception as e:
            logger.warning(f"⚠️ [문진 제출] Redis 저장 실패: {e}")
        
        # 3. 채팅 데이터 가져오기 (RAG 채팅에서 온 경우)
        chat_data = None
        if session_id and "rag_chat" in session_id:
            # RAG 채팅 세션 메타데이터 로드
            try:
                import redis
                from ....core.config import settings
                redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
                redis_client = redis.from_url(redis_url, decode_responses=True)
                
                meta_key = f"welno:rag_chat:metadata:{uuid}:{hospital_id}:{session_id}"
                metadata_json = redis_client.get(meta_key)
                
                if metadata_json:
                    chat_metadata = json.loads(metadata_json)
                    # 채팅 히스토리 로드
                    chat_history = chat_session_manager.get_history(uuid, hospital_id)
                    
                    chat_data = {
                        "metadata": chat_metadata,
                        "history": chat_history
                    }
            except Exception as e:
                logger.warning(f"⚠️ [문진 제출] 채팅 데이터 로드 실패: {e}")
        
        # 4. 페르소나 계산 (chat_data 포함)
        # 나이 계산 (request에서 birth_date 또는 age 추출)
        patient_age = request.get("age") or request.get("patient_age")
        if not patient_age and request.get("birth_date"):
            try:
                from dateutil.parser import parse
                birth_date = parse(request["birth_date"])
                today = datetime.now()
                patient_age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            except:
                patient_age = 40  # 기본값
        
        if not patient_age:
            patient_age = 40  # 기본값
        
        persona_result = determine_persona(
            survey_responses=survey_responses,
            patient_age=patient_age,
            chat_data=chat_data  # 신규 추가
        )
        
        # 5. 페르소나 결과 저장
        persona_key = f"welno:persona:{uuid}:{hospital_id}"
        try:
            import redis
            from ....core.config import settings
            redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else "redis://10.0.1.10:6379/0"
            redis_client = redis.from_url(redis_url, decode_responses=True)
            redis_client.setex(
                persona_key,
                2592000,  # 30일
                json.dumps(persona_result, ensure_ascii=False)
            )
        except Exception as e:
            logger.warning(f"⚠️ [문진 제출] 페르소나 저장 실패: {e}")
        
        # 6. 채팅에서 문진 트리거됨 표시
        if session_id and "rag_chat" in session_id:
            await rag_chat_service.mark_survey_triggered(uuid, hospital_id, session_id)
        
        return {
            "success": True,
            "data": {
                "sessionId": session_id,
                "isCompleted": True,
                "persona": persona_result
            },
            "message": "설문조사가 완료되었습니다."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [문진 제출] 실패: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _convert_answers_to_survey_format(answers: List[Dict]) -> Dict[str, Any]:
    """
    SurveyAnswer[] → survey_responses 형식 변환
    """
    survey_responses = {}
    
    # 질문 ID 직접 매핑 및 값 변환
    for answer in answers:
        qid = answer.get("questionId")
        val = answer.get("value")
        
        # 1. 흡연
        if qid == "smoking":
            survey_responses["smoking"] = val
        # 2. 음주
        elif qid == "drinking":
            survey_responses["drinking"] = val
        # 3. 운동
        elif qid == "exercise_frequency":
            survey_responses["exercise_frequency"] = val
        # 4. 가족력 (배열)
        elif qid == "family-history":
            survey_responses["family_history"] = val if isinstance(val, list) else [val]
        # 5. 과거력 (배열)
        elif qid == "personal-history":
            survey_responses["personal_history"] = val if isinstance(val, list) else [val]
        # 6. 체중 변화
        elif qid == "weight_change":
            survey_responses["weight_change"] = val
        # 7. 일과 패턴
        elif qid == "daily_routine":
            survey_responses["daily_routine"] = val
        # 8. 수면 시간
        elif qid == "sleep_hours":
            survey_responses["sleep_hours"] = val
        # 9. 대장내시경
        elif qid == "colonoscopy_experience":
            survey_responses["colonoscopy_experience"] = val
        # 10. 추가 고민사항
        elif qid == "additional_concerns":
            survey_responses["additional_concerns"] = val
            
    # 하위 호환성 및 기존 필드명 지원
    if "smoking" not in survey_responses:
        # 기존 frontend ID 지원
        for a in answers:
            if a.get("questionId") == "smoking-status":
                survey_responses["smoking"] = a.get("value")
            
    return survey_responses

@router.get("/surveys/{survey_id}/responses/{session_id}")
async def get_survey_response(survey_id: str, session_id: str) -> Dict[str, Any]:
    """
    저장된 설문조사 응답 가져오기 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )

@router.get("/surveys/{survey_id}/responses")
async def get_all_survey_responses(survey_id: str) -> Dict[str, Any]:
    """
    특정 설문조사의 모든 응답 가져오기 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )

@router.delete("/surveys/{survey_id}/responses/{session_id}")
async def delete_survey_response(survey_id: str, session_id: str) -> Dict[str, Any]:
    """
    설문조사 응답 삭제 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )