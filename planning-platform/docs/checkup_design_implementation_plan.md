# 검진 항목 설계 기능 구현 계획

## 📋 개요

검진 항목 설계하기 버튼 클릭 시 건강 데이터를 기반으로 맞춤형 검진 계획을 생성하는 기능을 구현합니다.

## 🔄 프로세스 플로우

```
1. 검진 항목 설계하기 버튼 클릭
   ↓
2. 건강 데이터 확인 (checkHasData API)
   ├─ 데이터 없음
   │  ├─ 메시지 표시 (3초)
   │  └─ 틸코 인증 페이지로 이동 (/login)
   │     └─ 데이터 수집 완료 후 돌아옴
   │
   └─ 데이터 있음
      ↓
3. 건강 데이터 파싱
   ├─ 최근 3년간 검진 데이터 추출
   ├─ 정상이 아닌 항목 리스트화
   └─ 약물 복용 이력 리스트화
      ↓
4. 염려 항목 선택 화면 표시
   ├─ 정상이 아닌 항목 목록
   ├─ 약물 복용 이력 목록
   └─ 사용자 선택 (다중 선택 가능)
      ↓
5. 선택한 항목 백엔드로 전송
   ↓
6. 백엔드 GPT API 호출
   ├─ 프롬프트 생성
   ├─ GPT 모델 호출 (gpt-4o-mini)
   └─ JSON 응답 반환
      ↓
7. 프론트엔드 화면 구성
   ├─ 추천 검진 항목 카테고리별 표시
   ├─ 의사 추천 메시지
   └─ 검진 예약 버튼
```

## 🏗️ 아키텍처 설계

### 백엔드 구조

#### 1. GPT 서비스 모듈화
**목표**: 기존 GPT 호출 로직을 공용 서비스로 통합

**현재 상태**:
- `health_analysis.py`의 `call_gpt_api` 함수
- `checkup_design_service.py`의 `_call_gpt_api` 메서드
- 각각 독립적으로 구현됨

**개선 방안**:
```
backend/app/services/gpt_service.py (신규)
├── GPTService 클래스
│   ├── call_gpt_api() - 공용 GPT 호출 메서드
│   ├── create_prompt() - 프롬프트 생성 헬퍼
│   └── parse_response() - JSON 응답 파싱
└── GPTConfig - 설정 관리
```

**기존 코드 리팩터링**:
- `health_analysis.py` → `GPTService` 사용
- `checkup_design_service.py` → `GPTService` 사용

#### 2. 검진 설계 API 엔드포인트
**경로**: `/wello-api/v1/checkup-design/create`

**요청 형식**:
```json
{
  "uuid": "string",
  "hospital_id": "string",
  "selected_concerns": [
    {
      "type": "abnormal_item" | "medication",
      "item_name": "string",
      "checkup_date": "YYYY-MM-DD",
      "value": "string",
      "status": "warning" | "abnormal"
    }
  ],
  "additional_info": {
    "symptoms": ["string"],
    "priority_areas": ["string"]
  }
}
```

**응답 형식**:
```json
{
  "success": true,
  "data": {
    "recommended_items": [
      {
        "category": "대장검사",
        "category_en": "Colonoscopy",
        "items": [
          {
            "id": "string",
            "name": "대장내시경(비수면)",
            "name_en": "Colonoscopy (non-sedated)",
            "description": "string",
            "reason": "string",
            "priority": 1
          }
        ],
        "doctor_recommendation": {
          "has_recommendation": true,
          "message": "string",
          "highlighted_text": "string"
        }
      }
    ],
    "analysis": "string",
    "total_count": 5
  }
}
```

#### 3. GPT 프롬프트 구조
**시스템 메시지**:
```
당신은 전문 의료 데이터 분석가입니다. 
환자의 검진 이력과 약물 복용 이력을 분석하여 
맞춤형 검진 계획을 제안해야 합니다.
```

**사용자 프롬프트 템플릿**:
```
환자 정보:
- 이름: {name}
- 나이: {age}세
- 성별: {gender}

최근 3년간 검진 이력:
{검진 데이터 JSON}

약물 복용 이력:
{처방전 데이터 JSON}

사용자가 선택한 염려 항목:
{selected_concerns JSON}

위 정보를 바탕으로 다음 JSON 형식으로 검진 계획을 제안해주세요:
{
  "recommended_items": [
    {
      "category": "카테고리명",
      "category_en": "Category Name",
      "items": [
        {
          "name": "검진 항목명",
          "name_en": "Item Name",
          "description": "검진 설명",
          "reason": "추천 이유",
          "priority": 1
        }
      ],
      "doctor_recommendation": {
        "has_recommendation": true,
        "message": "의사 추천 메시지",
        "highlighted_text": "강조할 텍스트"
      }
    }
  ],
  "analysis": "종합 분석",
  "total_count": 5
}
```

### 프론트엔드 구조

#### 1. 데이터 파싱 유틸리티
**파일**: `frontend/src/utils/checkupDesignParser.ts`

**기능**:
- 최근 3년간 검진 데이터 필터링
- 정상이 아닌 항목 추출 (warning, abnormal)
- 약물 복용 이력 추출
- 염려 항목 리스트 생성

#### 2. 염려 항목 선택 컴포넌트
**파일**: `frontend/src/components/checkup-design/ConcernSelection/index.tsx`

**기능**:
- 정상이 아닌 항목 목록 표시
- 약물 복용 이력 목록 표시
- 다중 선택 가능
- 선택한 항목 요약 표시

#### 3. 검진 설계 결과 페이지
**파일**: `frontend/src/pages/CheckupDesignResultPage/index.tsx`

**기능**:
- GPT 응답 기반 검진 항목 표시
- 카테고리별 아코디언 UI
- 의사 추천 메시지 표시
- 검진 예약 버튼

## 🎨 디자인 가이드

### 색상 시스템
기존 디자인 토큰 사용:
- `--color-brown-500` (#7c746a) - 메인 브랜드 컬러
- `--color-brown-600` (#696158) - 호버 상태
- `--color-success` (#059669) - 정상
- `--color-warning` (#d97706) - 경계
- `--color-danger` (#dc2626) - 이상

### 폰트 시스템
- `--font-family-primary`: 'Pretendard', sans-serif
- `--font-size-base`: 1rem (16px)
- `--font-size-lg`: 1.125rem (18px)
- `--font-size-xl`: 1.25rem (20px)
- `--font-size-2xl`: 1.5rem (24px)

### 레이아웃
- 최대 너비: 448px (모바일 우선)
- 패딩: `--space-4` (16px)
- 간격: `--space-2` ~ `--space-6`

### 컴포넌트 스타일
기존 `CheckupRecommendationsPage` 스타일 재사용:
- 아코디언 카드
- 의사 추천 박스
- 검진 항목 체크박스

## 📁 파일 구조

### 백엔드
```
backend/app/
├── services/
│   ├── gpt_service.py (신규) - 공용 GPT 서비스
│   └── checkup_design_service.py (수정) - GPT 서비스 사용
├── api/v1/endpoints/
│   └── checkup_design.py (신규) - 검진 설계 API
└── models/
    └── checkup_design.py (수정) - 데이터 모델
```

### 프론트엔드
```
frontend/src/
├── pages/
│   ├── CheckupDesignPage.tsx (수정) - 건강 데이터 확인 및 파싱
│   └── CheckupDesignResultPage.tsx (신규) - 결과 표시
├── components/
│   └── checkup-design/
│       ├── ConcernSelection/ (신규) - 염려 항목 선택
│       └── DesignResult/ (신규) - 결과 표시 컴포넌트
├── utils/
│   └── checkupDesignParser.ts (신규) - 데이터 파싱 유틸
└── services/
    └── checkupDesignService.ts (신규) - API 호출 서비스
```

## 🔧 기술 스택

### 백엔드
- Python FastAPI
- OpenAI GPT-4o-mini
- PostgreSQL (데이터 저장)

### 프론트엔드
- React + TypeScript
- SCSS (디자인 토큰 기반)
- React Router (페이지 이동)

## 📝 API 명세

### 1. 건강 데이터 확인
**기존 API 재사용**: `GET /wello-api/v1/wello/check-existing-data`

### 2. 검진 설계 생성
**신규 API**: `POST /wello-api/v1/checkup-design/create`

**요청 헤더**:
```
Content-Type: application/json
```

**요청 본문**: 위의 요청 형식 참조

**응답**: 위의 응답 형식 참조

## 🧪 테스트 계획

### 백엔드 테스트
1. GPT 서비스 모듈화 테스트
2. 검진 설계 API 엔드포인트 테스트
3. GPT 프롬프트 생성 테스트
4. JSON 응답 파싱 테스트

### 프론트엔드 테스트
1. 건강 데이터 파싱 테스트
2. 염려 항목 선택 UI 테스트
3. API 호출 및 응답 처리 테스트
4. 결과 페이지 렌더링 테스트

## 🚀 배포 계획

### Phase 1: 백엔드 GPT 서비스 모듈화
- GPT 서비스 클래스 생성
- 기존 코드 리팩터링
- 테스트

### Phase 2: 검진 설계 API 구현
- API 엔드포인트 생성
- GPT 프롬프트 템플릿 작성
- JSON 응답 구조 정의
- 테스트

### Phase 3: 프론트엔드 데이터 파싱
- 데이터 파싱 유틸리티 구현
- 염려 항목 추출 로직
- 테스트

### Phase 4: 염려 항목 선택 UI
- 선택 컴포넌트 구현
- UI/UX 테스트

### Phase 5: 검진 설계 결과 페이지
- 결과 페이지 구현
- API 연동
- 통합 테스트

## 📚 참고 자료

- 기존 디자인 가이드: `docs/02_design_guidelines.md`
- 색상 시스템: `docs/09_color_system_specification.md`
- 검진 추천 페이지: `CheckupRecommendationsPage.tsx`
- 건강 데이터 파싱: `TrendsSection.tsx`, `UnifiedHealthTimeline/index.tsx`

