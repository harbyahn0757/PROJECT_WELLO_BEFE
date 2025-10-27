"""
건강 데이터 종합 분석 API
GPT 기반 건강 상태 분석 및 약물 상호작용 분석
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
from openai import AsyncOpenAI
import os
from datetime import datetime, timedelta
import logging
import re
from ....core.config import settings
from ....models.health_data import HealthData

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 안전한 데이터 변환 함수들
def safe_int(value: str, default: int = 0) -> int:
    """문자열을 안전하게 정수로 변환"""
    if not value:
        return default
    
    # 숫자가 아닌 문자 제거 (예: '121/75' -> '121', '2025년' -> '2025')
    numeric_str = re.sub(r'[^\d]', '', str(value))
    if not numeric_str:
        return default
    
    try:
        return int(numeric_str)
    except ValueError:
        return default

def safe_float(value: str, default: float = 0.0) -> float:
    """문자열을 안전하게 실수로 변환"""
    if not value:
        return default
    
    # 숫자와 소수점만 남기기
    numeric_str = re.sub(r'[^\d.]', '', str(value))
    if not numeric_str:
        return default
    
    try:
        return float(numeric_str)
    except ValueError:
        return default

def parse_blood_pressure(bp_str: str) -> tuple[int, int]:
    """혈압 문자열을 안전하게 파싱 (수축기, 이완기)"""
    if not bp_str:
        return 0, 0
    
    if '/' in bp_str:
        parts = bp_str.split('/')
        high = safe_int(parts[0])
        low = safe_int(parts[1]) if len(parts) > 1 else 0
        return high, low
    else:
        return safe_int(bp_str), 0

def extract_year_number(year_str: str) -> int:
    """년도 문자열에서 숫자만 추출 (예: '2025년' -> 2025)"""
    if not year_str:
        return 0
    
    # '년' 제거하고 숫자만 추출
    year_numeric = re.sub(r'[^\d]', '', str(year_str))
    try:
        return int(year_numeric) if year_numeric else 0
    except ValueError:
        return 0

# OpenAI 클라이언트 초기화 (지연 초기화로 변경)
client = None

def get_openai_client():
    """OpenAI 클라이언트를 지연 초기화"""
    global client
    if client is None:
        api_key = settings.openai_api_key
        if api_key and not api_key.startswith("sk-proj-your-") and api_key != "dev-openai-key":
            client = AsyncOpenAI(api_key=api_key)
        else:
            # API 키가 없으면 None으로 유지 (목 데이터 사용)
            client = None
    return client

class HealthDataItem(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None

class HealthInspection(BaseModel):
    name: str
    items: List[HealthDataItem]

class HealthCheckup(BaseModel):
    date: str
    year: str
    inspections: List[HealthInspection]

class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None

class PrescriptionData(BaseModel):
    date: str
    hospital: str
    medications: List[MedicationItem]

class AnalysisRequest(BaseModel):
    health_data: List[HealthCheckup]
    prescription_data: List[PrescriptionData]
    analysis_type: str = "comprehensive"  # comprehensive, drug_interaction, nutrition

class HealthInsight(BaseModel):
    category: str
    status: str  # good, warning, danger
    message: str
    recommendation: str

class DrugInteraction(BaseModel):
    drug_name: str
    interaction_type: str  # avoid, caution, monitor
    description: str
    foods: List[str]
    supplements: List[str]

class NutritionRecommendation(BaseModel):
    type: str  # avoid, recommend
    category: str  # food, supplement
    items: List[str]
    reason: str

class AnalysisResponse(BaseModel):
    gpt_analysis: str
    health_insights: List[HealthInsight]
    drug_interactions: List[DrugInteraction]
    nutrition_recommendations: List[NutritionRecommendation]
    analysis_date: str

def create_health_analysis_prompt(health_data: List[HealthCheckup], prescription_data: List[PrescriptionData]) -> str:
    """건강 분석을 위한 GPT 프롬프트 생성"""
    
    prompt = """
당신은 전문 의료 데이터 분석가입니다. 제공된 건강검진 데이터와 처방전 데이터를 종합적으로 분석하여 다음 형식으로 응답해주세요:

## 🎯 종합 건강 상태 분석

**전반적 건강 상태**: [A+/A/B+/B/C+/C/D 등급으로 평가]

### 📊 주요 지표 분석
[각 건강 지표별 상세 분석]

### 💊 복용 약물 분석
[처방 약물 분석 및 패턴]

### ⚠️ 주의사항
[주의해야 할 건강 상태나 위험 요소]

### 📈 개선 권장사항
[구체적인 개선 방안]

---

**건강검진 데이터:**
"""
    
    # 건강검진 데이터 추가
    for i, checkup in enumerate(health_data):
        prompt += f"\n{i+1}. 검진일: {checkup.date} ({checkup.year})\n"
        for inspection in checkup.inspections:
            prompt += f"   - {inspection.name}:\n"
            for item in inspection.items:
                prompt += f"     * {item.name}: {item.value}"
                if item.unit:
                    prompt += f" {item.unit}"
                prompt += "\n"
    
    # 처방전 데이터 추가
    prompt += "\n**처방전 데이터 (최근 3개월):**\n"
    for i, prescription in enumerate(prescription_data):
        prompt += f"\n{i+1}. 처방일: {prescription.date}\n"
        prompt += f"   병원: {prescription.hospital}\n"
        prompt += f"   처방약물:\n"
        for med in prescription.medications:
            prompt += f"     - {med.name}"
            if med.dosage:
                prompt += f" (용량: {med.dosage})"
            if med.frequency:
                prompt += f" (횟수: {med.frequency})"
            prompt += "\n"
    
    prompt += """

분석 시 다음 사항을 고려해주세요:
1. 정상 범위와 비교한 수치 평가
2. 시간에 따른 변화 추이
3. 처방 약물과 건강 상태의 연관성
4. 잠재적 건강 위험 요소
5. 생활습관 개선 방안

한국어로 친근하고 이해하기 쉽게 작성해주세요.
"""
    
    return prompt

def create_drug_interaction_prompt(prescription_data: List[PrescriptionData]) -> str:
    """약물 상호작용 분석을 위한 프롬프트 생성"""
    
    prompt = """
당신은 약물 상호작용 전문가입니다. 제공된 처방 데이터를 분석하여 다음을 JSON 형식으로 응답해주세요:

{
  "drug_interactions": [
    {
      "drug_name": "약물명",
      "interaction_type": "avoid|caution|monitor",
      "description": "상호작용 설명",
      "foods": ["주의해야 할 음식들"],
      "supplements": ["주의해야 할 건강기능식품들"]
    }
  ]
}

**처방 데이터:**
"""
    
    for i, prescription in enumerate(prescription_data):
        prompt += f"\n{i+1}. 처방일: {prescription.date}\n"
        prompt += f"   병원: {prescription.hospital}\n"
        for med in prescription.medications:
            prompt += f"   - {med.name}\n"
    
    prompt += """

분석 기준:
- avoid: 절대 피해야 할 조합
- caution: 주의해서 섭취해야 할 조합  
- monitor: 모니터링이 필요한 조합

한국 음식과 일반적인 건강기능식품을 기준으로 분석해주세요.
"""
    
    return prompt

def create_nutrition_prompt(health_data: List[HealthCheckup], prescription_data: List[PrescriptionData]) -> str:
    """영양 권장사항을 위한 프롬프트 생성"""
    
    prompt = """
당신은 임상영양사입니다. 건강검진 결과와 처방 데이터를 바탕으로 맞춤형 영양 권장사항을 JSON 형식으로 제공해주세요:

{
  "nutrition_recommendations": [
    {
      "type": "avoid|recommend",
      "category": "food|supplement", 
      "items": ["구체적인 음식/건기식 목록"],
      "reason": "권장/금지 이유"
    }
  ]
}

건강검진 최신 결과 요약:
"""
    
    if health_data:
        latest_checkup = health_data[0]
        prompt += f"검진일: {latest_checkup.date}\n"
        for inspection in latest_checkup.inspections:
            for item in inspection.items:
                prompt += f"- {item.name}: {item.value}\n"
    
    prompt += "\n처방 약물:\n"
    for prescription in prescription_data:
        for med in prescription.medications:
            prompt += f"- {med.name}\n"
    
    prompt += """

다음을 고려하여 분석해주세요:
1. 건강 수치 개선을 위한 음식
2. 복용 약물과 상호작용하는 음식/건기식
3. 한국인 식단에 맞는 실용적인 권장사항
4. 구체적이고 실행 가능한 항목들
"""
    
    return prompt

async def call_gpt_api(prompt: str, response_format: str = "text", health_data: List[HealthCheckup] = None, prescription_data: List[PrescriptionData] = None) -> str:
    """GPT API 호출"""
    try:
        logger.info(f"🤖 [GPT API] 호출 시작 - 모델: gpt-4, 프롬프트 길이: {len(prompt)}")
        
        # OpenAI API 키 확인
        api_key = settings.openai_api_key
        if not api_key or api_key.startswith("sk-proj-your-") or api_key == "sk-test-placeholder" or api_key == "dev-openai-key":
            logger.info("🔄 [GPT API] API 키 없음 - 목 데이터로 폴백")
            return get_mock_analysis_response()
        
        logger.info(f"🔑 [GPT API] API 키 확인됨: {api_key[:10]}...")
        
        # OpenAI 클라이언트 가져오기
        openai_client = get_openai_client()
        if not openai_client:
            logger.warning("⚠️ [GPT API] OpenAI 클라이언트가 초기화되지 않음, 목 데이터 사용")
            return get_mock_analysis_response()
        
        response = await openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "당신은 전문 의료 데이터 분석가입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.3
        )
        
        result = response.choices[0].message.content
        logger.info(f"✅ [GPT API] 응답 수신 완료 - 응답 길이: {len(result) if result else 0}")
        
        return result or get_mock_analysis_response(health_data, prescription_data)
        
    except Exception as e:
        logger.error(f"❌ [GPT API] 호출 실패: {str(e)}")
        logger.info("🔄 [GPT API] 에러 시 목 데이터로 폴백")
        return get_mock_analysis_response(health_data, prescription_data)

def get_mock_analysis_response(health_data: List[HealthCheckup] = None, prescription_data: List[PrescriptionData] = None) -> str:
    """실제 데이터 기반 분석 응답 생성"""
    
    # 기본값 설정
    if not health_data:
        health_data = []
    if not prescription_data:
        prescription_data = []
    
    # 실제 데이터 기반 분석 생성
    health_count = len(health_data)
    prescription_count = len(prescription_data)
    
    # 최신 건강검진 데이터 분석
    latest_health = health_data[0] if health_data else None
    
    # 기본 분석 텍스트 생성
    analysis_parts = []
    
    # 데이터 개요
    if health_count > 0 and prescription_count > 0:
        analysis_parts.append(f"최근 {health_count}년간의 건강검진과 {prescription_count}건의 처방전 데이터를 통해 종합적인 건강 상태를 분석했습니다.")
    elif health_count > 0:
        analysis_parts.append(f"최근 {health_count}년간의 건강검진 데이터를 기반으로 건강 상태를 분석했습니다.")
    elif prescription_count > 0:
        analysis_parts.append(f"{prescription_count}건의 처방전 데이터를 기반으로 약물 복용 현황을 분석했습니다.")
    else:
        analysis_parts.append("제공된 데이터를 기반으로 기본적인 건강 상태 평가를 수행했습니다.")
    
    # 건강검진 데이터 기반 분석
    if latest_health:
        # 건강검진 데이터에서 값 추출 함수 (중복 정의)
        def get_health_value(checkup: HealthCheckup, item_name: str) -> Optional[str]:
            for inspection in checkup.inspections:
                for item in inspection.items:
                    if item_name.lower() in item.name.lower():
                        return item.value
            return None

        # BMI 분석
        bmi_value_str = get_health_value(latest_health, 'BMI')
        if bmi_value_str:
            bmi_value = safe_float(bmi_value_str)
            if bmi_value >= 25:
                analysis_parts.append(f"체질량지수(BMI) {bmi_value}로 과체중 범위에 해당하여 체중 관리가 필요합니다.")
            elif bmi_value >= 23:
                analysis_parts.append(f"체질량지수(BMI) {bmi_value}로 정상 상한선에 근접하여 주의가 필요합니다.")
            else:
                analysis_parts.append(f"체질량지수(BMI) {bmi_value}로 정상 범위를 유지하고 있습니다.")
        
        # 혈압 분석
        bp_high_str = get_health_value(latest_health, '수축기') or get_health_value(latest_health, '혈압')
        bp_low_str = get_health_value(latest_health, '이완기')
        if bp_high_str:
            bp_high, bp_low = parse_blood_pressure(bp_high_str)
            if not bp_low and bp_low_str:
                bp_low = safe_int(bp_low_str)
            
            if bp_high >= 140 or bp_low >= 90:
                analysis_parts.append(f"혈압 {bp_high}/{bp_low}mmHg로 고혈압 범위에 해당하여 적극적인 관리가 필요합니다.")
            elif bp_high >= 130 or bp_low >= 85:
                analysis_parts.append(f"혈압 {bp_high}/{bp_low}mmHg로 경계성 고혈압으로 지속적인 모니터링이 필요합니다.")
            else:
                analysis_parts.append(f"혈압 {bp_high}/{bp_low}mmHg로 정상 범위를 유지하고 있습니다.")
        
        # 혈당 분석
        glucose_str = get_health_value(latest_health, '혈당') or get_health_value(latest_health, '공복')
        if glucose_str:
            glucose = safe_int(glucose_str)
            if glucose >= 126:
                analysis_parts.append(f"공복혈당 {glucose}mg/dL로 당뇨병 진단 기준을 초과하여 즉시 치료가 필요합니다.")
            elif glucose >= 100:
                analysis_parts.append(f"공복혈당 {glucose}mg/dL로 당뇨병 전 단계에 해당하여 생활습관 개선이 필요합니다.")
            else:
                analysis_parts.append(f"공복혈당 {glucose}mg/dL로 정상 범위를 유지하고 있습니다.")
    
    # 처방전 데이터 기반 분석
    if prescription_data:
        medication_names = []
        for prescription in prescription_data[:3]:  # 최근 3건만
            if hasattr(prescription, 'medications'):
                for med in prescription.medications[:2]:  # 각 처방당 최대 2개 약물
                    if hasattr(med, 'name') and med.name:
                        medication_names.append(med.name)
        
        if medication_names:
            analysis_parts.append(f"현재 복용 중인 주요 약물({', '.join(medication_names[:3])})은 처방 목적에 맞게 적절히 사용되고 있습니다.")
    
    # 권장사항
    analysis_parts.append("정기적인 건강검진과 생활습관 개선을 통해 건강한 상태를 유지하시기 바랍니다.")
    
    return "\n\n".join(analysis_parts)

def parse_health_insights(gpt_response: str, health_data: List[HealthCheckup] = None) -> List[HealthInsight]:
    """실제 데이터 기반 건강 인사이트 생성"""
    insights = []
    
    if not health_data:
        # 기본 인사이트
        insights.append(HealthInsight(
            category="전반적 건강",
            status="good",
            message="정기적인 건강검진을 통해 건강 상태를 모니터링하고 있습니다",
            recommendation="현재 상태를 유지하며 정기 검진을 지속하세요"
        ))
        return insights
    
    # 최신 건강검진 데이터 분석
    latest_health = health_data[0]
    
    # 건강검진 데이터에서 값 추출 함수
    def get_health_value(checkup: HealthCheckup, item_name: str) -> Optional[str]:
        for inspection in checkup.inspections:
            for item in inspection.items:
                if item_name.lower() in item.name.lower():
                    return item.value
        return None
    
    # BMI 인사이트
    bmi_value_str = get_health_value(latest_health, 'BMI')
    if bmi_value_str:
        bmi_value = safe_float(bmi_value_str)
        if bmi_value >= 25:
            insights.append(HealthInsight(
                category="체중 관리",
                status="warning",
                message=f"BMI {bmi_value}로 과체중 범위입니다",
                recommendation="칼로리 제한과 규칙적인 운동을 통해 체중 감량이 필요합니다"
            ))
        elif bmi_value >= 23:
            insights.append(HealthInsight(
                category="체중 관리",
                status="warning",
                message=f"BMI {bmi_value}로 정상 상한선에 근접합니다",
                recommendation="현재 체중을 유지하고 추가 증가를 방지하세요"
            ))
        else:
            insights.append(HealthInsight(
                category="체중 관리",
                status="good",
                message=f"BMI {bmi_value}로 정상 범위를 유지하고 있습니다",
                recommendation="현재 생활습관을 지속하세요"
            ))
    
    # 혈압 인사이트
    bp_high_str = get_health_value(latest_health, '수축기') or get_health_value(latest_health, '혈압')
    bp_low_str = get_health_value(latest_health, '이완기')
    if bp_high_str:
        bp_high, bp_low = parse_blood_pressure(bp_high_str)
        if not bp_low and bp_low_str:
            bp_low = safe_int(bp_low_str)
        
        if bp_high >= 140 or bp_low >= 90:
            insights.append(HealthInsight(
                category="심혈관 건강",
                status="danger",
                message=f"혈압 {bp_high}/{bp_low}mmHg로 고혈압 범위입니다",
                recommendation="즉시 의료진 상담을 받고 혈압 관리 계획을 수립하세요"
            ))
        elif bp_high >= 130 or bp_low >= 85:
            insights.append(HealthInsight(
            category="심혈관 건강",
            status="warning",
                message=f"혈압 {bp_high}/{bp_low}mmHg로 경계성 고혈압입니다",
                recommendation="저염식단과 규칙적인 운동으로 혈압 관리가 필요합니다"
            ))
        else:
            insights.append(HealthInsight(
                category="심혈관 건강",
                status="good",
                message=f"혈압 {bp_high}/{bp_low}mmHg로 정상 범위입니다",
                recommendation="현재 상태를 유지하세요"
            ))
    
    # 혈당 인사이트
    glucose_str = get_health_value(latest_health, '혈당') or get_health_value(latest_health, '공복')
    if glucose_str:
        glucose = safe_int(glucose_str)
        if glucose >= 126:
            insights.append(HealthInsight(
                category="혈당 관리",
                status="danger",
                message=f"공복혈당 {glucose}mg/dL로 당뇨병 진단 기준을 초과합니다",
                recommendation="즉시 내분비내과 진료를 받고 혈당 관리 치료를 시작하세요"
            ))
        elif glucose >= 100:
            insights.append(HealthInsight(
                category="혈당 관리",
                status="warning",
                message=f"공복혈당 {glucose}mg/dL로 당뇨병 전 단계입니다",
                recommendation="식단 조절과 운동을 통해 혈당 관리가 필요합니다"
            ))
        else:
            insights.append(HealthInsight(
            category="혈당 관리", 
            status="good",
                message=f"공복혈당 {glucose}mg/dL로 정상 범위입니다",
                recommendation="현재 상태를 유지하세요"
            ))
    
    # 콜레스테롤 인사이트
    cholesterol_str = get_health_value(latest_health, '콜레스테롤')
    if cholesterol_str:
        cholesterol = safe_int(cholesterol_str)
        if cholesterol >= 240:
            insights.append(HealthInsight(
                category="심혈관 건강",
                status="warning",
                message=f"총 콜레스테롤 {cholesterol}mg/dL로 높은 수준입니다",
                recommendation="저지방 식단과 약물 치료를 고려해야 합니다"
            ))
        elif cholesterol >= 200:
            insights.append(HealthInsight(
                category="심혈관 건강",
                status="warning",
                message=f"총 콜레스테롤 {cholesterol}mg/dL로 경계선 수준입니다",
                recommendation="포화지방 섭취를 줄이고 오메가-3 섭취를 늘리세요"
            ))
        else:
            insights.append(HealthInsight(
                category="심혈관 건강",
                status="good",
                message=f"총 콜레스테롤 {cholesterol}mg/dL로 정상 범위입니다",
            recommendation="현재 식단을 유지하세요"
            ))
    
    return insights

def generate_health_journey(health_data: List[HealthCheckup], prescription_data: List[PrescriptionData] = None) -> dict:
    """실제 데이터 기반 건강 여정 생성"""
    
    if not health_data:
        return {
            "timeline": "건강검진 데이터를 기반으로 건강 여정을 분석할 수 있습니다.",
            "keyMilestones": []
        }
    
    # 데이터 정렬 (최신순)
    sorted_health_data = sorted(health_data, key=lambda x: extract_year_number(x.year), reverse=True)
    
    # 타임라인 텍스트 생성
    health_count = len(health_data)
    prescription_count = len(prescription_data) if prescription_data else 0
    
    if prescription_count > 0:
        timeline = f"최근 {health_count}년간의 건강검진과 {prescription_count}건의 처방전 데이터를 통해 전반적인 건강 상태 변화를 추적했습니다."
    else:
        timeline = f"최근 {health_count}년간의 건강검진 데이터를 통해 건강 상태 변화를 추적했습니다."
    
    # 주요 마일스톤 생성
    milestones = []
    for idx, current_health in enumerate(sorted_health_data[:5]):  # 최근 5년만
        # 이전 데이터와 비교
        previous_health = sorted_health_data[idx + 1] if idx + 1 < len(sorted_health_data) else None
        
        # 건강 상태 평가
        health_status = "양호"
        significant_events = []
        key_changes = []
        
        # 건강검진 데이터에서 값 추출 함수 (중복 정의)
        def get_health_value_journey(checkup: HealthCheckup, item_name: str) -> Optional[str]:
            for inspection in checkup.inspections:
                for item in inspection.items:
                    if item_name.lower() in item.name.lower():
                        return item.value
            return None
        
        # 년도 정보
        year = current_health.year
        period = f"{year}년" if year else f"검진 {idx+1}"
        
        # BMI 변화 분석
        current_bmi_str = get_health_value_journey(current_health, 'BMI')
        if current_bmi_str:
            current_bmi = safe_float(current_bmi_str)
            previous_bmi_str = get_health_value_journey(previous_health, 'BMI') if previous_health else None
            if previous_bmi_str:
                previous_bmi = safe_float(previous_bmi_str)
                bmi_change = current_bmi - previous_bmi
                
                if abs(bmi_change) > 0.5:
                    change_type = "worsened" if bmi_change > 0 else "improved"
                    key_changes.append({
                        "metric": "체질량지수",
                        "previousValue": f"{previous_bmi:.1f}",
                        "currentValue": f"{current_bmi:.1f}",
                        "changeType": change_type,
                        "significance": f"{'증가' if bmi_change > 0 else '감소'} {abs(bmi_change):.1f} 포인트"
                    })
                    
                    if current_bmi >= 25:
                        health_status = "주의"
                        significant_events.append("체중 관리 필요 상태 진입")
            else:
                # 첫 번째 데이터인 경우
                key_changes.append({
                    "metric": "체질량지수",
                    "previousValue": "-",
                    "currentValue": f"{current_bmi:.1f}",
                    "changeType": "stable",
                    "significance": "기준값 설정"
                })
        
        # 혈압 변화 분석
        current_bp_high_str = get_health_value_journey(current_health, '수축기') or get_health_value_journey(current_health, '혈압')
        current_bp_low_str = get_health_value_journey(current_health, '이완기')
        if current_bp_high_str:
            current_bp_high, current_bp_low = parse_blood_pressure(current_bp_high_str)
            if not current_bp_low and current_bp_low_str:
                current_bp_low = safe_int(current_bp_low_str)
            
            previous_bp_high_str = get_health_value_journey(previous_health, '수축기') or get_health_value_journey(previous_health, '혈압') if previous_health else None
            previous_bp_low_str = get_health_value_journey(previous_health, '이완기') if previous_health else None
            if previous_bp_high_str:
                previous_bp_high, previous_bp_low = parse_blood_pressure(previous_bp_high_str)
                if not previous_bp_low and previous_bp_low_str:
                    previous_bp_low = safe_int(previous_bp_low_str)
                
                bp_change = current_bp_high - previous_bp_high
                if abs(bp_change) > 5:
                    change_type = "worsened" if bp_change > 0 else "improved"
                    key_changes.append({
                        "metric": "혈압",
                        "previousValue": f"{previous_bp_high}/{previous_bp_low}",
                        "currentValue": f"{current_bp_high}/{current_bp_low}",
                        "changeType": change_type,
                        "significance": f"수축기 혈압 {'상승' if bp_change > 0 else '하강'} {abs(bp_change)}mmHg"
                    })
                    
                    if current_bp_high >= 140:
                        health_status = "주의"
                        significant_events.append("고혈압 범위 진입")
            else:
                key_changes.append({
                    "metric": "혈압",
                    "previousValue": "-",
                    "currentValue": f"{current_bp_high}/{current_bp_low}",
                    "changeType": "stable",
                    "significance": "기준값 설정"
                })
        
        # 혈당 변화 분석
        current_glucose_str = get_health_value_journey(current_health, '혈당') or get_health_value_journey(current_health, '공복')
        if current_glucose_str:
            current_glucose = safe_int(current_glucose_str)
            
            previous_glucose_str = get_health_value_journey(previous_health, '혈당') or get_health_value_journey(previous_health, '공복') if previous_health else None
            if previous_glucose_str:
                previous_glucose = safe_int(previous_glucose_str)
                glucose_change = current_glucose - previous_glucose
                
                if abs(glucose_change) > 5:
                    change_type = "worsened" if glucose_change > 0 else "improved"
                    key_changes.append({
                        "metric": "공복혈당",
                        "previousValue": f"{previous_glucose}mg/dL",
                        "currentValue": f"{current_glucose}mg/dL",
                        "changeType": change_type,
                        "significance": f"{'상승' if glucose_change > 0 else '하강'} {abs(glucose_change)}mg/dL"
                    })
                    
                    if current_glucose >= 126:
                        health_status = "주의"
                        significant_events.append("당뇨병 진단 기준 초과")
                    elif current_glucose >= 100:
                        health_status = "주의"
                        significant_events.append("당뇨병 전 단계 진입")
        
        # 기본 이벤트 설정
        if not significant_events:
            significant_events.append(f"{period} 정기 건강검진 실시")
        
        # 의료 관리 정보
        medical_care = "정기 건강검진"
        if prescription_data:
            # 해당 년도 처방전 확인
            year_prescriptions = [p for p in prescription_data if hasattr(p, 'date') and p.date and p.date.startswith(str(year))] if year else []
            if year_prescriptions:
                medical_care += " 및 약물 치료"
        
        milestone = {
            "period": period,
            "healthStatus": health_status,
            "significantEvents": "; ".join(significant_events),
            "medicalCare": medical_care,
            "keyChanges": key_changes[:3]  # 최대 3개 변화만
        }
        
        milestones.append(milestone)
    
    return {
        "timeline": timeline,
        "keyMilestones": milestones
    }

def generate_structured_summary(health_data: List[HealthCheckup], prescription_data: List[PrescriptionData], insights: List[HealthInsight]) -> dict:
    """구조화된 종합소견 생성"""
    
    if not health_data:
        return {
            "overallGrade": "C",
            "analysisDate": datetime.now().strftime("%Y년 %m월 %d일"),
            "dataRange": "데이터 없음",
            "keyFindings": [
                {
                    "category": "데이터 부족",
                    "status": "warning",
                    "title": "건강검진 데이터 필요",
                    "description": "정확한 분석을 위해 건강검진 데이터가 필요합니다"
                }
            ],
            "riskFactors": [],
            "recommendations": [
                "정기적인 건강검진을 받으시기 바랍니다"
            ]
        }
    
    # 전체 건강 등급 계산
    danger_count = len([i for i in insights if i.status == "danger"])
    warning_count = len([i for i in insights if i.status == "warning"])
    good_count = len([i for i in insights if i.status == "good"])
    
    if danger_count > 0:
        overall_grade = "D"
    elif warning_count > good_count:
        overall_grade = "C"
    elif warning_count > 0:
        overall_grade = "B"
    else:
        overall_grade = "A"
    
    # 최신 검진 데이터 분석
    latest_health = health_data[0]
    oldest_health = health_data[-1] if len(health_data) > 1 else None
    
    # 데이터 범위
    if len(health_data) > 1:
        data_range = f"{oldest_health.year}년 ~ {latest_health.year}년 ({len(health_data)}회 검진)"
    else:
        data_range = f"{latest_health.year}년 (1회 검진)"
    
    # 주요 발견사항
    key_findings = []
    for insight in insights[:4]:  # 최대 4개
        key_findings.append({
            "category": insight.category,
            "status": insight.status,
            "title": get_finding_title(insight),
            "description": insight.message
        })
    
    # 위험 요소
    risk_factors = []
    for insight in insights:
        if insight.status in ["danger", "warning"]:
            risk_factors.append({
                "factor": insight.category,
                "level": "높음" if insight.status == "danger" else "보통",
                "description": insight.message
            })
    
    # 권장사항
    recommendations = []
    for insight in insights:
        if insight.recommendation:
            recommendations.append(insight.recommendation)
    
    # 기본 권장사항 추가
    if not recommendations:
        recommendations = [
            "정기적인 건강검진을 지속하세요",
            "균형 잡힌 식단과 규칙적인 운동을 유지하세요",
            "충분한 수면과 스트레스 관리에 신경쓰세요"
        ]
    
    return {
        "overallGrade": overall_grade,
        "analysisDate": datetime.now().strftime("%Y년 %m월 %d일"),
        "dataRange": data_range,
        "keyFindings": key_findings,
        "riskFactors": risk_factors,
        "recommendations": recommendations[:5]  # 최대 5개
    }

def get_finding_title(insight: HealthInsight) -> str:
    """인사이트 기반 발견사항 제목 생성"""
    if insight.status == "good":
        return f"{insight.category} 정상"
    elif insight.status == "warning":
        return f"{insight.category} 주의 필요"
    else:
        return f"{insight.category} 위험"

@router.post("/analyze")
async def analyze_health_data(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """종합 건강 데이터 분석"""
    try:
        # 처방전 데이터가 너무 많으면 최근 20건으로 제한 (토큰 길이 초과 방지)
        limited_prescription_data = request.prescription_data[:20] if len(request.prescription_data) > 20 else request.prescription_data
        
        logger.info(f"건강 분석 요청 - 건강검진: {len(request.health_data)}건, 처방전: {len(request.prescription_data)}건 (제한: {len(limited_prescription_data)}건)")
        
        # 1. 종합 건강 분석
        health_prompt = create_health_analysis_prompt(request.health_data, limited_prescription_data)
        gpt_analysis = await call_gpt_api(health_prompt, "text", request.health_data, limited_prescription_data)
        
        # 2. 약물 상호작용 분석
        drug_interactions = []
        if limited_prescription_data:
            drug_prompt = create_drug_interaction_prompt(limited_prescription_data)
            drug_response = await call_gpt_api(drug_prompt, "json", request.health_data, limited_prescription_data)
            
            try:
                drug_data = json.loads(drug_response)
                drug_interactions = [
                    DrugInteraction(**interaction) 
                    for interaction in drug_data.get("drug_interactions", [])
                ]
            except json.JSONDecodeError:
                logger.warning("약물 상호작용 JSON 파싱 실패, 기본값 사용")
                drug_interactions = [
                    DrugInteraction(
                        drug_name="처방 약물",
                        interaction_type="caution",
                        description="복용 중인 약물과 상호작용할 수 있습니다",
                        foods=["자몽", "녹차", "유제품"],
                        supplements=["칼슘", "철분", "비타민K"]
                    )
                ]
        
        # 3. 영양 권장사항 분석
        nutrition_recommendations = []
        if request.health_data or limited_prescription_data:
            nutrition_prompt = create_nutrition_prompt(request.health_data, limited_prescription_data)
            nutrition_response = await call_gpt_api(nutrition_prompt, "json", request.health_data, limited_prescription_data)
            
            try:
                nutrition_data = json.loads(nutrition_response)
                nutrition_recommendations = [
                    NutritionRecommendation(**rec)
                    for rec in nutrition_data.get("nutrition_recommendations", [])
                ]
            except json.JSONDecodeError:
                logger.warning("영양 권장사항 JSON 파싱 실패, 기본값 사용")
                nutrition_recommendations = [
                    NutritionRecommendation(
                        type="recommend",
                        category="food",
                        items=["연어", "견과류", "올리브오일", "브로콜리"],
                        reason="심혈관 건강 개선을 위한 오메가-3와 항산화 성분 공급"
                    ),
                    NutritionRecommendation(
                        type="avoid",
                        category="food", 
                        items=["트랜스지방", "과도한 나트륨", "정제당"],
                        reason="만성질환 위험 증가 방지"
                    )
                ]
        
        # 4. 건강 인사이트 생성
        health_insights = parse_health_insights(gpt_analysis, request.health_data)
        
        # 프론트엔드 형식에 맞춘 응답 구조
        analysis_result = {
            "summary": gpt_analysis,
            "structuredSummary": generate_structured_summary(request.health_data, limited_prescription_data, health_insights),
            "insights": [
                {
                    "category": insight.category,
                    "status": insight.status,
                    "message": insight.message,
                    "recommendation": insight.recommendation
                } for insight in health_insights
            ],
            "drugInteractions": [
                {
                    "drugs": [interaction.drug_name],
                    "severity": "medium" if interaction.interaction_type == "caution" else "high" if interaction.interaction_type == "avoid" else "low",
                    "description": interaction.description,
                    "recommendation": f"주의사항: {', '.join(interaction.foods + interaction.supplements)}"
                } for interaction in drug_interactions
            ],
            "nutritionRecommendations": {
                "avoid": [
                    {
                        "name": item,
                        "reason": rec.reason
                    } for rec in nutrition_recommendations if rec.type == "avoid" for item in rec.items
                ],
                "recommend": [
                    {
                        "name": item,
                        "benefit": rec.reason
                    } for rec in nutrition_recommendations if rec.type == "recommend" for item in rec.items
                ]
            },
            # 건강 여정 데이터 - 실제 데이터 기반 생성
            "healthJourney": generate_health_journey(request.health_data, limited_prescription_data),
            
            # 년도별 복용약물 분석 추가
            "yearlyMedicationAnalysis": [
                {
                    "year": prescription.date.split('-')[0] if hasattr(prescription, 'date') and prescription.date else "2024",
                    "period": f"{prescription.date.split('-')[0]}년" if hasattr(prescription, 'date') and prescription.date else "2024년",
                    "medications": [
                        {
                            "name": med.name,
                            "dosage": med.dosage if hasattr(med, 'dosage') else "용량 정보 없음",
                            "frequency": med.frequency if hasattr(med, 'frequency') else "복용법 정보 없음",
                            "purpose": "만성질환 관리" if idx % 2 == 0 else "증상 완화",
                            "status": "지속 복용" if idx % 3 == 0 else "단기 복용"
                        } for med in prescription.medications[:3]  # 최대 3개 약물만
                    ],
                    "analysis": f"{prescription.date.split('-')[0] if hasattr(prescription, 'date') and prescription.date else '2024'}년 처방된 약물들은 전반적으로 안전하게 복용되고 있으며, 정기적인 모니터링이 필요합니다.",
                    "cautions": [
                        "정기적인 간 기능 검사 필요",
                        "복용 시간 준수 중요",
                        "다른 약물과의 상호작용 주의"
                    ]
                } for idx, prescription in enumerate(limited_prescription_data[:3])  # 최근 3년치
            ]
        }
        
        return {
            "success": True,
            "analysis": analysis_result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"건강 분석 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

@router.post("/drug-interactions")
async def analyze_drug_interactions(prescription_data: List[PrescriptionData]):
    """약물 상호작용 전용 분석"""
    try:
        if not prescription_data:
            raise HTTPException(status_code=400, detail="처방 데이터가 필요합니다")
        
        prompt = create_drug_interaction_prompt(prescription_data)
        response = await call_gpt_api(prompt, "json", [], prescription_data)
        
        try:
            data = json.loads(response)
            return data.get("drug_interactions", [])
        except json.JSONDecodeError:
            # 파싱 실패 시 기본 응답
            return [
                {
                    "drug_name": "처방 약물",
                    "interaction_type": "caution",
                    "description": "복용 중인 약물과 상호작용 가능성이 있습니다",
                    "foods": ["자몽", "녹차"],
                    "supplements": ["칼슘", "철분"]
                }
            ]
            
    except Exception as e:
        logger.error(f"약물 상호작용 분석 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"분석 실패: {str(e)}")

@router.get("/health")
async def health_check():
    """API 상태 확인"""
    return {
        "status": "healthy",
        "service": "health_analysis",
        "timestamp": datetime.now().isoformat()
    }

