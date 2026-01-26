# 네비게이션 플로우 분석

## 문제 상황
- 첫 클릭: URL은 `page=payment`로 변경되지만 화면이 바뀌지 않음
- 두 번째 클릭: 결제 페이지로 이동

## 플로우 비교

### 경로 1: 약관 모달에서 동의 (onConfirm)
```
1. TermsAgreementModal.onConfirm 호출
2. saveTermsAgreement 실행 (비동기)
3. setShowTermsModal(false) - 모달 닫기
4. navigate(`/campaigns/disease-prediction?page=payment&...`) 호출
5. location.search 변경 → useEffect 재실행
6. checkUserStatus 실행
7. page 파라미터 확인 → setCurrentPage('payment')
8. 렌더링: LandingPage
```

### 경로 2: 약관 데이터 있어서 패스 (IntroLandingPage)
```
1. IntroLandingPage.handleButtonClick 실행
2. checkAllTermsAgreement 실행 (비동기)
3. needsAgreement === false → 약관 패스
4. navigate(`/campaigns/disease-prediction?page=payment&...`) 호출
5. location.search 변경 → useEffect 재실행
6. checkUserStatus 실행
7. page 파라미터 확인 → setCurrentPage('payment')
8. 렌더링: LandingPage
```

## 문제점 분석

### 타이밍 이슈
1. `navigate` 호출은 비동기적으로 `location.search`를 변경
2. `navigate` 직후에는 아직 `location.search`가 변경되지 않음
3. 첫 렌더링에서는 `currentPage`가 'intro'로 유지됨
4. 그 다음 `location.search`가 변경되면 `useEffect`가 다시 실행됨
5. 하지만 그 사이에 `IntroLandingPage`가 다시 렌더링될 수 있음

### useEffect 의존성 문제
- `useEffect`의 의존성 배열: `[navigate, location.search]`
- `location.search`가 변경되면 `checkUserStatus`가 다시 실행됨
- 하지만 `navigate` 직후에는 아직 `location.search`가 변경되지 않았을 수 있음

### 해결 방안
1. `navigate` 호출 직후 `setCurrentPage`를 직접 호출
2. `useEffect`에서 `page` 파라미터를 확인하는 로직을 개선
3. `navigate` 대신 `setCurrentPage`를 먼저 호출하고, 그 다음 `navigate` 호출
