# 검진 설계 시스템 종합 개선 계획

생성 일시: 2025-12-06 00:00  
작성자: AI Assistant

---

## 🚨 발견된 치명적 문제 3가지

### ❌ 문제 1: Gemini API 키 유출 및 비활성화

**현상**:
```
[WARN] RAG 검색 실패: Gemini API 호출 실패: 
403 Your API key was reported as leaked. Please use another API key.
```

**원인**:
- Gemini API 키가 **GitHub 또는 공개 장소에 노출**됨
- Google이 자동 감지하여 키를 비활성화시킴
- **RAG 시스템 완전 불능 상태**

**영향**:
- 모든 RAG 검색 실패 (100%)
- 의학 근거 제공 불가
- 추천의 신뢰도 하락

**즉시 조치 사항**:
1. 새 Gemini API 키 발급 (https://makersuite.google.com/app/apikey)
2. 기존 유출된 키 완전 삭제
3. `backend/config.env` 업데이트
4. `.gitignore`에 `config.env` 확인

**장기 대책**:
- GitHub Secrets 사용
- 환경변수 관리 자동화
- 키 로테이션 정책 수립

---

### ❌ 문제 2: priority_1/2/3 병합 누락

**현상**:
```
WARNING: ⚠️ [검증] priority_1.items가 비어있음
INFO: ✅ [변환] 변환 완료 - 0개 카테고리, 총 0개 항목
```

**원인**:
- STEP 2-1, 2-2에서 생성한 `priority_1`, `priority_2`, `priority_3`가 병합 시 누락됨
- 프론트엔드로 전달되지 않음

**해결 완료**:
```python
# ✅ 수정 완료 (checkup_design.py:1138)
merged_result = {
    ...
    "priority_1": safe_get(step2_result, "priority_1", {}),
    "priority_2": safe_get(step2_result, "priority_2", {}),
    "priority_3": safe_get(step2_result, "priority_3", {}),
    ...
}
```

**테스트 필요**: 다시 검진 설계 실행하여 화면 확인

---

### ❌ 문제 3: 화면 빈 페이지 표시

**원인**:
- 문제 1 + 문제 2의 복합 작용
- `recommended_items`가 0개 → 화면에 표시할 내용 없음

**해결 상태**: 
- 문제 2 해결 완료 ✅
- 문제 1 해결 대기 중 (새 API 키 필요)

---

## 📋 상세 개선 계획

### Phase 1: 긴급 수정 (즉시)

#### 1.1 Gemini API 키 교체 ⚠️ **최우선**

```bash
# 1. 새 키 발급
https://makersuite.google.com/app/apikey

# 2. config.env 업데이트
GOOGLE_GEMINI_API_KEY=새_키_입력

# 3. PM2 재시작
pm2 restart WELLO_BE

# 4. 테스트
# 브라우저에서 검진 설계 실행 → 로그 확인:
pm2 logs WELLO_BE --lines 50 | grep "RAG 검색"
```

**예상 결과**:
```
[INFO] RAG 검색 완료 - 3개 에비던스, 2,500자
```

---

#### 1.2 Priority 병합 버그 수정 ✅ **완료**

**수정 내역**:
1. `merge_checkup_design_responses`: priority_1/2/3 복사 추가
2. `convert_priorities_to_recommended_items`: 최상위/summary 양쪽 확인

**테스트 방법**:
```bash
# 1. 검진 설계 실행
# 2. 로그 확인
pm2 logs WELLO_BE --lines 100 | grep "변환 완료"

# 예상 결과:
✅ [변환] 변환 완료 - 3개 카테고리, 총 7개 항목
```

---

### Phase 2: UX 개선 - 점진적 로딩 (추천!)

#### 현재 흐름 vs 개선안

| 단계 | 현재 (답답함) | 개선안 (Netflix 스타일) |
|------|---------------|------------------------|
| 문진 완료 | 스피너 60초 대기 | STEP 1 (15초) → 결과 페이지 이동 |
| 분석 단계 | 아무것도 안 보임 | 요약 분석 즉시 표시 ✅ |
| 설계 단계 | 계속 대기... | 백그라운드 로딩 (Skeleton UI) |
| Priority 1 | ... | 25초 후 추가 표시 ✅ |
| Priority 2,3 | ... | 43초 후 추가 표시 ✅ |
| 결과 표시 | 60초 후 한 번에 | **15초부터 점진적으로!** |

**체감 속도**: 4배 빠름 (60초 → 15초)

---

#### 2.1 백엔드 API 분리 (선택사항)

**옵션 A**: 현재 구조 유지
- STEP 1 완료 후 즉시 navigate
- 결과 페이지에서 STEP 2 API 호출

**옵션 B**: API 완전 분리
```
POST /api/v1/checkup-design/create-step1     # 15초
POST /api/v1/checkup-design/create-step2-1   # 25초
POST /api/v1/checkup-design/create-step2-2   # 18초
```

**추천**: 옵션 A (구현 간단, 변경 최소)

---

#### 2.2 프론트엔드 수정

**파일**: `CheckupDesignPage.tsx`

**Before**:
```typescript
const step1Response = await checkupDesignService.createCheckupDesignStep1(...);
const step2Response = await checkupDesignService.createCheckupDesignStep2(...);

navigate('/checkup-recommendations', { 
  state: { checkupDesign: {...step1, ...step2} }
});
```

**After**:
```typescript
const step1Response = await checkupDesignService.createCheckupDesignStep1(...);

// STEP 1 완료 후 즉시 이동!
navigate('/checkup-recommendations', { 
  state: { 
    checkupDesign: step1Response.data,
    loadingStep2: true  // ← 백그라운드 로딩 플래그
  }
});
```

---

**파일**: `CheckupRecommendationsPage.tsx`

**추가 기능**:
```typescript
const [loadingStep2, setLoadingStep2] = useState(
  location.state?.loadingStep2 || false
);

useEffect(() => {
  if (loadingStep2) {
    // 백그라운드에서 STEP 2 호출
    loadStep2Data();
  }
}, [loadingStep2]);

const loadStep2Data = async () => {
  const step2Response = await checkupDesignService.createCheckupDesignStep2(...);
  
  // 데이터 도착하면 화면 업데이트
  setGptResponse(prev => ({
    ...prev,
    ...step2Response.data
  }));
  
  setLoadingStep2(false);
};
```

**화면 렌더링**:
```tsx
{/* STEP 1 결과는 즉시 표시 */}
<div className="summary">
  {gptResponse.patient_summary}
</div>

{/* STEP 2 결과는 로딩 중이면 Skeleton */}
{loadingStep2 ? (
  <SkeletonLoader />
) : (
  <div className="priority-items">
    {gptResponse.priority_1?.items.map(...)}
  </div>
)}
```

---

#### 2.3 Skeleton 컴포넌트

**파일**: `components/SkeletonLoader.tsx` (신규)

```tsx
export const SkeletonLoader = () => (
  <div className="skeleton">
    <div className="skeleton__line skeleton__line--title"></div>
    <div className="skeleton__line skeleton__line--text"></div>
    <div className="skeleton__line skeleton__line--text"></div>
    <div className="skeleton__line skeleton__line--short"></div>
  </div>
);
```

**CSS**:
```scss
.skeleton {
  animation: pulse 1.5s ease-in-out infinite;
  
  &__line {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    height: 20px;
    margin-bottom: 10px;
    border-radius: 4px;
    
    &--title { height: 28px; width: 60%; }
    &--text { width: 100%; }
    &--short { width: 40%; }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

### Phase 3: 로깅 시스템 개선

#### 3.1 통합 로그 파일

**목표**: 한 실행당 하나의 로그 파일

**구조**:
```
logs/
  execution_20251206_000000_UUID.json
    ├─ execution_id
    ├─ timestamp
    ├─ patient_info
    ├─ step1_input
    ├─ step1_prompt
    ├─ step1_response
    ├─ step2_1_prompt
    ├─ step2_1_response
    ├─ step2_2_prompt
    ├─ step2_2_response
    ├─ rag_queries
    ├─ rag_results
    └─ final_output
```

**파일**: `services/execution_logger.py` (신규)

```python
class ExecutionLogger:
    def __init__(self, uuid: str):
        self.execution_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid}"
        self.log_file = f"logs/execution_{self.execution_id}.json"
        self.log_data = {
            "execution_id": self.execution_id,
            "timestamp": datetime.now().isoformat(),
            "steps": {}
        }
    
    def log_step(self, step_name: str, data: dict):
        self.log_data["steps"][step_name] = {
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        self._save()
    
    def _save(self):
        with open(self.log_file, 'w', encoding='utf-8') as f:
            json.dump(self.log_data, f, ensure_ascii=False, indent=2)
```

**사용 예**:
```python
logger = ExecutionLogger(uuid)
logger.log_step("step1_input", {...})
logger.log_step("step1_response", gpt_response)
logger.log_step("rag_search", rag_results)
```

---

### Phase 4: 에러 핸들링 강화

#### 4.1 부분 성공 허용

**현재 문제**:
- STEP 2-1 실패 → 전체 실패
- STEP 2-2 실패 → 전체 실패

**개선안**:
```python
# checkup_design.py
try:
    step2_1_result = await call_step2_1()
except Exception as e:
    logger.error(f"STEP 2-1 실패: {e}")
    step2_1_result = None  # ← 계속 진행!

try:
    step2_2_result = await call_step2_2()
except Exception as e:
    logger.error(f"STEP 2-2 실패: {e}")
    step2_2_result = None  # ← 계속 진행!

# 부분 성공 반환
return CheckupDesignResponse(
    success=True,
    data={
        ...step1_result,
        **(step2_1_result or {}),
        **(step2_2_result or {})
    },
    message="부분 완료" if not step2_2_result else "완료"
)
```

---

#### 4.2 RAG 실패 시 Fallback

**현재**: RAG 실패 → 에비던스 없음

**개선**: RAG 실패 → 기본 가이드라인 사용

```python
def get_medical_evidence_from_rag(...):
    try:
        results = await rag_engine.query(...)
        if not results:
            return get_fallback_evidence()  # ← Fallback!
        return results
    except Exception as e:
        logger.error(f"RAG 실패: {e}")
        return get_fallback_evidence()  # ← Fallback!

def get_fallback_evidence():
    return {
        "rag_evidence_context": """
        [기본 의학 가이드라인]
        
        1. 고혈압 관리 (대한고혈압학회 2022)
        - 수축기 140mmHg 이상 시 약물 치료 권고
        
        2. 당뇨병 관리 (대한당뇨병학회 2023)
        - 공복 혈당 126mg/dL 이상 시 진단
        
        3. 비만 관리 (대한비만학회 2021)
        - BMI 25 이상 시 체중 감량 권고
        """,
        "structured_evidences": []
    }
```

---

## 📊 작업 우선순위

| 순위 | 작업 | 소요 시간 | 중요도 | 난이도 |
|------|------|-----------|--------|--------|
| 1️⃣ | Gemini API 키 교체 | **5분** | ⚠️ 긴급 | 쉬움 |
| 2️⃣ | Priority 병합 테스트 | 5분 | 높음 | 쉬움 |
| 3️⃣ | RAG Fallback 추가 | 20분 | 높음 | 중간 |
| 4️⃣ | 점진적 로딩 구현 | 60분 | 중간 | 중간 |
| 5️⃣ | 통합 로깅 시스템 | 40분 | 낮음 | 중간 |
| 6️⃣ | 에러 핸들링 강화 | 30분 | 중간 | 쉬움 |

**총 소요 시간**: 약 2.5시간

---

## ✅ 즉시 실행 가능한 명령어

### 1. Gemini API 키 교체 (최우선!)

```bash
# 1. 새 키 발급 후
nano /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/config.env

# 2. 수정
GOOGLE_GEMINI_API_KEY=새_발급_받은_키

# 3. 저장 후 재시작
pm2 restart WELLO_BE

# 4. 테스트
curl -X POST "http://localhost:8082/api/v1/checkup-design/create-step2" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 2. 현재 상태 테스트

```bash
# 브라우저에서 검진 설계 실행 후
pm2 logs WELLO_BE --lines 200 | grep -E "변환 완료|recommended_items"

# 예상 결과 (성공 시):
✅ [변환] Priority 1 변환 완료: 2개
✅ [변환] Priority 2 변환 완료: 2개
✅ [변환] 변환 완료 - 2개 카테고리, 총 4개 항목
```

---

## 🎯 최종 목표

1. **안정성**: RAG 실패해도 기본 서비스 제공
2. **속도**: 15초 내 첫 화면 표시
3. **투명성**: 전체 로그 추적 가능
4. **사용자 경험**: 점진적 로딩으로 체감 속도 4배 향상

---

## 📞 다음 단계

**사용자 선택**:
1. **긴급 수정만** (Gemini 키 + 테스트) → 10분
2. **긴급 + 점진적 로딩** → 1.5시간
3. **전체 개선** → 2.5시간

**어떻게 진행할까요?** 🤔


