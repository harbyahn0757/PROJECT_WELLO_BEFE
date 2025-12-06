# 검진 설계 프롬프트 엔지니어링 분석 보고서

**작성일**: 2025-01-07  
**분석 대상**: 안광수님 케이스 (e3471a9a-2d67-4a23-8599-849963397d1c)  
**로그 경로**: `/backend/logs/planning_20251207/20251207_015015_e3471a9a/`

---

2. **프롬프트 예시 업데이트**: Output Format 섹션에 구체적인 구조 명시

---

### 2. 에비던스 각주 클릭 미작동 문제

**증상**: `[1]`, `[2]` 같은 각주를 클릭해도 아무 반응 없음

**원인 분석**:
- **백엔드 출력**: `evidence` 필드에 각주 번호는 포함되지만, `references` 배열이 strategies에 없음
  ```json
  "evidence": "고혈압 고위험군(고혈압전단계, 과체중/비만 등)에게는 매년 고혈압 선별검사를 받을 것이 권장됩니다 [1]."
  // ❌ references 필드 없음
  ```
- **프론트엔드 로직**: `CheckupComponents.tsx`의 `renderContentWithCitations` 함수는 `references` 배열을 받아야 각주를 클릭 가능한 링크로 변환
- **매칭 문제**: `[1]` 각주와 `references[0]` URL이 매칭되지 않음

**해결 방안**:
1. **백엔드 출력 형식 수정**: `step2_upselling.py`에서 각 strategy에 `references` 배열 추가
   ```json
   "doctor_recommendation": {
     "reason": "...",
     "evidence": "... [1]",
     "references": ["https://...", "https://..."]  // ✅ 추가 필요
   }
   ```

2. **RAG Evidence 매핑**: 프롬프트에서 `[Critical Evidence]` 섹션의 각 번호와 실제 URL을 매핑하여 `references` 배열 생성 지시

3. **프론트엔드 수정**: `CheckupItemCard` 컴포넌트에서 `evidence` 필드 렌더링 시 `references` prop 전달 확인

---

### 3. 프롬프트 엔지니어링 개선 사항

#### 3.1 비유(Analogy) 사용 모드 부재

**현재 상태**: 검사 설명이 의학 용어 중심으로만 구성됨

**개선 제안**:
```markdown
## 4. 비유(Analogy) 사용 모드 ⭐
- **심장 = 펌프/엔진**: "심장은 우리 몸의 엔진입니다. 엔진이 불규칙하게 돌면 차가 고장나듯, 심장도 리듬이 깨지면 문제가 생깁니다."
- **혈관 = 파이프**: "혈관은 물이 흐르는 파이프와 같습니다. 파이프가 좁아지거나 막히면 압력이 올라갑니다."
- **간 = 공장**: "간은 우리 몸의 화학 공장입니다. 술이나 약을 처리하다 보니 공장이 지치면 수치가 올라갑니다."
```

**적용 위치**: `step2_upselling.py` System Instruction 섹션에 추가

---

#### 3.2 3050 남성 타겟 지시어 부재

**현재 상태**: 페르소나별 접근은 있으나, 연령대별 특화 전략 없음

**개선 제안**:
```markdown
## 5. 타겟 연령대별 접근 전략
- **3050 남성 (30-50세 남성)**: 
  - '건강 염려'보다 '가성비'와 '효율'을 중시
  - "이 검사 하나로 여러 가지를 한번에 확인할 수 있어서 효율적입니다"
  - "나중에 병원을 여러 번 다닐 필요 없이 지금 한번에 체크하시죠"
  - 문진에서 "효율", "시간", "비용" 관련 키워드가 있으면 이 접근법 사용
```

**적용 위치**: `step2_upselling.py` 페르소나 섹션에 추가

**문진 데이터 확인 필요**: `survey_responses`에서 연령대와 효율성 선호도를 판단할 수 있는 데이터 확인

---

#### 3.3 Disclaimer (면책 조항) 강화 필요

**현재 상태**: 프롬프트에 진단 금지 지시는 있으나, LLM이 여전히 "당뇨병입니다" 같은 진단 표현 사용 가능

**개선 제안**:
```markdown
## 6. 진단 금지 (Diagnosis Prohibition) - 절대 규칙 ⚠️
- ❌ **절대 금지**: "당뇨병입니다", "고혈압 환자입니다", "암 의심 소견입니다"
- ✅ **올바른 표현**: 
  - "가이드라인에 따르면 당뇨병 전단계 의심 소견이므로, 확진 검사(HbA1c 재검 등)가 권고됩니다"
  - "혈압이 경계 수준이므로 정밀 검사로 확인이 필요합니다"
  - "초기 암 가능성을 배제하기 위해 정밀 검사가 필요합니다"

**역할 제한**: 당신은 '검진 설계자'이지 '진단 의사'가 아닙니다. 
- 내부 판단: "이 수치는 당뇨병 전단계로 판단됩니다" (시스템 내부 로직)
- 외부 표현: "당뇨병 전단계 의심 소견이므로 확진 검사가 필요합니다" (사용자에게 전달)
```

**적용 위치**: `step1_prompt.py`와 `step2_upselling.py` 모두에 추가

---

#### 3.4 Context Bridge 부재

**현재 상태**: Step 1의 분석 결과(체중 감소 + 가족력)가 Step 2.2의 추천 논리에 충분히 반영되지 않음

**개선 제안**:
```markdown
# 🔗 Context Bridge (반드시 반영할 것) ⭐

이 환자의 가장 큰 잠재 위험(Latent Risk)은 단순히 '고혈압'이 아닙니다.

**[Critical Context]**: 
- "최근 6개월간 3kg의 의도치 않은 체중 감소"가 "고혈압 가족력"과 결합되어 있습니다.
- 체중 감소 + 심장질환 가족력 = 심혈관 위험 증가 가능성
- 흡연 + 체중 감소 = 폐/대사 질환 위험 증가 가능성

**Instruction**: 
정밀 검사를 제안할 때, 단순히 "가이드라인 권고"라고 하지 말고, 
**"체중이 빠지면서 심장 부담이 늘어날 수 있으니, 심전도로 리듬을 확인하시죠"** 
같이 **맥락을 연결**하여 설명하세요.

**Step 1 → Step 2 연결 예시**:
- Step 1: "체중 감소 + 흡연 + 심장질환 가족력"
- Step 2 추천: "심전도 검사" 
- 연결 논리: "체중이 빠지면서 심장이 더 부담받을 수 있는데, 가족력까지 있으니 리듬부터 확인하시죠"
```

**적용 위치**: `step2_upselling.py` Context 섹션 상단에 추가

**RAG 활용 가능성**: 
- 사용자 제안대로, RAG에서 "체중 감소 + 심장질환 가족력" 조합에 대한 의학적 근거를 검색하여 Context Bridge에 포함
- `rag_service.py`의 쿼리 로직에 복합 위험 요인 검색 기능 추가 검토

---

## 📊 프롬프트 구조 분석

### 현재 프롬프트 흐름

```
Step 1 (step1_prompt.py)
  ↓
  - 환자 데이터 분석
  - 페르소나 결정
  - 위험도 프로필 생성
  ↓
Step 2-1 (step2_priority1.py)
  ↓
  - 기본 검진 항목 선정
  - Priority 1 구성
  ↓
Step 2-2 (step2_upselling.py) ← 현재 문제 집중 영역
  ↓
  - 정밀 검사 추천
  - Bridge Strategy 생성
  - doctor_comment 생성 (❌ 형식 문제)
```

### 개선된 프롬프트 흐름 (제안)

```
Step 1 (step1_prompt.py)
  ↓
  - 환자 데이터 분석
  - 페르소나 결정 (연령대별 특화 포함)
  - 위험도 프로필 생성
  - Context Bridge 데이터 준비 (체중 감소 + 가족력 조합 등)
  ↓
Step 2-1 (step2_priority1.py)
  ↓
  - 기본 검진 항목 선정
  - Priority 1 구성
  ↓
Step 2-2 (step2_upselling.py) ← 개선 필요
  ↓
  - Context Bridge 주입 (Step 1 결과 강제 연결)
  - 비유(Analogy) 모드 활성화
  - 타겟 연령대별 접근 전략 적용
  - 정밀 검사 추천
  - Bridge Strategy 생성
  - doctor_comment 생성 (✅ 객체 형식)
  - references 배열 생성 (✅ 각주 매핑)
```

---

## 🔧 즉시 수정 가능한 항목

### 1. doctor_comment 출력 형식 수정

**파일**: `planning-platform/backend/app/services/checkup_design/step2_upselling.py`

**수정 위치**: 333번 라인

**변경 전**:
```python
"doctor_comment": "전체적인 검진 방향에 대한 의사의 코멘트 (페르소나 반영)"
```

**변경 후**:
```python
"doctor_comment": {
  "overall_assessment": "전체적인 검진 방향에 대한 의사의 종합 평가 (페르소나 반영, 2-3문장)",
  "key_recommendations": [
    "핵심 추천사항 1 (구체적 검사명 포함)",
    "핵심 추천사항 2",
    "핵심 추천사항 3"
  ]
}
```

---

### 2. references 배열 추가

**파일**: `planning-platform/backend/app/services/checkup_design/step2_upselling.py`

**수정 위치**: 315-319번 라인 (doctor_recommendation 섹션)

**변경 전**:
```python
"doctor_recommendation": {
  "reason": "...",
  "evidence": "... [1]",
  "message": "..."
}
```

**변경 후**:
```python
"doctor_recommendation": {
  "reason": "...",
  "evidence": "... [1]",
  "references": ["https://...", "https://..."],  # [1] = references[0], [2] = references[1]
  "message": "..."
}
```

**프롬프트 지시 추가**:
```markdown
5. **Evidence & References 매핑**: 
   - evidence 필드에 `[1]`, `[2]` 같은 각주를 사용했다면, 
   - references 배열에 해당 번호 순서대로 URL을 포함하세요.
   - 예: evidence에 "[1]"이 있으면 references[0]에 해당 URL
```

---

## 🎯 단계별 개선 계획

### Phase 1: 긴급 수정 (즉시 적용)
- [ ] doctor_comment 출력 형식 수정 (객체로 변경)
- [ ] references 배열 추가 및 매핑 로직 구현
- [ ] 프론트엔드에서 references prop 전달 확인

### Phase 2: 프롬프트 개선 (1주 내)
- [ ] 비유(Analogy) 사용 모드 추가
- [ ] 3050 남성 타겟 지시어 추가 (문진 데이터 확인 후)
- [ ] Disclaimer 강화 (진단 금지 명확화)

### Phase 3: Context Bridge 구현 (2주 내)
- [ ] Step 1 → Step 2 Context Bridge 섹션 추가
- [ ] RAG 서비스에 복합 위험 요인 검색 기능 추가 검토
- [ ] 맥락 연결 논리 자동화

---

## 📝 추가 확인 사항

### 1. 문진 데이터 구조 확인
- `survey_responses`에서 연령대 정보 추출 가능 여부
- 효율성/가성비 선호도 판단 가능한 키워드 존재 여부
- 페르소나 판단 로직과 연령대 정보 연동 가능 여부

### 2. RAG Evidence 매핑
- `rag_evidences` 배열에서 각 번호([1], [2])와 URL 매핑 로직 확인
- 프론트엔드 `handleShowEvidence` 함수와 백엔드 출력 형식 일치 여부

### 3. 프론트엔드 렌더링 로직
- `renderTextWithFootnotes` 함수가 모든 evidence 필드에 적용되는지 확인
- `CheckupItemCard`에서 `references` prop 전달 경로 확인

---

## 🎓 프롬프트 엔지니어링 원칙 반영

### 1. 명확성 (Clarity)
- ✅ 각주 번호와 URL 매핑 명확화
- ✅ doctor_comment 구조 명시

### 2. 일관성 (Consistency)
- ✅ Step 1 → Step 2 데이터 흐름 일관성 확보
- ✅ 프론트엔드-백엔드 데이터 형식 일치

### 3. 제약 조건 (Constraints)
- ✅ 진단 금지 명확화
- ✅ 역할 제한 (검진 설계자 vs 진단 의사)

### 4. 맥락 제공 (Context)
- ✅ Context Bridge로 Step 1 결과 강제 연결
- ✅ 비유와 타겟 연령대별 접근으로 이해도 향상

---

**다음 단계**: 사용자 승인 후 Phase 1부터 순차적으로 진행

