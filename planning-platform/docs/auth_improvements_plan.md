# 인증 화면 개선 계획서

## 현재 상황 분석

### 1. 인증 방식 선택 후 알림 메시지 표시

**현재 상태:**
- 인증 방식 선택 후 `handleAllConfirmed` 함수가 호출되어 인증 요청이 시작됨
- `getCurrentStatusMessage` 함수에서 `auth_completed` 상태일 때만 인증 방식에 따른 메시지를 표시
- 인증 방식 선택 직후(`auth_method` 단계 완료 후)에는 별도 안내 메시지가 없음

**문제점:**
- 사용자가 인증 방식을 선택하고 "인증 시작하기" 버튼을 클릭한 직후, 어떤 인증 방식을 선택했는지 명확한 안내가 없음
- 현재는 `auth_completed` 상태에서만 메시지가 표시되어, 인증 요청 직후에는 안내가 부족함

**해결 방안:**
- `handleAllConfirmed` 함수에서 인증 요청 시작 직후, 선택한 인증 방식에 따른 안내 메시지를 즉시 표시
- `getCurrentStatusMessage` 함수에 `auth_requesting` 상태에 대한 인증 방식별 메시지 추가
- 타이핑 효과를 통해 사용자에게 선택한 인증 방식을 명확히 안내

**구현 위치:**
- `planning-platform/frontend/src/components/AuthForm.tsx`
  - `handleAllConfirmed` 함수 (1570라인 근처)
  - `getCurrentStatusMessage` 함수 (2200라인 근처)
  - `typeMessage` 함수 호출 추가

---

### 2. 처음 안내 화면 웰로 로고 미적용 문제

**현재 상태:**
- 초기 안내 화면(3147라인)에서 `splashIcon`을 사용 중
- 다른 인증 화면에서는 `WELLO_LOGO_IMAGE`를 사용 중
- 로고 이미지가 일관되지 않음

**문제점:**
```typescript
// 현재 코드 (3147라인)
<img 
  src={splashIcon}  // ❌ splashIcon 사용
  alt="아이콘" 
  style={{ 
    width: '32px', 
    height: '32px', 
    objectFit: 'contain' 
  }} 
/>
```

**해결 방안:**
- `splashIcon`을 `WELLO_LOGO_IMAGE`로 변경
- 다른 화면과 동일한 로고 이미지 사용 (2434라인, 2751라인 참조)
- 크기는 기존과 동일하게 유지 (32px → 64px로 변경 고려 가능)

**구현 위치:**
- `planning-platform/frontend/src/components/AuthForm.tsx` (3147라인)

---

### 3. 플로팅 버튼 하단 흰줄 문제

**현재 상태:**
- `_auth.scss`와 `App.scss`에서 이미 `::after`, `::before`를 `display: none`으로 설정
- `border-bottom: none` 설정도 완료
- `padding-bottom: 0` 설정도 완료

**문제점:**
- 스타일은 이미 제거되었지만, 여전히 흰줄이 보인다면:
  1. `floating-button-container` 부모 요소의 border/background
  2. Button 컴포넌트 내부 요소의 border/background
  3. 다른 CSS 규칙의 우선순위 문제
  4. 브라우저 기본 스타일

**원인 분석:**
```scss
// _auth.scss (21-34라인)
.questionnaire-container.tilko-login .floating-button-container {
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  // border 관련 스타일이 없음 - 추가 필요할 수 있음
}
```

**해결 방안:**
1. `floating-button-container`에 명시적으로 `border: none`, `border-bottom: none` 추가
2. Button 컴포넌트 내부의 모든 자식 요소에 대해 border 제거 확인
3. `box-shadow`가 하단에 그림자를 만들지 않도록 확인
4. `z-index` 문제로 인한 다른 요소와의 겹침 확인

**구현 위치:**
- `planning-platform/frontend/src/styles/_auth.scss` (21-34라인)
- `planning-platform/frontend/src/App.scss` (417-470라인)
- `planning-platform/frontend/src/components/Button.scss` (10-31라인)

---

## 구현 계획

### Phase 1: 인증 방식별 알림 메시지 추가

**작업 내용:**
1. `getCurrentStatusMessage` 함수에 `auth_requesting` 상태 처리 추가
2. 선택한 인증 방식에 따른 메시지 생성 로직 추가
3. `handleAllConfirmed` 함수에서 인증 요청 시작 직후 메시지 표시

**예상 메시지:**
- 카카오톡: "**카카오톡** 인증을 시작합니다.\n카카오톡 앱에서 인증을 완료해주세요."
- 통신사Pass: "**통신사Pass** 인증을 시작합니다.\nSKT/KT/LG U+ 앱에서 인증을 완료해주세요."
- 네이버: "**네이버** 인증을 시작합니다.\n네이버 앱에서 인증을 완료해주세요."

**파일:**
- `planning-platform/frontend/src/components/AuthForm.tsx`

---

### Phase 2: 웰로 로고 적용

**작업 내용:**
1. 초기 안내 화면의 `splashIcon`을 `WELLO_LOGO_IMAGE`로 변경
2. 로고 크기 조정 (32px → 64px로 변경 고려)
3. 다른 화면과 일관성 유지

**파일:**
- `planning-platform/frontend/src/components/AuthForm.tsx` (3147라인)

---

### Phase 3: 플로팅 버튼 하단 흰줄 제거

**작업 내용:**
1. `floating-button-container`에 명시적 border 제거 스타일 추가
2. Button 컴포넌트 내부 요소 확인 및 border 제거
3. 브라우저 개발자 도구로 실제 원인 확인 후 수정
4. 모든 관련 스타일 파일에서 일관성 있게 제거

**파일:**
- `planning-platform/frontend/src/styles/_auth.scss`
- `planning-platform/frontend/src/App.scss`
- `planning-platform/frontend/src/components/Button.scss`

---

## 테스트 시나리오

### 테스트 1: 인증 방식별 알림 메시지
1. 인증 화면 접속
2. 이름, 전화번호, 생년월일 확인
3. 인증 방식 선택 (카카오톡/통신사Pass/네이버)
4. "인증 시작하기" 버튼 클릭
5. **확인사항:** 선택한 인증 방식에 맞는 안내 메시지가 타이핑 효과로 표시되는지 확인

### 테스트 2: 웰로 로고 표시
1. 인증 화면 처음 접속
2. **확인사항:** 초기 안내 화면에 웰로 로고가 표시되는지 확인
3. 다른 인증 단계로 이동
4. **확인사항:** 모든 단계에서 동일한 웰로 로고가 표시되는지 확인

### 테스트 3: 플로팅 버튼 하단 흰줄
1. 인증 화면 접속
2. 플로팅 버튼 확인
3. **확인사항:** 플로팅 버튼 하단에 흰줄이 없는지 확인
4. 다양한 브라우저에서 테스트 (Chrome, Safari, Firefox)
5. 다양한 디바이스에서 테스트 (모바일, 태블릿, 데스크톱)

---

## 예상 작업 시간

- Phase 1: 30분
- Phase 2: 10분
- Phase 3: 20분 (원인 파악 시간 포함)

**총 예상 시간:** 1시간

---

## 우선순위

1. **높음:** 웰로 로고 적용 (사용자 경험 일관성)
2. **중간:** 인증 방식별 알림 메시지 (사용자 안내 개선)
3. **중간:** 플로팅 버튼 하단 흰줄 제거 (UI 완성도)

---

## 참고 파일

- `planning-platform/frontend/src/components/AuthForm.tsx`
- `planning-platform/frontend/src/styles/_auth.scss`
- `planning-platform/frontend/src/App.scss`
- `planning-platform/frontend/src/components/Button.scss`
- `planning-platform/frontend/src/constants/images.ts` (WELLO_LOGO_IMAGE 정의)

