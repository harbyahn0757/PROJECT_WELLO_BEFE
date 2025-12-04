# 문진 시스템 동적 질문 개선 계획

**작성일**: 2025-01-02  
**목적**: 프리미엄 항목의 `target_trigger`를 활용하여 병원별 맞춤형 문진 질문 생성

---

## 현재 상황 분석

### 현재 문진 질문 (고정)
1. 체중 변화
2. 운동 빈도
3. 가족력 (고혈압, 당뇨, 심장질환, 암, 뇌졸중)
4. 흡연
5. 음주
6. 수면 시간
7. 스트레스 수준
8. 추가 고민사항 (자유 입력)

### 프리미엄 항목의 target_trigger 분석 결과

**KIM_HW_CLINIC 병원의 주요 target_trigger 패턴**:
1. "이미 암 진단을 받은 환자" → **암 진단 이력 질문 필요**
2. "만성 위염, 소화불량 환자" → **위염/소화불량 질문 필요**
3. "유전성 암(브라카 변이 등) 유무 확인" → **유전자 검사 관련 질문 필요**
4. "B형/C형 간염 보균자" → **간염 보균자 질문 필요**
5. "유방암/난소암 확진자 및 가족" → **가족력 질문 확장 필요**
6. "대장내시경 준비(약물/금식) 기피자" → **내시경 관련 질문 필요**
7. "흉부 영상(CT)상 폐 결절 발견자" → **폐 결절 관련 질문 필요**
8. "혈뇨(Hematuria) 증상 호소자" → **혈뇨 증상 질문 필요**
9. "X-ray 통증 공포가 있는 여성" → **영상 검사 기피 관련 질문 필요**

---

## 개선 방안

### 1. 병원별 프리미엄 항목 조회 및 질문 생성

**프로세스**:
1. 검진 설계 페이지 진입 시 병원 정보 조회
2. 해당 병원의 프리미엄 항목(`external_checkup_items`) 조회
3. `target_trigger`에서 키워드 추출
4. 키워드 기반 동적 질문 생성
5. 기본 질문 + 동적 질문 조합하여 문진 표시

### 2. target_trigger 키워드 매핑 테이블

| 키워드 패턴 | 질문 유형 | 질문 내용 |
|------------|----------|----------|
| "암 진단" | radio | 과거 암 진단을 받으신 적이 있으신가요? |
| "위염", "소화불량" | checkbox | 현재 또는 과거에 다음 증상이 있으신가요? (위염, 소화불량) |
| "간염 보균자" | radio | B형 또는 C형 간염 보균자이신가요? |
| "대장내시경", "내시경" | radio | 대장내시경 검사를 받으신 적이 있으신가요? |
| "폐 결절" | radio | 흉부 CT나 X-ray에서 폐 결절이 발견된 적이 있으신가요? |
| "혈뇨" | radio | 최근 혈뇨(소변에 피가 섞여 나오는 증상)가 있으신가요? |
| "유전자", "브라카" | radio | 가족 중 유전성 암(브라카 변이 등)이 의심되는 경우가 있으신가요? |
| "영상 검사", "CT", "X-ray" | checkbox | 다음 검사 중 기피하거나 불편함을 느끼는 검사가 있으신가요? (CT, X-ray, MRI 등) |

### 3. 구현 계획

#### Phase 1: 백엔드 API 추가
- **엔드포인트**: `GET /wello-api/v1/checkup-design/survey-questions?hospital_id={hospital_id}`
- **기능**: 병원별 프리미엄 항목 조회 후 동적 질문 생성
- **응답 형식**:
```json
{
  "basic_questions": [...],  // 기본 질문 (현재 8개)
  "dynamic_questions": [     // 동적 질문 (target_trigger 기반)
    {
      "key": "cancer_history",
      "label": "과거 암 진단을 받으신 적이 있으신가요?",
      "type": "radio",
      "options": [
        { "value": "yes", "label": "예" },
        { "value": "no", "label": "아니오" }
      ],
      "triggered_by": ["이미 암 진단을 받은 환자"]
    }
  ]
}
```

#### Phase 2: 프론트엔드 통합
- **CheckupDesignPage**: 병원 정보 로드 시 동적 질문 API 호출
- **CheckupDesignSurveyPanel**: 기본 질문 + 동적 질문 조합하여 표시
- **조건부 질문**: 동적 질문은 선택적으로 표시 (사용자가 스킵 가능)

#### Phase 3: 프롬프트 통합
- 동적 질문 응답도 프롬프트에 포함
- `target_trigger`와 매칭되는 응답이 있으면 해당 프리미엄 항목 우선 추천

---

## 구체적 구현 예시

### 예시 1: 암 진단 이력 질문
```typescript
// target_trigger에 "암 진단" 키워드가 있는 경우
{
  key: 'cancer_history',
  label: '과거 암 진단을 받으신 적이 있으신가요?',
  type: 'radio',
  options: [
    { value: 'yes_current', label: '예, 현재 치료 중입니다' },
    { value: 'yes_past', label: '예, 과거에 치료를 받았습니다' },
    { value: 'no', label: '아니오' }
  ],
  triggeredBy: ['이미 암 진단을 받은 환자', '암 확진 후']
}
```

### 예시 2: 간염 보균자 질문
```typescript
// target_trigger에 "간염 보균자" 키워드가 있는 경우
{
  key: 'hepatitis_carrier',
  label: 'B형 또는 C형 간염 보균자이신가요?',
  type: 'radio',
  options: [
    { value: 'hepatitis_b', label: 'B형 간염 보균자' },
    { value: 'hepatitis_c', label: 'C형 간염 보균자' },
    { value: 'both', label: '둘 다' },
    { value: 'no', label: '아니오' }
  ],
  triggeredBy: ['B형/C형 간염 보균자']
}
```

### 예시 3: 내시경 관련 질문
```typescript
// target_trigger에 "대장내시경" 키워드가 있는 경우
{
  key: 'colonoscopy_experience',
  label: '대장내시경 검사를 받으신 적이 있으신가요?',
  type: 'radio',
  options: [
    { value: 'yes_comfortable', label: '예, 불편함 없이 받았습니다' },
    { value: 'yes_uncomfortable', label: '예, 불편했습니다' },
    { value: 'no_afraid', label: '아니오, 두려워서 받지 않았습니다' },
    { value: 'no_never', label: '아니오, 받아본 적이 없습니다' }
  ],
  triggeredBy: ['대장내시경 준비(약물/금식) 기피자']
}
```

---

## 데이터 흐름

```
1. 사용자 검진 설계 페이지 진입
   ↓
2. CheckupDesignPage에서 hospital_id 추출
   ↓
3. API 호출: GET /wello-api/v1/checkup-design/survey-questions?hospital_id={hospital_id}
   ↓
4. 백엔드: wello_data_service.get_hospital_by_id() 호출
   ↓
5. external_checkup_items의 target_trigger 분석
   ↓
6. 키워드 매핑 테이블 기반 동적 질문 생성
   ↓
7. 기본 질문 + 동적 질문 반환
   ↓
8. CheckupDesignSurveyPanel에서 질문 표시
   ↓
9. 사용자 응답 수집
   ↓
10. 프롬프트에 동적 질문 응답 포함
   ↓
11. AI가 target_trigger와 매칭하여 프리미엄 항목 추천
```

---

## 장점

1. **병원별 맞춤형 문진**: 각 병원이 제공하는 프리미엄 항목에 맞춰 질문 생성
2. **업셀링 최적화**: target_trigger와 매칭되는 정보를 미리 수집하여 정확한 추천
3. **확장성**: 새로운 프리미엄 항목 추가 시 자동으로 질문 생성
4. **사용자 경험**: 불필요한 질문 최소화, 필요한 질문만 표시

---

## 고려사항

1. **질문 수 제한**: 동적 질문이 너무 많아지지 않도록 제한 (최대 3-5개 추가)
2. **중복 제거**: 여러 target_trigger에서 같은 키워드가 나오면 질문 중복 방지
3. **우선순위**: 자주 나타나는 키워드 우선으로 질문 생성
4. **선택적 표시**: 동적 질문은 "건너뛰기" 가능하도록 설정

---

## 다음 단계

1. ✅ target_trigger 분석 완료
2. ⏳ 키워드 매핑 테이블 정의
3. ⏳ 백엔드 API 구현
4. ⏳ 프론트엔드 통합
5. ⏳ 테스트 및 검증


