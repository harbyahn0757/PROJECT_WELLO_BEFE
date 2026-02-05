# UUID bbfba40ee649d172c1cee9471249a535 (안광수) 상세 분석 보고서

## 1. 현재 DB 상태 (확인 일시: 스크립트 실행 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| welno.welno_patients | **0** | 환자 행 없음 |
| welno.welno_checkup_data | **0** | 건강검진 없음 |
| welno.welno_prescription_data | **9** | 동일 UUID 고아 데이터, created_at 전부 2026-01-30 20:29:57 (tilko) |
| welno.welno_mediarc_reports | **0** | 예측 리포트 없음 |
| welno.tb_campaign_payments | 1 | user_name 최안안, READY/INIT, OID TEMP_1770190104782, created_at 2026-02-04 |

---

## 2. 왜 지워졌는가 (삭제 경로)

- **삭제는 `scripts/managers/delete_manager.py`의 `patient` 서브커맨드로 수행된 것으로 추정됩니다.**
- 해당 스크립트는 다음 순서로만 삭제합니다.
  1. `welno.welno_checkup_data` (patient_uuid + hospital_id)
  2. `welno.welno_prescription_data` (patient_uuid + hospital_id)
  3. `welno.tb_campaign_payments` (uuid)
  4. `welno.welno_patients` (uuid + hospital_id)
- **`welno_mediarc_reports`는 스크립트에서 직접 DELETE 하지 않습니다.**
- 단, 스키마상 `welno_mediarc_reports.patient_id`가 `welno_patients(id)`를 참조하며 **ON DELETE CASCADE**가 걸려 있으므로,  
  **`welno_patients` 행을 삭제하는 순간 DB가 자동으로 해당 patient_id에 연결된 예측 리포트 행을 모두 지웁니다.**
- 따라서 “환자 삭제 한 번”으로 인해:
  - 환자 행 삭제 → CASCADE로 **예측 리포트도 함께 삭제**된 것이 맞고,
  - 처방전은 `patient_uuid`만 저장되고 `welno_patients.id` FK가 없어 CASCADE 대상이 아니므로 **삭제되지 않고 남은 것**입니다.

---

## 3. 예측 리포트(Mediarc)는 있었는가, 왜 지금 없는가

### 3.1 2026-01-27: 첫 시도 — API 성공, DB 저장 실패

- **14:14:33**  
  - `[Mediarc] 리포트 생성 시작 (통합 파이프라인): bbfba40...`  
  - `[Pipeline] 시작: uuid=bbfba40..., name=안광수`
- **14:14:55**  
  - `[Mediarc API] 응답 성공`  
  - bodyage: 37.9, rank: 36, analyzed_at: 2026-01-27T14:14:34.661709
- **14:14:55 (같은 시각)**  
  - **`[Pipeline] 예외 발생: invalid input for query argument $6: [{'name': '알츠하이머', 'code': 'alzheimers', ... (expected str, got list)`**  
  - 즉, **예측 리포트 API는 성공했지만, DB INSERT 시 `disease_data`/`cancer_data`를 list로 넘겨서 에러가 나 저장에 실패**한 상태입니다.
- 이 날은 **welno_mediarc_reports에 한 건도 들어가지 않았습니다.**

### 3.2 2026-01-30: 여러 번 저장 성공

- **14:55:18** Pipeline 시작 (안광수)  
  **14:55:42**  
  - `[Pipeline] welno_mediarc_reports 저장 완료`  
  - `[Pipeline] welno_patients 플래그 업데이트 완료`  
  - Step → COMPLETED
- **15:47:10**  
  - 동일 UUID로 다시 `welno_mediarc_reports 저장 완료` (ON CONFLICT DO UPDATE로 덮어쓰기)
- **16:18:40**  
  - 다시 `welno_mediarc_reports 저장 완료`
- **17:03:04**  
  - 다시 `welno_mediarc_reports 저장 완료`, COMPLETED

→ **2026-01-30에는 예측 리포트가 DB에 정상 저장되어 있었고, 생성/갱신 시각도 로그에 남아 있습니다.**

### 3.3 그 후: 환자 삭제로 인한 CASCADE 삭제

- 이후 어느 시점에 **동일 UUID에 대해 `delete_manager.py patient bbfba40...`가 실행**되어:
  - `welno_patients` 행이 삭제되고,
  - **ON DELETE CASCADE**로 해당 `patient_id`를 참조하던 **welno_mediarc_reports 행이 모두 삭제**되었습니다.
- 그래서 **지금 DB에는 예측 리포트가 0건**입니다.  
  “예측 리포트가 없어진 이유” = **환자 삭제 시 CASCADE로 같이 삭제되었기 때문**입니다.

---

## 4. 로그 타임라인 요약 (생성일·주요 이벤트)

| 일시 (KST) | 이벤트 |
|------------|--------|
| 2026-01-27 13:16 ~ 14:02 | 해당 UUID로 이미 404 (그 전에 1차 삭제된 상태로 추정) |
| 2026-01-27 14:02:42 | 약관동의상세 저장 (bbfba40 @ PEERNINE) |
| 2026-01-27 14:13:40 | [환자조회] 기존 환자 없음: 01056180757, 19810927, 안광수 |
| 2026-01-27 14:13:43 | 세션생성, 환자 정보 저장 bbfba40 @ PEERNINE (OID: COCkkhabit_1769490767179) |
| 2026-01-27 14:14:33 | 백그라운드 저장, 환자 저장 완료 **ID: 562**, 안광수 |
| 2026-01-27 14:14:33 | 백그라운드-정규화 캠페인 유저 정식 등록 완료 |
| 2026-01-27 14:14:33 | [Mediarc] 리포트 생성 시작 |
| 2026-01-27 14:14:55 | [Mediarc API] 응답 성공 (bodyage 37.9, rank 36) |
| 2026-01-27 14:14:55 | **[Pipeline] 예외 발생 — DB 저장 실패 (expected str, got list)** |
| 2026-01-30 14:55:42 | **[Pipeline] welno_mediarc_reports 저장 완료** (첫 성공) |
| 2026-01-30 15:47:10 | welno_mediarc_reports 저장 완료 |
| 2026-01-30 16:18:40 | welno_mediarc_reports 저장 완료 |
| 2026-01-30 17:03:04 | welno_mediarc_reports 저장 완료 |
| 2026-01-30 14:54:09 이후 | 동일 사용자로 재진입 시 “기존 환자 없음” 로그 있음 → 그 전에 환자 삭제 실행된 것으로 추정 |
| (삭제 실행 시점) | **delete_manager patient bbfba40... 실행** → 환자 삭제 → CASCADE로 예측 리포트 삭제 |

---

## 5. 결론

1. **왜 지워졌는지**  
   - **사람이 실행한 “환자 삭제”(delete_manager patient …)** 로 `welno_patients`가 삭제되었고,  
   - `welno_mediarc_reports`는 `patient_id` FK + ON DELETE CASCADE 때문에 **함께 삭제**되었습니다.

2. **예측 리포트는 있었는지 / 왜 없는지**  
   - **있었습니다.** 2026-01-30 14:55, 15:47, 16:18, 17:03에 걸쳐 여러 번 `welno_mediarc_reports 저장 완료` 로그가 있으며, 생성일·갱신일도 이 시각들에 대응됩니다.  
   - **지금 없는 이유**는 위 환자 삭제 시 **CASCADE로 예측 리포트가 같이 삭제되었기 때문**입니다.

3. **처방전 9건이 남아 있는 이유**  
   - 삭제 스크립트는 `welno_prescription_data`를 **patient_uuid + hospital_id**로만 DELETE 합니다.  
   - 실제로는 그 시점에 **환자만 먼저 지우는 흐름**이어서, 처방전 삭제가 누락되었거나 실행 순서/조건 때문에 같은 UUID의 처방전이 남은 것으로 보입니다.  
   - 혹은 삭제 후 다른 경로로 같은 UUID에 대해 처방전이 다시 적재된(created_at 2026-01-30 20:29:57) 가능성도 있습니다.  
   - 어쨌든 **예측 리포트만 CASCADE로 사라지고, 처방전은 patient_uuid 기준 고아 데이터로 남은 상태**입니다.

---

## 6. 참고: 사용 스크립트·로그 위치

- DB 상태 확인: `scripts/database/check_current_db.py` (welno_patients, checkup, prescription, **welno_mediarc_reports**, payments, 처방전 상세 포함)
- 삭제 스크립트: `scripts/managers/delete_manager.py` — `patient <uuid> [hospital_id]`
- 로그: `logs/pm2/welno-be/out.log`, `logs/pm2/welno-be/combined.log` (Pipeline, Mediarc, 저장 완료/예외 검색)
