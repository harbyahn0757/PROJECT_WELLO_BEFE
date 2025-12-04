# 프론트엔드 테스트 체크리스트

**작성일**: 2025-01-02  
**목적**: 검진 설계 문진 시스템 테스트 전 최종 점검

---

## ✅ 완료된 사항

### 1. 프론트엔드 구현
- [x] `CheckupDesignSurveyPanel` 컴포넌트 수정 완료
- [x] 기본 질문 8개 + 선택 질문 1개 구조
- [x] 선택적 추가 질문 7개 정의
- [x] 라디오 선택 시 자동 진행 구현
- [x] "아니오" 선택 시 바로 제출 구현
- [x] 조건부 질문 표시 로직 (`useMemo` 사용)

### 2. 타입 정의
- [x] `SurveyResponses` 인터페이스에 선택적 필드 추가
- [x] `optional_questions_enabled`, `cancer_history`, `hepatitis_carrier` 등 필드 추가

### 3. 백엔드 호환성
- [x] 백엔드 `survey_responses: Optional[Dict[str, Any]]`로 모든 필드 수신 가능
- [x] 프롬프트 생성 시 `survey_responses_clean`으로 전달

---

## ⚠️ 확인 필요 사항

### 1. 프론트엔드 서비스 타입 업데이트
**파일**: `planning-platform/frontend/src/services/checkupDesignService.ts`

**현재 상태**:
```typescript
survey_responses?: {
  weight_change?: string;
  exercise_frequency?: string;
  family_history?: string[];
  smoking?: string;
  drinking?: string;
  sleep_hours?: string;
  stress_level?: string;
  additional_concerns?: string;
  prescription_analysis_text?: string;
  selected_medication_texts?: string[];
};
```

**필요한 업데이트**: 선택적 질문 필드 추가
```typescript
survey_responses?: {
  // 기본 질문
  weight_change?: string;
  exercise_frequency?: string;
  family_history?: string[];
  smoking?: string;
  drinking?: string;
  sleep_hours?: string;
  stress_level?: string;
  additional_concerns?: string;
  // 선택적 질문
  optional_questions_enabled?: string; // 'yes' | 'no'
  cancer_history?: string;
  hepatitis_carrier?: string;
  colonoscopy_experience?: string;
  lung_nodule?: string;
  gastritis?: string;
  imaging_aversion?: string;
  genetic_test?: string;
  // 약품 분석 (기존)
  prescription_analysis_text?: string;
  selected_medication_texts?: string[];
};
```

### 2. 프롬프트에 선택적 질문 포함 확인
**파일**: `planning-platform/backend/app/services/checkup_design_prompt.py`

**확인 사항**:
- [ ] `survey_responses_clean`에 선택적 질문 필드들이 포함되는지
- [ ] 프롬프트에 선택적 질문 응답이 포함되는지
- [ ] 기본 질문만 있어도 프리미엄 항목 추천이 가능한지

### 3. 데이터 전달 확인
**파일**: `planning-platform/frontend/src/pages/CheckupDesignPage.tsx`

**확인 사항**:
- [ ] `CheckupDesignSurveyPanel`에서 `onSubmit` 호출 시 모든 필드 전달되는지
- [ ] `handleNext`에서 `surveyResponses`가 올바르게 전달되는지

---

## 🧪 테스트 시나리오

### 시나리오 1: 기본 질문만 사용
1. 검진 설계 페이지 진입
2. 염려 항목 선택
3. 문진 패널 열림
4. 기본 질문 8개 답변
5. "더 정확한 검진 설계를 위해 추가 질문에 답하시겠어요?" → **"아니오"** 선택
6. **예상 결과**: 바로 제출, 기본 질문만으로 프리미엄 항목 추천

### 시나리오 2: 선택적 질문 포함
1. 검진 설계 페이지 진입
2. 염려 항목 선택
3. 문진 패널 열림
4. 기본 질문 8개 답변
5. "더 정확한 검진 설계를 위해 추가 질문에 답하시겠어요?" → **"예"** 선택
6. 추가 질문 7개 답변 (라디오 선택 시 자동 진행)
7. **예상 결과**: 모든 질문 응답 포함하여 제출, 더 정확한 프리미엄 항목 추천

### 시나리오 3: 라디오 자동 진행 확인
1. 문진 패널에서 라디오 버튼 선택
2. **예상 결과**: 300ms 후 자동으로 다음 질문으로 이동

### 시나리오 4: 체크박스 질문 (가족력, 영상 검사 기피)
1. "가족 중에 다음 질환이 있으신가요?" 질문에서 여러 항목 선택
2. **예상 결과**: 선택된 항목들이 배열로 저장됨

---

## 🔍 점검 체크리스트

### 코드 레벨
- [ ] 프론트엔드 서비스 타입 업데이트 필요 여부 확인
- [ ] 백엔드 프롬프트에 선택적 질문 포함 확인
- [ ] 데이터 전달 경로 확인 (SurveyPanel → CheckupDesignPage → API)

### 기능 레벨
- [ ] 기본 질문만으로 제출 가능한지
- [ ] 선택적 질문 활성화 시 추가 질문 표시되는지
- [ ] 라디오 자동 진행 작동하는지
- [ ] "아니오" 선택 시 바로 제출되는지
- [ ] 체크박스 질문 정상 작동하는지

### 통합 레벨
- [ ] API 호출 시 모든 필드 전달되는지
- [ ] 백엔드에서 선택적 질문 필드 수신하는지
- [ ] 프롬프트에 선택적 질문 응답 포함되는지
- [ ] 기본 질문만으로도 프리미엄 항목 추천 가능한지

---

## 🚀 테스트 시작 전 확인

1. **프론트엔드 서비스 타입 업데이트** (필요 시)
2. **백엔드 프롬프트 확인** (선택적 질문 포함 여부)
3. **데이터 전달 경로 확인**
4. **브라우저 콘솔 에러 확인**
5. **네트워크 탭에서 API 요청/응답 확인**

---

## 📝 예상 문제점 및 해결

### 문제 1: 타입 불일치
**증상**: TypeScript 에러 발생
**해결**: `checkupDesignService.ts`의 `CheckupDesignRequest` 인터페이스 업데이트

### 문제 2: 선택적 질문이 프롬프트에 포함되지 않음
**증상**: 선택적 질문 응답이 AI에 전달되지 않음
**해결**: `checkup_design_prompt.py`에서 `survey_responses_clean` 확인

### 문제 3: "아니오" 선택 시 제출 안 됨
**증상**: "아니오" 선택 후 제출 버튼이 나타나지 않음
**해결**: `handleRadioChange`에서 `optional_questions_enabled === 'no'` 처리 확인

---

**다음 단계**: 프론트엔드 서비스 타입 업데이트 후 테스트 시작


