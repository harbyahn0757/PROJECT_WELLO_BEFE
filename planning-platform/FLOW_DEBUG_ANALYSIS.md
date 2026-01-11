# 입력 필드 문제 및 인증 플로우 전체 분석

## 🚨 현재 문제

### 1. 이름 입력 필드가 작동하지 않음
- 사용자가 "인증하고 내 검진추이 확인하기" 버튼 클릭
- 이름 입력 화면은 보이지만 **입력이 안됨**

### 2. 가능한 원인

#### 원인 A: 렌더링 조건 문제
```typescript
// Line 3870
if (showConfirmation && !authRequested) {
  return (
    // ... 입력 화면
  );
}
```
- `showConfirmation`은 true로 설정됨
- **BUT** `authRequested`가 이미 true일 경우 입력 화면이 렌더링되지 않음

#### 원인 B: 자동 업데이트 로직 간섭 (Line 832-892)
```typescript
useEffect(() => {
  if (showConfirmation && currentConfirmationStep === 'name' && (layoutConfig?.title || patient)) {
    if (isNameManuallyEdited.current) {
      return; // 사용자가 직접 수정한 경우 중단
    }
    
    // layoutConfig.title에서 이름 추출 시도
    if (layoutConfig?.title && layoutConfig.title.includes('님')) {
      const extractedName = layoutConfig.title.split('님')[0].trim();
      // ... 자동으로 editableName 업데이트
    }
  }
}, [layoutConfig?.title, patient, showConfirmation, currentConfirmationStep, editableName]);
```
- `layoutConfig.title`이나 `patient` 데이터가 변경될 때마다 실행
- `editableName`을 자동으로 업데이트하면서 **사용자 입력을 덮어쓸 수 있음**
- `isNameManuallyEdited.current`가 false인 경우 계속 덮어씀

#### 원인 C: 입력 복구 로직 충돌 (Line 1121-1143)
```typescript
useEffect(() => {
  const savedInput = StorageManager.getItem<LoginInputData>(STORAGE_KEYS.LOGIN_INPUT_DATA);
  if (savedInput && savedInputData.currentStep && !showConfirmation) {
    // ... 복구 로직
    setShowConfirmation(true);
    setCurrentConfirmationStep('birthday'); // ❌ 'name'이 아님!
  }
}, [editableName, editablePhone, editableBirthday, showConfirmation]);
```
- localStorage에 저장된 데이터를 복구하면서 `currentConfirmationStep`을 'birthday'로 설정
- 사용자는 'name' 단계를 기대하지만 실제로는 'birthday' 단계일 수 있음

#### 원인 D: input disabled 상태
- handleKakaoAuth 등에서 인증 요청 후 입력 필드를 disabled 처리 (Line 3293-3297)
- 세션 복구 시에도 disabled 처리 (Line 3551-3556)

---

## 🔍 전체 플로우 확인

### 플로우 1: 플로팅 버튼 클릭 → 이름 입력
```
1. 사용자: "인증하고 내 검진추이 확인하기" 버튼 클릭
   ↓
2. App.tsx: handleAuthClick() 호출
   - location.pathname === '/welno/login' 확인
   - window.welnoAuthForm.startInfoConfirmation() 호출
   ↓
3. AuthForm.tsx: startInfoConfirmation() 실행 (Line 3472-3485)
   if (!termsAgreed) {
     setShowTermsModal(true);
     return; // 약관 동의 먼저
   }
   setShowConfirmation(true);
   setCurrentConfirmationStep('name');
   StorageManager.setItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
   ↓
4. AuthForm.tsx: 렌더링 조건 확인 (Line 3870)
   if (showConfirmation && !authRequested) {
     // 입력 화면 렌더링
   }
   ↓
5. 이름 입력 필드 렌더링 (Line 3958-3995)
   {currentConfirmationStep === 'name' && (
     <input
       type="text"
       value={editableName}
       onChange={(e) => {
         isNameManuallyEdited.current = true;
         setEditableName(e.target.value);
       }}
       placeholder="이름을 입력하세요"
     />
   )}
```

### 🚨 문제 지점 체크리스트
1. [ ] `authRequested`가 이미 true인가?
2. [ ] `showConfirmation`이 실제로 true인가?
3. [ ] `currentConfirmationStep`이 'name'인가?
4. [ ] `editableName`이 자동 업데이트로 덮어써지는가?
5. [ ] 입력 필드가 disabled 상태인가?
6. [ ] localStorage 복구 로직이 간섭하는가?

---

## 🔧 디버깅 전략

### 1단계: 상태 로그 추가
- `showConfirmation`, `authRequested`, `currentConfirmationStep` 값 확인
- 플로팅 버튼 클릭 시점부터 모든 state 변경 추적

### 2단계: 자동 업데이트 로직 비활성화
- Line 832-892의 `useEffect` 조건 강화
- `isNameManuallyEdited.current`를 항상 true로 초기화

### 3단계: 입력 복구 로직 수정
- Line 1121-1143에서 `currentConfirmationStep`을 'birthday'가 아닌 'name'으로 시작
- 혹은 복구 조건을 더 엄격하게 설정

### 4단계: 렌더링 조건 명확화
- `showConfirmation && !authRequested` 조건이 정확한지 확인
- `authRequested`가 예상치 않게 true로 설정되는 경우 방지

---

## 📝 수정 계획

### 수정 1: 입력 복구 로직 개선
```typescript
// Line 1121-1143
useEffect(() => {
  const savedInput = StorageManager.getItem<LoginInputData>(STORAGE_KEYS.LOGIN_INPUT_DATA);
  if (savedInput && !showConfirmation) {
    // 1시간 이상 지난 데이터는 무시
    const lastUpdated = StorageManager.getItem<string>(STORAGE_KEYS.LOGIN_INPUT_LAST_UPDATED);
    if (lastUpdated) {
      const age = Date.now() - new Date(lastUpdated).getTime();
      if (age > 60 * 60 * 1000) { // 1시간
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_LAST_UPDATED);
        return;
      }
    }
    
    // ✅ 항상 'name' 단계부터 시작
    setEditableName(savedInput.name || '');
    setEditablePhone(savedInput.phone || '');
    setEditableBirthday(savedInput.birthday || '');
    setShowConfirmation(true);
    setCurrentConfirmationStep('name'); // ✅ 수정
  }
}, [showConfirmation]);
```

### 수정 2: 자동 업데이트 비활성화 조건 추가
```typescript
// Line 832
useEffect(() => {
  if (showConfirmation && currentConfirmationStep === 'name' && (layoutConfig?.title || patient)) {
    // ✅ 추가: 이미 값이 있으면 자동 업데이트 안 함
    if (isNameManuallyEdited.current || editableName.trim() !== '') {
      return;
    }
    // ... 자동 업데이트 로직
  }
}, [layoutConfig?.title, patient, showConfirmation, currentConfirmationStep, editableName]);
```

### 수정 3: startInfoConfirmation 강화
```typescript
// Line 3472-3485
startInfoConfirmation: () => {
  console.log('[AuthForm] 정보 확인 시작 (직접 호출)');
  
  // 약관동의 확인
  if (!termsAgreed) {
    setShowTermsModal(true);
    return;
  }
  
  // ✅ authRequested 초기화 (이전 상태 리셋)
  setAuthRequested(false);
  setShowConfirmation(true);
  setCurrentConfirmationStep('name');
  
  // ✅ editableName이 비어있으면 초기화
  if (!editableName || editableName.trim() === '') {
    const savedInput = StorageManager.getItem<LoginInputData>(STORAGE_KEYS.LOGIN_INPUT_DATA);
    if (savedInput?.name) {
      setEditableName(savedInput.name);
    }
  }
  
  StorageManager.setItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
  window.dispatchEvent(new Event('localStorageChange'));
},
```

---

## ⚠️ 인증 완료 → 추이보기 플로우

### 1. 인증 완료 버튼 클릭
```
handleAuthCompleted() (Line 3320)
  ↓
폴링으로 상태 확인 (checkAuthStatus)
  ↓
result.status === 'authenticated'
  ↓
데이터 수집 API 호출
  ↓
성공 시: navigate('/welno/results-trend')
```

### 2. 경로 확인
- `navigate('/welno/results-trend')` (Line 3391)
- App.tsx 라우팅: `<Route path="/welno/results-trend" element={<ResultsTrendPage />} />`

### 3. 데이터 전달 확인
- UUID와 hospitalId가 세션에 저장되어 있어야 함
- URL 파라미터로 전달: `/welno/results-trend?uuid=...&hospital=...`

---

## 🎯 즉시 수정 사항

1. ✅ Line 1128: `setCurrentConfirmationStep('birthday')` → `setCurrentConfirmationStep('name')`
2. ✅ Line 834-892: 자동 업데이트 조건 강화 (`editableName.trim() !== ''` 추가)
3. ✅ Line 3472-3485: `setAuthRequested(false)` 추가로 이전 상태 리셋
4. ✅ 디버깅 로그 추가: state 변경 시마다 로그 출력
