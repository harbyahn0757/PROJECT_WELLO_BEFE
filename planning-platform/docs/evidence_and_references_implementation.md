# 에비던스 및 참고 자료 구현 보고서

## 📋 구현 개요

검진 설계 응답에 **의학적 근거(evidence)**와 **참고 자료(references)**를 포함하여, 사용자가 추천 이유를 명확히 이해하고 신뢰할 수 있도록 개선했습니다.

## ✅ 구현 완료 사항

### 1. 백엔드 - Perplexity Citations 추출

**파일**: `backend/app/services/perplexity_service.py`

**변경 사항**:
- `PerplexityResponse`에 `citations` 필드 추가
- Perplexity API 응답에서 `citations` 추출
- 응답 로그에 citations 개수 기록

```python
@dataclass
class PerplexityResponse:
    content: str
    model: str
    usage: Dict[str, int]
    success: bool
    error: Optional[str] = None
    citations: Optional[List[str]] = None  # 추가됨
```

### 2. 백엔드 - 프롬프트에 에비던스 요청 추가

**파일**: `backend/app/services/checkup_design_prompt.py`

**변경 사항**:
- 시스템 메시지에 "의학적 근거와 참고 자료 기반" 요구사항 추가
- JSON 응답 구조에 `evidence` 및 `references` 필드 추가
- 응답 규칙에 의학적 근거 명시 요구사항 추가

**추가된 필드**:
```json
{
  "items": [
    {
      "name": "혈압 측정",
      "reason": "가족력에 고혈압이 있는 점을 고려하여...",
      "evidence": "대한의학회 건강검진 가이드라인에 따르면...",
      "references": [
        "https://www.kma.org/...",
        "대한의학회 건강검진 가이드라인 2023"
      ]
    }
  ]
}
```

### 3. 백엔드 - API 엔드포인트에서 Citations 포함

**파일**: `backend/app/api/v1/endpoints/checkup_design.py`

**변경 사항**:
- `call_api()` 대신 `call_with_json_response()` 사용 → `call_api()`로 변경하여 citations 추출
- Citations를 응답에 `_citations` 필드로 추가
- 로그에 citations 개수 기록

### 4. 프론트엔드 - 타입 정의 추가

**파일**: `frontend/src/pages/CheckupRecommendationsPage.tsx`

**변경 사항**:
- `CheckupItem` 인터페이스에 `evidence`, `references` 필드 추가

```typescript
interface CheckupItem {
  id: string;
  name: string;
  reason?: string;
  evidence?: string;  // 추가됨
  references?: string[];  // 추가됨
  recommended: boolean;
}
```

### 5. 프론트엔드 - UI에 에비던스 및 참고 자료 표시

**파일**: `frontend/src/pages/CheckupRecommendationsPage.tsx`

**변경 사항**:
- 각 검진 항목에 "의학적 근거" 섹션 추가
- 각 검진 항목에 "참고 자료" 섹션 추가 (링크는 클릭 가능)
- 종합 분석 섹션에 Perplexity Citations 표시

**표시 구조**:
```
항목: 혈압 측정
├─ 설명: "혈압을 측정하여..."
├─ 추천 이유: "가족력에 고혈압이 있는 점을 고려하여..."
├─ 의학적 근거: "대한의학회 건강검진 가이드라인에 따르면..." ✅
└─ 참고 자료:
    ├─ https://www.kma.org/... (링크) ✅
    └─ "대한의학회 건강검진 가이드라인 2023" ✅
```

### 6. 프론트엔드 - 스타일 추가

**파일**: `frontend/src/pages/CheckupRecommendationsPage.scss`

**추가된 스타일**:
- `.checkup-recommendations__item-evidence`: 의학적 근거 섹션
- `.checkup-recommendations__item-references`: 참고 자료 섹션
- `.checkup-recommendations__item-reference-link`: 링크 스타일
- `.checkup-recommendations__citations`: 종합 분석 Citations

## 🔍 동작 방식

### 1. Perplexity API 호출 시

1. Perplexity API 호출
2. 응답에서 `citations` 추출
3. JSON 응답 파싱
4. Citations를 `_citations` 필드로 추가

### 2. AI 응답 생성 시

AI 모델(Perplexity/OpenAI)이 다음을 포함하여 응답:
- `reason`: 추천 이유 (환자 데이터 기반)
- `evidence`: 의학적 근거 (가이드라인, 연구 결과 등)
- `references`: 참고 자료 (링크 또는 출처)

### 3. 프론트엔드 표시 시

1. 각 검진 항목에 `evidence`가 있으면 "의학적 근거" 섹션 표시
2. 각 검진 항목에 `references`가 있으면 "참고 자료" 섹션 표시
3. 링크는 클릭 가능한 `<a>` 태그로 표시
4. 종합 분석에 Perplexity Citations 표시

## 📊 예상 응답 구조

```json
{
  "recommended_items": [
    {
      "category": "기본 건강검진",
      "items": [
        {
          "name": "혈압 측정",
          "description": "혈압을 측정하여 고혈압 여부를 확인합니다.",
          "reason": "가족력에 고혈압이 있는 점을 고려하여, 정기적인 혈압 측정이 필요합니다.",
          "evidence": "대한의학회 건강검진 가이드라인(2023)에 따르면, 가족력이 있는 경우 연령과 무관하게 정기적인 혈압 측정이 권장됩니다.",
          "references": [
            "https://www.kma.org/health-checkup-guidelines-2023",
            "대한의학회 건강검진 가이드라인 2023"
          ],
          "priority": 1,
          "recommended": true
        }
      ]
    }
  ],
  "analysis": "종합 분석 내용...",
  "total_count": 5,
  "_citations": [
    "https://www.kma.org/...",
    "https://www.cdc.go.kr/..."
  ]
}
```

## ✅ 검증 사항

### 백엔드
- ✅ Perplexity 응답에서 citations 추출
- ✅ 프롬프트에 에비던스 요청 추가
- ✅ 응답 구조에 evidence, references 필드 포함
- ✅ Citations를 응답에 추가

### 프론트엔드
- ✅ 타입 정의에 evidence, references 추가
- ✅ UI에 의학적 근거 표시
- ✅ UI에 참고 자료 표시 (링크 클릭 가능)
- ✅ 종합 분석에 Citations 표시
- ✅ 스타일 적용

## 🎯 다음 단계

1. **실제 테스트**: API 호출하여 evidence와 references가 포함되는지 확인
2. **Perplexity Citations 확인**: 실제 Perplexity 응답에 citations가 포함되는지 확인
3. **UI 테스트**: 프론트엔드에서 에비던스와 참고 자료가 올바르게 표시되는지 확인

## 📝 참고 사항

- Perplexity는 온라인 검색 기능이 있어 citations를 제공할 수 있음
- OpenAI는 일반적으로 citations를 제공하지 않으므로, 프롬프트에서 명시적으로 요청해야 함
- References는 링크 또는 텍스트 형태로 제공 가능
- Evidence는 의학적 근거를 텍스트로 설명


