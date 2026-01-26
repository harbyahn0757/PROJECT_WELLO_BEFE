# 파트너사 접근 플로우 테스트 시나리오

## 테스트 URL
```
http://localhost:9282/campaigns/disease-prediction?page=payment&partner=medilinx&uuid=bbfba40ee649d172c1cee9471249a535&data=t0v62hegr5FS3LNNFAx6cmDhQG4K8WBzz%2FxoCo32ZIJrrKjTvylV%2Fr9a6qQZwoW39FN%2FJaQg31HwXOCl3qUtN6KSxN5IWbjygPY1ip7rmHCGJdyAzB1ViSTlc2HHZfwgnC9TkCIl7oOzWSs5JUQJxRT1qQxrnEAQH3vO7k0D2mDtgjdc5gpn7s7apbuZ5v7OnW8OqtDaK4JQAm1iQ72O95cqLdm57%2FS0JHzFE0XlP5zlLm73LyLUNBMrS6ySA8VzMrk1UtX9R6anIoetSOzkIiaRypy8HqJTgg3ps4TCU809bli%2B7InyXwIZmqOwpDl%2FT1E4dumw8cfmbOSO3shU8F8ZQFVOLrK2h79o9j4cr5Rgm0Lv7Ev%2BKmDpuGrN%2ByFAtLZCXROPSzbm9m0CzmE8rg%3D%3D&api_key=5a9bb40b5108ecd8ef864658d5a2d5ab
```

## 전체 플로우 개요

### Phase 1: 초기 접근 (페이지 로드)
### Phase 2: 상태 체크 API 호출
### Phase 3: 복호화 및 데이터 저장
### Phase 4: 약관 체크 및 동의
### Phase 5: 결제 페이지 이동
### Phase 6: 결제 초기화 (oid 생성)
### Phase 7: 환자 등록 (약관 동의 시)

---

## Phase 1: 초기 접근 (페이지 로드)

### 프론트엔드 동작
**파일**: `index.tsx:32-116`

1. URL 파라미터 파싱
   - `page`: `payment` 또는 `null`
   - `partner`: `medilinx`
   - `uuid`: `bbfba40ee649d172c1cee9471249a535`
   - `data`: 암호화된 데이터 (408자)
   - `api_key`: `5a9bb40b5108ecd8ef864658d5a2d5ab`

2. 콘솔 로그 확인
   ```
   [DiseasePrediction] URL 파라미터 확인: {
     page: 'payment' 또는 null,
     partner: 'medilinx',
     uuid: 'bbfba40ee649d172c1cee9471249a535',
     data_exists: true,
     data_length: 408,
     apiKey: true
   }
   ```

### 백엔드 호출
- **API**: `POST /api/v1/disease-report/check-partner-status`
- **호출 시점**: `(partner || apiKey) && uuid` 조건 만족 시

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 초기 상태 (데이터 없음)
- **저장 위치**: `WelnoHealthDB.health_data`
- **확인 방법**: 브라우저 DevTools → Application → IndexedDB → WelnoHealthDB
- **예상 데이터**: 없음 (파트너사 접근 시 IndexedDB에 건강 데이터 저장 안 됨)

#### 로컬 저장소 (localStorage)
- **상태**: 약관 동의 데이터 있을 수 있음
- **저장 키**: `TERMS_AGREEMENT_{uuid}_{partnerId}`
- **확인 방법**: 브라우저 DevTools → Application → Local Storage
- **예상 데이터**: 
  ```json
  {
    "uuid": "bbfba40ee649d172c1cee9471249a535",
    "partner_id": "medilinx",
    "terms_service": {...},
    "terms_privacy": {...},
    "terms_sensitive": {...},
    "terms_marketing": {...},
    "last_updated": "2026-01-26T...",
    "all_required_agreed": true
  }
  ```

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **예상 상태**: 없음 (초기 접근 시)
  - **확인 쿼리**:
    ```sql
    SELECT oid, uuid, partner_id, user_name, user_data, status, created_at
    FROM welno.tb_campaign_payments
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND partner_id = 'medilinx';
    ```
  - **예상 결과**: 0건

- **테이블**: `welno.welno_patients`
  - **예상 상태**: 없음 (초기 접근 시)
  - **확인 쿼리**:
    ```sql
    SELECT id, uuid, name, registration_source, partner_id, terms_agreement, created_at
    FROM welno.welno_patients
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND hospital_id = 'PEERNINE';
    ```
  - **예상 결과**: 0건

### 로직 흐름
1. URL 파라미터 파싱 → `location.search`에서 추출
2. 조건 확인: `(partner || apiKey) && uuid` → 만족 시 API 호출
3. `check-partner-status` API 호출 → 백엔드로 `encrypted_data` 전송

### 확인 사항
- [ ] 프론트: URL 파라미터가 제대로 파싱되는지
- [ ] 프론트: `check-partner-status` API 호출 여부
- [ ] 백엔드: 요청 본문에 `encrypted_data`가 포함되는지
- [ ] 로컬: IndexedDB에 건강 데이터가 없는지 확인
- [ ] 로컬: localStorage에 약관 동의 데이터가 있는지 확인 (있으면 유효기간 체크)
- [ ] DB: `tb_campaign_payments`에 해당 uuid/partner_id 데이터가 없는지
- [ ] DB: `welno_patients`에 해당 uuid 데이터가 없는지

---

## Phase 2: 상태 체크 API 호출

### 백엔드 동작
**파일**: `disease_report_unified.py:27-474`

1. 요청 본문 수신
   ```python
   body = await request.json()
   encrypted_data = body.get('data') or body.get('encrypted_data')
   ```

2. 로그 확인
   ```
   [상태체크] 시작: partner=medilinx, key=True, uuid=bbfba40ee649d172c1cee9471249a535
   [상태체크] 요청 본문 전체: {...}
   [상태체크] encrypted_data 확인: 타입=<class 'str'>, 존재=True, 길이=408, 값 시작=...
   ```

3. 파트너 설정 조회 로직
   ```python
   # disease_report_unified.py:81-110
   # 1단계: api_key로 조회
   SELECT partner_id, partner_name, config, is_active
   FROM welno.tb_partner_config
   WHERE config->>'api_key' = $1 AND is_active = true
   
   # 2단계: partner_id로 조회 (api_key로 못 찾으면)
   SELECT partner_id, partner_name, config, is_active
   FROM welno.tb_partner_config
   WHERE partner_id = $1 AND is_active = true
   ```

4. 기본 기록 생성 로직 (없으면)
   ```python
   # disease_report_unified.py:235-244
   # 유입 기록이 없다면 생성 (404 방지용 임시 기록)
   if not is_recorded_user:
       oid = f"TEMP_{int(time.time() * 1000)}"
       INSERT INTO welno.tb_campaign_payments (oid, uuid, partner_id, status, amount)
       VALUES ($1, $2, $3, 'READY', $4)
   ```

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음
- **이유**: 파트너사 접근 시 IndexedDB에 저장 안 됨

#### 로컬 저장소 (localStorage)
- **상태**: 변경 없음

#### 백엔드 DB 상태
- **테이블**: `welno.tb_partner_config`
  - **확인 쿼리**:
    ```sql
    SELECT partner_id, partner_name, config->>'encryption' as encryption_config
    FROM welno.tb_partner_config
    WHERE partner_id = 'medilinx' AND is_active = true;
    ```
  - **예상 결과**: 1건
  - **확인 필드**: `config->>'encryption'`에 `aes_key`, `aes_iv` 포함

- **테이블**: `welno.tb_campaign_payments`
  - **상태**: 없으면 임시 레코드 생성 (`oid = TEMP_...`)
  - **확인 쿼리**:
    ```sql
    SELECT oid, uuid, partner_id, status, amount, created_at
    FROM welno.tb_campaign_payments
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND partner_id = 'medilinx';
    ```
  - **예상 결과**: 0건 또는 1건 (임시 레코드)

### 로직 흐름
1. 요청 본문 파싱: `encrypted_data` 추출
2. 파트너 식별: `api_key` 또는 `partner_id`로 파트너 설정 조회
3. 암호화 키 추출: `config->>'encryption'`에서 `aes_key`, `aes_iv` 추출
4. 기본 기록 확인: `tb_campaign_payments`에 해당 uuid/partner_id 레코드 있는지 확인
5. 없으면 임시 레코드 생성: `oid = TEMP_...`로 임시 레코드 생성

### 확인 사항
- [ ] 백엔드: `encrypted_data`가 제대로 수신되는지 (타입, 길이, 값)
- [ ] 백엔드: 파트너 설정이 제대로 조회되는지
- [ ] 백엔드: 암호화 키가 존재하는지 (`aes_key`, `aes_iv`)
- [ ] 백엔드: 기본 기록 생성 로직이 실행되는지 (없으면)
- [ ] DB: `tb_partner_config`에 `medilinx` 파트너 설정이 있는지
- [ ] DB: `tb_partner_config.config->>'encryption'`에 암호화 키가 있는지
- [ ] DB: `tb_campaign_payments`에 임시 레코드가 생성되는지 (없으면)

---

## Phase 3: 복호화 및 데이터 저장

### 백엔드 동작
**파일**: `disease_report_unified.py:248-313`

1. 복호화 시작
   ```
   [상태체크] ===== 복호화 시작 ===== uuid=..., partner=medilinx
   [상태체크] encrypted_data 존재 여부: True
   [상태체크] encrypted_data 상세: 타입=<class 'str'>, 길이=408, 시작=...
   [상태체크] 암호화 키 확인: aes_key 존재=True, aes_key 길이=32, aes_iv 존재=True, aes_iv 길이=16
   [상태체크] 복호화 시도 시작: uuid=...
   ```

2. 복호화 결과
   ```
   [상태체크] 복호화 결과: 타입=<class 'dict'>, 존재=True
   [상태체크] 복호화된 데이터 키 목록: ['name', 'birth', 'gender', 'email', 'phone', ...]
   [상태체크] 복호화된 데이터 샘플: name=최안안, birth=2011-11-11, phone=01056180757
   ```

3. tb_campaign_payments 업데이트/생성 로직
   ```python
   # 1단계: 기존 READY 상태 결제 데이터 확인 (disease_report_unified.py:220-244)
   SELECT oid FROM welno.tb_campaign_payments
   WHERE uuid = $1 AND partner_id = $2 AND status = 'READY'
   
   # 없으면 새로 생성
   INSERT INTO welno.tb_campaign_payments (oid, uuid, partner_id, status, amount)
   VALUES ($1, $2, $3, 'READY', $4)
   
   # 2단계: 복호화 성공 시 업데이트 (disease_report_unified.py:293-297)
   UPDATE welno.tb_campaign_payments
   SET user_data = $1, user_name = $2, email = $3, updated_at = NOW()
   WHERE partner_id = $4 AND uuid = $5
   ```
   - 로그: `[상태체크] ✅ 파트너 데이터 업데이트 완료: uuid=... (지표=3)`

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음 (파트너사 접근 시 IndexedDB에 저장 안 됨)
- **이유**: 파트너사 데이터는 백엔드 DB에만 저장, IndexedDB는 Tilko 인증 완료 시 저장

#### 로컬 저장소 (localStorage)
- **상태**: 변경 없음 (약관 동의 데이터 유지)

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **예상 상태**: 1건 생성 또는 업데이트
  - **필드 확인**:
    ```sql
    SELECT 
      oid,
      uuid,
      partner_id,
      user_name,        -- 복호화된 name (예: '최안안')
      user_data,        -- 복호화된 전체 데이터 (JSONB)
      email,            -- 복호화된 email
      status,           -- 'READY'
      amount,           -- 7900
      created_at,
      updated_at
    FROM welno.tb_campaign_payments
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND partner_id = 'medilinx';
    ```
  - **예상 결과**: 
    - `oid`: 새로 생성된 값 (예: `COCkkhabit_1769444177386`)
    - `user_name`: `'최안안'` (복호화된 name)
    - `user_data`: JSONB 형태의 복호화된 데이터 (name, birth, phone, height, weight 등)
    - `email`: 복호화된 email (있으면)
    - `status`: `'READY'`

- **테이블**: `welno.welno_patients`
  - **예상 상태**: 없음 (아직 환자 등록 안 됨)
  - **이유**: 약관 동의 전에는 환자 등록 안 됨

### 로직 흐름
1. 기존 READY 상태 결제 데이터 확인
   - 있으면: 기존 oid 유지, user_data만 업데이트
   - 없으면: 새 oid 생성, INSERT
2. 복호화 시도
   - 성공: `user_data`, `user_name`, `email` 업데이트
   - 실패: 로그만 남기고 계속 진행
3. 지표 분석: `get_metric_count(decrypted)` → 지표 개수 계산

### 확인 사항
- [ ] 백엔드: 복호화가 성공하는지
- [ ] 백엔드: 복호화된 데이터 내용 (name, birth, phone 등)
- [ ] 백엔드: `tb_campaign_payments`에 `user_data`, `user_name`, `email`이 저장되는지
- [ ] DB: `tb_campaign_payments` 테이블에 데이터가 있는지
- [ ] DB: `tb_campaign_payments.user_data`에 복호화된 데이터가 JSONB로 저장되는지
- [ ] DB: `tb_campaign_payments.user_name`에 이름이 저장되는지 (예: '최안안')
- [ ] DB: `tb_campaign_payments.status`가 'READY'인지
- [ ] DB: `welno_patients`에는 아직 데이터가 없는지 (정상)

---

## Phase 4: 약관 체크 및 동의

### 시나리오 A: 약관이 필요 없는 경우 (로컬에 약관 데이터 있음)

#### 프론트엔드 동작
**파일**: `IntroLandingPage.tsx:101-134`, `termsAgreement.ts:106-260`

1. 버튼 클릭
   ```
   [IntroLandingPage] 약관 체크 시작: {uuid: ..., partnerForTerms: 'medilinx'}
   ```

2. 약관 체크 로직
   ```javascript
   // 1단계: 서버 조회 (termsAgreement.ts:124-157)
   GET /api/v1/terms/check?uuid=...&partner_id=medilinx
   // 응답: {agreed: false, terms_detail: null, message: '환자 정보를 찾을 수 없습니다.'}
   // 이유: welno_patients에 환자 정보 없음
   
   // 2단계: 로컬 체크 (termsAgreement.ts:162-260)
   localStorage.getItem(`TERMS_AGREEMENT_${uuid}_${partnerId}`)
   // 유효기간 체크: 3일 내면 유효
   ```

3. 약관 체크 결과
   ```
   [약관체크] 서버 조회 시작: {uuid: ..., partnerId: 'medilinx'}
   [약관체크] 서버 응답: {agreed: false, terms_detail: null, message: '환자 정보를 찾을 수 없습니다.'}
   [약관체크] 로컬 데이터: {...}
   [약관체크] 로컬 약관 유효: 2026년 1월 26일에 동의하신 약관으로 진행합니다.
   [IntroLandingPage] 약관 동의 완료 → 결제 진행
   ```

4. 결제 페이지로 이동
   ```
   💳 [IntroLanding] 결제 페이지로 이동
   navigate(`/campaigns/disease-prediction?page=payment&${commonParams}`)
   ```

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음

#### 로컬 저장소 (localStorage)
- **상태**: 약관 동의 데이터 유지
- **저장 키**: `TERMS_AGREEMENT_bbfba40ee649d172c1cee9471249a535_medilinx`
- **데이터 구조**:
  ```json
  {
    "uuid": "bbfba40ee649d172c1cee9471249a535",
    "partner_id": "medilinx",
    "terms_service": {
      "agreed": true,
      "agreed_at": "2026-01-26T...",
      "expires_at": "2026-01-29T...",
      "synced_to_server": false,
      "server_synced_at": null
    },
    "terms_privacy": {...},
    "terms_sensitive": {...},
    "terms_marketing": {...},
    "last_updated": "2026-01-26T...",
    "all_required_agreed": true
  }
  ```
- **유효기간 체크**: `expires_at`이 현재 시간보다 미래면 유효

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **상태**: Phase 3에서 저장된 데이터 유지
  - **변경 없음**

- **테이블**: `welno.welno_patients`
  - **상태**: 없음 (약관 동의 안 했으므로)
  - **이유**: 약관 동의 시점에만 환자 등록됨

### 로직 흐름
1. 서버 약관 체크: `GET /api/v1/terms/check` → 환자 정보 없으면 `agreed: false`
2. 로컬 약관 체크: localStorage에서 약관 데이터 조회
3. 유효기간 체크: `expires_at`이 현재 시간보다 미래면 유효
4. 결과 판단: 
   - 서버에서 동의 확인 → `needsAgreement: false`
   - 로컬에서 유효한 약관 확인 → `needsAgreement: false`
   - 둘 다 없거나 만료 → `needsAgreement: true`

### 확인 사항
- [ ] 프론트: 약관 체크 결과 (`needsAgreement: false`)
- [ ] 프론트: 결제 페이지로 이동하는지 (`page=payment`)
- [ ] 화면: 결제 페이지가 표시되는지
- [ ] 로컬: localStorage에 약관 동의 데이터가 있는지
- [ ] 로컬: 약관 동의 유효기간이 3일 내인지
- [ ] 백엔드: 서버 약관 체크 API 응답 (`agreed: false` - 정상, 환자 정보 없음)
- [ ] DB: `welno_patients`에 아직 데이터가 없는지 (정상)

### 시나리오 B: 약관 동의가 필요한 경우

#### 프론트엔드 동작
**파일**: `IntroLandingPage.tsx:110-120`, `index.tsx:174-202`

1. 약관 모달 표시
   ```
   [IntroLandingPage] 약관 동의 필요 → 약관 모달 표시
   navigate(`/campaigns/disease-prediction?page=terms&...`)
   ```

2. 약관 동의 완료
   ```
   ✅ [약관저장] 로컬 저장 완료: {...}
   POST /api/v1/campaigns/disease-prediction/register-patient/
   ```

3. 결제 페이지로 이동
   ```
   navigate(`/campaigns/disease-prediction?page=payment&...`)
   ```

#### 백엔드 동작
**파일**: `campaign_payment.py:852-983`

1. 환자 등록 API 호출
   ```
   🚀 [환자등록] 약관동의 완료 시 등록: uuid=..., oid=..., partner=medilinx
   ```

2. 데이터 조회
   - `oid`로 `tb_campaign_payments` 조회 (없으면 실패)
   - `uuid`와 `partner_id`로도 조회 필요 (현재 없음)

3. 환자 등록
   ```
   ✅ [환자등록] 환자 등록 완료: uuid=..., patient_id=...
   ```

#### 확인 사항
- [ ] 프론트: 약관 모달이 표시되는지
- [ ] 프론트: 약관 동의 후 `register-patient` API 호출 여부
- [ ] 백엔드: `register-patient`에서 `tb_campaign_payments` 데이터 조회 성공 여부
- [ ] 백엔드: `welno_patients`에 환자 등록 성공 여부
- [ ] DB: `welno_patients` 테이블에 데이터가 있는지

---

## Phase 5: 결제 페이지 이동

### 프론트엔드 동작
**파일**: `index.tsx:97-101`, `LandingPage.tsx:21-37`

1. 페이지 렌더링
   ```javascript
   if (page === 'payment' || page === 'landing' || page === 'terms') {
     setCurrentPage(page);
   }
   ```

2. 결제 페이지 로드
   - `LandingPage` 컴포넌트 렌더링
   - URL 파라미터 파싱: `userData` 구성
   - `userData.oid`: URL에서 가져옴 (없으면 빈 문자열)

3. 플로팅 버튼 텍스트 업데이트
   ```
   📤 [IntroLanding] 버튼 텍스트 업데이트 전송: 7,900원 결제하고 리포트 보기
   ```

4. 상태 체크 재실행
   - `checkUserStatus` useEffect 재실행 (location.search 변경 시)
   - `check-partner-status` API 재호출
   - 이때도 복호화 및 업데이트 수행

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음

#### 로컬 저장소 (localStorage)
- **상태**: 변경 없음 (약관 동의 데이터 유지)

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **상태**: Phase 3에서 저장된 데이터 유지
  - **확인**: `status = 'READY'`인 레코드 존재

- **테이블**: `welno.welno_patients`
  - **상태**: 없음 (약관 동의 전)

### 로직 흐름
1. URL 변경: `page=payment` 파라미터 추가
2. `checkUserStatus` 재실행: `location.search` 변경 감지
3. 상태 체크 API 재호출: 복호화 및 업데이트 재수행
4. `currentPage` 설정: `'payment'`로 설정
5. `LandingPage` 렌더링: 결제 페이지 표시

### 확인 사항
- [ ] 프론트: `currentPage`가 `payment`로 설정되는지
- [ ] 화면: 결제 페이지가 표시되는지
- [ ] 프론트: 플로팅 버튼 텍스트가 "7,900원 결제하고 리포트 보기"인지
- [ ] 프론트: URL에 `page=payment` 파라미터가 있는지
- [ ] 프론트: `check-partner-status` API가 재호출되는지 (정상)
- [ ] 백엔드: 상태 체크 API 재호출 시 복호화 및 업데이트 재수행되는지
- [ ] DB: `tb_campaign_payments`에 `status = 'READY'`인 레코드가 있는지

---

## Phase 6: 결제 초기화 (oid 생성)

### 프론트엔드 동작
**파일**: `LandingPage.tsx:82-157`

1. 버튼 클릭
   ```
   📣 [LandingPage] 전역 버튼 클릭 수신 -> 결제 시도
   handlePayment() 호출
   ```

2. 약관 체크 (결제 페이지에서도)
   ```
   [LandingPage] 약관 체크 시작: {uuid: ..., partnerId: 'medilinx'}
   ```

3. `init-payment` API 호출
   ```javascript
   POST /api/v1/campaigns/disease-prediction/init-payment/
   {
     data: "...",
     uuid: "...",
     partner_id: "medilinx",
     api_key: "..."
   }
   ```

### 백엔드 동작
**파일**: `campaign_payment.py:48-180`

1. 결제 초기화
   ```
   🔍 [결제초기화] 데이터 확인: uuid=..., partner=medilinx, encrypted_data 존재=True, 길이=408
   🔑 [결제초기화] 암호화 키 확인: aes_key 존재=True, aes_iv 존재=True
   ✅ [결제초기화] 복호화 성공: uuid=..., name=최안안
   ```

2. oid 생성
   ```python
   oid = f"{INICIS_MOBILE_MID}_{int(time.time() * 1000)}"
   ```

3. 기존 결제 데이터 확인 로직
   ```sql
   -- campaign_payment.py:124-129
   SELECT oid FROM welno.tb_campaign_payments
   WHERE uuid = $1 AND partner_id = $2 AND status = 'READY'
   ORDER BY created_at DESC
   LIMIT 1
   ```

4. DB 저장/업데이트 로직
   ```python
   # 기존 READY 상태 있으면: UPDATE (oid 새로 생성)
   if existing_payment:
       existing_oid = existing_payment[0]
       UPDATE welno.tb_campaign_payments
       SET oid = %s,  -- 새 oid로 변경
           user_name = COALESCE(%s, user_name),
           user_data = COALESCE(%s::jsonb, user_data),
           amount = %s,
           email = COALESCE(%s, email),
           updated_at = NOW()
       WHERE oid = %s  -- 기존 oid로 찾기
   
   # 없으면: INSERT (새 oid)
   else:
       INSERT INTO welno.tb_campaign_payments 
       (oid, uuid, partner_id, user_name, user_data, amount, status, email)
       VALUES (%s, %s, %s, %s, %s, %s, 'READY', %s)
   ```

5. 응답 반환
   ```json
   {
     "success": true,
     "P_OID": "COCkkhabit_1769279823475",
     "P_MID": "...",
     "P_AMT": "7900",
     ...
   }
   ```

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음

#### 로컬 저장소 (localStorage)
- **상태**: 변경 없음

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **상태**: 업데이트 또는 새로 생성
  - **시나리오 A**: 기존 READY 상태 있으면
    - `oid`: 새로 생성된 값 (기존 oid에서 변경)
    - `user_name`: 기존 값 유지 또는 새 값으로 업데이트
    - `user_data`: 기존 값 유지 또는 새 값으로 업데이트
    - `status`: `'READY'` 유지
    - `updated_at`: 현재 시간으로 업데이트
  - **시나리오 B**: 기존 READY 상태 없으면
    - `oid`: 새로 생성된 값
    - `user_name`: 복호화된 name
    - `user_data`: 복호화된 전체 데이터 (JSONB)
    - `email`: 복호화된 email
    - `status`: `'READY'`
    - `created_at`: 현재 시간
  - **확인 쿼리**:
    ```sql
    SELECT 
      oid,
      uuid,
      partner_id,
      user_name,
      user_data,
      email,
      status,
      amount,
      created_at,
      updated_at
    FROM welno.tb_campaign_payments
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND partner_id = 'medilinx'
    ORDER BY updated_at DESC;
    ```

- **테이블**: `welno.welno_patients`
  - **상태**: 없음 (약관 동의 전)

### 로직 흐름
1. 약관 체크: 결제 페이지에서도 약관 체크 수행
2. `init-payment` API 호출: `encrypted_data` 전송
3. 복호화: 백엔드에서 복호화 수행
4. 기존 결제 데이터 확인: `uuid` + `partner_id` + `status='READY'`로 조회
5. oid 생성: 새 oid 생성 (타임스탬프 기반)
6. DB 저장/업데이트:
   - 기존 있으면: UPDATE (oid 새로 생성, user_data 업데이트)
   - 없으면: INSERT (새 레코드 생성)
7. 응답 반환: oid 포함하여 프론트로 전달
8. 이니시스 결제창: form submit으로 이동

### 확인 사항
- [ ] 프론트: `init-payment` API 호출 여부
- [ ] 백엔드: 복호화 성공 여부
- [ ] 백엔드: oid 생성 여부
- [ ] 백엔드: `tb_campaign_payments`에 저장/업데이트 여부
- [ ] DB: `tb_campaign_payments`에 `oid`, `user_name`, `user_data`가 있는지
- [ ] DB: `tb_campaign_payments.oid`가 새로 생성된 값인지
- [ ] DB: `tb_campaign_payments.status`가 'READY'인지
- [ ] DB: `tb_campaign_payments.user_data`에 복호화된 데이터가 있는지
- [ ] 프론트: 이니시스 결제창으로 이동하는지

---

## Phase 7: 환자 등록 (약관 동의 시)

### 프론트엔드 동작
**파일**: `index.tsx:174-202`, `termsAgreement.ts:299-422`

1. 약관 모달에서 동의 완료
   ```
   ✅ [약관저장] 로컬 저장 완료: {...}
   ```

2. `register-patient` API 호출
   ```javascript
   POST /api/v1/campaigns/disease-prediction/register-patient/
   {
     uuid: "...",
     partner_id: "medilinx",
     terms_agreement_detail: {...},
     api_key: "..."
     // oid는 없음 (약관 동의 시점에는 아직 init-payment 호출 전)
   }
   ```

### 백엔드 동작
**파일**: `campaign_payment.py:852-983`

1. `register-patient` API 호출
   ```
   🚀 [환자등록] 약관동의 완료 시 등록: uuid=..., oid=..., partner=medilinx
   ```

2. 데이터 조회 로직 (문제점)
   ```python
   # campaign_payment.py:886-899
   # oid로만 조회 (없으면 실패)
   if oid:
       SELECT user_data, user_name, email
       FROM welno.tb_campaign_payments
       WHERE oid = %s
   # 문제: oid가 없으면 decrypted_data가 None이 됨
   ```

3. 환자 정보 추출 로직
   ```python
   # campaign_payment.py:901-916
   # 우선순위: user_info > decrypted_data > 최소 정보
   if user_info:
       patient_info = {
           "name": user_info.get('name', ''),
           "phone_number": user_info.get('phone', ...),
           "birth_date": user_info.get('birth', ...),
           "gender": user_info.get('gender', 'M')
       }
   elif decrypted_data:
       patient_info = {
           "name": decrypted_data.get('name', ''),
           "phone_number": decrypted_data.get('phone', ...),
           "birth_date": decrypted_data.get('birth', ...),
           "gender": ...
       }
   else:
       # 최소 정보로 등록
       patient_info = {
           "name": "임시사용자",
           "phone_number": "01000000000",
           "birth_date": "1900-01-01",
           "gender": "M"
       }
   ```

4. 환자 등록
   ```python
   welno_data_service.save_patient_data(
       uuid=uuid,
       hospital_id="PEERNINE",
       user_info=patient_info,
       registration_source='PARTNER',
       partner_id=partner_id
   )
   ```

5. 약관 동의 저장
   ```python
   welno_data_service.save_terms_agreement_detail(
       uuid=uuid,
       hospital_id="PEERNINE",
       terms_agreement_detail=terms_agreement_detail
   )
   ```

### 데이터 상태

#### 로컬 저장소 (IndexedDB)
- **상태**: 변경 없음

#### 로컬 저장소 (localStorage)
- **상태**: 약관 동의 데이터 저장/업데이트
- **저장 키**: `TERMS_AGREEMENT_{uuid}_{partnerId}`
- **데이터 구조**: Phase 4와 동일하지만 `synced_to_server: true`로 업데이트됨

#### 백엔드 DB 상태
- **테이블**: `welno.tb_campaign_payments`
  - **상태**: 변경 없음 (약관 동의 시점에는 이미 Phase 3에서 저장됨)
  - **문제**: `oid`로만 조회하므로, 약관 동의 시점에 `oid`가 없으면 조회 실패

- **테이블**: `welno.welno_patients`
  - **상태**: 1건 생성 (약관 동의 시)
  - **필드 확인**:
    ```sql
    SELECT 
      id,
      uuid,
      name,                    -- 복호화된 name 또는 '임시사용자'
      phone_number,           -- 복호화된 phone 또는 '01000000000'
      birth_date,              -- 복호화된 birth 또는 '1900-01-01'
      gender,                  -- 복호화된 gender 또는 'M'
      registration_source,     -- 'PARTNER'
      partner_id,              -- 'medilinx'
      terms_agreement_detail,  -- 약관 동의 상세 정보 (JSONB)
      terms_all_required_agreed_at,  -- 필수 약관 모두 동의 시각
      created_at,
      updated_at
    FROM welno.welno_patients
    WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND hospital_id = 'PEERNINE';
    ```
  - **예상 결과**:
    - `name`: 복호화된 name (예: '최안안') 또는 '임시사용자' (oid 없으면)
    - `registration_source`: `'PARTNER'`
    - `partner_id`: `'medilinx'`
    - `terms_agreement_detail`: 약관 동의 상세 정보 (JSONB)

### 로직 흐름
1. 약관 모달에서 동의 완료
2. 로컬 저장: localStorage에 약관 동의 데이터 저장
3. 서버 저장: `register-patient` API 호출
4. 데이터 조회: `oid`로 `tb_campaign_payments` 조회 (없으면 실패)
5. 환자 정보 추출: `user_info` > `decrypted_data` > 최소 정보
6. 환자 등록: `welno_patients`에 INSERT 또는 UPDATE
7. 약관 동의 저장: `welno_patients.terms_agreement_detail`에 저장

### 확인 사항
- [ ] 프론트: 약관 모달에서 동의 완료 시 `register-patient` API 호출 여부
- [ ] 프론트: `register-patient` 요청 본문에 `oid`가 있는지 (없으면 정상, 약관 동의 시점에는 아직 없음)
- [ ] 백엔드: `oid`로 `tb_campaign_payments` 조회 성공 여부 (oid 없으면 실패 - 문제점)
- [ ] 백엔드: `uuid`와 `partner_id`로 `tb_campaign_payments` 조회하는지 (현재 없음 - 수정 필요)
- [ ] 백엔드: 환자 정보 추출 성공 여부 (name, birth, phone 등)
- [ ] 백엔드: `welno_patients`에 환자 등록 성공 여부
- [ ] 백엔드: 약관 동의 저장 성공 여부
- [ ] DB: `welno_patients`에 데이터가 있는지
- [ ] DB: `welno_patients.name`이 복호화된 이름인지 (예: '최안안')
- [ ] DB: `welno_patients.registration_source`가 'PARTNER'인지
- [ ] DB: `welno_patients.partner_id`가 'medilinx'인지
- [ ] DB: `welno_patients.terms_agreement_detail`에 약관 정보가 있는지
- [ ] 로컬: localStorage의 약관 동의 데이터가 `synced_to_server: true`로 업데이트되는지

---

## 단계별 체크리스트

### Step 1: 초기 접근
**로컬 상태**
- [ ] IndexedDB: 건강 데이터 없음 확인
- [ ] localStorage: 약관 동의 데이터 확인 (있으면 유효기간 체크)

**프론트**
- [ ] URL 파라미터 파싱 확인
- [ ] `check-partner-status` API 호출

**백엔드**
- [ ] 요청 본문에 `encrypted_data` 포함 확인

**DB 상태**
- [ ] `tb_campaign_payments`: 해당 uuid/partner_id 데이터 없음
- [ ] `welno_patients`: 해당 uuid 데이터 없음

### Step 2: 상태 체크
**백엔드**
- [ ] `encrypted_data` 수신 확인 (타입, 길이, 값)
- [ ] 파트너 설정 조회 성공
- [ ] 암호화 키 존재 확인 (`aes_key`, `aes_iv`)

**DB 상태**
- [ ] `tb_partner_config`: `medilinx` 파트너 설정 존재
- [ ] `tb_partner_config.config->>'encryption'`: 암호화 키 포함
- [ ] `tb_campaign_payments`: 임시 레코드 생성 여부 확인 (없으면)

### Step 3: 복호화
**백엔드**
- [ ] 복호화 성공
- [ ] 복호화된 데이터 내용 확인 (name, birth, phone)
- [ ] `tb_campaign_payments` 업데이트 성공

**DB 상태**
- [ ] `tb_campaign_payments.user_data`: 복호화된 데이터 (JSONB) 저장 확인
- [ ] `tb_campaign_payments.user_name`: 복호화된 name 저장 확인 (예: '최안안')
- [ ] `tb_campaign_payments.email`: 복호화된 email 저장 확인
- [ ] `tb_campaign_payments.status`: 'READY' 확인
- [ ] `welno_patients`: 아직 데이터 없음 (정상)

### Step 4: 약관 체크
**로컬 상태**
- [ ] localStorage: 약관 동의 데이터 확인
- [ ] localStorage: 약관 유효기간 확인 (3일 내)

**프론트**
- [ ] 약관 체크 결과 (`needsAgreement` 값)
- [ ] 약관 모달 표시 여부 (필요한 경우)
- [ ] 결제 페이지로 이동 여부

**백엔드**
- [ ] 서버 약관 체크 API 응답 (`agreed: false` - 정상, 환자 정보 없음)

**DB 상태**
- [ ] `welno_patients`: 아직 데이터 없음 (정상)

### Step 5: 결제 페이지
**프론트**
- [ ] `currentPage`가 `payment`로 설정
- [ ] 화면: 결제 페이지 표시
- [ ] 플로팅 버튼 텍스트 확인

**백엔드**
- [ ] 상태 체크 API 재호출 (정상)
- [ ] 복호화 및 업데이트 재수행

**DB 상태**
- [ ] `tb_campaign_payments`: `status = 'READY'`인 레코드 존재
- [ ] `welno_patients`: 아직 데이터 없음

### Step 6: 결제 초기화
**프론트**
- [ ] `init-payment` API 호출
- [ ] 이니시스 결제창 이동

**백엔드**
- [ ] 복호화 성공
- [ ] oid 생성
- [ ] `tb_campaign_payments` 저장/업데이트

**DB 상태**
- [ ] `tb_campaign_payments.oid`: 새로 생성된 값 확인
- [ ] `tb_campaign_payments.user_data`: 복호화된 데이터 확인
- [ ] `tb_campaign_payments.user_name`: 이름 확인
- [ ] `tb_campaign_payments.status`: 'READY' 확인
- [ ] `welno_patients`: 아직 데이터 없음 (약관 동의 전)

### Step 7: 환자 등록 (약관 동의 시)
**로컬 상태**
- [ ] localStorage: 약관 동의 데이터 저장/업데이트
- [ ] localStorage: `synced_to_server: true`로 업데이트

**프론트**
- [ ] `register-patient` API 호출
- [ ] 요청 본문에 `oid` 있는지 확인 (없으면 정상, 약관 동의 시점에는 아직 없음)

**백엔드**
- [ ] `tb_campaign_payments` 조회 성공 여부
  - `oid`로 조회 (없으면 실패 - 문제점)
  - `uuid` + `partner_id`로 조회 (현재 없음 - 수정 필요)
- [ ] 환자 정보 추출 성공 (name, birth, phone 등)
- [ ] 환자 등록 성공
- [ ] 약관 동의 저장 성공

**DB 상태**
- [ ] `welno_patients`: 1건 생성 확인
- [ ] `welno_patients.name`: 복호화된 이름 확인 (예: '최안안')
- [ ] `welno_patients.registration_source`: 'PARTNER' 확인
- [ ] `welno_patients.partner_id`: 'medilinx' 확인
- [ ] `welno_patients.terms_agreement_detail`: 약관 동의 상세 정보 (JSONB) 확인
- [ ] `welno_patients.terms_all_required_agreed_at`: 필수 약관 모두 동의 시각 확인

---

## 예상 문제점 및 확인 사항

### 문제 1: 약관 동의 시 oid가 없음
- **현상**: `register-patient`에서 `oid`로 조회 실패
- **원인**: 약관 동의 시점에는 아직 `init-payment` 호출 전
- **확인**: `register-patient`에서 `uuid`와 `partner_id`로도 조회하는지

### 문제 2: 결제 페이지로 이동 안 됨
- **현상**: 약관 동의 완료 후 결제 페이지로 이동 안 됨
- **원인**: `navigate` 실행 후 `checkUserStatus`가 다시 실행되며 `page` 파라미터 덮어쓰기
- **확인**: URL이 실제로 변경되는지, `currentPage`가 업데이트되는지

### 문제 3: 복호화된 데이터가 DB에 저장 안 됨
- **현상**: `tb_campaign_payments.user_data`가 NULL
- **원인**: 복호화 실패 또는 업데이트 쿼리 실패
- **확인**: 복호화 로그, DB 업데이트 로그, 실제 DB 값

---

## DB 확인 쿼리 스크립트

각 단계마다 다음 쿼리로 DB 상태를 확인할 수 있습니다:

```sql
-- 1. tb_campaign_payments 확인
SELECT 
  oid,
  uuid,
  partner_id,
  user_name,
  user_data,
  email,
  status,
  amount,
  created_at,
  updated_at
FROM welno.tb_campaign_payments
WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND partner_id = 'medilinx'
ORDER BY updated_at DESC;

-- 2. welno_patients 확인
SELECT 
  id,
  uuid,
  name,
  phone_number,
  birth_date,
  gender,
  registration_source,
  partner_id,
  terms_agreement_detail,
  terms_all_required_agreed_at,
  created_at,
  updated_at
FROM welno.welno_patients
WHERE uuid = 'bbfba40ee649d172c1cee9471249a535' AND hospital_id = 'PEERNINE';

-- 3. 파트너 설정 확인
SELECT 
  partner_id,
  partner_name,
  config->>'encryption' as encryption_config,
  is_active
FROM welno.tb_partner_config
WHERE partner_id = 'medilinx' AND is_active = true;
```

## 로컬 저장소 확인 방법

### IndexedDB 확인
1. 브라우저 DevTools 열기 (F12)
2. Application 탭 선택
3. IndexedDB → WelnoHealthDB → health_data
4. uuid로 검색: `bbfba40ee649d172c1cee9471249a535`
5. 예상: 파트너사 접근 시 IndexedDB에 건강 데이터 저장 안 됨

### localStorage 확인
1. 브라우저 DevTools 열기 (F12)
2. Application 탭 선택
3. Local Storage → `http://localhost:9282`
4. 키 검색: `TERMS_AGREEMENT_bbfba40ee649d172c1cee9471249a535_medilinx`
5. 값 확인: 약관 동의 데이터 (JSON)

---

## 백엔드 로그 확인 포인트

### Phase 2-3: 상태 체크 및 복호화
```
[상태체크] 시작: partner=..., key=..., uuid=...
[상태체크] 요청 본문 전체: {...}
[상태체크] encrypted_data 확인: 타입=..., 존재=..., 길이=...
[상태체크] ===== 복호화 시작 =====
[상태체크] 복호화 결과: 타입=..., 존재=...
[상태체크] 복호화된 데이터 키 목록: [...]
[상태체크] 복호화된 데이터 샘플: name=..., birth=..., phone=...
[상태체크] ✅ 파트너 데이터 업데이트 완료: uuid=... (지표=...)
```

### Phase 6: 결제 초기화
```
🔍 [결제초기화] 데이터 확인: uuid=..., partner=..., encrypted_data 존재=..., 길이=...
🔑 [결제초기화] 암호화 키 확인: aes_key 존재=..., aes_iv 존재=...
✅ [결제초기화] 복호화 성공: uuid=..., name=...
✅ [결제초기화] 새 결제 데이터 생성: oid=..., uuid=...
또는
🔄 [결제초기화] 기존 결제 데이터 업데이트: oid=... -> ..., uuid=...
```

### Phase 7: 환자 등록
```
🚀 [환자등록] 약관동의 완료 시 등록: uuid=..., oid=..., partner=...
✅ [환자등록] 파트너 데이터 발견: oid=...
✅ [환자등록] 환자 등록 완료: uuid=..., patient_id=...
✅ [환자등록] 약관동의 상세 정보 저장 완료: uuid=...
```
