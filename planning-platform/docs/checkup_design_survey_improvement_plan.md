# 검진 설계 추가 설문 기능 개선 계획

## 현재 플로우 분석

### 현재 사용자 플로우
```
1. 메인 페이지 → "검진 항목 설계하기" 버튼 클릭
2. CheckupDesignPage → 건강 데이터 로드
3. ConcernSelection → 염려 항목 선택 (체크박스)
4. "다음 단계로 진행하기" 버튼 클릭
5. 바로 API 호출 → 결과 페이지로 이동
```

### 문제점
- 염려 항목만으로는 검진 설계에 부족한 정보
- 사용자의 최근 생활 변화, 운동, 가족력 등 추가 정보 없음
- 병원에서 업셀링할 때 활용할 데이터 부족

## 개선된 플로우

### 새로운 사용자 플로우
```
1. 메인 페이지 → "검진 항목 설계하기" 버튼 클릭
2. CheckupDesignPage → 건강 데이터 로드
3. ConcernSelection → 염려 항목 선택 (체크박스)
4. "다음 단계로 진행하기" 버튼 클릭
5. ↓ 아래에서 패널 올라옴 (CheckupDesignSurveyPanel)
6. 설문 항목 입력 (5-8개)
   - 최근 체중 변화 (객관식)
   - 최근 운동 (객관식)
   - 가족력 (객관식/주관식)
   - 생활습관 (객관식)
   - 기타 건강 고민사항 (주관식 텍스트)
7. "검진 설계하기" 버튼 클릭
8. API 호출 (선택한 염려 항목 + 설문 응답 포함)
9. DB에 저장 (업셀링용)
10. 결과 페이지로 이동
```

## 설문 항목 정의

### 1. 최근 체중 변화 (객관식)
- **질문**: 최근 3개월간 체중 변화가 있으신가요?
- **옵션**: 
  - 증가 (3kg 이상)
  - 약간 증가 (1-3kg)
  - 유지
  - 약간 감소 (1-3kg)
  - 감소 (3kg 이상)

### 2. 최근 운동 (객관식)
- **질문**: 최근 운동을 하시나요?
- **옵션**:
  - 규칙적으로 운동함 (주 3회 이상)
  - 가끔 운동함 (주 1-2회)
  - 거의 안 함
  - 전혀 안 함

### 3. 가족력 (객관식 - 다중 선택)
- **질문**: 가족 중에 다음 질환이 있으신가요? (복수 선택 가능)
- **옵션**:
  - 고혈압
  - 당뇨병
  - 심장질환
  - 암
  - 뇌졸중
  - 없음

### 4. 생활습관 - 흡연 (객관식)
- **질문**: 흡연하시나요?
- **옵션**:
  - 비흡연
  - 과거 흡연 (금연)
  - 현재 흡연

### 5. 생활습관 - 음주 (객관식)
- **질문**: 음주 빈도는?
- **옵션**:
  - 전혀 안 함
  - 월 1회 미만
  - 월 1-2회
  - 주 1-2회
  - 주 3회 이상

### 6. 수면 패턴 (객관식)
- **질문**: 평균 수면 시간은?
- **옵션**:
  - 5시간 미만
  - 5-6시간
  - 6-7시간
  - 7-8시간
  - 8시간 이상

### 7. 스트레스 수준 (객관식)
- **질문**: 최근 스트레스 수준은?
- **옵션**:
  - 매우 높음
  - 높음
  - 보통
  - 낮음
  - 매우 낮음

### 8. 추가 고민사항 (주관식 텍스트)
- **질문**: 검진 설계 시 고려해주셨으면 하는 특이사항이나 고민사항이 있으신가요?
- **입력**: 텍스트 입력 (최대 500자)

## 데이터베이스 스키마

### wello_checkup_design_requests 테이블
```sql
CREATE TABLE IF NOT EXISTS wello.wello_checkup_design_requests (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES wello.wello_patients(id) ON DELETE CASCADE,
    
    -- 선택한 염려 항목 (JSONB)
    selected_concerns JSONB NOT NULL,
    
    -- 설문 응답 (JSONB)
    survey_responses JSONB NOT NULL,
    
    -- 추가 고민사항 (텍스트)
    additional_concerns TEXT,
    
    -- 검진 설계 결과 (JSONB) - Perplexity 응답
    design_result JSONB,
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 인덱스
    INDEX idx_design_requests_patient (patient_id),
    INDEX idx_design_requests_created (created_at)
);
```

### 설문 응답 JSON 구조
```json
{
  "weight_change": "증가",
  "exercise_frequency": "가끔 운동함",
  "family_history": ["고혈압", "당뇨병"],
  "smoking": "비흡연",
  "drinking": "월 1-2회",
  "sleep_hours": "6-7시간",
  "stress_level": "보통",
  "additional_concerns": "최근 두통이 자주 발생합니다."
}
```

## 구현 계획

### Phase 1: 프론트엔드 설문 패널 구현
1. `CheckupDesignSurveyPanel.tsx` 컴포넌트 생성
2. 아래에서 올라오는 패널 애니메이션
3. 설문 항목 UI 구현 (객관식/주관식)
4. 폼 검증 및 제출

### Phase 2: 백엔드 API 수정
1. `CheckupDesignRequest` 모델에 설문 응답 필드 추가
2. 설문 데이터를 프롬프트에 포함
3. DB 저장 로직 구현

### Phase 3: DB 스키마 추가
1. `wello_checkup_design_requests` 테이블 생성
2. 설문 응답 저장 로직 구현

### Phase 4: 프롬프트 개선
1. 설문 응답을 프롬프트에 포함
2. Perplexity 프롬프트에 설문 데이터 반영

### Phase 5: 통합 테스트
1. 전체 플로우 테스트
2. DB 저장 확인
3. 업셀링용 데이터 확인

## 업셀링 활용 방안

### 저장되는 데이터
- 선택한 염려 항목 (어떤 검진 항목을 우려하는지)
- 설문 응답 (생활습관, 가족력 등)
- 추가 고민사항 (자유 텍스트)
- 검진 설계 결과

### 병원에서 활용
- 환자의 건강 우려사항 파악
- 맞춤형 검진 프로그램 제안
- 추가 검진 항목 업셀링
- 건강 관리 프로그램 추천

