# 데이터 수집 흐름 정리

## 전체 흐름

### 1. 인증 완료
- 사용자가 카카오톡/통신사Pass/네이버에서 인증 완료
- `auth_completed` 상태로 변경
- `tilko_auth_waiting` 플래그 설정

### 2. 약관 동의
- 약관 동의 모달 표시
- 사용자가 약관 동의 완료
- `handleTermsAgreed` 호출
- 서버에 약관 동의 저장
- `termsAgreed` 상태 true로 설정

### 3. 정보 확인 (선택적)
- 이름, 전화번호, 생년월일 확인
- `handleAllConfirmed` 호출
- 인증 요청 전송 (`SESSION_START` → `SIMPLE_AUTH`)

### 4. 데이터 수집 시작
- `handleManualDataCollection` 호출
- **로딩 스피너 시작** (`setLoading(true)`)
- `COLLECT_DATA` API 호출
- 상태: `manual_collecting` → `collecting`

### 5. 데이터 수집 진행
- 폴링 또는 WebSocket으로 상태 확인
- 상태별 진행:
  - `fetching_health_data`: 건강검진 데이터 수집 중
  - `fetching_prescription_data`: 처방전 데이터 수집 중
- **로딩 스피너 유지** (`loading: true`)

### 6. 데이터 수집 완료
- 상태: `completed` 또는 `data_completed`
- **로딩 스피너 종료** (`setLoading(false)`)
- 수집 완료 모달 표시
- 결과 페이지로 이동

## 스피너 관리

### 시작 시점
- `handleManualDataCollection` 시작 시: `setLoading(true)`

### 유지 시점
- 데이터 수집 진행 중: `loading: true` 유지
- 폴링 중: `loading: true` 유지

### 종료 시점
- 데이터 수집 완료 시: `setLoading(false)`
- 에러 발생 시: `setLoading(false)`
- 최대 폴링 횟수 초과 시: `setLoading(false)`
- WebSocket 완료 알림 수신 시: `setLoading(false)`

## 문제 해결

### 스피너가 중간에 깨지는 문제
- **원인**: 로딩 상태 관리가 일관되지 않음
- **해결**: 모든 완료/에러 경로에서 `setLoading(false)` 명시적 호출

