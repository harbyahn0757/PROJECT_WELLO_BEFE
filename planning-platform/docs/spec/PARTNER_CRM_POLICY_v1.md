# 파트너별 CRM 정책 v1

> 작성: 2026-05-04
> 적용 위치: `welno.tb_partner_config.config jsonb` 내 `crm_policy` 섹션
> 코드 사용: chat_tagging_service (자동 트리거) + partner_office API (산업군 필터) + alimtalk service (템플릿 분기)

---

## 1. 정책 jsonb 스키마

### 위치
```sql
welno.tb_partner_config (
    partner_id varchar(50) PK,
    config jsonb NOT NULL,  -- 여기 안에 crm_policy 섹션 추가
    ...
)
```

### crm_policy 섹션
```jsonc
{
  "crm_policy": {
    // ── 1. 활성 산업군 (B2B 영업 가능 영역) ──
    "active_industries": ["hospital", "supplement"],
    
    // ── 2. 산업군별 임계 (자동 트리거 발화) ──
    "thresholds": {
      "hospital": {
        "alert_score": 70,         // 이 점수 이상 → 의료진 Slack
        "auto_alimtalk_score": 50, // 이 점수 이상 → 알림톡 자동 발송
        "min_stage": "consider"    // 이 stage 이상만 액션 (awareness/interest 제외)
      },
      "supplement": {
        "alert_score": 80,
        "auto_alimtalk_score": 60,
        "min_stage": "consider"
      }
    },
    
    // ── 3. 알림톡 템플릿 매핑 (산업군 × stage × sub_category) ──
    "alimtalk_templates": {
      "hospital_decision":         "tmpl_hospital_consultation_001",
      "hospital_action":           "tmpl_hospital_visit_002",
      "hospital_recall_consider":  "tmpl_hospital_recall_010",
      "supplement_혈압관리_decision": "tmpl_supplement_bp_001",
      "supplement_간보호_consider":   "tmpl_supplement_liver_010"
    },
    
    // ── 4. Slack 채널 (의료진/마케터별) ──
    "slack_channels": {
      "hospital_alert": "https://hooks.slack.com/services/...",  // 의료진
      "supplement_alert": "https://hooks.slack.com/services/...", // 영양사/마케터
      "weekly_report": "https://hooks.slack.com/services/..."     // 주간 리포트
    },
    
    // ── 5. 상담 우선순위 (정렬 키) ──
    "consultation_priority": ["risk_level", "industry_score", "anxiety_level", "checkup_date"],
    
    // ── 6. 발송 정책 (스팸 방지) ──
    "send_policy": {
      "max_alimtalk_per_user_per_week": 2,
      "min_hours_between_alimtalk": 24,
      "blackout_hours": [22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8],  // 22시~다음날 8시 발송 X
      "dry_run": true  // 운영 검증 1주일 — 실 발송 X, 후보만 기록
    },
    
    // ── 7. 백오피스 권한 (역할별) ──
    "backoffice_roles": {
      "admin":     ["all"],
      "doctor":    ["consultation", "patient_detail", "health_report"],
      "marketer":  ["analytics", "revisit", "alimtalk"]
    }
  }
}
```

---

## 2. 파트너별 적용 (Day 1)

### medilinx (Day 1 — 보수적)
```jsonc
{
  "crm_policy": {
    "active_industries": ["hospital"],  // 일단 병원만 (검증 후 supplement 추가)
    "thresholds": {
      "hospital": { "alert_score": 70, "auto_alimtalk_score": 50, "min_stage": "consider" }
    },
    "send_policy": { "dry_run": true }  // 1주일 검증
  }
}
```

### kindhabit (자체 — 풀스택 검증용)
```jsonc
{
  "crm_policy": {
    "active_industries": ["hospital", "supplement", "fitness", "mental_care"],
    "thresholds": {
      "hospital":    { "alert_score": 70, "auto_alimtalk_score": 50, "min_stage": "consider" },
      "supplement":  { "alert_score": 80, "auto_alimtalk_score": 60, "min_stage": "consider" },
      "fitness":     { "alert_score": 75, "auto_alimtalk_score": 55, "min_stage": "interest" },
      "mental_care": { "alert_score": 60, "auto_alimtalk_score": 40, "min_stage": "interest" }
    },
    "send_policy": { "dry_run": true }
  }
}
```

### 신규 파트너 (default — 비활성)
```jsonc
{
  "crm_policy": {
    "active_industries": [],  // 명시 활성 전까지 액션 X
    "thresholds": {},
    "send_policy": { "dry_run": true }
  }
}
```

---

## 3. 코드 측 사용

### 3.1 chat_tagging_service
태깅 후 자동 트리거:
```python
async def trigger_industry_action(session_id, partner_id, tags):
    cfg = await get_partner_config(partner_id)
    policy = cfg.get("crm_policy", {})
    active = policy.get("active_industries", [])
    
    for industry in active:
        score_data = tags["industry_scores"].get(industry, {})
        score = score_data.get("score", 0)
        stage = score_data.get("stage", "none")
        thresholds = policy.get("thresholds", {}).get(industry, {})
        
        # Slack 알림 (alert_score 이상 + min_stage 이상)
        if score >= thresholds.get("alert_score", 100):
            if _stage_geq(stage, thresholds.get("min_stage", "consider")):
                await send_slack(industry, session_id, tags)
        
        # 알림톡 자동 발송 (auto_alimtalk_score 이상)
        if score >= thresholds.get("auto_alimtalk_score", 100):
            if _stage_geq(stage, thresholds.get("min_stage", "consider")):
                template = _resolve_template(industry, stage, score_data.get("sub_categories"))
                if not policy.get("send_policy", {}).get("dry_run", True):
                    await send_alimtalk(template, session_id, tags)
                else:
                    await log_dry_run(template, session_id, tags)  # DB 기록만
```

### 3.2 partner_office API
산업군 필터 추가:
```python
@router.post("/patients")
async def patient_list(
    req: PatientListRequest,  # 신규: industry: Optional[str]
    user: dict = Depends(get_current_user)
):
    cfg = await get_partner_config(req.partner_id)
    active_industries = cfg["crm_policy"]["active_industries"]
    
    # 권한 체크 — 비활성 산업군 조회 차단
    if req.industry and req.industry not in active_industries:
        raise HTTPException(403, f"산업군 {req.industry} 비활성")
    
    # 쿼리 — industry_scores jsonb path
    where = ""
    if req.industry:
        where = f" AND (industry_scores->'{req.industry}'->>'score')::int >= {req.min_score} "
    ...
```

---

## 4. dry_run 모드 (1주일 검증)

### 의도
- 새 LLM v2 prompt 가 출력하는 industry_scores 정확도 검증 전까지 실 알림톡 발송 X
- 발송 후보만 신규 테이블 `welno.tb_alimtalk_dry_run_log` 에 기록
- 운영팀이 매일 후보 검토 → 정확도 확인 → 1주일 후 dry_run=false 전환

### dry_run_log 스키마 (신규)
```sql
CREATE TABLE welno.tb_alimtalk_dry_run_log (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id VARCHAR(128),
    partner_id VARCHAR(64),
    hospital_id VARCHAR(64),
    industry VARCHAR(32),
    stage VARCHAR(16),
    score INT,
    template_id VARCHAR(64),
    -- 환자 정보 (스냅샷)
    patient_uuid VARCHAR(64),
    patient_name VARCHAR(64),
    -- 검증용
    industry_scores JSONB,
    health_concerns JSONB,
    signals JSONB,
    -- 운영 검토
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(64),
    review_decision VARCHAR(16)  -- approve / reject / pending
);
```

### 1주일 후 전환
```sql
UPDATE welno.tb_partner_config
SET config = jsonb_set(config, '{crm_policy,send_policy,dry_run}', 'false'::jsonb)
WHERE partner_id = 'medilinx';
```

---

## 5. 백오피스 노출

### 백오피스 신규 화면 (Phase 2~3)
- `/backoffice/policy` — 파트너별 crm_policy 편집 화면
  - active_industries 토글
  - thresholds 슬라이더
  - alimtalk_templates 매핑 표
  - dry_run 토글 (운영팀 권한 확인 필수)
  - send_policy.blackout_hours 설정

### 권한 매트릭스
| 역할 | active_industries | thresholds | dry_run 토글 | send 정책 |
|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ |
| marketer | 조회 | 조회 | ❌ | ❌ |
| doctor | 조회 | ❌ | ❌ | ❌ |

---

## 6. 마이그레이션 단계

### Phase 1 (Day 1): 정책 인프라
- 정의서 (이 문서) 확정
- chat_tagging_service 에 trigger_industry_action 추가 (단, dry_run=true)
- medilinx config UPDATE (active_industries=[hospital])

### Phase 2 (Day 2-5): 백오피스 화면
- /backoffice/policy 화면 (admin only)
- partner_office API industry 필터

### Phase 3 (Day 6-7): dry_run 검증
- 1주일 실 트래픽 → dry_run_log 누적 → 운영팀 검토 → 정확도 측정

### Phase 4 (Day 8+): 실 발송 활성화
- medilinx 본사 합의 후 dry_run=false 전환
- supplement / fitness 등 점진 추가

---

## 7. 참조

- `docs/spec/B2B_TAGGING_SYSTEM_v2.md` — 산업군/stage/signals 정의
- `chat_tagging_service.py` — trigger 추가 위치
- `partner_office.py` — industry 필터 추가
- `tb_partner_config` schema — config jsonb
