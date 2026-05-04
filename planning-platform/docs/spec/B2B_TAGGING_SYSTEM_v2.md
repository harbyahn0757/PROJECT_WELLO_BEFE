# WELNO B2B CRM 태깅 시스템 v2

> 작성: 2026-05-04
> 적용 범위: chat_tagging_service + tb_chat_session_tags + backoffice 5 페이지 + partner_office API
> 대체 대상: v1 (병원 1개 산업군 전용 prospect_type 5분류)
> 핵심 변경: **산업군 차원 추가** (병원/건기식/헬스장/보험/정신건강) — B2B CRM 표준화

---

## 1. 배경 — 왜 v2 인가

### v1 한계 (현재 시스템 점검 결과)
- `prospect_type` (line 819, chat_tagging_service.py) = `chronic_management`/`needs_visit`/`borderline_worried`/`lifestyle_improvable`/`low_engagement` = **모두 병원 전용**
- `hospital_prospect_score` = 병원 점수 단일
- 건기식 / 헬스장 / 보험 / 정신건강 등 다른 산업군 데이터 추출 불가
- 매출 채널 = 병원 1개 (재방문 commission)

### v2 목표
- **5 산업군** lead score 동시 추출 → B2B 매출 채널 5개로 확장
- **CRM 표준 5-stage funnel** (awareness/interest/consider/decision/action)
- **3 차원 signals** (urgency/readiness/timeline) — 산업군 무관 공통
- **하위 호환** — 기존 컬럼 (interest_tags/risk_level/sentiment 등) 유지, 1개월 후 deprecated drop
- **룰베이스 X** — LLM 유지 + Caching/Batch/Debounce 로 70% 비용 절감

---

## 2. 5 산업군 정의

| ID | 산업군 | 설명 | 매출 모델 (예상) |
|---|---|---|---|
| `hospital` | 의료기관 | 검진/외래/입원/응급/재검 | 재방문 commission, 상담 fee |
| `supplement` | 건기식/영양제 | 카테고리별 영양제 (혈압/간/관절/면역/뼈) | 전환 commission |
| `fitness` | 헬스장/PT/운동 | PT/그룹/홈/운동치료 | 등록 fee |
| `insurance` | 보험 | 실손/암/건강/치아 보험 | 가입 commission |
| `mental_care` | 심리상담/정신건강 | 상담/명상앱/약물 | 앱 사용료, 상담사 fee |

### 산업군별 Sub-category (LLM 추출 hint)
```yaml
hospital:
  - recall: 재방문 (검진 결과 후 다시)
  - additional_test: 추가 검사 (정밀/전문의)
  - consultation: 의료진 상담
  - emergency: 응급 / 긴급
  - chronic_followup: 만성질환 관리

supplement:
  - 혈압관리: 혈압 / 콜레스테롤 / 심혈관
  - 혈당관리: 당뇨 / 혈당
  - 간보호: 간수치 / 간기능
  - 관절: 관절 / 뼈 / 무릎
  - 면역: 면역 / 비타민
  - 다이어트: 체중 / 비만
  - 뇌건강: 기억력 / 인지

fitness:
  - 체중관리: 다이어트 / 체중
  - 근력증진: 근력 / 단백질
  - 유산소: 심폐 / 지구력
  - 재활: 통증 / 자세 교정
  - 노년건강: 시니어 / 낙상 예방

insurance:
  - 실손: 실손의료보험
  - 암: 암보험 / 중대질병
  - 건강: 일반 건강보험
  - 치아: 치아 / 임플란트
  - 간병: 간병 / 노인

mental_care:
  - 불안: 불안 / 걱정 / 강박
  - 우울: 우울 / 무기력
  - 스트레스: 스트레스 / 번아웃
  - 수면: 불면 / 수면장애
  - 관계: 가족 / 직장 관계
```

---

## 3. CRM Funnel 5-Stage (산업군 공통)

| stage | 신호 | 자동 액션 |
|---|---|---|
| `awareness` | 인지만 (질문 0~1회) | 정보 콘텐츠 발송 (재진입 유도) |
| `interest` | 흥미 (반복 질문, 깊이 탐색) | 추천 콘텐츠 + 사례 + 자가체크 |
| `consider` | 고민 (효과/가격/시기 비교) | 제품/프로그램 안내 + 알림톡 |
| `decision` | 결정 (구체 플랜 질문, 의지 표현) | 즉시 알림톡 + 상담 신청 유도 |
| `action` | 행동 (예약/구매 의사 표명) | 의료진 Slack + 우선 큐 |

---

## 4. 새 태그 구조 (4 차원)

### 4.1 health_concerns (jsonb 컬럼 신규)
```jsonc
[
  {"topic": "혈압", "intensity": "high", "evidence": "혈압이 좀 걱정"},
  {"topic": "콜레스테롤", "intensity": "medium"}
]
```
- 9 카테고리: 혈압 / 혈당 / 콜레스테롤 / 간 / 신장 / 비만 / 정신건강 / 일반 / 갑상선
- 3-class intensity (low/medium/high)
- 기존 `interest_tags` 와 1:1 호환 (마이그레이션 시 복사)

### 4.2 industry_scores (jsonb 컬럼 신규) ⭐ 핵심
```jsonc
{
  "hospital":    {"score": 82, "stage": "decision",  "sub_categories": ["recall","consultation"]},
  "supplement":  {"score": 65, "stage": "consider",  "sub_categories": ["혈압관리","간보호"]},
  "fitness":     {"score": 30, "stage": "interest",  "sub_categories": ["체중관리"]},
  "insurance":   {"score": 10, "stage": "awareness", "sub_categories": []},
  "mental_care": {"score": 5,  "stage": "none",      "sub_categories": []}
}
```
- 5 산업군 모두 점수 (0~100) + stage + sub_categories 동시 추출
- score 0 = 신호 없음, 100 = 즉시 행동
- stage 6종: `none` / `awareness` / `interest` / `consider` / `decision` / `action`
- **partner_office API 가 산업군별 환자 list 추출용 핵심 컬럼**

### 4.3 signals (jsonb 컬럼 신규) — 산업군 공통
```jsonc
{
  "urgency": "normal",        // urgent / normal / relaxed
  "readiness": "considering", // committed / considering / postponed
  "timeline_days": 30,        // 0=즉시 / 7=1주 / 30=1달 / 90=추후
  "anxiety_level": "medium",  // low / medium / high (기존 컬럼과 동일)
  "buying_intent": "exploring" // strong / exploring / none
}
```

### 4.4 meta (기존 컬럼 일부 + 신규 evidence_quotes)
| 컬럼 | 상태 | 비고 |
|---|---|---|
| `sentiment` | 유지 | 백오피스 5 페이지 사용 |
| `risk_level` | 유지 | RevisitPage 정렬 키 |
| `key_concerns` | 유지 | ConsultationPage 표시 |
| `conversation_summary` | 유지 | ConsultationPage 표시 |
| `evidence_quotes` (신규) | 추가 | 점수 근거 인용문 (정확도 검증 + 백오피스 표시) |

---

## 5. 백오피스 영향 매핑 (점검 완료)

### 5.1 사용 페이지 (5)
| 페이지 | 현재 사용 컬럼 | v2 변경 |
|---|---|---|
| **ConsultationPage** | interest_tags, key_concerns, conversation_summary, sentiment, risk_level, buying_signal, prospect_type, action_intent, anxiety_level, hospital_prospect_score | 신규: industry_scores 표시. 기존 prospect_type → industry_scores.hospital.stage 로 점진 전환 |
| **PatientPage** | risk_level, sentiment, action_intent, interest_tags, key_concerns, buying_signal | 신규: 산업군 컬럼 + 산업군 필터 |
| **AnalyticsPage** | risk_level, sentiment, action_intent, interest_tags 분포 | 신규: 산업군별 분포 차트 (5 산업군 stacked bar) |
| **RevisitPage** ⭐ | risk_level, action_intent, prospect_type, hospital_prospect_score | 핵심 변경 — **산업군 별 재방문 리스트** + 산업군별 정렬/필터 |
| **DashboardPage** | (점검 필요) | overview 카드 + 산업군 KPI |

### 5.2 partner_office API 영향
| API | 변경 |
|---|---|
| `/dashboard/overview` | industry_scores 분포 추가 |
| `/dashboard/stats` | 산업군별 stage 분포 |
| `/patients` | industry 필터 (예: `?industry=supplement&stage=decision`) |

### 5.3 하위 호환 (필수)
- 기존 컬럼 (`prospect_type`, `hospital_prospect_score`, `buying_signal`, `action_intent`) **유지**
- LLM v2 prompt 가 두 형식 모두 출력 (병행기 1개월)
- 백오피스 코드는 점진 전환 (5 페이지 × Phase 별)
- 1개월 후 백오피스 안정화 + B2B 고객사 합의 → DROP

---

## 6. 파트너별 정책 (tb_partner_config 확장)

기존 `welno.tb_partner_config.config jsonb` 에 `crm_policy` 섹션 추가:

```jsonc
{
  // ── 기존 필드 (api_key, payment 등) 유지 ──
  "api_key": "5a9bb40b...",
  "payment": {...},

  // ── 신규: CRM 정책 ──
  "crm_policy": {
    "active_industries": ["hospital", "supplement"],  // 활성 산업군 (medilinx 가 영업 가능한 영역)
    "thresholds": {
      "hospital": {"alert_score": 70, "auto_alimtalk_score": 50},
      "supplement": {"alert_score": 80, "auto_alimtalk_score": 60}
    },
    "alimtalk_templates": {
      "hospital_recall_decision": "tmpl_001",
      "hospital_recall_consider": "tmpl_002",
      "supplement_혈압관리_decision": "tmpl_010"
    },
    "slack_webhook": "https://hooks.slack.com/services/...",  // 의료진 채널
    "consultation_priority": ["risk_level", "industry_score", "anxiety_level"]
  }
}
```

### 의미
- 파트너 `medilinx` = 병원 + 건기식 활성 (헬스장/보험 비활성)
- 파트너 `kindhabit` = 병원 + 헬스장 + 정신건강 활성
- partner_office API 는 active_industries 만 표시
- alimtalk 발송 시 thresholds 도달한 환자만

### medilinx 적용 예 (Day 1)
```jsonc
{
  "crm_policy": {
    "active_industries": ["hospital"],  // medilinx 는 일단 병원만 (확장 검증 후 supplement 추가)
    "thresholds": { "hospital": {"alert_score": 70, "auto_alimtalk_score": 50} }
  }
}
```

---

## 7. CRM 액션 매트릭스 (5 산업군 × 5 stage = 25)

핵심 대표 시나리오:

| 산업군 | stage | 자동 액션 | 알림톡 템플릿 |
|---|---|---|---|
| hospital | awareness | 정보 콘텐츠 발송 | 검진 결과 안내 |
| hospital | interest | 자가체크 + 가이드 | 검진 결과 + 추천 항목 |
| hospital | consider | 의료진 상담 안내 | 의료진 상담 신청 |
| hospital | **decision** | **즉시 알림톡 + Slack** | 상담 예약 |
| hospital | **action** | **즉시 의료진 Slack** | 진료 예약 확정 |
| supplement | interest | 카테고리 정보 + 사례 | (혈압관리) 관련 글 |
| supplement | **decision** | **상품 알림톡** | (혈압관리) 추천 영양제 |
| fitness | interest | 운동 가이드 | 검진 기반 운동 추천 |
| fitness | **decision** | **프로그램 알림톡** | 제휴 헬스장 안내 |
| insurance | consider | 보험 비교 콘텐츠 | (실손) 비교 가이드 |
| mental_care | **decision** | **상담사 알림톡** | 심리상담 예약 |

전체 25 시나리오는 별도 `B2B_CRM_ACTION_MATRIX_v1.md` 에 상세 정의.

---

## 8. 비용 절감 (LLM 유지, 룰베이스 X)

| 기법 | 절감 | 적용 |
|---|---|---|
| Gemini Context Caching | -75% input | 환자 검진 데이터 cache |
| Gemini Batch API | -50% | chat_tagging 만 비동기 |
| Session-end debounce | -60% | 5턴 미만 skip + 종료 후 1회 |
| Hierarchical prompt slim | -40% input | 25 필드 → 9 카테고리 |
| gemini-2.5-flash-lite (이미) | (이미 적용) | chat_tagging |

**합산: 1턴당 LLM 비용 -70~80%**

---

## 9. 마이그레이션 단계

### Phase 1 (Day 1-2): 데이터 구조
- DB ALTER (industry_scores / health_concerns / signals jsonb 추가)
- 기존 컬럼 deprecated 주석 (DROP 안 함)
- LLM v2 prompt 적용 (두 형식 모두 출력)

### Phase 2 (Day 3-5): 백오피스 점진 전환
- AnalyticsPage 산업군 분포 추가 (가장 위험 적음 — 분석용)
- RevisitPage 산업군 필터 추가 (B2B 가치 직결)
- ConsultationPage / PatientPage 산업군 카드 추가
- DashboardPage 산업군 KPI

### Phase 3 (Day 6-7): CRM 액션 활성화
- 파트너별 crm_policy DB UPDATE (medilinx hospital only)
- 알림톡 템플릿 등록 (25 시나리오)
- 자동 트리거 활성화 (decision/action 도달 시)

### Phase 4 (1개월 후): 정리
- 기존 컬럼 (prospect_type 등) DROP
- B2B 고객사 합의 후 진행

---

## 10. 검증 (Day 7~)

### 정확도
- 30건 sampling (각 산업군 5~10건) — 수동 라벨 vs LLM
- 목표: 산업군별 score 정확도 > 75%, stage 정확도 > 70%

### 사업 가치
- medilinx 본사 인터뷰 (이 데이터로 의사결정 가능?)
- 1주일 RevisitPage 사용율 + 알림톡 발송율 + 응답율
- A/B: 새 태그 기반 알림톡 vs 기존 random → 응답율/전환율

### 비용
- 1턴당 LLM 비용 -70% 달성 여부
- Context Caching cached_tokens > 0 (현재 0)
- chat_tagging 발화 빈도 (debounce 효과)

---

## 11. 참조

- `chat_tagging_service.py` (line 1389~ tag_data + line 819 prospect_type)
- `partner_office.py` (line 313~ list 쿼리)
- `consultation.py` (line 698~ tag_row)
- backoffice 5 페이지 (ConsultationPage / PatientPage / AnalyticsPage / RevisitPage / DashboardPage)
- `tb_partner_config.config` jsonb (crm_policy 섹션 추가)
- 트렌드 ref: Helicone/Langfuse 2026, Anthropic monthly cap, Conversational Lead Scoring
