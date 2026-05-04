# WELNO 태깅 v3 마이그레이션 plan

> 작성: 2026-05-04
> 적용 대상: chat_tagging 시스템 + 백오피스 7 페이지 + DB 마이그레이션
> 진행 전 사용자 합의 필요 (4 결정 항목)
> 본 문서: 결정 + 영향 매트릭스 + 단계 plan 보존

---

## 1. 배경 — 왜 v3 인가

### v2 (현재) 한계
- LLM `risk_level` 결정 룰 미정의 → 자유 판단 (블랙박스)
- `calculate_risk_level` 임계 너무 낮음 (high_count ≥ 1) → high 34% 과추출
- `risk_level` vs `urgency` 모순 12% (432건)
- `interest_tags` 의 intent 차원 부재 — 같은 "혈압" 4 종류 (concern/info_seek/action/curiosity) 차별화 불가
- `signals` 차별화 0% (5/5 default 출력) — v2.1 P2 강화 무시
- partner 별 `abnormal` 필드 형식 차이 (medilinx sgot_ast vs kindhabit) 표준화 X
- 백오피스 위험도 결정 근거 부재 → 의료진 신뢰도 ↓

### 진짜 우선순위 환자 식별 부족
- 현재 high 1265건 모두 동일 표시
- 진짜 critical (high+high anxiety+urgent) = 217건 (5.8%) 묻힘

---

## 2. 6 가지 Fix (v3)

### Fix 1. LLM prompt 에 risk_level 결정 룰 명시
```
"high": 검진 수치 high 위험 1개+ + 환자 우려/증상 호소
"medium": 검진 medium 1개+ 또는 환자 우려 표현 + 수치 정상 약간 벗어남
"low": 검진 정상 + 환자 단순 정보 확인
```

### Fix 2. interest_tags 에 intent 필드 추가
```jsonc
[{
  "topic": "혈압",
  "intensity": "high",
  "intent": "concern|info_seek|action|curiosity"  // 신규
}]
```
- concern: "혈압이 걱정돼요"
- info_seek: "혈압 약 효과 어때요?"
- action: "혈압 관리 어떻게 하나요?"
- curiosity: "혈압 정상인데 왜 주의?"

### Fix 3. signals few-shot 예시 (P2 차별화 0% → 60%+)
```
환자: "혈압 약 시작해야 할까요? 빨리 알려주세요"
→ urgency: "urgent", readiness: "committed"

환자: "혈압 좀 걱정되네요"
→ urgency: "normal", readiness: "considering"

환자: "그렇군요"
→ urgency: "relaxed", readiness: "postponed"
```

### Fix 4. composite_risk 신규 도입 (4단계)
```jsonc
{
  "overall": "critical|high|medium|low",
  "factors": {
    "metric_severity": "high|medium|low",
    "patient_concern": "high|medium|low",
    "urgency": "urgent|normal|relaxed"
  },
  "reason": "AST 75 high + 환자 '걱정돼요' 명시 + 즉시 단어"
}
```
- critical: high+high+urgent (의료진 즉시)
- high: high + (medium anxiety or borderline urgency)
- 백오피스 호환: composite_risk.overall → 기존 risk_level 매핑

### Fix 5. partner 별 abnormal 정규화
정의서 `HEALTH_METRICS_NORMALIZATION.md` — partner 별 매핑 룰
- medilinx: sgot_ast → ast_위험
- kindhabit: (확인 필요)

### Fix 6. calculate_risk_level 임계 재조정
- `high_count >= 1` → **`>= 2`** 검토
- 사업적 합의 후 결정

---

## 3. 영향 매트릭스 (자체 점검 — 독립 verifier 미실시)

### 변경 없음 ✅
- 수검자 frontend (chat 태그 직접 노출 0건)
- 알림톡/캠페인 시스템 (mdx_agr_list 기반, chat 태그 무관)
- mediarc 별개 시스템
- 9 DB 테이블 (kakao_templates / mdx_agr_list / welno_trigger_log 등)

### 변경 있음
| 영역 | 변경 |
|---|---|
| `welno.tb_chat_session_tags` | composite_risk jsonb 컬럼 추가, interest_tags intent 필드 (jsonb 안) |
| `chat_tagging_v2_prompt.py` | prompt v3 + 6 fix 통합 |
| `build_v1_compat_fields` | composite_risk.overall → risk_level / intent → action_intent 매핑 |
| 백오피스 IndustryPage | composite_risk 4 단계 표시 (선택 추가) |
| 백오피스 5 페이지 (Consultation/Revisit/Patient/Analytics/Embedding/Dashboard) | 변경 0 (v1 호환 매핑 정확 시) |

---

## 4. 비용 + 시간

- **재태깅 비용**: $0.83 (3,700건 × $0.000223)
  - 평균 input 1,709 tokens, output 316 tokens
  - gemini-2.5-flash-lite ($0.075/1M in + $0.30/1M out)
- **시간**: ~31분 (0.5s/건 × 3,700 + quota 보호 sleep)

---

## 5. 단계 (Day 1 — 4~5h)

```
1. prompt v3 작성 (Fix 1~6 통합)                    1h
2. DB 마이그레이션 (composite_risk jsonb)            30m
3. v1 호환 매핑 갱신 (build_v1_compat_fields v3)    30m
4. dev-reviewer 7차 견제                            30m
5. 3,700건 재태깅 실행 (자동)                        31m
6. 백오피스 7 페이지 검증 — 컬럼 표시 정상 확인     30m
7. 신규 화면 추가 — risk_level 옆 결정 근거 툴팁    1h
```

---

## 6. 결정 필요 항목 (4개)

### Q1. v3 prompt 추가 항목 범위
- **최소** (Fix 1+2): risk_level 룰 + interest_tags.intent
- **중간** (Fix 1~3): + signals few-shot
- **전체** (Fix 1~6): + composite_risk + abnormal 정규화 + 임계 재조정

### Q2. composite_risk 도입?
- 4 단계 (critical/high/medium/low) + 결정 근거
- 백오피스 호환 = v1 risk_level 자동 매핑

### Q3. interest_tags intent 필드 방식
- **A**: 기존 jsonb 안 intent 필드 추가 (호환성 유지)
- **B**: health_concerns 와 분리 — concerns(걱정) vs interests(의지) 별도

### Q4. 재태깅 시점
- **즉시**: prompt v3 후 곧장 3,700건 재태깅 (31분)
- **점진**: 신규 chat 트래픽만 v3
- **선택적**: 24h 내 chat 만

---

## 7. 진행 전 전수 조사 (현재 단계)

사용자 지시: "전수 조사부터 잘 해 위에 계획 잘 저장해두고"

조사 대상:
- 수검자 frontend 전체 파일 (campaigns/checkup-design, disease-prediction, features/, embed/)
- 백오피스 7 페이지 + components 안 태그/위험도 사용
- API 27 endpoints 모두 grep
- DB 10 테이블 schema + 외래키 + 사용처
- services/ 비즈니스 로직 (auto_trigger / chat_tagging / partner_rag / welno_rag)

조사 결과는 `MIGRATION_v3_AUDIT.md` 별도 작성.

---

## 8. 참조

- `docs/spec/B2B_TAGGING_SYSTEM_v2.md` — v2 정의서
- `docs/spec/PARTNER_CRM_POLICY_v1.md` — 파트너 정책
- `chat_tagging_service.py` — 본 함수 (line 1290~ MAX 채택 룰)
- `chat_tagging_v2_prompt.py` — prompt v2.1 (P1~P4 강화)
- `migrations/2026-05-04_chat_tags_v2_industry.sql` — v2 DB 마이그레이션
