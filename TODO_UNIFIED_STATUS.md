# 🏥 WELNO 통합 상태 파이프라인 작업 명세서

## 🎯 최종 목표
- 데이터 출처 및 업데이트 시점의 명확한 추적 (DB 이력 관리)
- 백엔드 중심의 통합 상태 관리 (State Machine)
- 프론트엔드 UI와 백엔드 데이터 상태의 100% 동기화 (안광수 케이스 해결)

---

## 🛠️ 작업 상세 내역 (파일별)

### 1. Database (Schema)
- [ ] `welno_patients`, `welno_checkup_data`, `welno_prescription_data`에 `data_source` 컬럼 실 적용.
- [ ] 각 출처별(`tilko`, `indexeddb`, `partner`) 타임스탬프 컬럼 인덱싱.

### 2. WelnoDataService (backend/app/services/welno_data_service.py)
- [ ] **`get_metric_count(data)`**: `campaign_payment.py`에서 이동 및 틸코/파트너 통합 대응.
- [ ] **`check_existing_data(uuid, hosp)`**: 
    - [ ] 출처별 상세 건수/시점 반환 로직 추가.
    - [ ] `is_sufficient` (분석 가능 여부) 필드 계산 로직 추가.
- [ ] **`get_unified_status(uuid, hosp)`**: (신규) 결제 + 데이터 + 리포트 상태를 종합한 최종 상태 리턴.

### 3. API Endpoints (backend/app/api/v1/endpoints/...)
- [ ] **`disease_report_unified.py`**:
    - [ ] `check_partner_status`: 데이터 유무가 아닌 `get_unified_status` 결과에 기반하도록 수정.
- [ ] **`campaign_payment.py`**:
    - [ ] 파트너 데이터 저장 시 `data_source='partner'` 명시.
    - [ ] 리포트 생성 전 틸코+파트너 데이터 병합 로직 호출.

### 4. Frontend (frontend/src/...)
- [ ] **`features/disease-report/hooks/useUnifiedStatus.ts`**: (신규) 서버 상태 폴링 및 UI 액션 매핑.
- [ ] **`features/disease-report/pages/DiseaseReportPage.tsx`**:
    - [ ] 파편화된 `setError`, `setLoading` 로직을 서버 상태값 기반으로 교체.
- [ ] **`App.tsx` / `FloatingButton`**:
    - [ ] 하단 버튼의 노출 및 텍스트를 `useUnifiedStatus`와 연동.

---

## 📊 상태 매트릭스 (무결성 기준)
1. **ACTION_REQUIRED**: 데이터 0건 또는 지표 부족 -> `/landing` (인증 유도)
2. **PAYMENT_REQUIRED**: 데이터 충분하나 미결제 -> `/payment` (결제 유도)
3. **REPORT_PENDING**: 결제 완료, 리포트 생성 중 -> `/loading` (스피너)
4. **REPORT_READY**: 리포트 완료 및 URL 유효 -> `/report` (결과 화면)
5. **REPORT_EXPIRED**: URL 만료 -> `/report` (재생성 안내)
