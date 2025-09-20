"""
GPT 기반 검진 설계 서비스

OpenAI GPT API를 사용하여 환자의 기존 검진 결과를 바탕으로
맞춤형 검진을 설계합니다.
"""

import openai
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

from ..models.entities import Patient, CheckupDesign
from ..models.value_objects import CheckupItem, GPTPrompt
from ..repositories.interfaces import IPatientRepository, ICheckupDesignRepository
from ..core.config import settings
from .exceptions import PatientNotFoundError, CheckupDesignError, GPTServiceError


class CheckupDesignService:
    """GPT 기반 검진 설계 서비스"""
    
    def __init__(
        self,
        patient_repository: IPatientRepository,
        checkup_design_repository: ICheckupDesignRepository
    ):
        self._patient_repo = patient_repository
        self._design_repo = checkup_design_repository
        
        # OpenAI 클라이언트 초기화
        openai.api_key = settings.openai.api_key
        self._model = settings.openai.model
        self._max_tokens = settings.openai.max_tokens
        self._temperature = settings.openai.temperature
    
    async def design_checkup_for_patient(
        self, 
        patient_uuid: UUID,
        additional_symptoms: Optional[List[str]] = None,
        priority_areas: Optional[List[str]] = None
    ) -> CheckupDesign:
        """환자를 위한 맞춤형 검진 설계"""
        
        # 환자 정보 조회
        patient = await self._patient_repo.get_by_uuid(patient_uuid)
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {patient_uuid}")
        
        # GPT 프롬프트 생성
        prompt = self._create_checkup_design_prompt(
            patient, additional_symptoms, priority_areas
        )
        
        try:
            # GPT API 호출
            gpt_response = await self._call_gpt_api(prompt)
            
            # GPT 응답 파싱
            recommended_items, analysis, reason = self._parse_gpt_response(gpt_response)
            
            # 검진 설계 객체 생성
            design = CheckupDesign(
                patient_uuid=patient_uuid,
                recommended_items=recommended_items,
                gpt_analysis=analysis,
                recommendation_reason=reason,
                priority=self._calculate_priority(patient, recommended_items),
                estimated_cost=self._calculate_estimated_cost(recommended_items),
                expires_at=datetime.now() + timedelta(days=30)  # 30일 후 만료
            )
            
            # 저장
            return await self._design_repo.create(design)
            
        except Exception as e:
            raise CheckupDesignError(f"검진 설계 중 오류가 발생했습니다: {str(e)}")
    
    async def get_latest_design(self, patient_uuid: UUID) -> Optional[CheckupDesign]:
        """환자의 최신 검진 설계 조회"""
        return await self._design_repo.get_latest_by_patient(patient_uuid)
    
    async def get_design_history(self, patient_uuid: UUID) -> List[CheckupDesign]:
        """환자의 검진 설계 이력 조회"""
        return await self._design_repo.get_by_patient(patient_uuid)
    
    async def analyze_checkup_trends(self, patient_uuid: UUID) -> Dict[str, Any]:
        """환자의 검진 결과 추이 분석"""
        
        patient = await self._patient_repo.get_by_uuid(patient_uuid)
        if not patient:
            raise PatientNotFoundError(f"환자를 찾을 수 없습니다: {patient_uuid}")
        
        if not patient.last_checkup_results:
            return {
                "analysis": "검진 결과가 없어 추이 분석이 불가능합니다.",
                "recommendations": ["정기 건강검진을 받아보시기 바랍니다."],
                "risk_factors": []
            }
        
        # GPT를 사용한 추이 분석
        prompt = self._create_trend_analysis_prompt(patient)
        
        try:
            gpt_response = await self._call_gpt_api(prompt)
            return self._parse_trend_analysis_response(gpt_response)
            
        except Exception as e:
            raise CheckupDesignError(f"추이 분석 중 오류가 발생했습니다: {str(e)}")
    
    def _create_checkup_design_prompt(
        self, 
        patient: Patient,
        additional_symptoms: Optional[List[str]] = None,
        priority_areas: Optional[List[str]] = None
    ) -> GPTPrompt:
        """검진 설계를 위한 GPT 프롬프트 생성"""
        
        # 환자 기본 정보
        patient_info = f"""
환자 정보:
- 이름: {patient.info.name}
- 나이: {patient.info.get_age()}세
- 성별: {patient.info.gender.value}
"""
        
        # 기존 검진 결과
        checkup_history = ""
        if patient.last_checkup_results:
            checkup_history = "기존 검진 결과:\n"
            for item in patient.last_checkup_results:
                status = item.get_status_text()
                checkup_history += f"- {item.item_name}: {item.result_value} {item.unit or ''} ({status})\n"
        else:
            checkup_history = "기존 검진 결과가 없습니다."
        
        # 추가 증상
        symptoms_text = ""
        if additional_symptoms:
            symptoms_text = f"현재 증상: {', '.join(additional_symptoms)}\n"
        
        # 우선순위 영역
        priority_text = ""
        if priority_areas:
            priority_text = f"우선 검진 희망 영역: {', '.join(priority_areas)}\n"
        
        user_message = f"""
{patient_info}

{checkup_history}

{symptoms_text}
{priority_text}

위 정보를 바탕으로 다음 형식으로 맞춤형 검진을 설계해주세요:

1. 추천 검진 항목 (우선순위 순):
   - 항목명: [검진명]
   - 이유: [추천 이유]
   - 예상 비용: [비용]

2. 종합 분석:
   [환자 상태에 대한 종합적인 의학적 분석]

3. 추천 이유:
   [이 검진들을 추천하는 주요 이유]

응답은 한국어로, 의학적으로 정확하고 환자가 이해하기 쉽게 작성해주세요.
"""
        
        return GPTPrompt(
            system_message=settings.openai.checkup_system_prompt,
            user_message=user_message,
            temperature=self._temperature,
            max_tokens=self._max_tokens
        )
    
    def _create_trend_analysis_prompt(self, patient: Patient) -> GPTPrompt:
        """추이 분석을 위한 GPT 프롬프트 생성"""
        
        # 검진 결과를 시간순으로 정렬
        sorted_results = sorted(
            patient.last_checkup_results or [],
            key=lambda x: x.checkup_date or datetime.min.date()
        )
        
        results_text = ""
        for item in sorted_results:
            date_str = item.checkup_date.isoformat() if item.checkup_date else "날짜 미상"
            results_text += f"- {date_str}: {item.item_name} = {item.result_value} {item.unit or ''}\n"
        
        user_message = f"""
환자 정보:
- 나이: {patient.info.get_age()}세
- 성별: {patient.info.gender.value}

검진 결과 추이:
{results_text}

위 검진 결과의 변화 추이를 분석하고 다음 형식으로 답변해주세요:

1. 추이 분석:
   [시간에 따른 변화 분석]

2. 주의 사항:
   [주의해야 할 지표들]

3. 권장 사항:
   [향후 관리 방법]

응답은 한국어로, 의학적으로 정확하게 작성해주세요.
"""
        
        return GPTPrompt(
            system_message=settings.openai.analysis_system_prompt,
            user_message=user_message,
            temperature=0.5,  # 분석은 더 일관성 있게
            max_tokens=800
        )
    
    async def _call_gpt_api(self, prompt: GPTPrompt) -> str:
        """GPT API 호출"""
        try:
            response = await openai.ChatCompletion.acreate(
                model=self._model,
                messages=[
                    {"role": "system", "content": prompt.system_message},
                    {"role": "user", "content": prompt.user_message}
                ],
                temperature=prompt.temperature,
                max_tokens=prompt.max_tokens
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            raise GPTServiceError(f"GPT API 호출 실패: {str(e)}")
    
    def _parse_gpt_response(self, response: str) -> tuple[List[CheckupItem], str, str]:
        """GPT 응답을 파싱하여 구조화된 데이터로 변환"""
        
        # 간단한 파싱 로직 (실제로는 더 정교한 파싱 필요)
        lines = response.split('\n')
        
        recommended_items = []
        analysis = ""
        reason = ""
        
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if "추천 검진 항목" in line or "1." in line:
                current_section = "items"
            elif "종합 분석" in line or "2." in line:
                current_section = "analysis"
            elif "추천 이유" in line or "3." in line:
                current_section = "reason"
            elif current_section == "items" and "항목명:" in line:
                # 검진 항목 파싱
                item_name = line.split(":")[-1].strip()
                # 간단한 CheckupItem 생성 (실제로는 더 정교한 파싱 필요)
                item = CheckupItem(
                    checkup_type="recommended",
                    item_name=item_name,
                    description="GPT 추천 항목"
                )
                recommended_items.append(item)
            elif current_section == "analysis":
                analysis += line + " "
            elif current_section == "reason":
                reason += line + " "
        
        # 기본값 제공
        if not recommended_items:
            recommended_items = [
                CheckupItem(
                    checkup_type="basic",
                    item_name="기본 건강검진",
                    description="연례 기본 검진을 권장합니다."
                )
            ]
        
        if not analysis:
            analysis = "환자의 건강 상태를 종합적으로 검토한 결과 맞춤형 검진이 필요합니다."
        
        if not reason:
            reason = "환자의 연령과 기존 검진 결과를 고려하여 예방적 차원에서 권장드립니다."
        
        return recommended_items, analysis.strip(), reason.strip()
    
    def _parse_trend_analysis_response(self, response: str) -> Dict[str, Any]:
        """추이 분석 응답 파싱"""
        
        # 간단한 파싱 (실제로는 더 정교한 구조화 필요)
        return {
            "analysis": response,
            "recommendations": ["정기적인 추적 검사를 받으시기 바랍니다."],
            "risk_factors": ["연령에 따른 자연스러운 변화"],
            "next_checkup_date": (datetime.now() + timedelta(days=365)).date().isoformat()
        }
    
    def _calculate_priority(self, patient: Patient, items: List[CheckupItem]) -> int:
        """검진 우선순위 계산"""
        
        age = patient.info.get_age()
        
        # 나이별 우선순위
        if age >= 65:
            return 1  # 고우선순위
        elif age >= 50:
            return 2  # 중우선순위
        elif age >= 35:
            return 3  # 일반우선순위
        else:
            return 4  # 저우선순위
    
    def _calculate_estimated_cost(self, items: List[CheckupItem]) -> int:
        """예상 비용 계산"""
        
        total_cost = 0
        
        for item in items:
            if item.cost:
                total_cost += item.cost
            else:
                # 기본 비용 추정
                if "종합" in item.item_name:
                    total_cost += 200000
                elif "기본" in item.item_name:
                    total_cost += 100000
                else:
                    total_cost += 50000
        
        return total_cost

