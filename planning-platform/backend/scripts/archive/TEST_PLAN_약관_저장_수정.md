# 약관 저장 수정 테스트 계획

## Phase별 테스트 항목

### Phase 0: verify_terms_agreement 함수 수정 ✅

**테스트 항목:**
- [ ] `terms_agreement_detail` 컬럼이 있는 경우 정상 인식
- [ ] `terms_agreement` 컬럼만 있는 경우 하위 호환 동작
- [ ] 두 컬럼 모두 없는 경우 약관 미동의로 판단
- [ ] 필수 약관 3개 모두 동의 시 `is_agreed = True`
- [ ] 필수 약관 중 하나라도 미동의 시 `is_agreed = False`

**테스트 방법:**
```python
# 1. terms_agreement_detail만 있는 경우
# 2. terms_agreement만 있는 경우
# 3. 둘 다 있는 경우 (terms_agreement_detail 우선)
# 4. 둘 다 없는 경우
```

---

### Phase 1: 약관 동의 데이터 확인 스크립트 작성 ✅

**테스트 항목:**
- [ ] 스크립트 실행 시 환자 정보 정상 조회
- [ ] `terms_agreement` 컬럼 정상 표시
- [ ] `terms_agreement_detail` 컬럼 정상 표시
- [ ] `verify_terms_agreement` 함수 검증 결과 정상 표시
- [ ] 파트너 결제 정보 정상 조회

**테스트 방법:**
```bash
# 웰노 유저 테스트
python scripts/check_terms_agreement.py <welno_user_uuid>

# 파트너사 유저 테스트
python scripts/check_terms_agreement.py <partner_user_uuid>
```

---

### Phase 2: 프론트엔드 saveTermsAgreement 함수 수정 ✅

**테스트 항목:**
- [ ] `oid` 없이도 서버 저장 시도
- [ ] `oid` 있을 때도 정상 동작
- [ ] 서버 저장 성공 시 로컬 데이터 동기화 플래그 업데이트
- [ ] 서버 저장 실패 시에도 로컬 저장은 성공

**테스트 시나리오:**
1. **파트너사 유저 (oid 없음)**
   - 약관 동의 → 서버 저장 시도 → 성공 확인
   - DB에서 `terms_agreement_detail` 확인

2. **웰노 유저 (oid 있음)**
   - 약관 동의 → 서버 저장 시도 → 정상 동작 확인

3. **네트워크 오류 시뮬레이션**
   - 서버 저장 실패해도 로컬 저장은 성공 확인

---

### Phase 3: 백엔드 register-patient API 수정 ✅

**테스트 항목:**
- [ ] `user_info` 없을 때 최소 정보로 환자 등록
- [ ] `user_info` 있을 때 정상 등록
- [ ] 약관 동의 정보 정상 저장 (`terms_agreement_detail`)
- [ ] 환자 등록 후 약관 저장 성공

**테스트 시나리오:**
1. **파트너사 유저 (user_info 없음)**
   ```
   POST /api/v1/campaigns/disease-prediction/register-patient/
   {
     "uuid": "...",
     "partner_id": "kindhabit",
     "terms_agreement_detail": {...}
   }
   ```
   - 환자 등록: `name = "임시사용자"` 확인
   - 약관 저장: `terms_agreement_detail` 확인

2. **파트너사 유저 (user_info 있음)**
   ```
   {
     "uuid": "...",
     "user_info": {"name": "홍길동", ...},
     "terms_agreement_detail": {...}
   }
   ```
   - 환자 등록: 실제 정보로 등록 확인
   - 약관 저장: 정상 저장 확인

3. **웰노 유저**
   - 기존 플로우 정상 동작 확인

---

### Phase 3-1: save_patient_data 함수 개선 (선택사항)

**테스트 항목:**
- [ ] `registration_source` 파라미터 추가 시 정상 저장
- [ ] `partner_id` 파라미터 추가 시 정상 저장
- [ ] 기존 호출부 영향 없음 (기본값 사용)
- [ ] UPDATE 시 기존 값 유지 (COALESCE)

**테스트 시나리오:**
1. **약관 동의 시 등록 (파트너사)**
   ```python
   save_patient_data(
       uuid=uuid,
       hospital_id="PEERNINE",
       user_info=patient_info,
       session_id=session_id,
       registration_source='PARTNER',
       partner_id='kindhabit'
   )
   ```
   - DB에서 `registration_source = 'PARTNER'` 확인
   - DB에서 `partner_id = 'kindhabit'` 확인

2. **Tilko 인증 후 업데이트 (기존 값 유지)**
   ```python
   save_patient_data(
       uuid=uuid,
       hospital_id="PEERNINE",
       user_info=real_user_info,
       session_id=session_id
       # registration_source, partner_id 없음
   )
   ```
   - DB에서 기존 `registration_source`, `partner_id` 유지 확인

---

### Phase 4: 통합 테스트 및 검증

**테스트 항목:**

#### 4.1 파트너사 유저 약관 저장 플로우
- [ ] 약관 동의 → 서버 저장 → DB 확인
- [ ] 매트릭스 상태: `TERMS_REQUIRED*` → 약관 동의 후 상태 변경 확인
- [ ] 약관 동의 후 결제 페이지 이동 정상 동작

#### 4.2 웰노 유저 정상 동작 확인
- [ ] 기존 플로우 정상 동작
- [ ] 약관 동의 저장 정상 동작
- [ ] 매트릭스 상태 정상 인식

#### 4.3 매트릭스 전체 플로우 검증
- [ ] 웰노 유저: 약관 미동의 → `TERMS_REQUIRED*` → 약관 동의 → 상태 변경
- [ ] 파트너사 유저: 약관 미동의 → `TERMS_REQUIRED*` → 약관 동의 → `PAYMENT_REQUIRED` 또는 다음 단계
- [ ] 결제 조건 반영: `requires_payment` + `has_payment` 조합 정상 동작

#### 4.4 약관 체크 API 검증
- [ ] `/api/v1/terms/check` API 정상 동작
- [ ] `terms_agreement_detail` 형식 정상 조회
- [ ] 필수 약관 체크 정상 동작

---

## 테스트 실행 순서

1. **Phase 0 테스트** (단위 테스트)
   - `verify_terms_agreement` 함수 직접 테스트

2. **Phase 1 테스트** (스크립트 실행)
   - 실제 DB 데이터로 스크립트 실행

3. **Phase 2 + Phase 3 통합 테스트** (E2E)
   - 프론트엔드에서 약관 동의 → 백엔드 저장 확인

4. **Phase 3-1 테스트** (선택사항)
   - `registration_source`, `partner_id` 저장 확인

5. **Phase 4 통합 테스트** (전체 플로우)
   - 웰노/파트너사 유저 전체 플로우 검증
   - 매트릭스 상태 변화 확인

---

## 테스트 데이터 준비

### 웰노 유저 테스트 UUID
- 기존 웰노 유저 UUID 사용

### 파트너사 유저 테스트 UUID
- 신규 UUID 생성 또는 기존 파트너사 유저 UUID 사용

### 테스트 시나리오별 체크리스트
- [ ] 약관 미동의 상태에서 시작
- [ ] 약관 동의 후 DB 저장 확인
- [ ] 매트릭스 상태 변경 확인
- [ ] 화면 이동 정상 동작 확인
