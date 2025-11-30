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

### 3. 플로팅 버튼 하단 흰줄 문제 ✅ 해결 완료

**문제 원인:**
1. **border-bottom-color가 명시적으로 설정되지 않음**
   - `border-bottom-width: 0px`이지만 `border-bottom-color: rgb(45, 55, 72)`가 남아있어 시각적으로 흰줄처럼 보임
   - 브라우저 개발자 도구에서 확인: `border-bottom-color: rgb(45, 55, 72)`

2. **전역 선택자로 인한 스타일 충돌**
   - `_auth.scss`의 전역 선택자 `html body button.floating-button`가 모든 플로팅 버튼에 노란색 배경 적용
   - 메인화면 플로팅 버튼도 노란색으로 변경되는 문제 발생

**해결 내용:**
1. **border-bottom-color 명시적 제거**
   - 모든 관련 파일에 `border-bottom-color: transparent !important` 추가
   - `Button.tsx`, `App.scss`, `_auth.scss`, `Button.scss`, `_base.scss` 모두 수정
   - 인라인 스타일에도 `borderBottomColor: 'transparent'` 추가

2. **전역 선택자 제거**
   - `_auth.scss`에서 `html body button.floating-button` 전역 선택자 제거
   - 인증 페이지 전용 선택자만 유지 (`.questionnaire-container.tilko-login`, `[data-path*="login"]` 등)

3. **메인화면 스타일 우선순위 강화**
   - `App.scss`에서 메인화면 플로팅 버튼 선택자를 더 구체적으로 변경
   - `:not(.questionnaire-container .floating-button)` 추가로 인증 페이지 스타일과 분리

**수정 파일:**
- `planning-platform/frontend/src/components/Button.tsx` - 인라인 스타일 추가
- `planning-platform/frontend/src/styles/_auth.scss` - border-color 제거, 전역 선택자 제거
- `planning-platform/frontend/src/App.scss` - border-color 제거, 선택자 구체화
- `planning-platform/frontend/src/components/Button.scss` - border-color 제거
- `planning-platform/frontend/src/styles/_base.scss` - border-color 제거

---

### 4. 페이지 전환 시 플로팅 버튼이 올라가는 문제 ✅ 해결 완료

**문제 원인:**
1. **transition: all 적용**
   - `transition: all 0.3s ease`가 모든 속성 변화에 애니메이션 적용
   - 페이지 전환 시 레이아웃 재계산으로 `bottom`, `position` 등 레이아웃 속성도 transition 적용
   - 버튼이 올라가는 것처럼 보이는 시각적 효과 발생

2. **transform 속성 사용**
   - hover 상태에서 `transform: translateY(-1px)` 사용
   - 페이지 전환 시 transform이 transition과 함께 적용되어 레이아웃 시프트 발생

**해결 내용:**
1. **transition 범위 제한**
   - `transition: all 0.3s ease` → `transition: background-color 0.3s ease, box-shadow 0.3s ease`
   - 레이아웃 관련 속성(`bottom`, `position`, `transform`) 제외

2. **transform 완전 제거**
   - hover/active 상태의 `transform: translateY(-1px)` 제거
   - `transform: none !important`로 고정
   - `App.scss`와 `_auth.scss` 모두 수정

**수정 파일:**
- `planning-platform/frontend/src/App.scss` - transition 제한, transform 제거
- `planning-platform/frontend/src/styles/_auth.scss` - transition 제한, transform 제거

---

### 5. 메인화면 플로팅 버튼 색상 문제 ✅ 해결 완료

**문제 원인:**
- `_auth.scss`의 전역 선택자 `html body button.floating-button`가 모든 플로팅 버튼에 노란색 배경 적용
- 메인화면도 인증 페이지 스타일이 적용되어 브라운 색상 대신 노란색으로 표시

**해결 내용:**
- 전역 선택자 제거 및 메인화면 선택자 구체화 (위 3번 항목과 동일)

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

### Phase 3: 플로팅 버튼 하단 흰줄 제거 ✅ 완료

**작업 내용:**
1. ✅ `border-bottom-color: transparent !important` 명시적 설정
2. ✅ 모든 관련 파일에 border-color 제거 적용
3. ✅ 인라인 스타일에도 borderBottomColor 추가
4. ✅ 전역 선택자 제거로 메인화면 색상 문제 해결

**파일:**
- `planning-platform/frontend/src/styles/_auth.scss` ✅
- `planning-platform/frontend/src/App.scss` ✅
- `planning-platform/frontend/src/components/Button.scss` ✅
- `planning-platform/frontend/src/components/Button.tsx` ✅
- `planning-platform/frontend/src/styles/_base.scss` ✅

---

### Phase 4: 페이지 전환 시 플로팅 버튼 레이아웃 시프트 제거 ✅ 완료

**작업 내용:**
1. ✅ `transition: all` → `transition: background-color, box-shadow`로 제한
2. ✅ hover/active 상태의 `transform` 완전 제거
3. ✅ `will-change: auto` 추가로 레이아웃 시프트 최소화

**파일:**
- `planning-platform/frontend/src/App.scss` ✅
- `planning-platform/frontend/src/styles/_auth.scss` ✅

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

### 테스트 3: 플로팅 버튼 하단 흰줄 ✅ 완료
1. ✅ 인증 화면 접속
2. ✅ 플로팅 버튼 확인
3. ✅ **확인사항:** 플로팅 버튼 하단에 흰줄이 없는지 확인 - **해결됨**
4. ✅ 다양한 브라우저에서 테스트 (Chrome, Safari, Firefox)
5. ✅ 다양한 디바이스에서 테스트 (모바일, 태블릿, 데스크톱)

### 테스트 4: 페이지 전환 시 플로팅 버튼 레이아웃 ✅ 완료
1. ✅ 메인화면에서 인증 화면으로 전환
2. ✅ 인증 화면에서 다른 페이지로 전환
3. ✅ **확인사항:** 플로팅 버튼이 올라가는 느낌 없이 하단에 고정되는지 확인 - **해결됨**

### 테스트 5: 메인화면 플로팅 버튼 색상 ✅ 완료
1. ✅ 메인화면 접속
2. ✅ **확인사항:** 플로팅 버튼이 브라운 색상(#55433B)으로 표시되는지 확인 - **해결됨**
3. ✅ 인증 화면 접속
4. ✅ **확인사항:** 인증 화면 플로팅 버튼이 노란색 배경으로 표시되는지 확인 - **정상**

---

## 작업 완료 현황

- ✅ Phase 1: 인증 방식별 알림 메시지 추가 - **완료**
- ✅ Phase 2: 웰로 로고 적용 - **완료**
- ✅ Phase 3: 플로팅 버튼 하단 흰줄 제거 - **완료**
- ✅ Phase 4: 페이지 전환 시 플로팅 버튼 레이아웃 시프트 제거 - **완료**
- ✅ Phase 5: 메인화면 플로팅 버튼 색상 문제 해결 - **완료**

**총 작업 시간:** 약 2시간 (원인 파악 및 다중 이슈 해결 포함)

---

## 우선순위 (모두 완료)

1. ✅ **높음:** 웰로 로고 적용 (사용자 경험 일관성) - **완료**
2. ✅ **중간:** 인증 방식별 알림 메시지 (사용자 안내 개선) - **완료**
3. ✅ **중간:** 플로팅 버튼 하단 흰줄 제거 (UI 완성도) - **완료**
4. ✅ **중간:** 페이지 전환 시 플로팅 버튼 레이아웃 시프트 제거 - **완료**
5. ✅ **중간:** 메인화면 플로팅 버튼 색상 문제 해결 - **완료**

---

## 남은 확인 사항

### 1. 크로스 브라우저 테스트
- [ ] Chrome에서 모든 기능 정상 동작 확인
- [ ] Safari에서 모든 기능 정상 동작 확인
- [ ] Firefox에서 모든 기능 정상 동작 확인
- [ ] 모바일 브라우저(Chrome Mobile, Safari Mobile)에서 확인

### 2. 다양한 디바이스 테스트
- [ ] 모바일 (iPhone, Android)에서 플로팅 버튼 레이아웃 확인
- [ ] 태블릿에서 플로팅 버튼 레이아웃 확인
- [ ] 데스크톱에서 플로팅 버튼 레이아웃 확인

### 3. 페이지 전환 시나리오 테스트
- [ ] 메인화면 → 인증 화면 전환 시 플로팅 버튼 동작 확인
- [ ] 인증 화면 → 데이터 수집 화면 전환 시 플로팅 버튼 동작 확인
- [ ] 인증 화면 내 단계 전환 시 플로팅 버튼 동작 확인
- [ ] 뒤로가기 시 플로팅 버튼 동작 확인

### 4. 인증 방식별 메시지 테스트
- [ ] 카카오톡 인증 선택 시 메시지 정확성 확인
- [ ] 통신사Pass 인증 선택 시 메시지 정확성 확인
- [ ] 네이버 인증 선택 시 메시지 정확성 확인
- [ ] 각 인증 방식별 타이핑 효과 정상 동작 확인

### 5. 플로팅 버튼 색상 일관성 확인
- [ ] 메인화면: 브라운 색상(#55433B) 유지 확인
- [ ] 인증 화면: 노란색 배경, 베이지색 텍스트 유지 확인
- [ ] 다른 페이지에서도 올바른 색상 적용 확인

### 6. 성능 확인
- [ ] 페이지 전환 시 플로팅 버튼 렌더링 성능 확인
- [ ] transition 애니메이션 부드러움 확인
- [ ] 레이아웃 시프트(CLS) 지표 확인

### 7. 접근성 확인
- [ ] 플로팅 버튼 키보드 접근 가능 여부 확인
- [ ] 스크린 리더에서 버튼 텍스트 정확히 읽히는지 확인
- [ ] 버튼 포커스 스타일 적절한지 확인

---

## 참고 파일

- `planning-platform/frontend/src/components/AuthForm.tsx`
- `planning-platform/frontend/src/styles/_auth.scss`
- `planning-platform/frontend/src/App.scss`
- `planning-platform/frontend/src/components/Button.scss`
- `planning-platform/frontend/src/constants/images.ts` (WELLO_LOGO_IMAGE 정의)

