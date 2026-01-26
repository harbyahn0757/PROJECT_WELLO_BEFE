# 🏥 WELNO 통합 상태 및 데이터 추적 파이프라인 구축 플랜

## 📋 개요
데이터의 출처(Tilko, Partner, IndexedDB)를 명확히 하고, 유저의 상태 업데이트와 그에 따른 UI 정책(네비게이션, 플로팅 버튼)을 통합 관리하는 시스템을 구축합니다.

## 1. 데이터 수집 및 업데이트 이력 관리 (Back-end)
### DB 스키마 보완
- `data_source`: 'tilko', 'indexeddb', 'partner' 플래그 추가 (완료)
- `last_synced_at`: 출처별 동기화 시점 타임스탬프 기록
- `registration_source`: 유저 가입 경로 추적

### 저장 로직 통합
- `WelnoDataService`: 모든 저장 함수에서 `data_source` 필수 기록
- IndexedDB 업로드와 Tilko 수집 이력을 분리하여 추적

## 2. 통합 상태 업데이트 엔진 (Status Machine)
### WelnoUserStatusService 구현
- **데이터 병합(Merge)**: 파트너 데이터와 틸코 데이터를 합쳐 지표 보충
- **상태 판단 로직**:
  1. `ACTION_REQUIRED`: 지표 부족 (추가 수집 필요)
  2. `PAYMENT_REQUIRED`: 데이터 충분하나 미결제
  3. `REPORT_PENDING`: 결제 완료, 리포트 생성 중
  4. `REPORT_READY`: 리포트 완료 및 URL 유효
  5. `REPORT_EXPIRED`: URL 만료 (재생성 필요)

## 3. UI 정책 매트릭스 (Front-end)
백엔드의 `unified_status`에 따른 일관된 UI 정책 강제 적용:

| 상태 (Status) | 경로 (Route) | 플로팅 버튼 (Text) | 버튼 액션 (Action) |
| :--- | :--- | :--- | :--- |
| ACTION_REQUIRED | /landing | `데이터 가져오기` | Tilko 인증 가이드 |
| PAYMENT_REQUIRED| /payment | `결제하고 리포트 보기` | 이니시스 결제창 |
| REPORT_PENDING  | /loading | (스피너 노출) | 자동 상태 체크 (Polling) |
| REPORT_READY    | /report  | `더 자세히 알아보기` | PDF 뷰어 오픈 |
| REPORT_EXPIRED  | /report  | `리포트 새로고침` | S3 URL 재생성 |

## 🚀 단계별 작업 명세 (To-Do)
- [ ] **Phase 1**: DB 마이그레이션 실행 및 `WelnoDataService` 이력 저장 로직 수정
- [ ] **Phase 2**: `WelnoUserStatusService` (상태 판단 엔진) 및 데이터 병합 로직 구현
- [ ] **Phase 3**: `GET /api/v1/welno/user-status` 통합 API 엔드포인트 추가
- [ ] **Phase 4**: 프론트엔드 `useUnifiedStatus` 훅 개발 및 `DiseaseReportPage` 리팩토링
- [ ] **Phase 5**: 안광수 유저 케이스를 통한 로직 무결성 검증 및 최종 테스트
