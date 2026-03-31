# WELNO 검진설계 캠페인 — E2E 파이프라인 기획서 + 백오피스 상담원 화면 설계

작성일: 2026-03-31
작성: dev-planner + dev-architect

---

## 1. 전체 파이프라인 단계별 상태표

### [수검자 Flow]

| # | 단계 | 필요 데이터 | 호출 API | 구현 상태 | 코드 위치 |
|---|------|------------|---------|----------|----------|
| 1 | **알림톡 수신 + 링크 클릭** | uuid, hospital_id, partner_id, 건강데이터(BMI/혈압/혈당 등) | `POST /partner-office/alimtalk/send` (발송) / `GET /partner-office/alimtalk/link-data/{key}` (수신) | **완료** | BE: `partner_office.py` (AlimtalkPanel) / FE: `campaigns/checkup-design/index.tsx` L60-112 |
| 2 | **랜딩 페이지 (소개)** | uuid, status 판단 결과 | `POST /checkup-design/check-status` | **완료** | FE: `campaigns/checkup-design/IntroLandingPage.tsx` / BE: `checkup_design.py` L2405-2492 |
| 3 | **약관 동의 (1회)** | uuid, partner_id, 동의 항목 4종 | `POST /terms/check-all` + `POST /terms/save` | **완료** | FE: `components/terms/TermsAgreementModal` / BE: `terms_agreement.py` |
| 4 | **기존 환자 맞이 화면** | check-status 결과 case A(결과있음) / case C(데이터있음) | check-status API 응답 분기 | **완료** | FE: `campaigns/checkup-design/index.tsx` 상태 머신 (L142-168) |
| 5 | **정보 확인 (이름/전화/생년)** | 알림톡 링크에 포함된 name, birthday, gender | `POST /checkup-design/save-link-health-data` | **완료** | FE: `IntroLandingPage.tsx` / BE: `checkup_design.py` L2388-2402 |
| 6 | **비밀번호 (기존 환자)** | password hash | `POST /password/verify` | **완료** | FE: `components/PasswordModal/` / BE: `password.py` |
| 7 | **검진설계 채팅 (AI)** | 건강데이터, 페르소나, FAISS RAG 결과 | `POST /checkup-design/step1` + `POST /checkup-design/step2` | **완료** | FE: `features/checkup/CheckupDesignPage.tsx` / BE: `checkup_design.py` L817, L1246 / services: `checkup_design/` (prompt, rag_service, persona, step1_prompt, step2_priority1, step2_upselling) |
| 8 | **결과 확인 + 상담 요청 버튼** | design_result (JSON) | `GET /checkup-design/latest/{uuid}` | **부분** | FE: `campaigns/checkup-design/ResultPage.tsx` — 결과 표시 완료, **상담 요청 버튼 미구현** |
| 9 | **(선택) 캘린더 예약** | 선택 날짜, uuid | - | **부분** | FE: `components/appointment/AppointmentModal/` — UI만 존재, **API 연동 없음 (onConfirm 핸들러 미구현)** |

### [상담원 Flow — 백오피스]

| # | 단계 | 필요 데이터 | 호출 API | 구현 상태 | 코드 위치 |
|---|------|------------|---------|----------|----------|
| 10 | **상담 요청 알림 수신** | consultation_requested 건 수 | `GET /admin/embedding/summary-counts` (현재 new_revisit만) | **미구현** | PartnerOfficeLayout에 revisit 뱃지는 있으나, **검진설계 상담 요청 전용 뱃지 없음** |
| 11 | **고객 상세 화면 열기** | session_id → 환자 정보 + 태깅 + 대화 이력 | `POST /partner-office/revisit-candidates/{session_id}/messages` | **부분** | RevisitPage에 대화이력+태그 조회 있으나, **검진설계 전용 상세 화면 없음** |
| 12 | **건강데이터 + 검진설계 결과 + 대화이력 확인** | checkup_data, design_result, chat_log, prescription_data | 개별 API 존재하나 **통합 조회 API 없음** | **미구현** | BE: welno_data_service.py에 개별 함수 있음, 통합 endpoint 필요 |
| 13 | **상담 메모 작성** | counselor_note text | - | **미구현** | DB에 메모 컬럼 없음 |
| 14 | **상담 완료 처리** | consultation_status 변경 | `POST /partner-office/consultation-status` | **완료** | BE: `partner_office.py` L1754-1769 |

---

## 2. 미구현 항목 정리

### P0 (핵심 — 상담 파이프라인 작동에 필수)

| ID | 항목 | 설명 | 영향 범위 |
|----|------|------|----------|
| P0-1 | **검진설계 결과 페이지 — 상담 요청 버튼** | ResultPage.tsx에 "상담 받기" 버튼 추가. 클릭 시 consultation-request API 호출 | FE: ResultPage.tsx, BE: 기존 API 재사용 |
| P0-2 | **백오피스 상담 요청 목록 페이지** | 검진설계 완료 고객 중 상담 요청한 건 리스트. 상태(대기/진행중/완료) 필터 | FE: 새 페이지 ConsultationPage, BE: 새 API |
| P0-3 | **백오피스 고객 상세 화면** | 건강데이터 + 검진설계 결과 + 대화이력 + 처방내역을 한 화면에 통합 | FE: 새 컴포넌트, BE: 통합 조회 API |
| P0-4 | **상담 메모 기능** | 상담원이 메모 작성/수정 가능. DB 컬럼 추가 필요 | DB: 컬럼 추가, BE: CRUD API, FE: 메모 입력 UI |

### P1 (중요 — 상담 품질 향상)

| ID | 항목 | 설명 |
|----|------|------|
| P1-1 | **상담 요청 알림 뱃지** | PartnerOfficeLayout 사이드바에 검진설계 상담 전용 뱃지 |
| P1-2 | **업셀링 포인트 하이라이트** | 검진설계 결과에서 "추가 추천" 항목을 상담원에게 별도 섹션으로 표시 |
| P1-3 | **고객 관심사 태그 표시** | 채팅에서 관심 보인 주제를 태그로 상세 화면에 표시 (interest_tags 활용) |
| P1-4 | **라벨링/태깅 체계 구분 표시** | 데이터 출처별(수검자 입력 / AI 추출 / 공단 데이터 / 파트너 제공) 라벨 |
| P1-5 | **건강검진 추이 차트** | 연도별 수치 변화를 상담원 화면에서 확인 (기존 HealthTrends 컴포넌트 재사용) |

### P2 (개선 — 운영 효율화)

| ID | 항목 | 설명 |
|----|------|------|
| P2-1 | **캘린더 예약 API 연동** | AppointmentModal의 날짜 선택 결과를 DB에 저장하고 상담원에게 전달 |
| P2-2 | **상담 스크립트 제안 (AI)** | 검진설계 결과 + 관심사 기반 상담원용 스크립트 자동 생성 |
| P2-3 | **알림톡 재발송** | 상담원이 백오피스에서 특정 고객에게 알림톡 재발송 |
| P2-4 | **엑셀 내보내기** | 상담 요청 목록 + 상세 데이터 엑셀 다운로드 |
| P2-5 | **대시보드 KPI** | 상담 전환율, 평균 응답 시간, 예약 완료율 등 |

---

## 3. 백오피스 상담원 화면 와이어프레임

### A. 상담 요청 목록 (ConsultationListPage)

```
+==============================================================================+
| [사이드바]              | [헤더: 검진설계 상담]                    [관리자 ▼] |
|                         |                                                     |
| 대시보드                | +---상태 필터---+  +---검색---+  +---기간---+         |
| 환자 통합               | | ● 전체 (42)  |  | 고객명.. |  | 최근 7일 ▼|         |
| 검진결과 상담           | | ○ 대기 (15)  |  +----------+  +----------+          |
| 만족도 조사             | | ○ 진행중 (8) |                                       |
| 재환가망고객            | | ○ 완료 (19)  |  [엑셀 내보내기]                      |
|=검진설계 상담 [3]=====| +---[KPI 카드]-------------------------------------------+   |
| 데이터 분석             | | 대기 15건 | 오늘 신규 5건 | 상담 전환율 63% |        |
| 검진설계 관리           | +-------------------------------------------------------+   |
|                         |                                                          |
|                         | +---리스트 테이블------------------------------------------+  |
|                         | | 상태  | 고객명 | 요청일시    | 검진유형  | 추천항목 | AI요약     | |
|                         | |-------|--------|-------------|-----------|---------|------------|
|                         | | 🔴대기| 김영수 | 03-31 14:20 | 종합검진  | 5개     | 혈압주의.. | |
|                         | | 🔴대기| 박미영 | 03-31 13:55 | 정밀검진  | 8개     | 당뇨위험.. | |
|                         | | 🟡진행| 이철호 | 03-31 10:30 | 종합검진  | 4개     | 간기능..   | |
|                         | | 🟢완료| 정하나 | 03-30 16:45 | 정밀검진  | 6개     | 갑상선..   | |
|                         | +------------------------------------------------------+      |
|                         |                                                          |
|                         | [이전] 1 / 3 [다음]                                       |
+==============================================================================+
```

**구성 요소:**
- 상단: 상태 필터 (전체/대기/진행중/완료) + 텍스트 검색 + 기간 필터
- KPI 카드: 대기 건수, 오늘 신규, 상담 전환율
- 리스트 컬럼: 상태 뱃지, 고객명, 요청일시, 검진유형(종합/정밀), 추천 항목 수, AI 분석 1줄 요약
- 행 클릭 시 → 고객 상세 화면 (패널 or 페이지)

---

### B. 고객 상세 화면 (ConsultationDetailPanel)

RevisitPage의 split-panel 패턴(리스트 좌 / 상세 우)을 재사용하되, 검진설계 전용 섹션을 추가한다.

```
+==============================================================================+
| [리스트 (40%)]                    | [상세 패널 (60%)]                         |
|                                   |                                           |
| (위 리스트와 동일)                 | +---고객 기본정보---+                      |
|                                   | | 김영수 (남, 52세)                        |
|                                   | | 010-1234-5678                            |
|                                   | | [수검자 입력] 이름,전화,생년             |
|                                   | +-------------------------------------------+
|                                   |                                           |
|                                   | +---탭: [설계결과] [건강추이] [대화이력] [처방내역] [업셀링]---+
|                                   |                                           |
| ====[설계결과 탭 선택 시]===========                                          |
|                                   | +---페르소나 배지---+                      |
|                                   | | 건강관리형 (Optimizer)                   |
|                                   | | [AI 추출]                                |
|                                   | +-------------------------------------------+
|                                   |                                           |
|                                   | +---위험도 프로필---+                      |
|                                   | | 심혈관계  [High]  ← [AI 추출]            |
|                                   | | 소화기계  [Moderate] ← [AI 추출]         |
|                                   | | 내분비계  [Low]   ← [AI 추출]            |
|                                   | +-------------------------------------------+
|                                   |                                           |
|                                   | +---추천 검진 항목---+                     |
|                                   | | [필수] 심장초음파                         |
|                                   | |   근거: 혈압 147/92, 고혈압 진단        |
|                                   | |   [AI 추출]                              |
|                                   | | [필수] 경동맥초음파                       |
|                                   | |   근거: LDL 165, 심혈관 위험            |
|                                   | |   [AI 추출]                              |
|                                   | | [추천] 갑상선초음파                       |
|                                   | |   근거: 가족력 언급                       |
|                                   | |   [AI 추출] ★업셀링 포인트              |
|                                   | +-------------------------------------------+
|                                   |                                           |
|                                   | +---종합 분석---+                          |
|                                   | | 52세 남성, 혈압/LDL 관리 필요.          |
|                                   | | 최근 2년간 혈압 상승 추세...            |
|                                   | | [AI 추출]                                |
|                                   | +-------------------------------------------+
|                                   |                                           |
| ====[건강추이 탭 선택 시]===========                                          |
|                                   | +---연도별 수치 비교 차트---+              |
|                                   | | 2024  2025  2026                         |
|                                   | | BMI    24.1  25.3  26.0  ↑              |
|                                   | | 혈압   132   140   147   ↑↑             |
|                                   | | 혈당   98    105   112   ↑              |
|                                   | | [공단 데이터] + [파트너 제공]            |
|                                   | +-------------------------------------------+
|                                   | | (추이 차트 — 기존 HealthTrends 재사용)  |
|                                   | +-------------------------------------------+
|                                   |                                           |
| ====[대화이력 탭 선택 시]===========                                          |
|                                   | +---RAG 채팅 내용---+                     |
|                                   | | [사용자] 혈압약을 먹고 있는데...        |
|                                   | | [AI] 현재 복용 중인 혈압약과 함께...    |
|                                   | | [사용자] 위내시경은 꼭 해야 하나요?     |
|                                   | |   → 관심태그: #위내시경 #소화기         |
|                                   | | [AI] 50세 이상 남성은 2년 주기...       |
|                                   | +-------------------------------------------+
|                                   |                                           |
| ====[처방내역 탭 선택 시]===========                                          |
|                                   | +---Tilko 처방 데이터---+                 |
|                                   | | 아모디핀 5mg (혈압) — 2025-01 ~         |
|                                   | | 메트포르민 500mg (당뇨) — 2024-06 ~     |
|                                   | | [공단 데이터]                            |
|                                   | +-------------------------------------------+
|                                   |                                           |
| ====[업셀링 탭 선택 시]=============                                          |
|                                   | +---업셀링 포인트---+                     |
|                                   | | ★ 갑상선초음파 — 가족력 언급 (채팅)     |
|                                   | | ★ 대장내시경 — 50대 남성, 미검 3년     |
|                                   | | ★ CT 촬영 — 흡연력 20년                |
|                                   | | [AI 추출] + [수검자 관심]               |
|                                   | +-------------------------------------------+
|                                   | | +---상담 스크립트 제안---+               |
|                                   | | | "김영수님, 혈압이 작년 대비 7mmHg     |
|                                   | | |  상승했어요. 심장초음파와 함께         |
|                                   | | |  경동맥초음파도 추천드려요..."         |
|                                   | | | [AI 생성]                              |
|                                   | | +---------------------------------------+ |
|                                   |                                           |
|===================================================================           |
|                                   | +---하단 액션 영역---+                    |
|                                   | | [상담 메모]                              |
|                                   | | +-----------------------------------+    |
|                                   | | | 혈압약 복용 확인, 경동맥 초음파   |    |
|                                   | | | 추가 설명 완료. 4/7 오전 예약.    |    |
|                                   | | +-----------------------------------+    |
|                                   | | [저장]                                   |
|                                   | |                                          |
|                                   | | 상태: [대기 ▼] → [진행중] → [완료]      |
|                                   | | [상태 변경]                               |
|                                   | |                                          |
|                                   | | [캘린더 예약 연동]                        |
|                                   | | 희망일: 2026-04-07 오전                  |
|                                   | | [예약 확정] [예약 변경]                   |
|                                   | +-------------------------------------------+
+==============================================================================+
```

---

### B-2. 라벨링/태깅 체계

각 데이터 항목 옆에 출처 라벨을 표시한다:

| 라벨 | 색상 | 데이터 소스 | 예시 |
|------|------|------------|------|
| `[수검자 입력]` | `#3b82f6` (파란) | 사용자가 직접 입력한 정보 | 이름, 전화, 생년, 약관 동의, 상담 요청 |
| `[AI 추출]` | `#8b5cf6` (보라) | Gemini/GPT가 분석한 결과 | 건강검진 수치 해석, 검진 추천, 위험도, 페르소나 |
| `[공단 데이터]` | `#059669` (초록) | Tilko로 가져온 건보공단 raw data | 건강검진 수치, 처방전, 복약 내역 |
| `[파트너 제공]` | `#d97706` (주황) | 알림톡 링크에 포함된 건강 데이터 | BMI, 혈압, 혈당 (병원 EMR에서 추출) |

**구현 위치:**
- BE: 각 데이터 조회 API 응답에 `data_source` 필드 추가
- FE: Badge 컴포넌트로 라벨 표시

---

## 4. 필요한 신규 API 목록

### P0 — 핵심

| # | Method | Endpoint | 설명 | BE 파일 |
|---|--------|---------|------|---------|
| A1 | `POST` | `/partner-office/consultation-requests` | 상담 요청 목록 조회 (필터: status, date_from, date_to, search) | partner_office.py (신규) |
| A2 | `GET` | `/partner-office/consultation-detail/{session_id}` | 고객 상세 통합 조회 (기본정보 + 건강데이터 + 설계결과 + 대화이력 + 처방내역 + 태그) | partner_office.py (신규) |
| A3 | `POST` | `/partner-office/consultation-memo` | 상담 메모 저장/수정 | partner_office.py (신규) |
| A4 | `GET` | `/partner-office/consultation-memo/{session_id}` | 상담 메모 조회 | partner_office.py (신규) |
| A5 | `POST` | `/partner-office/consultation-status` | 상담 상태 변경 (pending → contacted → completed) | partner_office.py (**기존 L1754**) |

### P1 — 중요

| # | Method | Endpoint | 설명 |
|---|--------|---------|------|
| B1 | `GET` | `/admin/embedding/summary-counts` | 기존 API에 `new_consultation_requests` 필드 추가 |
| B2 | `POST` | `/partner-office/upselling-points/{session_id}` | 업셀링 포인트 추출 (검진설계 결과 + 채팅 관심사 분석) |
| B3 | `POST` | `/partner-office/consultation-script/{session_id}` | AI 상담 스크립트 생성 (Gemini) |

### P2 — 개선

| # | Method | Endpoint | 설명 |
|---|--------|---------|------|
| C1 | `POST` | `/partner-office/appointment-reserve` | 캘린더 예약 저장 (날짜, 시간, 메모) |
| C2 | `GET` | `/partner-office/appointment/{uuid}` | 예약 상태 조회 |
| C3 | `POST` | `/partner-office/consultation-export` | 엑셀 내보내기 (서버사이드 생성) |

---

## 5. DB 테이블 변경 사항

### 5-1. 기존 테이블 컬럼 추가

**welno.tb_chat_session_tags** — 이미 consultation 컬럼 추가됨 (migration 완료)

```sql
-- 이미 적용됨 (add_consultation_request_columns.sql)
-- consultation_requested BOOLEAN DEFAULT false
-- consultation_type VARCHAR(50)        -- 'revisit' | 'checkup'
-- consultation_status VARCHAR(20)      -- 'pending' | 'contacted' | 'completed'
-- consultation_consent_at TIMESTAMPTZ
```

### 5-2. 신규 테이블

```sql
-- 상담 메모 테이블
CREATE TABLE IF NOT EXISTS welno.tb_consultation_memos (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    patient_uuid VARCHAR(100),
    hospital_id VARCHAR(255),
    partner_id VARCHAR(50) DEFAULT 'welno',
    -- 메모 내용
    memo_content TEXT,
    counselor_name VARCHAR(100),
    counselor_id VARCHAR(100),
    -- 상태
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft' | 'saved'
    -- 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_memo_session
  ON welno.tb_consultation_memos(session_id);
CREATE INDEX IF NOT EXISTS idx_consult_memo_patient
  ON welno.tb_consultation_memos(patient_uuid);
CREATE INDEX IF NOT EXISTS idx_consult_memo_created
  ON welno.tb_consultation_memos(created_at DESC);

-- 상담 메모 updated_at 자동 갱신
CREATE TRIGGER trg_consult_memo_updated_at
    BEFORE UPDATE ON welno.tb_consultation_memos
    FOR EACH ROW
    EXECUTE FUNCTION welno.update_chat_tags_updated_at();
```

```sql
-- 예약 테이블 (P2)
CREATE TABLE IF NOT EXISTS welno.tb_consultation_appointments (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    patient_uuid VARCHAR(100) NOT NULL,
    hospital_id VARCHAR(255),
    partner_id VARCHAR(50) DEFAULT 'welno',
    -- 예약 정보
    preferred_dates JSONB DEFAULT '[]',  -- [{date: "2026-04-07", time_slot: "AM"}]
    confirmed_date DATE,
    confirmed_time VARCHAR(20),
    appointment_type VARCHAR(50),        -- 'checkup' | 'consultation'
    -- 상태
    status VARCHAR(20) DEFAULT 'requested',  -- 'requested' | 'confirmed' | 'cancelled' | 'completed'
    note TEXT,
    -- 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_appt_patient
  ON welno.tb_consultation_appointments(patient_uuid);
CREATE INDEX IF NOT EXISTS idx_consult_appt_status
  ON welno.tb_consultation_appointments(status);
CREATE INDEX IF NOT EXISTS idx_consult_appt_date
  ON welno.tb_consultation_appointments(confirmed_date);
```

### 5-3. 기존 테이블 확장 (P1)

```sql
-- welno.tb_chat_session_tags에 검진설계 연결 컬럼 추가
ALTER TABLE welno.tb_chat_session_tags
  ADD COLUMN IF NOT EXISTS design_request_id INTEGER,
  ADD COLUMN IF NOT EXISTS upselling_points JSONB DEFAULT '[]';

COMMENT ON COLUMN welno.tb_chat_session_tags.design_request_id IS '연결된 검진설계 요청 ID';
COMMENT ON COLUMN welno.tb_chat_session_tags.upselling_points IS 'AI 추출 업셀링 포인트';
```

---

## 6. 프론트엔드 신규 파일 목록

### 백오피스 (backoffice/src/)

```
pages/
  ConsultationPage/              ← 신규
    index.tsx                    ← 리스트 + 상세 split-panel (RevisitPage 패턴)
    styles.scss
    components/
      ConsultationList.tsx       ← 좌측 리스트
      ConsultationDetail.tsx     ← 우측 상세 패널
      DesignResultSection.tsx    ← 검진설계 결과 표시
      HealthTrendSection.tsx     ← 건강추이 차트
      ChatHistorySection.tsx     ← 대화이력 표시
      PrescriptionSection.tsx    ← 처방내역 표시
      UpsellingSection.tsx       ← 업셀링 포인트
      ConsultationMemo.tsx       ← 상담 메모 입력
      StatusChanger.tsx          ← 상태 변경
      DataSourceBadge.tsx        ← 라벨링 배지 컴포넌트
```

### 프론트엔드 (frontend/src/) — 수검자 화면 수정

```
campaigns/checkup-design/
  ResultPage.tsx                 ← 수정: 상담 요청 버튼 + 캘린더 예약 추가
```

### 백오피스 App.tsx 수정

```tsx
// 추가할 라우트
import ConsultationPage from './pages/ConsultationPage';

// Routes에 추가
<Route path="consultation" element={<ConsultationPage />} />
```

### PartnerOfficeLayout 수정

```tsx
// NAV_ITEMS에 추가
{ key: 'consultation', label: '검진설계 상담', path: '/backoffice/consultation' },

// 뱃지 추가
{item.key === 'consultation' && summaryCounts.new_consultation > 0 && (
  <span className="po-layout__nav-badge">{summaryCounts.new_consultation}</span>
)}
```

---

## 7. 구현 우선순위 로드맵

### Phase 1 (P0) — 1주차: 상담 파이프라인 기본 동작

1. DB migration: `tb_consultation_memos` 테이블 생성
2. BE: consultation-requests 목록 API (A1)
3. BE: consultation-detail 통합 조회 API (A2)
4. BE: consultation-memo CRUD API (A3, A4)
5. FE (수검자): ResultPage에 "상담 받기" 버튼 추가 + consultation-request API 호출
6. FE (백오피스): ConsultationPage 기본 — 리스트 + 상세 패널 (설계결과 탭)
7. FE (백오피스): 상담 메모 + 상태 변경 기능
8. App.tsx, PartnerOfficeLayout 라우트/네비 추가

### Phase 2 (P1) — 2주차: 상담 품질 향상

1. BE: summary-counts에 new_consultation_requests 추가 (B1)
2. FE: 사이드바 뱃지
3. FE: 건강추이 탭 (기존 차트 컴포넌트 재사용)
4. FE: 대화이력 탭 (기존 RevisitPage의 채팅 로드 로직 재사용)
5. FE: 처방내역 탭
6. FE: 라벨링/태깅 DataSourceBadge 컴포넌트
7. FE: 업셀링 포인트 탭
8. BE: upselling-points API (B2)

### Phase 3 (P2) — 3주차: 운영 효율화

1. DB migration: `tb_consultation_appointments` 테이블 생성
2. BE: appointment-reserve API (C1, C2)
3. FE (수검자): AppointmentModal API 연동
4. FE (백오피스): 캘린더 예약 연동 섹션
5. BE: consultation-script AI 생성 (B3)
6. FE: 상담 스크립트 제안 UI
7. FE: 엑셀 내보내기

---

## 8. 데이터 흐름도

```
[알림톡 발송]
    │ uuid, health_data, lookup_key
    ▼
[수검자: 랜딩 → 약관 → 인증 → 검진설계 채팅]
    │
    │ POST /checkup-design/step1, step2
    ▼
[welno_checkup_design_requests]  ←  design_result (JSON)
    │
    │ 결과 페이지에서 "상담 받기" 클릭
    │ POST /partner-office/consultation-request
    ▼
[tb_chat_session_tags]  ←  consultation_requested=true, status='pending'
    │
    │ 백오피스 뱃지 갱신 (summary-counts)
    ▼
[상담원: 상담 요청 목록]
    │
    │ 행 클릭 → consultation-detail API
    ▼
[상담원: 고객 상세]
    │ ├── 건강데이터 ← welno_checkup_data
    │ ├── 설계결과 ← welno_checkup_design_requests
    │ ├── 대화이력 ← tb_partner_rag_chat_log
    │ ├── 처방내역 ← welno_prescription_data
    │ ├── 태그/관심사 ← tb_chat_session_tags
    │ └── 업셀링 ← design_result.recommended_items + interest_tags
    │
    │ 메모 작성 → POST /consultation-memo
    │ 상태 변경 → POST /consultation-status (pending → contacted → completed)
    │ 예약 연동 → POST /appointment-reserve (P2)
    ▼
[완료]
```

---

## 9. 기존 코드 재사용 매핑

| 신규 컴포넌트 | 참고할 기존 코드 | 재사용 내용 |
|-------------|---------------|------------|
| ConsultationList | `backoffice/src/pages/RevisitPage/index.tsx` | 리스트 테이블, 필터, 정렬, KPI 카드 패턴 |
| ConsultationDetail | `backoffice/src/pages/RevisitPage/index.tsx` (detailTab) | split-panel, 탭 전환, 채팅 로드 |
| DesignResultSection | `frontend/src/campaigns/checkup-design/ResultPage.tsx` | 페르소나 배지, 위험도 프로필, 추천 항목 표시 |
| HealthTrendSection | `frontend/src/features/health/HealthTrends.tsx` | 연도별 수치 비교 차트 |
| ChatHistorySection | `backoffice/src/pages/RevisitPage/index.tsx` (chat 탭) | 채팅 메시지 렌더링 |
| DataSourceBadge | 신규 (단순 Badge) | - |
| StatusChanger | `backoffice/src/pages/RevisitPage/` (consultation_status 표시 로직) | 상태 드롭다운 |
| ConsultationMemo | 신규 (textarea + 저장 버튼) | - |
| 상담 요청 버튼 | `frontend/src/App.tsx` FloatingButton "상담예약 신청" | 플로팅 버튼 패턴 |

---

## 10. 주의사항

1. **RevisitPage와의 관계**: 재환가망고객(RevisitPage)은 "AI가 자동 판단한 follow_up_needed" 기반. 검진설계 상담(ConsultationPage)은 "사용자가 명시적으로 요청한 consultation_requested" 기반. 두 리스트는 별도 페이지로 유지하되, 동일 session이 양쪽에 나올 수 있다.

2. **consultation_type 구분**: 현재 'revisit'(재환) 과 'checkup'(검진예약) 두 유형. 검진설계 캠페인에서는 'checkup'이 기본값.

3. **session_id 연결**: 검진설계 채팅 시 생성되는 session_id가 tb_chat_session_tags와 tb_partner_rag_chat_log를 연결하는 키. 이 session_id를 통해 설계 결과, 대화 이력, 태그를 모두 조회한다.

4. **design_request_id**: welno_checkup_design_requests.id와 tb_chat_session_tags를 연결하는 FK가 현재 없음. P1에서 추가 필요.

5. **보안**: 상담 메모에 개인정보가 포함될 수 있으므로, 백오피스 인증(JWT) 필수. embed(iframe) 모드에서는 메모 기능 비활성화.
