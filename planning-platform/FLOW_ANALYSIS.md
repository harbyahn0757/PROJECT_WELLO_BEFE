# WELNO 전체 플로우 분석 (2025-01-05 최종)

## 🎯 핵심 수정 완료

### ✅ 수정 1: pendingNavigation 경로 수정 (MainPage.tsx)
```typescript
// 수정 전
setPendingNavigation(`/results-trend?uuid=...`);

// 수정 후
setPendingNavigation(`/welno/results-trend?uuid=...`);
```
- Line 604, 633, 642 모두 수정 완료
- 비밀번호 모달 성공 후 정상 navigate 가능

### ✅ 수정 2: 플로팅 버튼 메인 페이지 숨김 (App.tsx)
```typescript
// 메인 페이지에서는 플로팅 버튼 숨김
const isMainPage = location.pathname === '/welno' || location.pathname === '/welno/';
const shouldHide = ... || isMainPage;
```
- 메인 화면에서 플로팅 버튼 제거

---

## 📋 라우팅 구조

```
/welno (MainPage - 플로팅 버튼 없음)
├─ /welno/login (AuthForm - 플로팅 버튼: "인증하고 내 검진추이 확인하기")
├─ /welno/results-trend (HealthTrends - 플로팅 버튼: "상담예약 신청")
├─ /welno/survey/checkup-design (CheckupDesignPage)
└─ ... (기타)
```

---

## 🎴 메인 페이지 카드 클릭 플로우

### 검진결과추이 카드
```
1. URL 파라미터 확인 (uuid, hospital)
2. 없으면 → state.patient 확인
3. 없으면 → IndexedDB 확인
4. 있으면 → checkHasData 확인
   - 데이터 있음 → 비밀번호 체크 → /welno/results-trend 이동
   - 데이터 없음 → /welno/login 이동
5. 모두 없으면 → /welno/login 이동
```

### 검진설계 카드
```
1. uuid, hospital 있으면 → checkHasData 확인
   - 있으면 → /welno/survey/checkup-design 이동
   - 없으면 → 3초 대기 → /welno/login 이동
2. 없으면 → /welno/survey/checkup-design 직접 이동
```

---

## 🎈 플로팅 버튼 표시 규칙

### 숨김 조건
```typescript
1. location.pathname === '/welno' (메인 페이지)
2. isManualCollecting (수집 중)
3. isCollectingPath (수집 페이지)
4. passwordModalOpen (비밀번호 모달)
5. location.pathname.includes('/login') (로그인 페이지는 아님 - 표시됨)
```

### 경로별 버튼 텍스트
```
/welno              → 숨김
/welno/login        → "인증하고 내 검진추이 확인하기"
/welno/results-trend → "상담예약 신청"
기타                → "인증하고 내 검진추이 확인하기"
```

---

## 🌐 URL 시나리오

### 시나리오 1: `/welno` (파라미터 없음, 신규 사용자)
```
1. 메인 화면 렌더링 (플로팅 버튼 없음)
2. 카드 클릭
3. IndexedDB 확인 → 없음
4. /welno/login 이동
5. 플로팅 버튼 표시: "인증하고 내 검진추이 확인하기"
```

### 시나리오 2: `/welno` (파라미터 없음, 기존 사용자)
```
1. 메인 화면 렌더링 (플로팅 버튼 없음)
2. 카드 클릭
3. IndexedDB 확인 → 있음!
4. /welno/results-trend?uuid=xxx&hospital=yyy 직접 이동
5. 플로팅 버튼 표시: "상담예약 신청"
```

### 시나리오 3: `/welno?uuid=xxx&hospital=yyy` (파라미터 있음)
```
1. WelnoDataContext가 환자 데이터 자동 로드
2. 메인 화면 렌더링 (플로팅 버튼 없음)
3. state.patient 있음
4. 카드 클릭 → checkHasData → /welno/results-trend 이동
```

### 시나리오 4: 데이터 수집 완료 후
```
1. AuthForm에서 수집 완료
2. navigate('/welno/results-trend?uuid=xxx&hospital=yyy')
3. HealthTrends 페이지 렌더링
4. 플로팅 버튼: "상담예약 신청"
```

---

## 🚨 남은 문제점

### 1. FloatingButton의 Context 의존 (낮은 우선순위)
```typescript
// App.tsx Line 183-187
if (!patient) {
  navigate('/login');
  return;
}
// ❌ Context에 patient 없으면 항상 login으로
// → 하지만 메인에서는 이제 플로팅 버튼이 숨겨져 있으므로 큰 문제 없음
```

### 2. cleanupAllStorage 조건 (낮은 우선순위)
```typescript
// App.tsx Line 96-99
if (savedInput && !hasSession) {
  cleanupAllStorage();
}
// ❌ 사용자가 입력 중이던 데이터까지 삭제 가능
// → 하지만 1시간 이상 된 데이터만 삭제하므로 실제 문제는 적음
```

---

## ✅ 테스트 체크리스트

### 신규 사용자 테스트
- [ ] /welno 접속 → 플로팅 버튼 없는지 확인
- [ ] "검진결과추이" 카드 클릭 → /welno/login 이동
- [ ] 정보 입력 → 인증 → 수집 → /welno/results-trend 이동
- [ ] results-trend 페이지에서 플로팅 버튼: "상담예약 신청"

### 기존 사용자 (IndexedDB 있음) 테스트
- [ ] /welno 접속 → 플로팅 버튼 없는지 확인
- [ ] "검진결과추이" 카드 클릭 → /welno/results-trend 직접 이동
- [ ] 비밀번호 모달 표시 (필요 시)
- [ ] results-trend 페이지에서 플로팅 버튼: "상담예약 신청"

### 기존 사용자 (URL 파라미터 있음) 테스트
- [ ] /welno?uuid=xxx&hospital=yyy 접속
- [ ] 메인 화면에 환자명 표시
- [ ] 플로팅 버튼 없는지 확인
- [ ] "검진결과추이" 카드 클릭 → /welno/results-trend 이동
- [ ] 비밀번호 모달 우회 or 표시 (상황에 따라)

---

## 🔍 개발 서버 테스트

```bash
# 프론트엔드 개발 서버
포트: 9282
URL: http://localhost:9282/welno

# 백엔드 서버
포트: 9001 (PM2 관리)

# 테스트 방법
1. http://localhost:9282/welno 접속
2. 개발자 도구 열기
3. 콘솔에서 [플로팅버튼] 로그 확인
4. 메인 화면에서 플로팅 버튼 숨김 확인
5. /welno/login 이동 시 플로팅 버튼 표시 확인
```

---

생성일: 2025-01-05 최종
수정: 메인 페이지 플로팅 버튼 제거, pendingNavigation 경로 수정
