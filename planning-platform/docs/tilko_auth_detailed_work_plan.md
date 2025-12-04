# 틸코 인증 화면 상세 작업 계획

## 📋 현재 상황 리마인드

### 발견된 핵심 문제점

#### 1. 로컬 스토리지 관련 문제
- **초기화 시 로컬 스토리지 읽기**: 컴포넌트 마운트 시 `localStorage.getItem('tilko_selected_auth_type')`로 이전 선택값 불러옴
- **문제**: 이전 세션의 인증 방식이 남아있으면 새로 선택해도 이전 값이 사용될 수 있음
- **위치**: `AuthForm.tsx` 라인 62-65

#### 2. 인증 방식 전달 플로우 문제
- **프론트엔드**: 5단계 fallback (localStorage > confirmationData > DOM > state > 기본값 '0')
- **백엔드**: `user_info.get("private_auth_type", "0")` - 기본값 '0' 강제
- **문제**: 어느 단계에서든 '0'으로 fallback될 위험

#### 3. 입력값 처리 문제
- **DOM 직접 읽기**: 입력 필드가 사라진 후에도 DOM에서 읽으려고 시도
- **State와 DOM 불일치**: 여러 소스에서 값을 가져와서 불일치 가능

---

## 🔍 상세 코드 분석

### 로컬 스토리지 사용 현황

#### 1. 인증 방식 저장/읽기 위치

**저장 위치:**
1. `AuthForm.tsx` 라인 3351: 인증 방식 선택 시 `localStorage.setItem('tilko_selected_auth_type', authType.value)`
2. `AuthForm.tsx` 라인 2441: `handleNextStep`에서도 저장
3. `AuthForm.tsx` 라인 1938: `handleAllConfirmed`에서 state 업데이트 시 저장 안 함 (누락 가능)

**읽기 위치:**
1. `AuthForm.tsx` 라인 63: 컴포넌트 초기화 시 읽기 (기본값 '0')
2. `AuthForm.tsx` 라인 1845: `handleAllConfirmed`에서 읽기
3. `AuthForm.tsx` 라인 2414: `handleNextStep`에서 읽기

**문제점:**
- 초기화 시 로컬 스토리지에서 읽으면 이전 세션 값이 남아있을 수 있음
- 여러 곳에서 읽어서 일관성 문제 발생 가능

#### 2. 인증 방식 전달 플로우

**프론트엔드 → 백엔드 전달:**
```
1. 사용자 선택 (라인 3349) 
   → setSelectedAuthType(authType.value)
   → localStorage.setItem('tilko_selected_auth_type', authType.value)

2. handleAllConfirmed 호출 (라인 1813)
   → finalAuthType 결정 (라인 1886-1892):
     - localStorage > confirmationData > DOM > state > '0'
   → sessionStartPayload 생성 (라인 2048)
   → private_auth_type: finalAuthTypeForRequest

3. API 호출 (라인 2087)
   → POST /api/v1/tilko-auth/session/start
   → body: { private_auth_type: finalAuthTypeForRequest, ... }
```

**백엔드 처리:**
```
1. 세션 시작 (tilko_auth.py 라인 151-218)
   → request.private_auth_type 받음
   → str(request.private_auth_type).strip() 처리
   → user_info에 저장: "private_auth_type": str(...).strip()

2. simple-auth 호출 (tilko_auth.py 라인 220-430)
   → user_info.get("private_auth_type", "0") ← 기본값 '0' 강제!
   → str(...).strip() 처리
   → simple_auth(private_auth_type, ...) 호출
```

**문제점:**
- 백엔드 라인 267: `user_info.get("private_auth_type", "0")` - 기본값 '0' 강제
- 세션에 저장은 되지만, simple-auth 호출 시 기본값으로 fallback 가능

#### 3. 입력값 처리 플로우

**이름 처리:**
```
1. patient 데이터에서 로드 (라인 466-471)
2. editableName state에 저장
3. handleAllConfirmed에서 최종 결정 (라인 1863-1868):
   - nameInput?.value (DOM)
   - confirmationData.name (히스토리)
   - editableName (state)
   - '' (빈 문자열)
```

**전화번호 처리:**
```
1. patient 데이터에서 로드 (라인 759-768)
2. editablePhone state에 저장
3. handleAllConfirmed에서 최종 결정 (라인 1870-1875):
   - phoneInput?.value (DOM)
   - confirmationData.phone (히스토리)
   - editablePhone (state)
   - '' (빈 문자열)
```

**생년월일 처리:**
```
1. patient 데이터에서 로드 (라인 774-784)
2. editableBirthday state에 저장
3. handleAllConfirmed에서 최종 결정 (라인 1877-1883):
   - birthdayInput?.value (DOM)
   - confirmationData.birthday (히스토리)
   - editableBirthday (state)
   - patient?.birthday (patient 데이터)
   - '' (빈 문자열)
```

**문제점:**
- DOM에서 직접 읽는 방식: 입력 필드가 사라진 후에는 읽을 수 없음
- 여러 소스 우선순위가 복잡해서 예측하기 어려움

---

## ✅ 상세 작업 계획

### Phase 1: 로컬 스토리지 정리 및 초기화 개선

#### 1.1 로컬 스토리지 초기화 시점 개선
- [ ] **컴포넌트 마운트 시 로컬 스토리지 정리**
  - 파일: `AuthForm.tsx` (라인 441-482)
  - 현재: 초기화 시 이전 값 읽기
  - 수정: 
    - 인증 페이지 진입 시 `tilko_selected_auth_type` 초기화
    - 또는 세션별로 고유 키 사용 (예: `tilko_selected_auth_type_${sessionId}`)
  - 검증: 새로 접속 시 항상 기본값 '0'으로 시작하는지 확인

- [ ] **인증 방식 선택 시 즉시 state와 로컬 스토리지 동기화**
  - 파일: `AuthForm.tsx` (라인 3343-3352)
  - 현재: `setSelectedAuthType` + `localStorage.setItem` 분리
  - 수정: 
    - `setSelectedAuthType` 호출 후 즉시 localStorage 저장 확인
    - 또는 커스텀 훅으로 통합 관리
  - 검증: 선택 즉시 state와 localStorage에 동일한 값 저장 확인

#### 1.2 로컬 스토리지 읽기 로직 단순화
- [ ] **단일 소스에서만 읽기**
  - 파일: `AuthForm.tsx` (라인 1844-1892)
  - 현재: 5단계 fallback
  - 수정:
    - state 우선 사용
    - localStorage는 보조 (state가 없을 때만)
    - 기본값은 마지막
  - 검증: state에 값이 있으면 항상 state 값 사용 확인

- [ ] **로컬 스토리지 키 정리**
  - 파일: `AuthForm.tsx`, `storage.ts`
  - 현재: `tilko_selected_auth_type` 직접 사용
  - 수정: `STORAGE_KEYS`에 상수 추가하여 관리
  - 검증: 모든 로컬 스토리지 접근이 상수를 통해 이루어지는지 확인

### Phase 2: 인증 방식 전달 검증 강화

#### 2.1 프론트엔드 검증
- [ ] **인증 방식 전달 전 최종 검증**
  - 파일: `AuthForm.tsx` (라인 2047-2085)
  - 현재: 로그만 있고 검증 없음
  - 수정:
    ```typescript
    // 유효한 인증 방식인지 검증
    const VALID_AUTH_TYPES = ['0', '4', '6'];
    if (!VALID_AUTH_TYPES.includes(finalAuthTypeForRequest)) {
      console.error('❌ [세션시작] 유효하지 않은 인증 방식:', finalAuthTypeForRequest);
      setError('인증 방식을 다시 선택해주세요.');
      setLoading(false);
      return;
    }
    
    // state와 전달값 불일치 시 경고
    if (finalAuthTypeForRequest !== selectedAuthType) {
      console.warn('⚠️ [세션시작] 인증 타입 불일치:', {
        state: selectedAuthType,
        전달값: finalAuthTypeForRequest
      });
      // 사용자에게 확인 요청 또는 state 업데이트
    }
    ```
  - 검증: 유효하지 않은 값 전달 시 에러 표시 확인

- [ ] **인증 방식 선택 완료 확인**
  - 파일: `AuthForm.tsx` (라인 2430-2435)
  - 현재: 기본값 '0'이면 선택 안 된 것으로 간주
  - 수정:
    - 인증 방식 선택 단계에서 명시적으로 선택했는지 확인
    - 선택 안 했으면 다음 단계로 진행 불가
  - 검증: 선택 없이 진행 시도 시 에러 메시지 확인

#### 2.2 백엔드 검증
- [ ] **세션 시작 시 인증 방식 검증**
  - 파일: `backend/app/api/v1/endpoints/tilko_auth.py` (라인 151-218)
  - 현재: `str(request.private_auth_type).strip()` 만 처리
  - 수정:
    ```python
    # 인증 방식 검증
    VALID_AUTH_TYPES = ['0', '4', '6']
    private_auth_type = str(request.private_auth_type).strip()
    
    if private_auth_type not in VALID_AUTH_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 인증 방식입니다: {private_auth_type}. 지원되는 방식: {VALID_AUTH_TYPES}"
        )
    
    # 필수 필드로 처리 (기본값 없음)
    if not private_auth_type:
        raise HTTPException(
            status_code=400,
            detail="인증 방식을 선택해주세요."
        )
    ```
  - 검증: 잘못된 인증 방식 전달 시 400 에러 반환 확인

- [ ] **simple-auth 호출 시 기본값 제거**
  - 파일: `backend/app/api/v1/endpoints/tilko_auth.py` (라인 267)
  - 현재: `user_info.get("private_auth_type", "0")` - 기본값 '0' 강제
  - 수정:
    ```python
    # 기본값 없이 필수 필드로 처리
    private_auth_type = user_info.get("private_auth_type")
    if not private_auth_type:
        error_msg = "세션에 저장된 인증 방식이 없습니다. 다시 시작해주세요."
        print(f"❌ [simple-auth] {error_msg}")
        session_manager.add_error_message(session_id, error_msg)
        session_manager.update_session_status(session_id, "error", error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    
    private_auth_type = str(private_auth_type).strip()
    
    # 유효성 검증
    VALID_AUTH_TYPES = ['0', '4', '6']
    if private_auth_type not in VALID_AUTH_TYPES:
        error_msg = f"유효하지 않은 인증 방식입니다: {private_auth_type}"
        print(f"❌ [simple-auth] {error_msg}")
        session_manager.add_error_message(session_id, error_msg)
        session_manager.update_session_status(session_id, "error", error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    ```
  - 검증: 세션에 인증 방식이 없으면 에러 반환 확인

- [ ] **틸코 API 호출 전 최종 로그 강화**
  - 파일: `backend/app/api/v1/endpoints/tilko_auth.py` (라인 275-280)
  - 현재: 로그만 있음
  - 수정:
    ```python
    print(f"🚨 [틸코API최종검증] simple_auth 호출 전 최종 확인:")
    print(f"   - 세션 ID: {session_id}")
    print(f"   - 사용자: {user_info['name']}")
    print(f"   - 인증방법: {auth_type_name} (코드: {private_auth_type})")
    print(f"   - 세션에 저장된 값: {user_info.get('private_auth_type')}")
    print(f"   - 최종 전달값: {private_auth_type}")
    print(f"   - 유효성 검증: {'✅ 통과' if private_auth_type in VALID_AUTH_TYPES else '❌ 실패'}")
    ```
  - 검증: 각 단계별 로그에서 정확한 값 확인 가능

### Phase 3: 입력값 처리 개선

#### 3.1 State 우선 사용으로 변경
- [ ] **DOM 읽기 제거, State 우선 사용**
  - 파일: `AuthForm.tsx` (라인 1863-1883)
  - 현재: DOM > 히스토리 > state 순서
  - 수정:
    ```typescript
    // State 우선, DOM은 보조
    const finalName = (
      editableName?.trim() || 
      nameInput?.value?.trim() || 
      confirmationData.name?.trim() || 
      ''
    ).trim();
    
    const finalPhone = (
      editablePhone?.trim() || 
      phoneInput?.value?.trim() || 
      confirmationData.phone?.trim() || 
      ''
    ).trim();
    
    const finalBirthday = (
      editableBirthday?.trim() || 
      birthdayInput?.value?.trim() || 
      confirmationData.birthday?.trim() || 
      patient?.birthday?.trim() || 
      ''
    ).trim();
    ```
  - 검증: State 값이 있으면 항상 State 값 사용 확인

- [ ] **입력 필드 변경 시 즉시 State 업데이트**
  - 파일: `AuthForm.tsx`
  - 현재: 입력 필드와 state 동기화 불확실
  - 수정:
    - 각 입력 필드에 `onChange` 핸들러 추가
    - 입력 즉시 state 업데이트
    - `handleAllConfirmed`에서는 state만 사용
  - 검증: 입력 후 state에 즉시 반영되는지 확인

#### 3.2 입력값 검증 강화
- [ ] **각 단계 이동 전 검증 추가**
  - 파일: `AuthForm.tsx` (라인 2227-2454)
  - 현재: `handleNextStep`에서 일부 검증만
  - 수정:
    ```typescript
    const validateStep = (step: string): boolean => {
      if (step === 'name') {
        const name = editableName?.trim() || '';
        if (!name || name.length < 2) {
          setError('이름을 입력해주세요. (2자 이상)');
          return false;
        }
      } else if (step === 'phone') {
        const phone = editablePhone?.trim() || '';
        const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
        if (!phone || !phoneRegex.test(phone.replace(/-/g, ''))) {
          setError('올바른 전화번호 형식을 입력해주세요.');
          return false;
        }
      } else if (step === 'birthday') {
        const birthday = editableBirthday?.trim() || '';
        if (!birthday || birthday.length !== 8 || !/^\d{8}$/.test(birthday)) {
          setError('생년월일을 8자리 숫자로 입력해주세요. (예: 19810927)');
          return false;
        }
      }
      return true;
    };
    ```
  - 검증: 각 단계에서 잘못된 값 입력 시 에러 메시지 확인

- [ ] **공통 검증 함수 생성**
  - 파일: `AuthForm.tsx` 또는 별도 유틸 파일
  - 현재: 여러 곳에서 개별 검증
  - 수정:
    ```typescript
    const validateAuthInput = (input: {
      name?: string;
      phone?: string;
      birthday?: string;
    }): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      
      if (input.name) {
        const name = input.name.trim();
        if (name.length < 2 || name.length > 10) {
          errors.push('이름은 2-10자로 입력해주세요.');
        }
      }
      
      if (input.phone) {
        const phone = input.phone.replace(/-/g, '');
        const phoneRegex = /^01[0-9][0-9]{7,8}$/;
        if (!phoneRegex.test(phone)) {
          errors.push('올바른 전화번호 형식을 입력해주세요.');
        }
      }
      
      if (input.birthday) {
        const birthday = input.birthday.trim();
        if (birthday.length !== 8 || !/^\d{8}$/.test(birthday)) {
          errors.push('생년월일을 8자리 숫자로 입력해주세요.');
        } else {
          // 날짜 유효성 검증
          const year = parseInt(birthday.substring(0, 4));
          const month = parseInt(birthday.substring(4, 6));
          const day = parseInt(birthday.substring(6, 8));
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            errors.push('올바른 날짜를 입력해주세요.');
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    };
    ```
  - 검증: 모든 검증이 통일된 함수로 처리되는지 확인

### Phase 4: 환자 정보 조회 실패 처리

#### 4.1 프론트엔드 에러 처리
- [ ] **환자 정보 API 실패 시 명확한 에러 메시지**
  - 파일: `AuthForm.tsx` (라인 472-476)
  - 현재: 에러 처리 없음
  - 수정:
    ```typescript
    useEffect(() => {
      if (uuid && hospitalId && !patient) {
        actions.loadPatientData(uuid, hospitalId, { force: false })
          .catch((error) => {
            console.error('❌ [환자정보] 로드 실패:', error);
            setError('환자 정보를 불러올 수 없습니다. URL을 확인해주세요.');
            setShowErrorModal(true);
          });
      }
    }, [uuid, hospitalId, patient, actions]);
    ```
  - 검증: API 실패 시 에러 모달 표시 확인

- [ ] **patient가 null인 경우 인증 진행 차단**
  - 파일: `AuthForm.tsx` (라인 1813-1991)
  - 현재: patient 없어도 진행 시도
  - 수정:
    ```typescript
    const handleAllConfirmed = useCallback(async () => {
      // patient 필수 체크
      if (!patient || !patient.uuid) {
        setError('환자 정보가 없습니다. 처음부터 다시 시작해주세요.');
        setShowErrorModal(true);
        return;
      }
      // ... 나머지 로직
    }, [patient, ...]);
    ```
  - 검증: patient 없을 때 인증 시작 불가 확인

#### 4.2 백엔드 에러 응답 개선
- [ ] **환자 정보 조회 API 에러 응답 개선**
  - 파일: `backend/app/api/v1/endpoints/patients.py` (라인 51-100)
  - 현재: 404 에러만 반환
  - 수정:
    ```python
    @router.get("/{patient_uuid}", response_model=PatientResponse)
    async def get_patient(...):
        try:
            patient = await patient_service.get_patient_by_uuid(patient_uuid)
            
            if not patient:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": "환자를 찾을 수 없습니다",
                        "message": f"UUID {patient_uuid}에 해당하는 환자 정보가 없습니다.",
                        "suggestion": "URL을 확인하거나 관리자에게 문의해주세요."
                    }
                )
            
            # 필수 필드 검증
            if not patient.info.name:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "환자 정보 불완전",
                        "message": "환자 이름이 없습니다.",
                        "field": "name"
                    }
                )
            
            # ... 나머지 로직
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "서버 오류",
                    "message": f"환자 정보 조회 중 오류가 발생했습니다: {str(e)}"
                }
            )
    ```
  - 검증: 각 에러 케이스별 명확한 메시지 확인

---

## 🧪 테스트 시나리오

### 시나리오 1: 로컬 스토리지 정리 테스트
1. 이전에 통신사Pass('4') 선택한 상태
2. 새로 접속
3. 예상: 기본값 '0' (카카오톡)으로 시작
4. 검증: localStorage 확인 및 화면 확인

### 시나리오 2: 인증 방식 전달 테스트
1. 통신사Pass('4') 선택
2. 인증 시작
3. 예상: 
   - 프론트엔드 로그: `private_auth_type: '4'`
   - 백엔드 로그: `private_auth_type: '4'`
   - 틸코 API 호출: `PrivateAuthType: '4'`
4. 검증: 각 단계별 로그 확인

### 시나리오 3: 입력값 검증 테스트
1. 이름만 입력하고 다음 단계 이동 시도
2. 예상: "전화번호를 입력해주세요" 에러
3. 생년월일 없이 인증 시작 시도
4. 예상: "생년월일을 입력해주세요" 에러
5. 검증: 각 단계별 에러 메시지 확인

### 시나리오 4: 환자 정보 없음 테스트
1. 존재하지 않는 UUID로 접속
2. 예상: "환자 정보를 찾을 수 없습니다" 에러 모달
3. 인증 진행 불가 확인
4. 검증: 에러 모달 표시 및 인증 버튼 비활성화 확인

---

## 📋 단계별 테스트 로그 확인 포인트

### 1단계: 인증 페이지 진입 시

#### 프론트엔드 로그 (브라우저 콘솔)
```
🔄 [인증페이지-{componentId}] AuthForm 마운트 - 플로팅 버튼 플래그 초기화
🔄 [인증페이지-{componentId}] AuthForm 완전 마운트됨 - 모든 useEffect 활성화
🔄 [StorageManager] 인증 페이지 초기화 - 인증 방식 선택 리셋
🔄 [인증페이지-{componentId}] 인증 방식 선택 리셋 완료 - 기본값 '0' (카카오톡)으로 시작
```

**확인 사항:**
- ✅ `resetAuthPage()` 호출 확인
- ✅ 인증 방식이 기본값 '0'으로 리셋되는지 확인
- ✅ localStorage에서 `tilko_selected_auth_type` 제거 확인
- ⚠️ localStorage 사용 불가 시: "⚠️ [인증페이지] localStorage 사용 불가 - 메모리 모드로 동작" 로그 확인

---

### 2단계: 인증 방식 선택 시

#### 프론트엔드 로그 (브라우저 콘솔)
```
🔘 [인증방법선택] 사용자가 선택: { value: '4', label: '통신사Pass', previousValue: '0' }
💾 [인증방법선택] localStorage에 저장: 4
또는
💾 [인증방법선택] 메모리에 저장 (localStorage 사용 불가): 4
```

**확인 사항:**
- ✅ 선택한 인증 방식 값이 정확한지 확인 ('0', '4', '6')
- ✅ localStorage 저장 성공 여부 확인
- ⚠️ 저장 실패 시 메모리 저장 확인

---

### 3단계: 정보 확인 완료 후 인증 시작

#### 프론트엔드 로그 (브라우저 콘솔)
```
🔍 [handleAllConfirmed] 인증 방법 확인: {
  state: '4',
  메모리: '4',
  localStorage: '4',
  confirmationData: undefined,
  DOM: undefined,
  최종결정: '4',
  스토리지모드: 'localStorage' 또는 '메모리'
}

📤 [세션시작] 요청 데이터: {
  private_auth_type: '4',
  private_auth_type_name: '통신사Pass',
  selectedAuthType_원본값: '4',
  selectedAuthType_타입: 'string',
  finalAuthTypeForRequest: '4',
  user_name: '홍길동',
  birthdate: '19810927 (길이: 8)',
  phone_no: '***',
  gender: 'M',
  patient_uuid: 'xxx',
  hospital_id: 'xxx'
}

⚠️ [세션시작] 인증 타입 불일치 감지: { state: '4', 전달값: '4' }  // 불일치 시에만 표시
```

**확인 사항:**
- ✅ 최종 결정된 인증 방식이 선택한 값과 일치하는지 확인
- ✅ state, 메모리, localStorage 값이 모두 일치하는지 확인
- ✅ `private_auth_type`이 정확히 전달되는지 확인
- ⚠️ 불일치 경고가 발생하지 않는지 확인

---

### 4단계: 백엔드 세션 시작 API

#### 백엔드 로그 (PM2 로그 또는 터미널)
```
📥 [세션시작] 받은 요청 데이터:
   - user_name: 홍길동
   - birthdate: 19810927 (타입: <class 'str'>, 길이: 8)
   - phone_no: 010*** (마스킹)
   - gender: M
   - private_auth_type: 4 (타입: <class 'str'>)

💾 [세션생성] 저장할 user_info:
   - name: 홍길동
   - birthdate: 19810927 (길이: 8)
   - phone_no: 010*** (마스킹)
   - gender: M
   - private_auth_type: '4' (타입: <class 'str'>)
```

**확인 사항:**
- ✅ `private_auth_type`이 문자열 '4'로 전달되는지 확인
- ✅ 세션에 저장되는 값이 '4'인지 확인
- ❌ 기본값 '0'이 저장되지 않는지 확인
- ❌ 유효하지 않은 값 전달 시 400 에러 반환 확인

---

### 5단계: 백엔드 simple-auth 호출

#### 백엔드 로그 (PM2 로그 또는 터미널)
```
📋 [simple-auth] 세션에서 가져온 user_info:
   - name: 홍길동
   - birthdate: 19810927 (타입: <class 'str'>, 길이: 8)
   - phone_no: 010*** (마스킹)
   - private_auth_type: 4 (타입: <class 'str'>)

🚨 [틸코API최종검증] simple_auth 호출 전 최종 확인:
   - 세션 ID: {session_id}
   - 사용자: 홍길동
   - 인증방법: 통신사Pass (코드: 4)
   - 세션에 저장된 값: 4
   - 최종 전달값: 4
   - 유효성 검증: ✅ 통과

🔍 [틸코API] simple_auth 파라미터:
   - private_auth_type: '4'
   - user_name: '홍길동'
   - birthdate: '19810927' (길이: 8)
   - phone_no: '010***' (마스킹)

🔍 [틸코API] simple_auth 호출 - 사용자: 홍길동, 인증방법: 통신사Pass (타입: 4)
```

**확인 사항:**
- ✅ 세션에서 가져온 `private_auth_type`이 '4'인지 확인
- ✅ 최종 검증 로그에서 '4' 확인
- ✅ 틸코 API 호출 파라미터에 '4' 전달되는지 확인
- ❌ 기본값 '0'으로 fallback되지 않는지 확인
- ❌ 세션에 값이 없으면 에러 반환 확인

---

### 6단계: 틸코 API 응답

#### 백엔드 로그 (PM2 로그 또는 터미널)
```
🔍 [틸코API] simple_auth 응답: { Status: 'OK', ResultData: {...} }
🔍 [틸코API] Status 값: 'OK'
🔍 [틸코API] 전체 키들: ['Status', 'ResultData', ...]

🚨 [틸코검증] 틸코 Status 확인: 'OK'
🚨 [틸코검증] CxId 확인: '{cx_id}'

✅ [틸코성공] 카카오톡 인증 메시지 발송 성공 - CxId: {cx_id}
또는
✅ [틸코성공] 통신사Pass 인증 메시지 발송 성공 - CxId: {cx_id}
또는
✅ [틸코성공] 네이버 인증 메시지 발송 성공 - CxId: {cx_id}
```

**확인 사항:**
- ✅ Status가 'OK'인지 확인
- ✅ CxId가 정상적으로 반환되는지 확인
- ✅ 인증 방식에 맞는 메시지가 표시되는지 확인

---

### 7단계: 입력값 검증 로그

#### 프론트엔드 로그 (브라우저 콘솔) - 이름 단계
```
📝 [handleNextStep] 이름 확인 (버튼 클릭 시점): {
  nameInput값: '홍길동',
  editableName: '홍길동',
  finalName: '홍길동',
  모든입력필드: [...]
}

⚠️ [handleNextStep] 이름이 입력되지 않았습니다.  // 에러 시
또는
⚠️ [handleNextStep] 이름 형식이 올바르지 않습니다: {입력값}  // 에러 시
```

#### 프론트엔드 로그 - 전화번호 단계
```
📞 [handleNextStep] 전화번호 확인 (버튼 클릭 시점): {
  phoneInput값: '010-1234-5678',
  phoneInput존재: true,
  editablePhone: '010-1234-5678',
  finalPhone: '01012345678'
}

⚠️ [handleNextStep] 전화번호가 입력되지 않았습니다.  // 에러 시
또는
⚠️ [handleNextStep] 전화번호 형식이 올바르지 않습니다: {입력값}  // 에러 시
```

#### 프론트엔드 로그 - 생년월일 단계
```
📅 [handleNextStep] 생년월일 확인 (버튼 클릭 시점): {
  birthdayInput값: '19810927',
  birthdayInput존재: true,
  editableBirthday: '19810927',
  finalBirthday: '19810927',
  모든입력필드: [...]
}

⚠️ [handleNextStep] 생년월일이 입력되지 않았습니다.  // 에러 시
또는
⚠️ [handleNextStep] 생년월일 형식이 올바르지 않습니다: {입력값}  // 에러 시
또는
⚠️ [handleNextStep] 생년월일 년도가 유효하지 않습니다: {year}  // 에러 시
또는
⚠️ [handleNextStep] 생년월일 날짜가 유효하지 않습니다: {year, month, day}  // 에러 시
```

**확인 사항:**
- ✅ 각 단계에서 입력값이 정확히 읽히는지 확인
- ✅ 검증 실패 시 명확한 에러 메시지 표시 확인
- ✅ 다음 단계로 진행되지 않는지 확인

---

### 8단계: 환자 정보 조회 실패 로그

#### 프론트엔드 로그 (브라우저 콘솔)
```
📋 [인증페이지-{componentId}] 환자 데이터 없음 - 로드 시작: {uuid} @ {hospitalId}
❌ [인증페이지-{componentId}] 환자 정보 로드 실패: {error}
또는
❌ [인증페이지-{componentId}] 필수 파라미터 누락 - uuid: {uuid}, hospitalId: {hospitalId}
```

#### 백엔드 로그 (PM2 로그 또는 터미널)
```
🔍 [API DEBUG] 환자 조회 시작 - UUID: {uuid}
🔍 [API DEBUG] 환자 조회 결과: None
또는
HTTPException: 404 - 환자를 찾을 수 없습니다: {uuid}
```

**확인 사항:**
- ✅ 에러 메시지가 명확하게 표시되는지 확인
- ✅ 인증 진행이 차단되는지 확인
- ✅ 에러 모달이 표시되는지 확인

---

## 🔍 로그 확인 방법

### 프론트엔드 로그 확인
1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭 선택
3. 필터링: `[인증페이지]`, `[세션시작]`, `[인증방법선택]`, `[handleAllConfirmed]` 등으로 검색
4. 로그 시간순으로 확인

### 백엔드 로그 확인
```bash
# PM2 로그 확인 (최신 로그만)
tail -100 /root/.pm2/logs/Todayon-BE-out.log | grep -E "(세션시작|simple-auth|private_auth_type|인증방법|틸코API)"

# 실시간 로그 모니터링
pm2 logs Todayon_BE --lines 0

# 특정 키워드로 필터링
tail -200 /root/.pm2/logs/Todayon-BE-out.log | grep "private_auth_type"
```

---

## ✅ 로그 확인 체크리스트

### 인증 방식 전달 플로우 확인
- [ ] **1단계**: 인증 페이지 진입 시 리셋 로그 확인
- [ ] **2단계**: 인증 방식 선택 시 저장 로그 확인
- [ ] **3단계**: `handleAllConfirmed`에서 최종 결정 로그 확인
- [ ] **4단계**: 백엔드 세션 시작 API 로그에서 `private_auth_type: '4'` 확인
- [ ] **5단계**: 백엔드 simple-auth 호출 전 최종 검증 로그에서 '4' 확인
- [ ] **6단계**: 틸코 API 호출 파라미터에 '4' 전달 확인

### 입력값 검증 확인
- [ ] 이름 단계: 입력값 읽기 및 검증 로그 확인
- [ ] 전화번호 단계: 형식 검증 로그 확인
- [ ] 생년월일 단계: 날짜 유효성 검증 로그 확인

### 에러 처리 확인
- [ ] 환자 정보 조회 실패 시 에러 로그 확인
- [ ] 인증 방식 누락 시 에러 로그 확인
- [ ] 입력값 검증 실패 시 에러 로그 확인

---

## 🚨 문제 발생 시 확인할 로그

### 인증 방식이 '0'으로 강제되는 경우
1. **프론트엔드**: `handleAllConfirmed` 로그에서 `최종결정` 값 확인
2. **백엔드**: `[세션시작]` 로그에서 `private_auth_type` 값 확인
3. **백엔드**: `[틸코API최종검증]` 로그에서 `최종 전달값` 확인
4. **백엔드**: `[틸코API] simple_auth 파라미터` 로그에서 `private_auth_type` 확인

### 입력값이 전달되지 않는 경우
1. **프론트엔드**: `handleNextStep` 로그에서 각 단계별 입력값 확인
2. **프론트엔드**: `handleAllConfirmed` 로그에서 `최종결정값` 확인
3. **백엔드**: `[세션시작]` 로그에서 받은 요청 데이터 확인

### localStorage 실패 시
1. **프론트엔드**: "⚠️ localStorage 사용 불가 - 메모리 모드로 동작" 로그 확인
2. **프론트엔드**: "💾 메모리에 저장" 로그 확인
3. **프론트엔드**: `스토리지모드: '메모리'` 확인

---

## 📝 수정 우선순위

### 🔴 긴급 (즉시 수정)
1. **백엔드 기본값 '0' 제거** (Phase 2.2)
2. **인증 방식 전달 검증** (Phase 2.1, 2.2)

### 🟡 중요 (빠른 시일 내)
3. **로컬 스토리지 정리** (Phase 1)
4. **입력값 검증 강화** (Phase 3.2)

### 🟢 개선 (여유 있을 때)
5. **State 우선 사용** (Phase 3.1)
6. **환자 정보 에러 처리** (Phase 4)

---

## 🔧 작업 시작 전 체크리스트

- [ ] 현재 코드베이스 백업
- [ ] 테스트 환경 준비 (개발 서버 실행)
- [ ] 브라우저 개발자 도구 준비 (로컬 스토리지 확인용)
- [ ] 백엔드 로그 확인 방법 준비
- [ ] 각 Phase별 테스트 시나리오 준비

---

## 📌 참고 파일 목록

### 프론트엔드
- `planning-platform/frontend/src/components/AuthForm.tsx` - 메인 인증 폼 (4321 라인)
- `planning-platform/frontend/src/constants/storage.ts` - 스토리지 관리

### 백엔드
- `planning-platform/backend/app/api/v1/endpoints/tilko_auth.py` - 틸코 인증 API
- `planning-platform/backend/app/api/v1/endpoints/patients.py` - 환자 정보 API
- `planning-platform/backend/app/utils/tilko_utils.py` - 틸코 유틸리티

---

## ✅ 완료 체크리스트

- [ ] Phase 1 완료
- [ ] Phase 2 완료
- [ ] Phase 3 완료
- [ ] Phase 4 완료
- [ ] 통합 테스트 완료
- [ ] 사용자 테스트 완료

