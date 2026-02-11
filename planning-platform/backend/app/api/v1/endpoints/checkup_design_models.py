"""
검진 설계 관련 Pydantic 모델들
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ConcernItem(BaseModel):
    """염려 항목 모델"""
    type: str = Field(..., description="염려 타입 (checkup, prescription, family_history)")
    id: str = Field(..., description="염려 항목 ID")
    name: Optional[str] = Field(None, description="검진 항목명 (checkup 타입인 경우)")
    date: Optional[str] = Field(None, description="검진 날짜 (checkup 타입인 경우)")
    value: Optional[float] = Field(None, description="검진 수치 (checkup 타입인 경우)")
    unit: Optional[str] = Field(None, description="단위 (checkup 타입인 경우)")
    status: Optional[str] = Field(None, description="상태 (checkup 타입인 경우)")
    medication_name: Optional[str] = Field(None, description="약품명 (prescription 타입인 경우)")
    condition: Optional[str] = Field(None, description="질환명 (family_history 타입인 경우)")
    relation: Optional[str] = Field(None, description="관계 (family_history 타입인 경우)")


class CheckupDesignRequest(BaseModel):
    """검진 설계 요청 모델 (GPT 기반)"""
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")
    partner_id: str = Field("welno", description="파트너 ID")  # 파트너 ID 추가
    selected_concerns: List[ConcernItem] = Field(..., description="선택한 염려 항목 리스트")
    survey_responses: Optional[Dict[str, Any]] = Field(None, description="설문 응답 (체중 변화, 운동, 가족력 등)")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="추가 정보")
    # 약품 분석 결과 텍스트 (전체 처방 데이터 대신 사용)
    prescription_analysis_text: Optional[str] = Field(None, description="약품 분석 결과 텍스트 (프롬프트용)")
    selected_medication_texts: Optional[List[str]] = Field(None, description="선택된 약품의 사용자 친화적 텍스트 (프롬프트용)")
    events: Optional[List[Dict[str, Any]]] = Field(None, description="사용자 행동 로그 (체류 시간, 클릭 등)") # 추가
    session_id: Optional[str] = Field(None, description="세션 ID (WebSocket 알림용)")


class CheckupDesignResponse(BaseModel):
    """검진 설계 응답 모델"""
    success: bool = Field(..., description="성공 여부")
    data: Optional[Dict[str, Any]] = Field(None, description="응답 데이터")
    error: Optional[str] = Field(None, description="오류 메시지")


class Step1Result(BaseModel):
    """STEP 1 결과 모델"""
    patient_summary: str = Field(..., description="환자 요약")
    analysis: str = Field(..., description="분석 결과")
    survey_reflection: str = Field(..., description="설문 반영")
    selected_concerns_analysis: str = Field(..., description="선택 염려 분석")
    basic_checkup_guide: str = Field(..., description="기본 검진 안내")
    session_id: Optional[str] = Field(None, description="세션 ID")


class CheckupDesignStep2Request(BaseModel):
    """STEP 2 요청 모델"""
    uuid: str = Field(..., description="환자 UUID")
    hospital_id: str = Field(..., description="병원 ID")
    partner_id: str = Field("welno", description="파트너 ID")
    step1_result: Step1Result = Field(..., description="STEP 1 결과")
    selected_concerns: List[ConcernItem] = Field(..., description="선택한 염려 항목 리스트")
    survey_responses: Optional[Dict[str, Any]] = Field(None, description="설문 응답")
    prescription_analysis_text: Optional[str] = Field(None, description="약품 분석 결과 텍스트")
    selected_medication_texts: Optional[List[str]] = Field(None, description="선택된 약품 텍스트")
    session_id: Optional[str] = Field(None, description="세션 ID")


class TrendAnalysisResponse(BaseModel):
    """트렌드 분석 응답 모델"""
    success: bool = Field(..., description="성공 여부")
    trends: Optional[List[Dict[str, Any]]] = Field(None, description="트렌드 데이터")
    insights: Optional[str] = Field(None, description="인사이트")
    error: Optional[str] = Field(None, description="오류 메시지")