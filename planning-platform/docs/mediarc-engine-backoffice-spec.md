# mediArc 엔진 백오피스 이식 설계서

**작성일**: 2026-04-14
**작성자**: dev-planner
**대상**: WELNO 백엔드에 `~/mediarc_report/demo/engine.py` 를 **백오피스 전용 모듈**로 이식
**상태**: DRAFT (승인 전)

---

## 0. 3줄 요약

1. 신규 엔진(`engine.py` 1,787줄, scikit-learn pkl 포함)을 `backend/app/services/report_engine/`(신규, 가칭)로 이식. 기존 `services/mediarc/`(Twobecon API 어댑터)는 **read-only 참조만** 하고 수정/삭제하지 않는다.
2. FE `useMediarcApi.ts` 5개 경로 중 **3개는 BE에 alias 라우트만 추가**(FE 재배포 없이 해결), **2개는 신규 구현**(`/compare`, `/verify-all`). 현재 404 나는 FE 페이지를 즉시 살린다.
3. `engine.py`는 **직접 복사 + 얇은 래퍼** 방식으로 이식한다. `requirements.txt`에 numpy/scikit-learn 추가, pkl·json 리소스는 모듈 내 고정 경로, 엔진은 **프로세스당 1회 로드 싱글톤**으로 메모리/지연 최소화.

---

## 1. 배경 및 현재 상태

### 3줄 요약
- FE 백오피스(`HealthReportPage`)는 5개 엔드포인트를 호출하지만 경로 불일치로 404가 발생.
- 기존 BE(`partner_office.py`)에는 3소스(chat/campaign/welno) UNION 조회 + 정규화는 구현되어 있으나, **리포트 계산 엔진은 없음**(현재 `stats`는 엔진 메타를 하드코딩).
- 신규 엔진 자산(`~/mediarc_report/demo/`)은 로컬 프로토타입 단계로, 테스트 완료 상태이지만 WELNO 백엔드에 편입되지 않음.

### 1.1 확인된 팩트

| 항목 | 값 | 증거 |
|---|---|---|
| 라우터 prefix | `/partner-office` (내부) | `partner_office.py:24` |
| 등록 prefix | `/api/v1` + `/welno-api/v1` | `main.py:144, 175` |
| FE API base | `${API}/partner-office/mediarc-report/...` | `useMediarcApi.ts:96` |
| 기존 엔드포인트 3개 | `/unified-patients`, `/patient/{uuid}`, `/stats` | `partner_office.py:2462, 2628, 2704` |
| Twobecon 파이프라인 함수 | `generate_mediarc_report_async`, `run_disease_report_pipeline`, `call_mediarc_api` | `services/mediarc/report_service.py` + `checkup_design.py:644`, `surveys.py:184`, `welno_data.py:380/967`, `tilko_auth.py:1592/2319/2801`, `campaign_payment.py:51, 1004` |
| 읽기 전용 테이블 | `welno.welno_mediarc_reports` | `welno_models.py:143` |
| 정규화 함수 | `_normalize_health_metrics(source, raw)` — chat/campaign/welno 3경로 | `partner_office.py:2381-2454` |
| 엔진 진입 함수 | `run_for_patient(name, patient)` → ReportData-like dict | `engine.py:1424-1504` |
| 엔진 바이오에이지 | `compute_bioage_gb(patient)` → pkl 로드, 실패 시 None | `engine.py:1719-1787` |
| 엔진 리소스 | `bioage_model.pkl`, `bioage_features.json`, `static_data.json`, `rr_ci_table.json`, `nutrition_rules.py`, `reference_data.py` | `~/mediarc_report/demo/` |
| Twobecon 파이프라인 호출 지점 | 8개 파일 (checkup_design, surveys, welno_data, tilko_auth, campaign_payment, disease_report_unified) | grep 결과 |

### 1.2 FE ↔ BE 경로 불일치 표

| FE 호출 경로 | BE 실존 | 조치 |
|---|---|---|
| `/partner-office/mediarc-report/patients?limit=200` | `/unified-patients` | **alias 추가** (BE) |
| `/partner-office/mediarc-report/{uuid}` | `/patient/{uuid}` | **alias 추가** (BE) |
| `/partner-office/mediarc-report/{uuid}/compare` | 없음 | **신규 구현** |
| `/partner-office/mediarc-report/engine/stats` | `/stats` | **alias 추가 + 하드코딩 제거** |
| `/partner-office/mediarc-report/verify-all` | 없음 | **신규 구현** |

### 1.3 FE 타입 요구사항 (`useMediarcApi.ts:40-91`)

- `ReportData`: `{name, age, sex, group, bodyage{bodyage,delta}, rank, diseases, nutrition, gauges, patient_info}` — **엔진 `run_for_patient`가 대부분 제공**, `nutrition`/`rank`/`gauges` 구조 매핑 필요.
- `ComparisonData`: `{patient, twobecon{bodyage,rank}, mediarc{bodyage,rank}, match_rate, comparison[]}` — Twobecon 결과(welno_mediarc_reports) vs 엔진 실시간 출력 비교 전용 신규 구조.
- `EngineStats`: `{total_rr, pmid_coverage, confidence, diseases, validation}` — 엔진 내부 상수에서 집계.
- `VerificationData`: `{total_patients, match_rate, disease_summary, anomalies, top_match, worst_match}` — `verify-all` 전용.

---

## 2. 결정 필요 3가지 (옵션 + 추천)

### A. 신규 엔진 모듈 이름

| 옵션 | 경로 | 장점 | 단점 |
|---|---|---|---|
| **A1. `services/report_engine/`** | `backend/app/services/report_engine/` | 기능 중립적. `services/mediarc/`(어댑터)와 확실히 구분 | 이름이 약간 포괄적 |
| A2. `services/health_engine/` | `...services/health_engine/` | 가장 도메인 중립적 | 기존 함수들이 "mediArc" 브랜드이라 혼선 |
| A3. `services/mediarc_v2/` | `...services/mediarc_v2/` | v1/v2 버전 체계로 자연 | "v2"라는 이름이 기존 v1을 곧 대체할 듯한 뉘앙스 → 제약 1번(Twobecon 무손상) 원칙과 충돌 |

**추천: A1 `services/report_engine/`**

- 근거: (1) 기존 `services/mediarc/`는 Twobecon 외부 API 어댑터/저장 파이프라인 — "통신 계층"이다. (2) 신규는 자체 계산 엔진 — "계산 계층"이다. 두 계층은 직교하며 이름도 직교해야 한다. (3) "v2"는 v1을 대체할 계획이 있을 때 쓰는 이름인데, 본 프로젝트는 v1을 존치할 것이므로 부적절.
- 백오피스 전용임을 강조하려면 `services/report_engine/backoffice/`로 한 단계 더 내리는 것도 가능하나, 지금은 전원이 백오피스이므로 불필요한 중첩. 나중에 프론트 노출 생기면 그때 분리.

### B. FE-BE 경로 불일치 해결

| 옵션 | 방식 | 장점 | 단점 |
|---|---|---|---|
| **B1. BE에 alias 라우트 추가** | `/patients` → `/unified-patients` 내부 위임, `/{uuid}` → `/patient/{uuid}` 내부 위임, `/engine/stats` → `/stats` 내부 위임 | FE 재배포 0. 즉시 404 해결. 기존 3개 엔드포인트를 그대로 유지(다른 호출처 있을 가능성) | BE에 중복 경로 2쌍 생김(정리 숙제) |
| B2. FE 경로 수정 후 백오피스 재배포 | FE useMediarcApi.ts 5개 URL을 BE 실존 경로로 교체 | 경로 일원화 | 백오피스 재빌드+배포 필요. 배포 주기 동안 계속 404 |
| B3. 혼합 (FE + BE 둘 다 수정하여 공식 명칭으로 통일) | 예: 공식 명칭 `/reports`, `/reports/{uuid}`, `/reports/{uuid}/compare` | 장기적으로 깨끗 | 변경 범위 최대. 배포 리스크 |

**추천: B1 alias 추가 (단기) + 메모로 B3 통일 로드맵 남김**

- 근거: (1) 제약 "아직 오픈 전 단계, 내부 검증용"이라도 FE가 이미 404 상태. 즉시 살리는 게 우선. (2) BE 라우트 2쌍 중복은 FastAPI에서 단순 래퍼 함수 하나로 해결 — 유지 부담 최소. (3) `/unified-patients`는 의미 있는 이름이므로 삭제보다는 alias 추가 + 주석으로 "FE 호환 목적" 명시.
- alias 라우트 구현 시 내부 함수 재호출(DRY): `@router.get("/mediarc-report/patients")` → 바로 `await mediarc_unified_patients(limit, hospital_id)` 호출하는 1줄 wrapper.

### C. `~/mediarc_report/` 폴더 처리

| 옵션 | 방식 | 장점 | 단점 |
|---|---|---|---|
| **C1. 필요한 자산만 복사, 원본 유지** | engine.py, nutrition_rules.py, reference_data.py, bioage_model.pkl, bioage_features.json, static_data.json, rr_ci_table.json만 WELNO로 복사. 원본은 프로토타입 저장소로 남김 | 프로토타입 반복 개선 여지. WELNO 쪽은 "배포본" 개념으로 확정본만 유지 | 원본/WELNO 동기화 숙제(향후 엔진 개선 시) |
| C2. 전체 이동 후 원본 삭제 | `~/mediarc_report/` 전체를 WELNO/archive로 이동 | 소스 분산 없음 | 프로토타입 개선 이력(demo/analysis/phase2_review 등) 전부 WELNO에 섞임. 90MB 가량. |
| C3. 그대로 유지 + WELNO에서 심링크 | WELNO에서 `~/mediarc_report/demo/` 심링크 | 동기화 자동 | 서버 배포 불가(원본이 로컬에만 있음). **실질 불가능** |

**추천: C1 필요 자산만 복사 + 원본 유지**

- 근거: (1) C3는 배포가 안 되므로 탈락. (2) 원본 폴더에는 `analysis/`, `phase2_review/`, `phase3_our_design/`, `validation/`, `.pptx` 파일 등 프로토타입 이력 대량 존재. WELNO 레포지토리에 들어가면 git 기록 지저분. (3) C1로 복사하는 파일 크기는 engine.py 90KB + pkl 270KB + 나머지 JSON 수십KB = 약 400KB, 관리 가능 수준.
- 원본 폴더는 추후 `~/mediarc_report_proto/` 같은 아카이브 폴더로 이름 변경 권장(실수 유입 방지). 결정 필요 사항이므로 본 설계서에서는 강제하지 않고 권고만.

---

## 3. 디렉토리 구조 (신규)

### 3줄 요약
- `services/report_engine/`(신규) 하나만 추가. 기존 `services/mediarc/` 무손상.
- 엔진 관련 파일은 모두 이 폴더 하위. 외부에서는 `EngineFacade` 싱글톤 하나만 import.
- FE 호환 alias 라우트는 `partner_office.py` 내부에 얇게 추가(별도 라우터 파일 만들지 않음 — 기존 구조 존중).

```
backend/app/services/report_engine/          ← 신규 폴더
├── __init__.py                                  # EngineFacade export
├── engine.py                                    # ~/mediarc_report/demo/engine.py 복사 (1,787줄)
├── nutrition_rules.py                           # 복사 (263줄)
├── reference_data.py                            # 복사 (140줄)
├── static_data.json                             # 복사
├── rr_ci_table.json                             # 복사
├── bioage_model.pkl                             # 복사 (270KB)
├── bioage_features.json                         # 복사
├── facade.py                                    # 신규 — 엔진 1회 로드 + 어댑터 (150줄 이내)
├── adapter.py                                   # 신규 — _normalize_health_metrics 결과 → engine.patient dict
├── comparator.py                                # 신규 — Twobecon 결과 vs 엔진 결과 비교 (compare/verify-all)
├── stats.py                                     # 신규 — EngineStats 집계 (하드코딩 제거)
└── README.md                                    # 엔진 출처, 결정 이력, 배포 주의사항
```

### 3.1 각 신규 파일 역할

| 파일 | 역할 | 외부 노출 |
|---|---|---|
| `facade.py` | `EngineFacade` 싱글톤. 엔진 최초 호출 시 pkl/json 로드. `run(patient_dict) -> ReportData dict` 제공 | `from ....services.report_engine import EngineFacade` |
| `adapter.py` | `to_engine_patient(normalized_metrics, age, sex) -> dict` — engine.py가 기대하는 patient 스키마로 변환 | facade 내부 사용 |
| `comparator.py` | `compare_single(uuid, twobecon_row, engine_result) -> ComparisonData dict`, `verify_batch(limit) -> VerificationData dict` | partner_office.py에서 호출 |
| `stats.py` | `build_engine_stats() -> EngineStats dict` — engine.RR_MATRIX, rr_ci_table.json 카운트/PMID coverage 집계 | partner_office.py에서 호출 |

### 3.2 import 경로 격리

- 신규 엔진은 **`services/mediarc/`를 import 하지 않음** (기존 어댑터와 독립).
- 신규 엔진은 `services/report_engine/` 하위에서만 해결. 루트 추가 안 함.
- partner_office.py에서만 `from ....services.report_engine import EngineFacade, compare_single, verify_batch, build_engine_stats` 4개 함수 import.

---

## 4. engine.py 이식 방식

### 3줄 요약
- **직접 복사** + 얇은 파사드. 리팩토링은 하지 않는다(회귀 리스크 최소화, 프로토타입 변경 이력 보존).
- 리소스는 모듈 파일과 같은 디렉토리에서 `Path(__file__).parent`로 로드 (engine.py line 1731-1732 패턴 유지).
- 엔진 인스턴스는 facade.py에서 **lazy singleton**: 최초 호출 시 pkl/json 로드 → 이후 재사용.

### 4.1 복사 vs 리팩토링

| 기준 | 복사 | 리팩토링 |
|---|---|---|
| 회귀 리스크 | 낮음 | 높음 |
| WELNO 코드스타일 일치 | 낮음 | 높음 |
| 향후 원본 개선 반영 | 쉬움 (diff apply) | 어려움 |
| 도입 속도 | 빠름 | 느림 |

**결정**: 복사. 이유: (1) 현재는 엔진 "사용 개시"가 목적. 스타일 통일은 급하지 않음. (2) 엔진 자체에 버그 발견되면 원본에서 먼저 고친 후 WELNO에 diff 반영하는 워크플로우가 깔끔. (3) 절대 원칙 10번(견제) 적용 시 dev-reviewer가 원본 대조로 빠르게 확인 가능.

한 가지 양보: **logger 사용**. engine.py는 `print`와 `logging.warning`을 혼용(라인 1785). WELNO는 표준 logger를 쓰므로, facade.py에서 engine 호출을 감싸며 `try/except + logger.exception`으로 포장.

### 4.2 외부 의존성

| 패키지 | 현재 WELNO | engine.py 필요 | 조치 |
|---|---|---|---|
| numpy | 미설치 | 필요 (line 1763) | `requirements.txt`에 `numpy==1.26.4` 추가 |
| scikit-learn | 미설치 | pkl 로드에 필요 | `scikit-learn==1.4.2` 추가 |
| pickle | stdlib | 필요 | 별도 설치 불필요 |
| json | stdlib | 필요 | — |
| math | stdlib | 필요 | — |
| dataclasses | stdlib | 필요 | — |

**주의**: pkl은 학습 시점의 scikit-learn 버전과 호환되어야 한다. `~/mediarc_report/demo/` 안에 학습 스크립트가 있으면 버전 확인 필수. 불일치 시 pkl 재학습 또는 sklearn 버전 맞춤.

### 4.3 리소스 로드 경로

engine.py line 1731 패턴(`Path(__file__).parent / "bioage_model.pkl"`)을 그대로 유지. 복사 후에도 파일이 같은 디렉토리에 있으므로 수정 불필요. 다만 **배포 절차**에서 pkl/json 파일이 static 제외 대상이 아님을 반드시 확인(섹션 9 참조).

### 4.4 싱글톤 전략

```python
# facade.py (의사코드)
from threading import Lock
from .engine import run_for_patient, RR_MATRIX, ENGINE_CONFIG, compute_bioage_gb

class EngineFacade:
    _instance = None
    _lock = Lock()
    _warmed = False

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
        return cls._instance

    def warmup(self) -> None:
        """서버 기동 시 1회 호출 권장 — pkl 로드를 앞당긴다."""
        if self._warmed:
            return
        dummy = {"age": 40, "sex": "M", "bmi": 22.0, "sbp": 120, "dbp": 75, "fbg": 90,
                 "height": 170, "weight": 65, "waist": 80, "hemoglobin": 14,
                 "tc": 180, "hdl": 50, "ldl": 110, "tg": 100,
                 "ast": 20, "alt": 20, "ggt": 20, "cr": 1.0, "gfr": 100}
        compute_bioage_gb(dummy)
        self._warmed = True

    def run(self, name: str, patient: dict) -> dict:
        return run_for_patient(name, patient)
```

- `main.py` 기동 시 `EngineFacade().warmup()` 호출(async 외부에서 안전하게). 실패해도 앱 기동은 계속 — compute_bioage_gb가 None 반환하면 엔진은 normal path로 진행됨.
- `warmup`을 반드시 강제하진 않는다. 첫 API 호출 시점에 자동 로드되므로. 단, 첫 호출 지연(pkl 로드 ~50ms)을 피하려면 warmup 권장.

### 4.5 patient dict 어댑터

`_normalize_health_metrics`의 출력 키 vs engine.py가 기대하는 키 매핑:

| 정규화 출력 | 엔진 기대 (impute_missing, classify_risk_factors) | 변환 |
|---|---|---|
| `bp_high` | `sbp` | 키 이름만 변경 |
| `bp_low` | `dbp` | 키 이름만 변경 |
| `fasting_glucose` | `fbg` | 키 이름만 변경 |
| `total_chol` | `tc` | 키 이름만 변경 |
| `hdl` | `hdl` | 동일 |
| `ldl` | `ldl` | 동일 |
| `tg` | `tg` | 동일 |
| `sgot` | `ast` | 키 이름만 변경 |
| `sgpt` | `alt` | 키 이름만 변경 |
| `ggt` | `ggt` | 동일 |
| `creatinine` | `cr` | 키 이름만 변경 |
| `gfr` | `gfr` | 동일 |
| `hemoglobin` | `hemoglobin` | 동일 |
| `height` | `height` | 동일 |
| `weight` | `weight` | 동일 |
| `waist` | `waist` | 동일 |
| `bmi` | `bmi` | 동일 |
| (없음) | `age` | 환자 birth_date에서 계산 |
| (없음) | `sex` | 'M'/'F' 표준화(campaign `1`/`2` 또는 chat/welno의 gender 문자열 정규화) |
| (없음) | `hx_htn`, `hx_dm`, `family_dm` 등 가족력/과거력 | 3소스에 없음 → False 고정, TODO 남김 |

adapter.py의 `to_engine_patient(normalized, age, sex)` 이 매핑을 처리.

**리스크**: 3소스 데이터는 가족력/과거력을 수집하지 않으므로 엔진의 RR 위험인자(`family_dm`, `family_cvd`, `hx_htn` 등)가 전부 False로 들어간다. 결과적으로 RR은 대부분 생활습관(BMI, 혈압, 공복혈당 등)만으로 산출 → Twobecon 결과와 차이가 커질 수 있음. 비교 지표가 낮게 나와도 정상 해석임을 `comparator.py` 출력에 주석/플래그로 포함.

---

## 5. 신규 엔드포인트 스펙

### 3줄 요약
- Alias 3개(`/patients`, `/{uuid}`, `/engine/stats`) + 신규 2개(`/{uuid}/compare`, `/verify-all`).
- 모든 엔드포인트는 `partner_office.py` 내부에 추가(별도 라우터 파일 만들지 않음).
- 캐싱 전략은 필요 시 `/verify-all`에만 적용(30분 TTL 메모리 캐시), 나머지는 매번 계산.

### 5.1 엔드포인트 목록

#### 5.1.1 `GET /partner-office/mediarc-report/patients` (alias)

| 항목 | 값 |
|---|---|
| Query | `limit: int = 200`, `hospital_id: str = None` |
| Response | `{ patients: PatientListItem[], total: number }` |
| 구현 | 기존 `mediarc_unified_patients(limit, hospital_id)` 내부 호출 후 응답 shape만 FE 스키마에 맞게 조정. `patients[i]`는 `uuid, name, gender, birth_date, age, checkup_date, has_health_data, has_twobecon, source` 포함. `has_twobecon`은 `welno_mediarc_reports`에 해당 uuid 레코드가 있는지 LEFT JOIN 혹은 별도 집합 조회. |
| 성능 | 기존 쿼리 + 추가 1 쿼리(`SELECT patient_uuid FROM welno.welno_mediarc_reports WHERE patient_uuid = ANY($1)`)로 `has_twobecon` 플래그 채움. |

#### 5.1.2 `GET /partner-office/mediarc-report/{uuid}` (alias + 엔진 실행)

| 항목 | 값 |
|---|---|
| Path | `uuid: str` |
| Response | `ReportData` (FE 타입) |
| 구현 | 1) 기존 `mediarc_patient_detail(uuid)` 재사용해서 `health_data` + age/sex 확보. 2) `EngineFacade().run(name, adapter.to_engine_patient(...))` 호출. 3) 엔진 결과를 FE 스키마로 매핑(`bodyage -> {bodyage, delta}`, `diseases -> {질환명: {rank, rate}}`, `gauges.all`, `nutrition.recommend/caution`). |
| Nutrition | `nutrition_rules.py` 호출 결과를 `{recommend: [], caution: []}`로 변환. (엔진 원본은 이 스키마와 약간 다를 수 있음 — 이식 시 1차 구현 후 FE 페이지 수동 점검) |
| 오류 | 환자 데이터 없음: 404. 엔진 계산 실패: 500 + 로그. 바이오에이지 None: `bodyage.delta`만 비우고 정상 응답. |

#### 5.1.3 `GET /partner-office/mediarc-report/{uuid}/compare` (신규)

| 항목 | 값 |
|---|---|
| Path | `uuid: str` |
| Response | `ComparisonData` |
| 구현 | 1) `welno_mediarc_reports` 에서 uuid 레코드 **SELECT만** (write 금지). `report_url` 또는 `result_json` 컬럼에서 Twobecon 결과 파싱. 2) 엔진 결과 `run_for_patient` 동일 계산. 3) `comparator.compare_single(tb, engine_out)` 호출하여 diff 테이블 생성. |
| welno_mediarc_reports 스키마 확인 | 이식 전 dev-coder가 반드시 `\d welno.welno_mediarc_reports` 조회해서 컬럼 정확히 확인. 특히 Twobecon bodyage/rank/ratios가 어느 컬럼에 JSONB로 저장되는지 `welno_models.py:143` + 기존 `run_disease_report_pipeline` 코드에서 확인. |
| 404 | Twobecon 레코드 없음 또는 환자 데이터 없음. |

#### 5.1.4 `GET /partner-office/mediarc-report/engine/stats` (alias + 실데이터)

| 항목 | 값 |
|---|---|
| Response | `EngineStats` |
| 구현 | `stats.build_engine_stats()`에서: `total_rr = len(RR_MATRIX의 모든 위험인자 수 합)`, `diseases = len(RR_MATRIX)`, `pmid_coverage = PMID 있는 항목 / 전체 * 100`, `confidence = {verified: N, estimated: M, inferred: K}` 카운트, `validation = "데이터레이크 1,005건"` (bioage_gb 모델 메타). |
| 기존 `/stats`와 관계 | 기존 `mediarc_stats()`는 **DB 소스 카운트** 반환. 이건 **엔진 메타**. FE는 둘 다 필요할 수 있음. → alias `/engine/stats`는 신규 엔진 전용. 기존 `/stats`는 유지(유실 방지). FE가 `/stats`도 부르는지 확인 후 필요하면 분리. |

#### 5.1.5 `GET /partner-office/mediarc-report/verify-all` (신규)

| 항목 | 값 |
|---|---|
| Query | `limit: int = 100`, `hospital_id: str = None`, `force: bool = False` (캐시 무시) |
| Response | `VerificationData` |
| 구현 | 1) `welno_mediarc_reports`에 있고 3소스 중 검진수치도 있는 환자 목록 조회(최대 `limit`). 2) 각 환자별 엔진 실행 + Twobecon 결과 비교. 3) 질환별 일치율, 평균 diff, 방향성(엔진이 체계적으로 높게/낮게 나오는지) 집계. 4) top_match(차이 작은 5건) / worst_match(차이 큰 5건) / anomalies(|diff|>2.0 이상). |
| 성능 | 100건 × 엔진 호출(~20ms) = 2초 정도 예상. pkl 이미 warmup. 필요 시 30분 TTL 메모리 캐시(`functools.lru_cache`는 async 미지원 → `asyncio-cache` 또는 간단한 dict + expiry). |
| 타임아웃 리스크 | FE/nginx 타임아웃 30초 가정. limit=500 초과 시 499 응답으로 가드. |

### 5.2 구현 위치 (partner_office.py 추가)

```python
# partner_office.py 끝(line 2743 뒤)에 신규 섹션 추가

# ─── mediArc 엔진 (신규, 백오피스 전용) ──────────────────────────────

from ....services.report_engine import (
    EngineFacade, compare_single, verify_batch, build_engine_stats,
    to_engine_patient,
)

@router.get("/mediarc-report/patients")
async def mediarc_patients_alias(limit: int = 200, hospital_id: str = None):
    """FE 호환 alias → mediarc_unified_patients + has_twobecon 플래그"""
    base = await mediarc_unified_patients(limit=limit, hospital_id=hospital_id)
    # has_twobecon 플래그 주입
    uuids = [p['uuid'] for p in base.get('patients', [])]
    # ... SELECT DISTINCT patient_uuid FROM welno.welno_mediarc_reports WHERE patient_uuid = ANY(%s)
    # ... 집합 대조 후 각 patient에 has_twobecon 채움
    return {"patients": ..., "total": len(...)}


@router.get("/mediarc-report/{uuid}", response_model=None)  # ReportData
async def mediarc_report_alias(uuid: str):
    """FE 호환 alias + 엔진 실행"""
    detail = await mediarc_patient_detail(uuid)  # 기존 함수
    # age 계산 (birth_date YYYY-MM-DD 가정)
    # sex 정규화
    engine_patient = to_engine_patient(detail['health_data'], age=..., sex=...)
    result = EngineFacade().run(name=detail['name'] or '익명', patient=engine_patient)
    # FE 스키마 매핑
    return {...}


@router.get("/mediarc-report/{uuid}/compare")
async def mediarc_report_compare(uuid: str):
    """Twobecon DB 결과 vs 엔진 실시간 계산 비교"""
    return await compare_single(uuid, db_manager=db_manager, engine=EngineFacade())


@router.get("/mediarc-report/engine/stats")
async def mediarc_engine_stats_alias():
    """FE 호환 alias — 엔진 메타 (하드코딩 제거)"""
    return build_engine_stats()


@router.get("/mediarc-report/verify-all")
async def mediarc_verify_all(limit: int = 100, hospital_id: str = None, force: bool = False):
    """전체 환자 Twobecon vs 엔진 배치 검증"""
    if limit > 500:
        raise HTTPException(status_code=400, detail="limit은 500 이하")
    return await verify_batch(limit=limit, hospital_id=hospital_id, force=force,
                               db_manager=db_manager, engine=EngineFacade())
```

### 5.3 기존 3개 엔드포인트는 그대로 유지

`/unified-patients`, `/patient/{uuid}`, `/stats`는 **수정하지 않는다**. 다른 호출처 있을 수 있으므로 존치. 신규 alias 3개는 별개로 추가만.

---

## 6. 3소스 → 엔진 입력 매핑 검증

### 3줄 요약
- `_normalize_health_metrics`는 이미 17개 키를 표준화했으므로 adapter는 **키 이름 변환만** 하면 된다(섹션 4.5 표).
- 가족력/과거력은 3소스에 없음 → 전부 False. 엔진 출력은 "생활습관 기반 RR"로만 해석해야 한다.
- age는 birth_date로 계산, sex는 소스별 정규화 규칙 다름(특히 campaign은 '1'/'2' 문자열).

### 6.1 누락 위험 필드

엔진은 다음 필드도 활용하지만 3소스엔 대부분 없음:
- `hx_htn`, `hx_dm`, `hx_cvd`, `hx_stroke`, `hx_cancer_*`
- `family_dm`, `family_cvd`, `family_cancer_*`
- `smoking`, `ex_smoking`, `drinking_*`, `mets_aerobic`, `mets_resistance`
- `ifg` (공복혈당 100-125 구간은 fbg로 계산 가능)
- `high_tg`, `high_ldl` 등은 tc/hdl/ldl/tg로 엔진 내부에서 자체 판정

**판정**: 엔진은 내부 `classify_risk_factors`에서 생체값 기반으로 자동 판정하는 부분이 많으므로(`engine.py:358`), 설문 기반 필드(smoking, drinking, family_* 등)만 False로 고정해도 엔진은 정상 동작한다. 단 **결과 해석**에서 일부 질환(특히 대사증후군, 폐암, 간암)은 저평가될 수 있음.

### 6.2 age 계산 규칙

```python
from datetime import date
def calc_age(birth_date_str: str) -> int:
    # 'YYYY-MM-DD' 또는 'YYYYMMDD' 또는 'YY-MM-DD' 대응
    # welno: 'YYYY-MM-DD' 예상, chat: 'YYYY-MM-DD', campaign: 'YYMMDD' 가능성
    ...
```

- **리스크**: campaign 소스의 birth_date 형식 확인 필요. `mediarc_patient_detail` (line 2696)은 `ud.get('birth')`를 문자열 그대로 반환. adapter.py에서 YYMMDD 6자리면 세기 추정 로직 필요(19xx vs 20xx) — 현 검진 이용자 연령대 상식상 30년 컷.

### 6.3 sex 정규화

| 소스 | 원본 값 | 정규화 |
|---|---|---|
| welno | 'M'/'F' 또는 '남'/'여' | 'M'/'F' |
| chat | gender 문자열 | 'M'/'F' |
| campaign | '1'/'2' | '1'→'M', '2'→'F' (line 2691 참조) |

adapter.py 내부에서 처리. 알 수 없으면 'M' 기본값 + warning log.

---

## 7. 테스트 계획

### 3줄 요약
- 단위(adapter/facade/comparator) → 통합(엔드포인트 5개) → 회귀(기존 Twobecon 파이프라인 무손상) → E2E(FE 페이지 로드).
- 회귀 테스트가 가장 중요 — `services/mediarc/`와 8개 호출 지점(checkup_design, surveys, welno_data 등) 모두 영향 없음을 grep + 런타임 smoke test로 증명.
- 3소스 환자 각 2건씩 총 6건 실샘플로 엔진 출력 수동 검토.

### 7.1 단위 테스트

| 대상 | 케이스 |
|---|---|
| `adapter.to_engine_patient` | 3소스별 정규화 결과 → engine patient dict 키 일치 / age/sex 계산 / 누락 필드 None/False 처리 |
| `EngineFacade` | warmup 전후 동일 출력 / 싱글톤성(id 동일) / pkl 로드 실패 시 compute_bioage_gb None 반환해도 run 정상 |
| `build_engine_stats` | RR_MATRIX 카운트 재현 가능 / pmid_coverage 퍼센트 계산 |
| `compare_single` | Twobecon mock + 엔진 출력 → ComparisonData 구조 / match_rate 정확 |
| `verify_batch` | limit=10 mock → VerificationData 구조 / top_match/worst_match 정렬 |

### 7.2 통합 테스트 (엔드포인트 5개)

```bash
# 로컬 기동 (uvicorn 8082)
curl 'http://localhost:8082/api/v1/partner-office/mediarc-report/patients?limit=5'
curl 'http://localhost:8082/api/v1/partner-office/mediarc-report/{테스트_uuid}'
curl 'http://localhost:8082/api/v1/partner-office/mediarc-report/{테스트_uuid}/compare'
curl 'http://localhost:8082/api/v1/partner-office/mediarc-report/engine/stats'
curl 'http://localhost:8082/api/v1/partner-office/mediarc-report/verify-all?limit=10'
```

각각 200 응답 + FE 스키마 준수 검증(jq 필드 존재 체크).

### 7.3 실데이터 샘플 검토

| 소스 | UUID | 확인 포인트 |
|---|---|---|
| welno | `831b1be7-677b-4899-803d-f69622f919dd` (안광수, 테스트 계정) | bodyage 합리적 범위(30-80) / diseases 16개 모두 존재 |
| chat | (DB 조회로 선정) | `has_twobecon=true`인 환자로 compare 테스트 |
| campaign | (DB 조회로 선정) | birth 형식(YYMMDD) 처리 확인 |

각 2건씩 = 6건. dev-coder가 실행 후 출력 JSON을 dev-reviewer에게 검토 요청.

### 7.4 회귀 테스트 (Twobecon 무손상 증명)

**정적**:
```bash
# services/mediarc/ 파일 수정 이력 없음 증명
git diff HEAD~1 backend/app/services/mediarc/  # 빈 출력이어야 함
```

**런타임**:
| 호출처 | 시나리오 |
|---|---|
| `surveys.py` | 설문 제출 → `generate_mediarc_report_async` 정상 호출 + welno_mediarc_reports INSERT |
| `checkup_design.py` | 검진설계 생성 → 동일 |
| `welno_data.py` | 데이터 sync → 동일 |
| `campaign_payment.py` | 결제 완료 → `run_disease_report_pipeline` 정상 |
| `tilko_auth.py` | Tilko 인증 완료 → `generate_mediarc_report_async` 정상 |

이 5곳 중 최소 1곳 실행 후 `welno.welno_mediarc_reports` INSERT 확인. 수동 테스트 또는 기존 E2E 재실행.

### 7.5 FE E2E

```bash
# 백오피스 페이지 접근
# URL: /backoffice/health-report 또는 해당 경로
# 확인:
# 1. 환자 목록 200개 로드 (404 없음)
# 2. 환자 클릭 → 리포트 상세 렌더링
# 3. 비교 탭 → 매칭률 표시
# 4. 전체 검증 버튼 → 배치 결과
```

Playwright 자동화는 `frontend/e2e/` 하위에 `test_mediarc_report_page.py` 신규 작성 권장(선택).

---

## 8. 배포 계획

### 3줄 요약
- requirements.txt에 numpy + scikit-learn 추가 → 서버에서 `pip install` 재실행 필수.
- pkl/json 리소스 파일은 git에 포함시켜 배포 → `.gitignore` 충돌 체크.
- PM2 restart 필요(모듈 새로 로드). 엔진 warmup은 main.py startup 이벤트에서.

### 8.1 requirements.txt 변경

```diff
+ numpy==1.26.4
+ scikit-learn==1.4.2
```

- numpy 1.26은 Python 3.9+ 호환 (WELNO는 3.9+).
- sklearn 버전은 **pkl 학습 시 사용된 버전과 일치**해야 함. `~/mediarc_report/demo/__pycache__/` 또는 학습 로그에서 확인 후 정확한 버전 지정. 불일치 시 `UnpicklingError` 또는 silent 오차.
- 서버 디스크 ~100MB 추가 사용(numpy 30MB + sklearn 70MB). welno 서버(10.0.1.6) 디스크 여유 확인 필수.

### 8.2 pkl/json 파일 배포

| 파일 | 크기 | git 포함 여부 |
|---|---|---|
| `bioage_model.pkl` | 270KB | **포함** (작음) |
| `bioage_features.json` | <1KB | 포함 |
| `static_data.json` | 확인 필요 | 포함 |
| `rr_ci_table.json` | 확인 필요 | 포함 |

`.gitignore` 확인: `*.pkl`이 glob으로 ignore되어 있지 않은지 체크. 있으면 예외 추가(`!backend/app/services/report_engine/bioage_model.pkl`).

### 8.3 배포 순서

```bash
# 1. 로컬 커밋 + 푸시
git add backend/app/services/report_engine/
git add backend/app/api/v1/endpoints/partner_office.py
git add backend/requirements.txt
git commit -m "feat(backend): mediArc 엔진 백오피스 전용 이식 (Twobecon 무손상)"
git push origin main

# 2. 서버 배포 (2-hop SSH)
ssh root@223.130.142.105 → ssh root@10.0.1.6
cd /home/welno/workspace/PROJECT_WELNO_BEFE/planning-platform

# 3. pull + 의존성 설치 (welno 유저)
sudo -u welno git pull origin main
sudo -u welno bash -c "cd backend && pip install -r requirements.txt"

# 4. pm2 재시작
sudo -u welno pm2 restart WELNO_BE
sudo -u welno pm2 logs WELNO_BE --lines 50 --nostream

# 5. 로그 확인 포인트
# - "engine warmup OK" 또는 "compute_bioage_gb failed" 로그
# - 첫 API 호출 시 에러 없음
```

### 8.4 PM2 메모리 한계 주의

CLAUDE.md에 "PM2 1G 제한, 78회 OOM 재시작" 기록. numpy + sklearn + pkl 로드 시 ~50-100MB 추가 메모리. 이식 후 메모리 사용량 모니터링. OOM 빈도 증가 시 PM2 설정에서 `max_memory_restart: '1500M'`로 상향 고려(ops팀 협의).

### 8.5 롤백

**정책**: git revert + pm2 restart. 엔진 관련 파일만 추가된 상태이므로 롤백 영향도 낮음.

```bash
git revert <커밋해시>
git push origin main
# 서버에서 pull + pm2 restart
```

- 프론트 변경이 없으므로 FE 재배포 불필요(어차피 FE는 현재도 404 상태 — 엔진 없어도 기존 상태 유지).
- requirements.txt rollback 시 numpy/sklearn uninstall 안 해도 서버 동작 무관.

---

## 9. 리스크 & 완화

### 3줄 요약
- 최대 리스크는 **Twobecon 파이프라인 오염**. 격리된 신규 모듈 + grep 체크리스트로 방어.
- pkl 로드 실패는 엔진이 자체 fallback(compute_bioage_gb None 반환) — 치명도 낮음. numpy/sklearn 버전 미스매치가 진짜 원인일 가능성.
- 3소스 결측 필드가 많아 엔진 출력이 Twobecon과 큰 차이 → verify-all 결과로 사전 파악, FE에 "참고용" 라벨.

### 9.1 리스크 매트릭스

| # | 리스크 | 치명도 | 발생 확률 | 완화책 |
|---|---|:---:|:---:|---|
| R1 | 기존 Twobecon 파이프라인 훼손 | 높음 | 낮음 | services/mediarc/ 디렉토리 수정 금지 + 배포 후 git diff 검증 |
| R2 | pkl 로드 실패 (sklearn 버전 미스매치) | 중간 | 중간 | 정확한 sklearn 버전 pin + try/except 래퍼 + bioage_gb None fallback |
| R3 | 엔진 결과가 Twobecon과 크게 달라 신뢰도 저하 | 중간 | 높음 | verify-all 결과 사전 확인 + FE에 "내부 검증용" 라벨 |
| R4 | 메모리 사용량 증가 → OOM 빈도 상승 | 중간 | 중간 | warmup 후 pm2 monit로 메모리 모니터링 1시간 / 필요 시 max_memory_restart 상향 |
| R5 | 3소스 결측 필드로 엔진 RR 저평가 | 낮음 | 높음 | adapter.py에서 누락 필드 목록을 응답에 포함 (debug 필드) / comparator에서 플래그 |
| R6 | 가족력/과거력 False 고정이 해석 오해 | 낮음 | 높음 | README + API 문서에 명시 |
| R7 | ComparisonData의 Twobecon 파싱 실패 (스키마 미확인) | 중간 | 중간 | 이식 전 welno_mediarc_reports 컬럼 실제 조회 + 샘플 row로 파싱 검증 |
| R8 | nginx/FE 타임아웃 (verify-all 느림) | 낮음 | 낮음 | limit=500 가드 + 30분 TTL 캐시 |
| R9 | 서버 디스크 부족 (numpy/sklearn ~100MB) | 낮음 | 낮음 | 배포 전 `df -h` 확인 |
| R10 | pkl이 git에 안 올라감 (.gitignore) | 중간 | 낮음 | `.gitignore` 사전 점검 + `git add -f` 또는 예외 추가 |

### 9.2 R1 체크리스트 (Twobecon 무손상 증명)

**배포 전**:
- [ ] `git diff --stat backend/app/services/mediarc/` → 0개 파일 변경
- [ ] `grep -r "from ....services.report_engine" backend/app/services/mediarc/` → 0건
- [ ] `grep -r "generate_mediarc_report_async\|run_disease_report_pipeline\|call_mediarc_api" backend/app/services/report_engine/` → 0건 (역의존성 없음)
- [ ] `welno_mediarc_reports` INSERT/UPDATE/DELETE 쿼리가 report_engine/ 어디에도 없음 (읽기 전용)

**배포 후**:
- [ ] 기존 E2E(설문 제출) 1건 실행 → welno_mediarc_reports 신규 row 생성 확인
- [ ] pm2 logs에 `services.mediarc` 모듈 관련 에러 0건

### 9.3 R3 (엔진-Twobecon 차이) 예상 원인

| 원인 | 예상 차이 | 대응 |
|---|---|---|
| 3소스 결측 필드 | 엔진 ratio가 체계적으로 낮음 | `comparator` 출력에 "누락 필드 N개" 플래그 포함 |
| 엔진 RR_MATRIX가 한국 코호트 기반, Twobecon은 자체 모델 | 질환별 편차 있음 | 정상 해석 (둘 다 다른 모델) |
| 감쇠계수 설정 차이 (EngineConfig 토글) | 다중 위험인자 시 차이 증폭 | EngineConfig 기본값 유지 |

---

## 10. 검증 기준 (완료 정의)

### 기능
- [ ] FE 백오피스 HealthReport 페이지 404 0건
- [ ] 환자 목록 200명 정상 로드
- [ ] 환자 상세 리포트 렌더링(bodyage/diseases/gauges/nutrition)
- [ ] 비교 탭 매칭률 계산
- [ ] 전체 검증 배치 실행(limit=100)
- [ ] 엔진 stats 하드코딩 제거, 실데이터 표시

### 안정성
- [ ] services/mediarc/ 무손상 (git diff 0)
- [ ] welno_mediarc_reports write 0건 (신규 엔진 측)
- [ ] 기존 Twobecon 호출 지점 8개 모두 정상
- [ ] pm2 메모리 사용 <1G 유지 (1시간 관찰)

### 품질
- [ ] dev-reviewer 리뷰 PASS (절대 원칙 10번)
- [ ] 단위 테스트 5개 작성 및 통과
- [ ] README 작성 (엔진 출처, 결정 이력, 운영 주의사항)
- [ ] MEMORY.md 에 `project-mediarc-engine-backoffice.md` 등록

---

## 11. 다음 단계 (실행 순서)

### 모드 제안: **STANDARD+**
이유: 신규 모듈 1개 + 기존 파일 1개 수정, 외부 의존성 추가, 백오피스 전용 격리 요건. dev-coder + dev-reviewer 필수, 필요 시 dev-architect 1회 검토.

### 실행 순서

1. **결정 사항 승인** (하비)
   - A. 모듈명 `services/report_engine/`
   - B. alias 라우트 방식
   - C. `~/mediarc_report/` 원본 유지 + 필요 자산만 복사
2. **welno_mediarc_reports 스키마 조회** (dev-coder, 5분)
   - `\d welno.welno_mediarc_reports` → 컬럼 확정
   - 샘플 row 1건 확인 → Twobecon 결과 JSON 위치 파악
3. **Phase 1: 모듈 골격 + alias 3개** (dev-coder)
   - `services/report_engine/` 생성
   - engine.py + nutrition_rules.py + reference_data.py + pkl/json 복사
   - facade.py + adapter.py + stats.py 작성
   - `partner_office.py`에 alias 3개 추가
   - requirements.txt 업데이트
4. **Phase 1 검증** (dev-reviewer + 로컬 smoke test)
5. **Phase 2: compare + verify-all** (dev-coder)
   - comparator.py 작성
   - `partner_office.py`에 신규 2개 추가
6. **Phase 2 검증** (dev-reviewer)
7. **로컬 E2E** (dev-coder)
   - uvicorn 기동 → curl 5개 엔드포인트
   - 실데이터 6건(3소스×2) 수동 검토
8. **배포** (ops 협의, welno 유저)
   - git push → 서버 pull → pip install → pm2 restart
9. **배포 후 모니터링** (ops-monitor, 1시간)
   - pm2 logs, 메모리, 기존 파이프라인 smoke
10. **FE E2E + 회귀 확인**
11. **트래커 갱신 + MEMORY.md 등록**

### 예상 소요

| Phase | 시간 |
|---|---|
| 결정 + 스키마 조회 | 30분 |
| Phase 1 구현 | 3시간 |
| Phase 1 검증 | 1시간 |
| Phase 2 구현 | 2시간 |
| Phase 2 검증 | 1시간 |
| 배포 | 30분 |
| 모니터링 + 문서화 | 1시간 |
| **합계** | **~9시간** (1일) |

---

## 12. 참조

- 엔진 원본: `~/mediarc_report/demo/engine.py`, `nutrition_rules.py`, `reference_data.py`, `bioage_model.pkl`, `bioage_features.json`, `static_data.json`, `rr_ci_table.json`
- 기존 BE 엔드포인트: `/Users/harby/0_workspace/PEERNINE/PROJECT_WELNO_BEFE/planning-platform/backend/app/api/v1/endpoints/partner_office.py:2381-2743`
- Twobecon 파이프라인: `backend/app/services/mediarc/report_service.py`, `constants.py`, `data_mapper.py`, `questionnaire_mapper.py`
- FE 호출 훅: `backend/../backoffice/src/pages/HealthReportPage/hooks/useMediarcApi.ts`
- DB 모델: `backend/app/models/welno_models.py:143` (welno_mediarc_reports)
- 프로젝트 문서: `memory/project-mediarc-report.md` (2026-04-12 최신)
- WELNO 배포: `memory/welno-deploy.md`, `planning-platform/CLAUDE.md` (배포 절차 섹션)
- 절대 원칙: `/Users/harby/0_workspace/PEERNINE/CLAUDE.md` (특히 10번 dev-reviewer 견제 필수)

---

## 13. 부록 — welno_mediarc_reports 컬럼 조회 쿼리 (이식 전 필수)

```sql
-- 서버 DB 또는 로컬 터널 접속 후
\d welno.welno_mediarc_reports

-- 샘플 row 1건 (Twobecon 결과 JSON 구조 파악)
SELECT id, patient_uuid, hospital_id, created_at,
       report_url,      -- PDF URL 또는 JSON URL
       result_json,     -- JSONB (bodyage, rank, ratios 포함 여부 확인)
       status
FROM welno.welno_mediarc_reports
WHERE result_json IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;
```

이 쿼리 결과로 `comparator.py`의 Twobecon 파싱 로직을 확정한다.

---

*작성일: 2026-04-14 | 다음 리뷰: 결정 3건 승인 후 Phase 1 착수 시점*
