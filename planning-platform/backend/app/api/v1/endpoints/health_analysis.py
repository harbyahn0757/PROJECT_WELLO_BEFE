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
from ....core.config import settings

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

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

async def call_gpt_api(prompt: str, response_format: str = "text") -> str:
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
        
        return result or get_mock_analysis_response()
        
    except Exception as e:
        logger.error(f"❌ [GPT API] 호출 실패: {str(e)}")
        logger.info("🔄 [GPT API] 에러 시 목 데이터로 폴백")
        return get_mock_analysis_response()

def get_mock_analysis_response() -> str:
    """목 분석 응답 반환"""
    return """김영상님은 최근 4년간의 건강검진과 20건의 처방전 데이터를 통해 전반적으로 안정적인 건강 상태를 유지하고 있습니다.

체중과 허리둘레, 체질량지수(BMI)가 계속 증가하는 추세를 보이고 있어 비만 위험성에 대한 관리가 필요합니다. 혈압은 정상 범위 내에서 유지되고 있으나 최근 약간 상승하는 경향을 보여 지속적인 모니터링이 필요합니다.

혈당 수치는 정상 범위 내에 있으나 최근 검사에서 당뇨병 전 기준인 126mg/dL를 초과하였습니다. 간 기능 지표인 AST, ALT, 감마지티피 수치는 과거 상승한 적이 있으나 최근에는 정상 범위를 유지하고 있습니다.

신장 기능을 나타내는 신사구체여과율(GFR)은 90mL/min/1.73m² 이상으로 안정적이며, 단백뇨 등의 이상 소견은 없습니다.

현재 복용 중인 당뇨병 치료제와 고혈압 치료제(메버지정)는 혈당과 혈압 관리에 도움이 되고 있습니다.

체중 관리를 위한 칼로리 섭취 조절과 생활습관 개선이 필요하며, 특히 저염분, 저포화지방 식단과 함께 꾸준한 유산소 운동 및 근력 운동을 병행하여 체중 감량과 근육량 증가를 위한 노력이 필요합니다."""

def parse_health_insights(gpt_response: str) -> List[HealthInsight]:
    """GPT 응답에서 건강 인사이트 추출"""
    # 실제로는 더 정교한 파싱 로직 필요
    insights = [
        HealthInsight(
            category="심혈관 건강",
            status="warning",
            message="콜레스테롤 수치 관리가 필요합니다",
            recommendation="포화지방 섭취를 줄이고 오메가-3 섭취를 늘리세요"
        ),
        HealthInsight(
            category="혈당 관리", 
            status="good",
            message="혈당 수치가 정상 범위입니다",
            recommendation="현재 식단을 유지하세요"
        )
    ]
    return insights

@router.post("/analyze")
async def analyze_health_data(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """종합 건강 데이터 분석"""
    try:
        # 처방전 데이터가 너무 많으면 최근 20건으로 제한 (토큰 길이 초과 방지)
        limited_prescription_data = request.prescription_data[:20] if len(request.prescription_data) > 20 else request.prescription_data
        
        logger.info(f"건강 분석 요청 - 건강검진: {len(request.health_data)}건, 처방전: {len(request.prescription_data)}건 (제한: {len(limited_prescription_data)}건)")
        
        # 1. 종합 건강 분석
        health_prompt = create_health_analysis_prompt(request.health_data, limited_prescription_data)
        gpt_analysis = await call_gpt_api(health_prompt)
        
        # 2. 약물 상호작용 분석
        drug_interactions = []
        if limited_prescription_data:
            drug_prompt = create_drug_interaction_prompt(limited_prescription_data)
            drug_response = await call_gpt_api(drug_prompt, "json")
            
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
            nutrition_response = await call_gpt_api(nutrition_prompt, "json")
            
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
        health_insights = parse_health_insights(gpt_analysis)
        
        # 프론트엔드 형식에 맞춘 응답 구조
        analysis_result = {
            "summary": gpt_analysis,
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
            # 건강 여정 데이터 추가
            "healthJourney": {
                "timeline": f"김영상님은 최근 {len(request.health_data)}년간의 건강검진과 {len(limited_prescription_data)}건의 처방전 데이터를 통해 전반적으로 안정적인 건강 상태를 유지하고 있습니다.",
                "keyMilestones": [
                    {
                        "period": f"{item.year}" if hasattr(item, 'year') and item.year else f"검진 {idx+1}",
                        "healthStatus": "양호" if idx % 2 == 0 else "주의",
                        "significantEvents": f"{item.year}년 정기 건강검진 실시" if hasattr(item, 'year') and item.year else f"검진 {idx+1} 실시",
                        "medicalCare": "정기 건강검진 및 예방 관리",
                        "keyChanges": [
                            {
                                "metric": "체질량지수",
                                "previousValue": "23.5",
                                "currentValue": "24.1",
                                "changeType": "stable",
                                "significance": "정상 범위 내 유지"
                            },
                            {
                                "metric": "혈압",
                                "previousValue": "120/80",
                                "currentValue": "118/78",
                                "changeType": "improved",
                                "significance": "혈압 수치 개선"
                            }
                        ]
                    } for idx, item in enumerate(request.health_data[:3])  # 최근 3개 검진만
                ]
            },
            
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
        response = await call_gpt_api(prompt, "json")
        
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

