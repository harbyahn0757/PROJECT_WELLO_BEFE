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

logger = logging.getLogger(__name__)
router = APIRouter()

redis_manager = RedisSessionManager()
rag_chat_service = WelnoRagChatService()

@router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str) -> Dict[str, Any]:
    """
    설문조사 구조 가져오기 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )

@router.get("/surveys")
async def get_all_surveys() -> Dict[str, Any]:
    """
    모든 설문조사 목록 가져오기 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )

@router.post("/surveys/save")
async def save_survey_response(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    설문조사 중간저장 - 실제 데이터베이스 기반으로 구현 필요
    """
    raise HTTPException(
        status_code=501, 
        detail="설문조사 시스템은 실제 데이터베이스 기반으로 재구현이 필요합니다."
    )

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
    
    Input: [{"questionId": "smoking-status", "value": "current", ...}]
    Output: {"smoking": "current_smoker", ...}
    """
    survey_responses = {}
    
    # 질문 ID 매핑
    question_mapping = {
        "smoking-status": {
            "key": "smoking",
            "value_map": {
                "never": "non_smoker",
                "quit": "ex_smoker",
                "current": "current_smoker",
                "0": "non_smoker",
                "1": "current_smoker",
                "2": "ex_smoker"
            }
        },
        "drinking-frequency": {
            "key": "drinking",
            "value_map": {
                "never": "never",
                "sometimes": "monthly_1_2",
                "frequent": "weekly_3plus"
            }
        },
        "exercise-frequency": {
            "key": "exercise_frequency",
            "value_map": {
                "never": "never",
                "sometimes": "sometimes",
                "regular": "regular"
            }
        },
        "family-history": {
            "key": "family_history",
            "is_array": True,
            "value_map": {
                "cerebral": "stroke",
                "heart": "heart_disease",
                "hypertension": "hypertension",
                "diabetes": "diabetes",
                "cancer": "cancer",
                "none": "none",
                "familyCerebralHistory": "stroke",
                "familyHeartDiseaseHistory": "heart_disease",
                "familyHypertensionHistory": "hypertension",
                "familyDiabetesHistory": "diabetes",
                "familyCancerHistory": "cancer"
            }
        },
        "familyHistory": {
            "key": "family_history",
            "is_array": True,
            "value_map": {
                "familyCerebralHistory": "stroke",
                "familyHeartDiseaseHistory": "heart_disease",
                "familyHypertensionHistory": "hypertension",
                "familyDiabetesHistory": "diabetes",
                "familyCancerHistory": "cancer",
                "none": "none"
            }
        }
    }
    
    for answer in answers:
        question_id = answer.get("questionId")
        value = answer.get("value")
        
        if question_id in question_mapping:
            mapping = question_mapping[question_id]
            key = mapping["key"]
            
            if mapping.get("is_array"):
                # 배열 타입 (checkbox)
                if isinstance(value, list):
                    mapped_values = [
                        mapping["value_map"].get(v, v) for v in value
                    ]
                    survey_responses[key] = mapped_values
                else:
                    survey_responses[key] = [mapping["value_map"].get(value, value)]
            else:
                # 단일 타입 (radio, input)
                survey_responses[key] = mapping["value_map"].get(value, value)
    
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