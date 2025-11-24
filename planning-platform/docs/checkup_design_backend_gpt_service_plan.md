# 검진 설계 백엔드 GPT 서비스 모듈화 계획

## 📋 개요

기존에 분산되어 있는 GPT API 호출 로직을 공용 서비스로 모듈화하여 재사용성을 높이고 일관성을 유지합니다.

## 🔍 현재 상태 분석

### 1. 기존 GPT 호출 위치

#### health_analysis.py
**위치**: `backend/app/api/v1/endpoints/health_analysis.py`
**함수**: `call_gpt_api()`
**특징**:
- 프롬프트 로그 저장 기능
- 응답 로그 저장 기능
- 목 데이터 폴백 처리
- OpenAI 클라이언트 재사용

#### checkup_design_service.py
**위치**: `backend/app/services/checkup_design_service.py`
**메서드**: `_call_gpt_api()`
**특징**:
- 간단한 GPT 호출만 수행
- 에러 처리 기본적
- 로그 기능 없음

### 2. 공통점
- 모두 `gpt-4o-mini` 모델 사용
- OpenAI API 사용
- 비슷한 에러 처리 패턴

### 3. 차이점
- 로그 저장 기능 유무
- 프롬프트 생성 방식
- 응답 파싱 방식

## 🏗️ 모듈화 설계

### GPTService 클래스 구조

```python
# backend/app/services/gpt_service.py

from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import openai
from openai import AsyncOpenAI
import logging

logger = logging.getLogger(__name__)

@dataclass
class GPTRequest:
    """GPT 요청 데이터 클래스"""
    system_message: str
    user_message: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    max_tokens: int = 2000
    response_format: Optional[Dict[str, Any]] = None

@dataclass
class GPTResponse:
    """GPT 응답 데이터 클래스"""
    content: str
    model: str
    usage: Dict[str, int]
    success: bool
    error: Optional[str] = None

class GPTService:
    """공용 GPT 서비스 클래스"""
    
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self._api_key: Optional[str] = None
        
    async def initialize(self):
        """OpenAI 클라이언트 초기화"""
        # settings에서 API 키 가져오기
        # 클라이언트 생성
        
    async def call_api(
        self,
        request: GPTRequest,
        save_log: bool = True,
        health_data: Optional[List[Any]] = None,
        prescription_data: Optional[List[Any]] = None
    ) -> GPTResponse:
        """GPT API 호출 (공용 메서드)"""
        # 1. API 키 확인
        # 2. 클라이언트 확인
        # 3. 프롬프트 로그 저장 (옵션)
        # 4. GPT API 호출
        # 5. 응답 로그 저장 (옵션)
        # 6. 응답 반환
        
    async def call_with_json_response(
        self,
        request: GPTRequest,
        save_log: bool = True
    ) -> Dict[str, Any]:
        """JSON 형식 응답을 기대하는 GPT 호출"""
        # response_format 설정
        # JSON 파싱
        # 반환
        
    def create_prompt(
        self,
        template: str,
        **kwargs
    ) -> str:
        """프롬프트 템플릿 기반 생성"""
        # 템플릿 변수 치환
        # 반환
        
    def parse_json_response(
        self,
        response: str
    ) -> Dict[str, Any]:
        """JSON 응답 파싱 (코드블록 제거)"""
        # JSON 코드블록 제거
        # JSON 파싱
        # 반환
```

### 기존 코드 리팩터링

#### health_analysis.py 수정
```python
# 기존
async def call_gpt_api(...):
    # GPT 호출 로직
    pass

# 수정 후
from app.services.gpt_service import GPTService

gpt_service = GPTService()

async def call_gpt_api(...):
    request = GPTRequest(
        system_message="당신은 전문 의료 데이터 분석가입니다.",
        user_message=prompt,
        temperature=0.3,
        max_tokens=2000
    )
    response = await gpt_service.call_api(
        request,
        save_log=True,
        health_data=health_data,
        prescription_data=prescription_data
    )
    return response.content
```

#### checkup_design_service.py 수정
```python
# 기존
async def _call_gpt_api(self, prompt: GPTPrompt) -> str:
    response = await openai.ChatCompletion.acreate(...)
    return response.choices[0].message.content.strip()

# 수정 후
from app.services.gpt_service import GPTService

class CheckupDesignService:
    def __init__(self, ...):
        self._gpt_service = GPTService()
        
    async def _call_gpt_api(self, prompt: GPTPrompt) -> str:
        request = GPTRequest(
            system_message=prompt.system_message,
            user_message=prompt.user_message,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens
        )
        response = await self._gpt_service.call_api(request, save_log=False)
        return response.content
```

## 📝 검진 설계 전용 GPT 프롬프트

### 프롬프트 템플릿

```python
CHECKUP_DESIGN_PROMPT_TEMPLATE = """
환자 정보:
- 이름: {patient_name}
- 나이: {patient_age}세
- 성별: {patient_gender}

최근 3년간 검진 이력:
{health_data_json}

약물 복용 이력:
{prescription_data_json}

사용자가 선택한 염려 항목:
{selected_concerns_json}

위 정보를 바탕으로 다음 JSON 형식으로 검진 계획을 제안해주세요:
{{
  "recommended_items": [
    {{
      "category": "카테고리명",
      "category_en": "Category Name",
      "items": [
        {{
          "name": "검진 항목명",
          "name_en": "Item Name",
          "description": "검진 설명",
          "reason": "추천 이유",
          "priority": 1
        }}
      ],
      "doctor_recommendation": {{
        "has_recommendation": true,
        "message": "의사 추천 메시지",
        "highlighted_text": "강조할 텍스트"
      }}
    }}
  ],
  "analysis": "종합 분석",
  "total_count": 5
}}
"""
```

### 시스템 메시지

```python
CHECKUP_DESIGN_SYSTEM_MESSAGE = """
당신은 전문 의료 데이터 분석가입니다. 
환자의 검진 이력과 약물 복용 이력을 분석하여 
맞춤형 검진 계획을 제안해야 합니다.

다음 사항을 고려하여 검진 계획을 수립하세요:
1. 최근 3년간 검진 결과에서 정상이 아닌 항목
2. 약물 복용 이력과 관련된 검진 항목
3. 환자의 연령과 성별에 따른 권장 검진
4. 사용자가 선택한 염려 항목에 대한 정밀 검진

응답은 반드시 JSON 형식으로 제공해야 하며, 
의학적으로 정확하고 환자가 이해하기 쉽게 작성해야 합니다.
"""
```

## 🔧 API 엔드포인트 구현

### 엔드포인트 구조

```python
# backend/app/api/v1/endpoints/checkup_design.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/checkup-design", tags=["checkup-design"])

class ConcernItem(BaseModel):
    type: str  # "abnormal_item" | "medication"
    item_name: str
    checkup_date: Optional[str] = None
    value: Optional[str] = None
    status: Optional[str] = None  # "warning" | "abnormal"
    medication_period: Optional[str] = None

class CheckupDesignRequest(BaseModel):
    uuid: str
    hospital_id: str
    selected_concerns: List[ConcernItem]
    additional_info: Optional[dict] = None

@router.post("/create")
async def create_checkup_design(
    request: CheckupDesignRequest
):
    """검진 설계 생성"""
    # 1. 환자 데이터 조회
    # 2. 건강 데이터 파싱
    # 3. GPT 프롬프트 생성
    # 4. GPT API 호출
    # 5. JSON 응답 파싱
    # 6. 결과 반환
    pass
```

## 📊 데이터 변환

### 건강 데이터 → GPT 입력 형식

```python
def format_health_data_for_gpt(health_data: List[Dict]) -> str:
    """건강 데이터를 GPT 입력 형식으로 변환"""
    formatted = []
    for checkup in health_data:
        formatted.append({
            "date": checkup.get("checkup_date"),
            "location": checkup.get("location"),
            "items": [
                {
                    "name": item.get("ItemName"),
                    "value": item.get("Value"),
                    "status": determine_status(item)
                }
                for item in checkup.get("Items", [])
            ]
        })
    return json.dumps(formatted, ensure_ascii=False, indent=2)
```

### 처방전 데이터 → GPT 입력 형식

```python
def format_prescription_data_for_gpt(prescription_data: List[Dict]) -> str:
    """처방전 데이터를 GPT 입력 형식으로 변환"""
    formatted = []
    for prescription in prescription_data:
        formatted.append({
            "date": prescription.get("treatment_date"),
            "medications": [
                {
                    "name": med.get("MedicationName"),
                    "period": med.get("Period")
                }
                for med in prescription.get("Medications", [])
            ]
        })
    return json.dumps(formatted, ensure_ascii=False, indent=2)
```

## 🧪 테스트 계획

### 단위 테스트
1. GPTService 초기화 테스트
2. GPT API 호출 테스트
3. 프롬프트 생성 테스트
4. JSON 응답 파싱 테스트

### 통합 테스트
1. 검진 설계 API 엔드포인트 테스트
2. 전체 플로우 테스트 (요청 → GPT 호출 → 응답)

## 📚 참고 파일

- `backend/app/api/v1/endpoints/health_analysis.py` - 기존 GPT 호출 로직
- `backend/app/services/checkup_design_service.py` - 기존 검진 설계 서비스
- `backend/app/core/config.py` - 설정 관리

