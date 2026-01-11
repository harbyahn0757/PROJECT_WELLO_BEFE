"""
3주 생활습관 개선 RAG 파이프라인 서비스
NHIS G1EQ 문진 데이터와 지침서 RAG를 결합하여 맞춤형 개선 플랜 생성
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .rag_service import init_rag_engine, clean_html_content

logger = logging.getLogger(__name__)

class LifestyleAnalysisRequest(BaseModel):
    """생활습관 분석 요청 모델"""
    uuid: str
    hospital_id: str
    patient_name: str
    age: int
    gender: str  # 'M', 'F'
    # G1EQ 기반 핵심 항목
    bmi: Optional[float] = None
    smoking_status: Optional[int] = None  # 1: 흡연, 2: 금연중, 3: 비흡연
    drinking_freq: Optional[int] = None   # 음주 빈도 코드
    exercise_freq: Optional[Dict[str, int]] = None # {'vigorous': days, 'moderate': days, 'walking': days}
    chronic_diseases: Optional[List[str]] = None # ['고혈압', '당뇨병' 등]
    concerns: Optional[List[str]] = None # ['체중 감량', '금연' 등]

class ThreeWeekPlan(BaseModel):
    """3주 개선 플랜 응답 모델"""
    summary: str = Field(..., description="현재 상태 종합 분석")
    week1: Dict[str, Any] = Field(..., description="1주차: 인식 및 적응")
    week2: Dict[str, Any] = Field(..., description="2주차: 집중 실천")
    week3: Dict[str, Any] = Field(..., description="3주차: 유지 및 습관화")
    medical_basis: List[Dict[str, Any]] = Field(..., description="의학적 근거 (지침서 인용)")

class LifestyleRagService:
    """생활습관 개선 RAG 서비스 클래스"""
    
    def __init__(self):
        self.query_engine = None

    async def _ensure_engine(self):
        if not self.query_engine:
            self.query_engine = await init_rag_engine(use_local_vector_db=True)
        return self.query_engine

    def _generate_search_query(self, request: LifestyleAnalysisRequest) -> str:
        """환자 상태 기반 RAG 검색 쿼리 생성"""
        query_parts = []
        
        # 1. 신체활동 및 운동
        if request.exercise_freq:
            query_parts.append("한국인을 위한 신체활동 지침서 운동 권장량")
        
        # 2. 비만 및 BMI
        if request.bmi and request.bmi >= 25:
            query_parts.append("비만 진료지침 체중 감량 전략 및 식단")
        
        # 3. 만성질환 (고혈압, 당뇨)
        if request.chronic_diseases:
            for disease in request.chronic_diseases:
                query_parts.append(f"{disease} 환자를 위한 생활습관 개선 수칙 및 영양 가이드")
        
        # 4. 흡연/음주
        if request.smoking_status == 1:
            query_parts.append("금연 가이드라인 및 행동 요령")
        if request.drinking_freq and request.drinking_freq >= 3:
            query_parts.append("절주 가이드라인 및 건강 영향")
            
        return " \n".join(query_parts)

    async def generate_3week_plan(self, request: LifestyleAnalysisRequest) -> ThreeWeekPlan:
        """3주 생활습관 개선 플랜 생성"""
        engine = await self._ensure_engine()
        if not engine:
            raise Exception("RAG 엔진 초기화 실패")
            
        # 1. RAG 검색
        search_query = self._generate_search_query(request)
        logger.info(f"🔍 [LifestyleRAG] 검색 쿼리: {search_query}")
        
        response = await engine.aquery(search_query)
        context = str(response)
        
        # 2. 의학적 근거 추출
        evidences = []
        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                evidences.append({
                    "source": node.metadata.get('file_name', '지침서'),
                    "content": clean_html_content(node.text)[:300],
                    "score": float(node.score) if hasattr(node, 'score') else 0.0
                })

        # 3. LLM 프롬프트 생성
        prompt = f"""
당신은 'Dr. Welno'라는 전문 건강 코치입니다. 
다음 환자의 건강 데이터와 의학적 지침서(RAG Context)를 바탕으로 개인 맞춤형 '3주 생활습관 개선 플랜'을 작성하세요.

[환자 정보]
- 이름: {request.patient_name}
- 나이/성별: {request.age}세/{request.gender}
- BMI: {request.bmi}
- 생활습관: 흡연({request.smoking_status}), 음주빈도({request.drinking_freq}), 운동({request.exercise_freq})
- 기저질환: {', '.join(request.chronic_diseases or [])}
- 염려사항: {', '.join(request.concerns or [])}

[의학적 근거 (RAG Context)]
{context}

[요청 사항]
1. summary: 현재 환자의 가장 시급한 건강 문제를 지침서 근거와 함께 3줄로 요약하세요.
2. week1 (적응): 첫 번째 주에 실천할 구체적인 행동 2가지를 제안하세요.
3. week2 (집중): 두 번째 주에 강도를 높이거나 추가할 행동 2가지를 제안하세요.
4. week3 (유지): 세 번째 주에 습관으로 정착시키기 위한 팁을 제안하세요.
5. 반드시 한국어로 답변하고, 전문적이면서도 격려하는 어조를 유지하세요.
6. 결과는 반드시 JSON 형식으로 반환하세요.

[JSON 구조 예시]
{{
  "summary": "...",
  "week1": {{ "title": "...", "actions": ["...", "..."] }},
  "week2": {{ "title": "...", "actions": ["...", "..."] }},
  "week3": {{ "title": "...", "actions": ["...", "..."] }}
}}
"""
        # 4. LLM 호출 (Gemini Flash 사용)
        from ...services.gemini_service import gemini_service, GeminiRequest
        await gemini_service.initialize()
        
        gemini_request = GeminiRequest(
            prompt=prompt,
            model="gemini-3-flash-preview",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        gemini_response = await gemini_service.call_api(gemini_request)
        if not gemini_response.success:
            raise Exception(f"LLM 호출 실패: {gemini_response.error}")
            
        result_json = json.loads(gemini_response.content)
        
        return ThreeWeekPlan(
            summary=result_json.get("summary", ""),
            week1=result_json.get("week1", {}),
            week2=result_json.get("week2", {}),
            week3=result_json.get("week3", {}),
            medical_basis=evidences[:3] # 상위 3개 근거 포함
        )

lifestyle_rag_service = LifestyleRagService()
