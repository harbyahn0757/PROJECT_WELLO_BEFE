# mediArc 건기식 RAG 맞춤 추천 Phase 1 기획서

> 작성일: 2026-04-16
> 작성자: dev-planner
> 범위: Phase 1 (2-4주), nutrition_rules 6종 -> 28종 확장 + RAG 에비던스 + GPT 스토리텔링
> 경쟁 우위: 실측 검진 수치(13종) + 16개 질환 위험도 + RAG 357종 약물 상호작용 동시 보유 (글로벌 유일)

---

## 0. 요약

**현재 문제**: `nutrition_rules.py`에 6종 영양소만 하드코딩. 설명문 고정, 개인화 없음, 에비던스 미노출.

**Phase 1 목표**:
1. 영양소 풀을 6종에서 28종으로 확장 (룰 기반 후보 선정)
2. RAG로 각 영양소의 식약처 인정 기능성/용량/주의사항 동적 조회
3. GPT-4o-mini로 "OOO님의 혈압이 135라 경계예요" 수준의 개인화 스토리텔링
4. FE 카드 리디자인: 에비던스 배지 + 용량 가이드 + Disclosure

**Phase 2 (4-8주, 이후 별도 기획)**: 복용 약물 입력 + 357종 약물-영양소 상호작용 경고

**의학적 소견 절대 금지**: 가이드라인 제시만 허용. "~질환입니다" 표현 프롬프트 레벨에서 차단.

---

## 1. 아키텍처 (4-step 파이프라인)

### 1-1. 전체 흐름도

```
facade.py::generate_report()
  |
  v
nutrition_service.recommend(patient_dict, disease_results, medications=[])
  |
  +-- Step 1: 룰 엔진 (nutrition_rules.py 확장)
  |     입력: patient_dict (13종 수치) + disease_results (16개 질환)
  |     출력: 후보 8-12종 (28종 풀에서 조건 매칭)
  |
  +-- Step 2: RAG 에비던스 조회
  |     입력: 후보 영양소 코드 리스트
  |     사용: pnt_rag_service.get_batch_supplement_info()
  |           + checkup_design/vector_search.py (FAISSVectorSearch)
  |     출력: 영양소별 { evidence_source, dosage, timing, caution_text }
  |
  +-- Step 3: 약물 상호작용 체크 (Phase 1에서는 빈 배열 허용)
  |     입력: medications[] + 후보 영양소
  |     사용: FAISS 검색 "약물명 + 영양소명 + 상호작용"
  |     출력: 상호작용 경고 리스트 (Phase 1: 빈 배열 통과)
  |
  +-- Step 4: GPT-4o-mini 스토리텔링
  |     입력: 환자 수치 + 영양소 + RAG 에비던스
  |     출력: 개인화 설명 1-2문장 (80자 이내)
  |
  v
NutritionResult { recommend: [...5종], caution: [...6종] }
```

### 1-2. 데이터 흐름 상세

```python
# 입력 (facade.py에서 넘겨주는 것과 동일한 구조)
patient_dict = {
    "alt": 54, "sbp": 138, "dbp": 85, "bmi": 26,
    "cr": 1.3, "tc": 190, "ldl": 125, "fbg": 115,
    "hemoglobin": 14.0, "hdl": 42, "tg": 180,
    "ast": 28, "ggt": 45,
    "age": 55, "sex": "M", "name": "김광중"
}

disease_results = {
    "고혈압":       {"result": "이상", "ratio": 0.35, "rank": 15},
    "당뇨":         {"result": "이상", "ratio": 0.28, "rank": 22},
    "이상지질혈증": {"result": "이상", "ratio": 0.42, "rank": 10},
    "만성신장병":   {"result": "정상", "ratio": 0.08, "rank": 65},
    # ... 16개 질환
}

medications = []  # Phase 1: 빈 배열

# 출력
{
    "recommend": [
        {
            "name": "밀크씨슬",
            "tag": "간 건강",
            "desc": "김광중님의 ALT가 54로 기준치(40)를 넘었어요. 밀크씨슬의 실리마린 성분이 간세포 보호에 도움을 줄 수 있어요.",
            "evidence": {
                "source": "식약처 인정 기능성 원료",
                "type": "official",
                "detail": "간 건강에 도움을 줄 수 있음 (개별인정형)"
            },
            "dosage": {
                "amount": "실리마린 130mg/일",
                "timing": "식후",
                "duration": "3개월 이상 꾸준히"
            },
            "caution": null,
            "priority": 1
        },
        # ... 최대 5종
    ],
    "caution": [
        {
            "name": "글루코사민",
            "tag": "당뇨 위험군 주의",
            "desc": "공복혈당이 115로 당뇨 전단계예요. 글루코사민은 혈당을 올릴 수 있어 주의가 필요해요.",
            "evidence": {
                "source": "대한당뇨병학회 가이드라인",
                "type": "guideline"
            },
            "priority": 1
        },
        # ... 최대 6종
    ]
}
```

### 1-3. 기존 facade.py 연결 변경점

현재 (`nutrition_rules.py` 직접 호출):
```python
# facade.py:109-134
from .nutrition_rules import recommend_nutrients, caution_nutrients
nutrition_result = {
    "recommend": recommend_nutrients(_nr_patient, _nr_diseases),
    "caution":   caution_nutrients(_nr_patient, _nr_diseases),
}
```

변경 후 (`nutrition_service.py` 경유):
```python
# facade.py 변경
from .nutrition_service import NutritionService

nutrition_svc = NutritionService()
nutrition_result = await nutrition_svc.recommend(
    patient=_nr_patient,
    diseases=_nr_diseases,
    name=name,
    medications=[]
)
```

**주의**: facade.py::generate_report()는 현재 **동기 함수**. nutrition_service의 RAG/GPT 호출은 비동기이므로, 두 가지 전략 중 선택:
- (A) generate_report를 async로 전환 (영향 범위 큼 -- 호출부 전부 수정)
- (B) nutrition_service에 sync wrapper 제공 (`asyncio.run()` 또는 `loop.run_until_complete`)
- **권장: (B)** -- facade.py 호출 체인 변경 최소화. nutrition_service 내부에서 async를 감싸는 `recommend_sync()` 메서드 제공.

---

## 2. 영양소 풀 (28종 목록 + 카테고리 + 추천 조건)

### 2-1. 기존 6종 (유지, 리팩터링)

| # | 영양소 | 카테고리 | 현재 추천 조건 | 변경 사항 |
|---|--------|----------|---------------|----------|
| 1 | 오메가3 | 혈압/심혈관 | HTN이상 or SBP>=130 or TC>=200 or LDL>=130 | 유지, RAG 에비던스 추가 |
| 2 | 코엔자임Q10 | 혈압/심혈관 | HTN이상 or SBP>=130 | 유지, RAG 에비던스 추가 |
| 3 | 콜레우스 포스콜리 | 체중 | BMI>=28 | 유지, RAG 에비던스 추가 |
| 4 | 밀크씨슬 | 간/해독 | ALT>40 | 유지, RAG 에비던스 추가 |
| 5 | 비타민B | 기본 | 기본 추천 (질환 2개 이하) | 유지, RAG 에비던스 추가 |
| 6 | 생균제제 | 장 | 기본 추천 (질환 2개 이하) | 유지, RAG 에비던스 추가 |

### 2-2. 신규 22종

| # | 영양소 | 카테고리 | 추천 조건 (룰) | RAG 쿼리 키워드 |
|---|--------|----------|---------------|----------------|
| 7 | 마그네슘 | 혈압/심혈관 | SBP>=130 and 신장 정상(cr<1.2) | "마그네슘 혈압 식약처" |
| 8 | 칼륨 | 혈압/심혈관 | SBP>=140 and 신장 정상 | "칼륨 혈압 감소" |
| 9 | 크롬 | 혈당/당뇨 | FBG>=100 and 간 정상(ALT<=40) | "크롬 혈당 조절 식약처" |
| 10 | 알파리포산 | 혈당/당뇨 | FBG>=110 or 당뇨 이상 | "알파리포산 혈당 항산화" |
| 11 | 바나바잎 | 혈당/당뇨 | FBG>=100 | "바나바잎 코로솔산 혈당" |
| 12 | NAC (N-아세틸시스테인) | 간/해독 | ALT>35 or GGT>50 | "NAC 글루타치온 간" |
| 13 | 글루타치온 | 간/해독 | ALT>40 or AST>40 | "글루타치온 간 해독 항산화" |
| 14 | 가르시니아 | 체중 | BMI>=25 and BMI<28 | "가르시니아 HCA 체지방 식약처" |
| 15 | 녹차추출물 (카테킨) | 체중 | BMI>=25 | "녹차추출물 카테킨 체지방 식약처" |
| 16 | 프리바이오틱스 | 장 | 기본 보조 (생균제제와 함께) | "프리바이오틱스 장 건강" |
| 17 | 글루타민 | 장 | 위장 관련 질환 이상 | "글루타민 장벽 회복" |
| 18 | 비타민D | 기본 | 50세 이상 or 여성 | "비타민D 칼슘 흡수 식약처" |
| 19 | 비타민C | 기본 | 기본 항산화 (신장 정상 시) | "비타민C 항산화 식약처" |
| 20 | 아연 | 기본 | 면역 관련 or 50세 이상 남성 | "아연 면역 기능 식약처" |
| 21 | 셀레늄 | 기본 | 항산화 필요 (복합 위험인자) | "셀레늄 항산화 식약처" |
| 22 | 글루코사민 | 관절/뼈 | 50세 이상 and 신장 정상 | "글루코사민 관절 식약처" |
| 23 | 칼슘 | 관절/뼈 | 여성 50세 이상 and 이상지질혈증 없음 | "칼슘 뼈 건강 식약처" |
| 24 | 비타민K2 | 관절/뼈 | 칼슘 추천 시 함께 | "비타민K2 칼슘 흡수 뼈" |
| 25 | 루테인 | 항산화 | 50세 이상 | "루테인 눈 건강 식약처" |
| 26 | 아스타잔틴 | 항산화 | 복합 위험인자 3개 이상 | "아스타잔틴 항산화" |
| 27 | 레스베라트롤 | 항산화 | 심혈관 위험 이상 | "레스베라트롤 심혈관 항산화" |
| 28 | 식이섬유 | 혈당/체중 | FBG>=100 or BMI>=25 | "식이섬유 혈당 체중 식약처" |

### 2-3. 카테고리별 최대 추천 수

| 카테고리 | 최대 추천 | 비고 |
|----------|----------|------|
| 혈압/심혈관 | 2종 | 오메가3 + (CoQ10 or 마그네슘) |
| 혈당/당뇨 | 2종 | 크롬 + (알파리포산 or 바나바잎) |
| 간/해독 | 1종 | 밀크씨슬 우선, ALT 매우 높으면 NAC 추가 |
| 체중 | 1종 | BMI 구간별 분기 |
| 장 | 1종 | 생균제제 우선 |
| 기본 | 2종 | 비타민D + (비타민B or C) |
| 관절/뼈 | 1종 | 50세 이상 조건부 |
| 항산화 | 1종 | 복합 위험인자 시 |

**전체 추천 상한: 5종** (현재 3종에서 확장)
**전체 주의 상한: 6종** (현재 유지)

### 2-4. 추천 우선순위 로직

```python
# 우선순위 점수 계산 (높을수록 우선)
priority_score = (
    disease_relevance * 3.0    # 질환 직접 관련: 3점
    + risk_level * 2.0          # 해당 수치 이상 정도: 0-2점
    + evidence_strength * 1.5   # RAG 에비던스 강도: 0-1.5점
    + kfda_approved * 2.0       # 식약처 인정: 2점 (bool)
)
```

---

## 3. 스토리텔링 프롬프트 (GPT-4o-mini)

### 3-1. 시스템 프롬프트

```
당신은 건강검진 결과를 일반인에게 친근하게 설명하는 영양 가이드입니다.

절대 규칙:
1. 의학적 진단/소견을 내리지 않습니다. "~질환입니다", "~병이 있습니다" 금지.
2. 가이드라인 표현만 사용합니다. "~할 수 있어요", "~에 도움이 돼요"
3. 출처를 한 줄로 첨부합니다.
4. 공포 마케팅 금지. "이걸 안 먹으면 위험합니다" 같은 표현 사용하지 않습니다.
5. 중학생도 이해할 수 있는 쉬운 말로 설명합니다.
```

### 3-2. 추천 설명 생성 프롬프트

```
환자 이름: {name}
환자 검진 수치: SBP={sbp}, DBP={dbp}, LDL={ldl}, FBG={fbg}, BMI={bmi}, ALT={alt}
추천 영양소: {nutrient_name}
추천 태그: {tag}
추천 사유 (룰): {rule_reason}
에비던스 요약: {evidence_summary}

위 정보로 환자에게 보여줄 추천 설명을 작성해주세요.

형식 규칙:
- 1-2문장, 80자 이내
- "~예요", "~해요" 친근한 톤
- 환자 수치를 구체적으로 언급 (예: "LDL이 125라 경계 구간이에요")
- 에비던스 출처를 자연스럽게 포함 (예: "식약처 인정 기능성이에요")
- 의학적 진단 표현 절대 금지
```

### 3-3. 주의 영양소 설명 생성 프롬프트

```
환자 이름: {name}
환자 검진 수치: {relevant_values}
주의 영양소: {nutrient_name}
주의 사유: {caution_reason}
에비던스: {evidence_summary}

위 정보로 환자에게 보여줄 주의사항 설명을 작성해주세요.

형식 규칙:
- 1문장, 60자 이내
- "~할 수 있어요" 톤 (공포 유발 금지)
- 환자 수치 + 왜 주의인지 간결히
```

### 3-4. GPT 호출 최적화

| 항목 | 설정 |
|------|------|
| 모델 | gpt-4o-mini |
| temperature | 0.3 (일관성 우선) |
| max_tokens | 150 (설명 1-2문장) |
| 배치 | 추천 5종 + 주의 6종 = 최대 11회 호출 |
| 캐싱 | 영양소+수치구간 해시키로 Redis 캐시 (TTL 24h) |
| 폴백 | GPT 실패 시 기존 NUTRIENT_DESC 고정 설명문 반환 |

**비용 추정**:
- 입력 ~300 tokens * 11회 = 3,300 tokens
- 출력 ~100 tokens * 11회 = 1,100 tokens
- GPT-4o-mini 기준: ~$0.001/리포트 (무시 가능)

### 3-5. 캐싱 전략

```python
# 캐시 키 생성: 영양소 + 수치 구간 (10단위 반올림)으로 동일 구간 재사용
def _cache_key(nutrient: str, patient: dict) -> str:
    sbp_bin = (patient.get("sbp", 0) // 10) * 10   # 130, 140, 150...
    fbg_bin = (patient.get("fbg", 0) // 10) * 10
    bmi_bin = round(patient.get("bmi", 0))
    alt_bin = (patient.get("alt", 0) // 10) * 10
    return f"nutrition_story:{nutrient}:{sbp_bin}:{fbg_bin}:{bmi_bin}:{alt_bin}"
```

수치가 같은 구간이면 동일 스토리 재사용. 24시간 TTL.

---

## 4. API 스키마 (Request/Response)

### 4-1. 내부 서비스 인터페이스

```python
class NutritionService:
    """건기식 RAG 맞춤 추천 서비스."""

    async def recommend(
        self,
        patient: dict,      # {ALT, SBP, DBP, BMI, cr, TC, LDL, FBG, ...}
        diseases: dict,      # {질환명: {result, ratio, rank}, ...}
        name: str = "",      # 환자 이름 (스토리텔링용)
        medications: list[str] = [],  # Phase 2
    ) -> dict:
        """
        Returns:
            {
                "recommend": [NutrientRecommendation, ...],  # max 5
                "caution":   [NutrientCaution, ...],         # max 6
                "meta": {
                    "pool_size": 28,
                    "candidates": 12,
                    "rag_hits": 8,
                    "gpt_generated": True,
                    "cached": False,
                    "latency_ms": 1200
                }
            }
        """

    def recommend_sync(self, patient, diseases, name="", medications=[]) -> dict:
        """facade.py (동기 함수)에서 호출하는 sync wrapper."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 이미 이벤트 루프가 돌고 있으면 새 스레드에서 실행
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(
                        asyncio.run,
                        self.recommend(patient, diseases, name, medications)
                    ).result(timeout=30)
            else:
                return loop.run_until_complete(
                    self.recommend(patient, diseases, name, medications)
                )
        except Exception:
            # 폴백: 기존 nutrition_rules 그대로
            from .nutrition_rules import recommend_nutrients, caution_nutrients
            return {
                "recommend": recommend_nutrients(patient, diseases),
                "caution": caution_nutrients(patient, diseases),
                "meta": {"gpt_generated": False, "fallback": True}
            }
```

### 4-2. 응답 타입 정의

```typescript
// FE: NutrientRecommendation (신규)
interface NutrientRecommendation {
  name: string;           // "오메가3"
  tag: string;            // "혈압 관리"
  desc: string;           // GPT 생성 개인화 설명 (80자 이내)
  evidence: {
    source: string;       // "식약처 인정 기능성 원료"
    type: "official" | "guideline" | "research";
    detail?: string;      // RAG에서 가져온 상세
  } | null;
  dosage: {
    amount: string;       // "EPA+DHA 합계 500-2000mg/일"
    timing: string;       // "식후"
    duration?: string;    // "3개월 이상"
  } | null;
  caution: string | null; // 약물 상호작용 (Phase 2)
  priority: number;       // 1-5
}

// FE: NutrientCaution (기존 확장)
interface NutrientCaution {
  name: string;           // "글루코사민"
  tag: string;            // "당뇨 위험군 주의"
  desc: string;           // GPT 생성 개인화 설명 (60자 이내)
  evidence: {
    source: string;
    type: "official" | "guideline" | "research";
  } | null;
  priority: number;
}

// 전체 응답 (기존 nutrition 필드 확장)
interface NutritionResult {
  recommend: NutrientRecommendation[];  // max 5
  caution: NutrientCaution[];           // max 6
  meta?: {
    pool_size: number;
    candidates: number;
    rag_hits: number;
    gpt_generated: boolean;
    cached: boolean;
    latency_ms: number;
  };
}
```

### 4-3. 하위 호환성

기존 FE는 `nutrition.recommend[].{name, tag, desc}` 3필드만 사용.
신규 필드 `evidence`, `dosage`, `caution`, `priority`는 **optional**로 추가하여 기존 렌더링이 깨지지 않게 한다.
FE 업데이트 전까지 기존 3필드 포맷 유지.

---

## 5. FE 컴포넌트 설계 (NutritionBlock 리디자인)

### 5-1. 현재 구조

```
AIAnalysisSection/index.tsx (1761줄)
  └── nutrition-teaser (L1601-L1659)
       ├── 추천/피해야 할 카운트 배지
       ├── 3종 미리보기
       └── "상세 영양 가이드" CTA 버튼

ComprehensiveAnalysisPage/index.tsx
  └── nutrition-grid (L1969-L2020)
       ├── avoid-section (피해야 할 음식)
       └── recommend-section (권장 음식)
```

두 곳 모두 `NutritionRecommendation` 인터페이스를 사용하지만 구조가 다름 (AIAnalysis는 category/foods/reason, Comprehensive는 avoid/recommend 분리).

### 5-2. 신규 컴포넌트 구조

```
src/components/health/NutritionCard/
  ├── index.tsx          <- 단일 영양소 카드 (recommend/caution 공용)
  ├── EvidenceBadge.tsx  <- 에비던스 출처 배지 (식약처/가이드라인/연구)
  ├── DosageInfo.tsx     <- 용량/타이밍 아이콘
  ├── Disclosure.tsx     <- "왜 추천?" 펼침 패널 (RAG 상세)
  └── styles.scss

src/components/health/NutritionSection/
  ├── index.tsx          <- 추천/주의 탭 + 카드 슬라이더
  └── styles.scss
```

### 5-3. NutritionCard 와이어프레임

```
+------------------------------------------+
| [식약처 인정]  오메가3           우선순위 1 |
|                                          |
| "김광중님의 혈압이 138로 경계 구간이에요.  |
|  오메가3가 혈중 중성지질 개선에 도움을     |
|  줄 수 있어요."                          |
|                                          |
| +------+ +--------+ +----------+        |
| | 식후  | | 500-   | | 3개월+  |        |
| |  복용 | | 2000mg | | 꾸준히  |        |
| +------+ +--------+ +----------+        |
|                                          |
| [v] 왜 이 영양소를 추천했나요?           |
|   "식약처 인정 기능성: 혈중 중성지질      |
|    개선, 혈행 개선에 도움을 줄 수 있음.   |
|    EPA+DHA 합계 기준 1일 500-2000mg      |
|    권장. (출처: 식약처 건강기능식품        |
|    기능성 원료 인정 현황)"                |
+------------------------------------------+
```

### 5-4. NutritionSection (슬라이더) 와이어프레임

```
+--------------------------------------------------+
| 맞춤 영양 가이드                    [추천] [주의] |
|                                                  |
| <- [카드1] [카드2] [카드3] [카드4] [카드5] ->    |
|                                                  |
|              * * * * *  (페이지 dots)            |
+--------------------------------------------------+
```

### 5-5. 에비던스 배지 디자인

| 타입 | 배지 텍스트 | 색상 | 아이콘 |
|------|-----------|------|--------|
| official | "식약처 인정" | #2563EB (파랑) | 방패 |
| guideline | "학회 권고" | #059669 (초록) | 체크 |
| research | "연구 근거" | #7C3AED (보라) | 문서 |

### 5-6. 주의 카드 (caution) 차별화

```
+------------------------------------------+
| [!] 글루코사민                  주의 필요 |
|                                          |
| "공복혈당이 115로 당뇨 전단계예요.       |
|  글루코사민은 혈당을 올릴 수 있어        |
|  주의가 필요해요."                       |
|                                          |
| (학회 권고) 대한당뇨병학회               |
+------------------------------------------+

- 카드 테두리: #FCA5A5 (연빨강)
- 배경: #FEF2F2 (연분홍)
- 아이콘: 경고 삼각형
```

### 5-7. 기존 Term 시스템 재사용

현재 hover tooltip으로 의학 용어를 설명하는 Term 시스템이 구축되어 있음.
NutritionCard에서 영양소 이름을 Term으로 감싸 hover 시 RAG 상세 표시 가능.
새로 만들지 않고 기존 인프라 활용.

---

## 6. 워커 분배표 + 잠금 매트릭스

### 6-1. 워커 분배

| 워커 | 담당 | 수정 파일 | 예상 소요 |
|------|------|----------|----------|
| **W1** BE 룰 확장 | nutrition_rules.py 28종 풀 확장 + 우선순위 로직 | `backend/app/services/report_engine/nutrition_rules.py` | 3일 |
| **W2** BE 서비스 레이어 | nutrition_service.py 신규 (4-step 파이프라인) | `backend/app/services/report_engine/nutrition_service.py` (신규) | 4일 |
| **W3** BE RAG + GPT | pnt_rag_service 연결 + GPT 프롬프트 + 캐싱 | `backend/app/services/report_engine/nutrition_service.py` (W2와 같은 파일) | 3일 |
| **W4** BE facade 연결 | facade.py 수정 + sync wrapper | `backend/app/services/report_engine/facade.py` | 1일 |
| **W5** FE 컴포넌트 | NutritionCard + NutritionSection + EvidenceBadge | `frontend/src/components/health/NutritionCard/` (신규) | 4일 |
| **W6** FE 통합 | AIAnalysisSection + ComprehensiveAnalysisPage 연결 | `frontend/src/components/health/AIAnalysisSection/index.tsx`, `frontend/src/features/health/ComprehensiveAnalysisPage/index.tsx` | 2일 |
| **W7** SCSS | 카드/배지/disclosure 스타일 | `frontend/src/components/health/NutritionCard/styles.scss` (신규) | 2일 |

### 6-2. 잠금 매트릭스

```
         nutrition_rules.py  nutrition_service.py  facade.py  NutritionCard/*  AIAnalysis  Comprehensive
W1 룰확장      LOCK              read                read         -               -            -
W2 서비스        read             LOCK                read         -               -            -
W3 RAG/GPT       -               LOCK(동일)           -           -               -            -
W4 facade        read             read               LOCK         -               -            -
W5 FE컴포넌트    -                -                   -          LOCK             -            -
W6 FE통합        -                -                   -          read            LOCK         LOCK
W7 SCSS          -                -                   -          LOCK(scss만)     -            -
```

**충돌 지점**:
- W2와 W3: 같은 파일(`nutrition_service.py`) -- **순차 실행** (W2 먼저 -> W3)
- W5와 W7: NutritionCard/ 디렉토리 -- W5가 tsx, W7이 scss이므로 **파일 단위 분리 가능하나 순차 권장**
- 나머지: 독립적, 병렬 가능

### 6-3. 실행 순서 (권장)

```
Week 1:
  [병렬] W1 (룰 확장) + W5 (FE 컴포넌트) + W7 (SCSS)

Week 2:
  [순차] W2 (서비스) -> W3 (RAG/GPT)
  [병렬] W5/W7 완료 대기 -> W6 (FE 통합)

Week 3:
  [순차] W4 (facade 연결) -- W1+W2+W3 완료 후
  [병렬] 통합 테스트 + 디버깅

Week 4:
  QA + 엣지 케이스 검증 + 배포 준비
```

---

## 7. 의존성 DAG + 실행 순서

```
                 W1 (룰 확장)
                    |
                    v
                 W2 (서비스 레이어) ---+
                    |                  |
                    v                  v
                 W3 (RAG/GPT)       W4 (facade)
                    |                  |
                    +--------+---------+
                             |
                    BE 통합 테스트
                             |
   W5 (FE 컴포넌트) ------+  |
          |                |  |
   W7 (SCSS) ------+      |  |
                    |      |  |
                    v      v  v
                 W6 (FE 통합)
                    |
                    v
               E2E 테스트
                    |
                    v
                  배포
```

**크리티컬 패스**: W1 -> W2 -> W3 -> W4 -> 통합 테스트 -> 배포
**FE 패스 (병렬)**: W5 + W7 -> W6 -> 통합 테스트에 합류

---

## 8. 검증 체크리스트

### 8-1. 단위 테스트

- [ ] nutrition_rules.py 28종 룰이 4명 실데이터(윤철주/김광중/안주옥/이강복)에서 기존 3종 결과 유지 (회귀)
- [ ] 28종 풀에서 조건별 후보 선정이 올바른지 (카테고리 상한 준수)
- [ ] 우선순위 점수 계산이 올바른지
- [ ] RAG 검색 결과가 비어도 폴백(기존 NUTRIENT_DESC) 동작
- [ ] GPT 호출 실패 시 폴백 동작
- [ ] 캐싱: 동일 수치 구간 -> 캐시 히트, 다른 구간 -> 미스

### 8-2. 통합 테스트

- [ ] facade.py -> nutrition_service.recommend_sync() 호출 성공
- [ ] 응답 포맷이 기존 `{recommend: [...], caution: [...]}` 구조 유지
- [ ] 신규 필드(evidence, dosage, priority)가 추가되되 기존 필드 깨지지 않음
- [ ] FE NutritionCard가 새 데이터 포맷 정상 렌더링
- [ ] FE 하위 호환: 구 포맷(desc만) 수신 시에도 렌더링 정상

### 8-3. 성능 테스트

- [ ] 전체 파이프라인 latency < 5초 (RAG + GPT 포함)
- [ ] 캐시 히트 시 latency < 200ms
- [ ] 메모리 증가량 < 50MB (PM2 1G 제한 감안)

### 8-4. 의학적 안전성

- [ ] 생성된 설명문에 "~질환", "~병", "진단" 표현 없음
- [ ] 공포 마케팅 표현 없음
- [ ] 모든 에비던스에 출처(기관명) 포함
- [ ] 약물 상호작용 경고가 Phase 1에서 오발(false positive) 하지 않음 (medications=[] 시 빈 배열)

### 8-5. FE 렌더링

- [ ] 모바일(375px) + 태블릿(768px) + 데스크톱 반응형 정상
- [ ] 에비던스 배지 색상 3종 정상 표시
- [ ] Disclosure 펼침/접기 동작
- [ ] 카드 슬라이더 터치 스와이프 (모바일)

---

## 9. 수용 기준 (Acceptance Criteria)

### AC-1. 필수 (Phase 1 완료 기준)

| # | 기준 | 검증 방법 |
|---|------|----------|
| 1 | 추천 영양소가 5종까지 표시됨 (기존 3종에서 확장) | 4명 실데이터 테스트 |
| 2 | 각 추천에 개인화 설명이 포함됨 (환자 이름 + 수치 언급) | 리포트 육안 확인 |
| 3 | 식약처 인정 영양소에 "식약처 인정" 배지 표시 | FE 스크린샷 |
| 4 | 용량/타이밍 정보 표시 | FE 스크린샷 |
| 5 | "왜 추천?" Disclosure에 RAG 상세 표시 | FE 클릭 테스트 |
| 6 | 주의 영양소 6종까지 경고 카드로 표시 | 4명 테스트 |
| 7 | GPT 실패 시 기존 고정 설명문으로 폴백 | GPT API 차단 테스트 |
| 8 | 기존 리포트 렌더링이 깨지지 않음 (하위 호환) | 기존 4명 리포트 비교 |
| 9 | 의학적 진단 표현 0건 | 전수 검토 |
| 10 | 전체 latency < 5초 | 서버 로그 |

### AC-2. 우대 (있으면 좋지만 Phase 2로 이월 가능)

| # | 기준 | 비고 |
|---|------|------|
| 11 | 복용 약물 입력 -> 약물-영양소 상호작용 경고 | Phase 2 핵심 |
| 12 | "같은 나이대 상위 X%" 비교 배지 | 벤치마크 서베이 아이디어 |
| 13 | 시즌/트렌드 배지 ("봄철 추천") | 벤치마크 서베이 아이디어 |

---

## 10. 모드 제안 + 참조

### 모드: STANDARD

- 예상 변경 파일: BE 3개 (nutrition_rules.py 수정, nutrition_service.py 신규, facade.py 수정) + FE 6개 (NutritionCard 4파일, AIAnalysis 수정, Comprehensive 수정)
- 신규 파일: 2개 (nutrition_service.py, NutritionCard/)
- Breaking Change: 없음 (하위 호환)
- 이유: TEAM 모드까지는 불필요 (FE/BE 파일 잠금 겹치지 않음), LITE로는 부족 (7워커 규모)

### 참조 파일

| 파일 | 역할 |
|------|------|
| `backend/app/services/report_engine/nutrition_rules.py` | 기존 6종 룰 (리팩터링 대상) |
| `backend/app/services/report_engine/facade.py` | 엔진 파사드 (연결 수정) |
| `backend/app/services/pnt_rag_service.py` | RAG 서비스 (재사용) |
| `backend/app/services/checkup_design/vector_search.py` | FAISS 검색 (재사용) |
| `backend/app/services/checkup_design/rag_service.py` | RAG 엔진 초기화 (재사용) |
| `frontend/src/components/health/AIAnalysisSection/index.tsx` | 현재 nutrition 렌더링 (수정) |
| `frontend/src/features/health/ComprehensiveAnalysisPage/index.tsx` | 상세 분석 페이지 (수정) |
| `docs/supplement-benchmark-survey.md` | 벤치마크 서베이 (기획 근거) |
