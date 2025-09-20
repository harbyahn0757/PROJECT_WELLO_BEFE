"""
설문조사 관련 API 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime
import uuid

from ....data.dummy_data import SURVEYS_DATA, SURVEY_RESPONSES_DATA

router = APIRouter()

@router.get("/surveys/{survey_id}")
async def get_survey(survey_id: str) -> Dict[str, Any]:
    """
    설문조사 구조 가져오기
    """
    if survey_id not in SURVEYS_DATA:
        raise HTTPException(
            status_code=404, 
            detail=f"Survey with id '{survey_id}' not found"
        )
    
    return {
        "success": True,
        "data": SURVEYS_DATA[survey_id],
        "message": "설문조사를 성공적으로 가져왔습니다."
    }

@router.get("/surveys")
async def get_all_surveys() -> Dict[str, Any]:
    """
    모든 설문조사 목록 가져오기
    """
    surveys_list = [
        {
            "id": survey["id"],
            "title": survey["title"], 
            "description": survey["description"]
        }
        for survey in SURVEYS_DATA.values()
    ]
    
    return {
        "success": True,
        "data": surveys_list,
        "message": "설문조사 목록을 성공적으로 가져왔습니다."
    }

@router.post("/surveys/save")
async def save_survey_response(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    설문조사 중간저장
    """
    try:
        survey_id = request.get("surveyId")
        session_id = request.get("sessionId")
        answers = request.get("answers", [])
        page_id = request.get("pageId")
        
        if not survey_id or not session_id:
            raise HTTPException(
                status_code=400,
                detail="surveyId와 sessionId는 필수입니다."
            )
        
        # 응답 데이터 저장
        response_key = f"{survey_id}_{session_id}"
        SURVEY_RESPONSES_DATA[response_key] = {
            "surveyId": survey_id,
            "sessionId": session_id,
            "currentPageId": page_id,
            "answers": answers,
            "isCompleted": False,
            "lastSavedAt": datetime.now().isoformat()
        }
        
        return {
            "success": True,
            "data": {
                "sessionId": session_id,
                "isCompleted": False
            },
            "message": "설문조사가 성공적으로 저장되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설문조사 저장 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/surveys/submit")
async def submit_survey(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    설문조사 최종 제출
    """
    try:
        survey_id = request.get("surveyId")
        session_id = request.get("sessionId")
        answers = request.get("answers", [])
        page_id = request.get("pageId")
        is_complete = request.get("isComplete", True)
        
        if not survey_id or not session_id:
            raise HTTPException(
                status_code=400,
                detail="surveyId와 sessionId는 필수입니다."
            )
        
        # 최종 응답 데이터 저장
        response_key = f"{survey_id}_{session_id}"
        SURVEY_RESPONSES_DATA[response_key] = {
            "surveyId": survey_id,
            "sessionId": session_id,
            "currentPageId": page_id,
            "answers": answers,
            "isCompleted": is_complete,
            "completedAt": datetime.now().isoformat() if is_complete else None,
            "lastSavedAt": datetime.now().isoformat()
        }
        
        return {
            "success": True,
            "data": {
                "sessionId": session_id,
                "isCompleted": is_complete
            },
            "message": "설문조사가 성공적으로 제출되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설문조사 제출 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/surveys/{survey_id}/responses/{session_id}")
async def get_survey_response(survey_id: str, session_id: str) -> Dict[str, Any]:
    """
    저장된 설문조사 응답 가져오기
    """
    response_key = f"{survey_id}_{session_id}"
    
    if response_key not in SURVEY_RESPONSES_DATA:
        raise HTTPException(
            status_code=404,
            detail="저장된 설문조사 응답을 찾을 수 없습니다."
        )
    
    return {
        "success": True,
        "data": SURVEY_RESPONSES_DATA[response_key],
        "message": "설문조사 응답을 성공적으로 가져왔습니다."
    }

@router.get("/surveys/{survey_id}/responses")
async def get_all_survey_responses(survey_id: str) -> Dict[str, Any]:
    """
    특정 설문조사의 모든 응답 가져오기 (관리자용)
    """
    responses = [
        response for key, response in SURVEY_RESPONSES_DATA.items()
        if key.startswith(f"{survey_id}_")
    ]
    
    return {
        "success": True,
        "data": responses,
        "message": f"설문조사 '{survey_id}'의 모든 응답을 가져왔습니다."
    }

@router.delete("/surveys/{survey_id}/responses/{session_id}")
async def delete_survey_response(survey_id: str, session_id: str) -> Dict[str, Any]:
    """
    설문조사 응답 삭제
    """
    response_key = f"{survey_id}_{session_id}"
    
    if response_key not in SURVEY_RESPONSES_DATA:
        raise HTTPException(
            status_code=404,
            detail="삭제할 설문조사 응답을 찾을 수 없습니다."
        )
    
    del SURVEY_RESPONSES_DATA[response_key]
    
    return {
        "success": True,
        "data": None,
        "message": "설문조사 응답이 성공적으로 삭제되었습니다."
    }
