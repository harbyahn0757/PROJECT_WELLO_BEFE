# 메인 페이지 코드 리뷰 및 개선 사항

## 완료된 작업

### 1. 스크롤 하단 처리
- ✅ 스크롤이 제일 아래로 내렸을 때 검진 예약하기 버튼과 제일 아래 아이템이 겹치지 않도록 조정
- ✅ 스크롤 이벤트 리스너 추가 (throttle 적용)
- ✅ 하단 카드 섹션 패딩 증가 (64px -> 5.5rem = 88px)

### 2. 부드러운 스크롤 효과
- ✅ `html` 요소에 `scroll-behavior: smooth` 추가
- ✅ 은은한 스크롤 효과 적용

### 3. 플로팅 버튼 개선
- ✅ 버튼 높이 조금 줄이기 (56px -> 48px)
- ✅ 패딩 조정 (1rem -> 0.75rem)
- ✅ 폰트 크기 증가 (16px -> 17px)
- ✅ 인사말과 같은 폰트 사용 (`var(--font-family-greeting)`)

## 발견된 개선 사항

### 1. 하드코딩된 색상 값 토큰화 필요

**현재 상태:**
- `#FEF9EE` (상단 섹션 배경색) - 하드코딩
- `#FFFCF6` (하단 카드 섹션 배경색) - 하드코딩
- `#55433B` (버튼 색상, 카드 헤더 텍스트) - 하드코딩
- `#A16A51` (병원명, 브라운 아이콘 배경) - 하드코딩

**권장 사항:**
```css
/* design-tokens.css에 추가 */
:root {
  /* 브라운 스킨 전용 색상 */
  --color-brown-skin-bg-top: #FEF9EE;      /* 상단 섹션 배경 */
  --color-brown-skin-bg-bottom: #FFFCF6;   /* 하단 섹션 배경 */
  --color-brown-skin-button: #55433B;      /* 버튼 색상 */
  --color-brown-skin-accent: #A16A51;      /* 강조 색상 (병원명, 아이콘) */
}
```

**적용 위치:**
- `MainPage.scss`: 모든 하드코딩된 색상을 CSS 변수로 교체
- `App.scss`: 플로팅 버튼 색상 토큰화
- `Card.scss`: 카드 헤더 텍스트 색상 토큰화

### 2. 헤더 섹션 재사용 가능성 검토

**현재 상태:**
- `main-page__header-greeting-section`이 MainPage에만 존재
- 다른 페이지에서도 유사한 헤더 구조가 필요할 수 있음

**권장 사항:**
1. **재사용 가능한 컴포넌트 생성**
   - `components/common/HeaderGreetingSection.tsx` 생성
   - Props: `hospital`, `patient`, `logoUrl`, `className`
   - 스타일은 별도 SCSS 파일로 분리

2. **높이 조정 가능하도록 설계**
   - `height` prop 추가 (기본값: auto)
   - `minHeight` prop 추가
   - 반응형 높이 조정 지원

3. **스타일 토큰화**
   - 배경색, 패딩, 마진 등을 CSS 변수로 관리
   - 테마별 스타일 지원 (브라운 스킨, 기본 스킨 등)

**구조 예시:**
```tsx
<HeaderGreetingSection
  hospital={hospital}
  patient={patient}
  logoUrl={getHospitalLogoUrl(hospital)}
  height="auto"
  minHeight="200px"
  theme="brown"
/>
```

### 3. 폰트 토큰 시스템

**현재 상태:**
- ✅ `font-tokens.css`에 잘 정의되어 있음
- ✅ `--font-family-greeting` 사용 중
- ✅ 플로팅 버튼에도 적용 완료

**개선 사항:**
- 모든 텍스트 요소가 폰트 토큰을 사용하도록 확인 필요
- 하드코딩된 `font-family` 값이 있는지 점검

### 4. 중복 코드 제거

**발견된 중복:**
1. **색상 값 중복**
   - `#A16A51`이 여러 곳에 하드코딩됨
   - `#55433B`가 여러 곳에 하드코딩됨

2. **스타일 중복**
   - `font-family: var(--font-family-greeting)` 반복
   - `!important` 남용 (특정성 문제 해결 필요)

**권장 사항:**
- CSS 변수 사용으로 중복 제거
- `!important` 대신 더 구체적인 선택자 사용
- 공통 스타일 믹스인 생성

### 5. 성능 최적화

**현재 상태:**
- 스크롤 이벤트에 throttle 적용됨 ✅
- `requestAnimationFrame` 사용 ✅

**개선 사항:**
- 스크롤 이벤트 리스너가 필요할 때만 활성화
- Intersection Observer API 활용 검토

## 우선순위별 개선 계획

### 높은 우선순위
1. ✅ 스크롤 하단 처리 (완료)
2. ✅ 부드러운 스크롤 효과 (완료)
3. ✅ 플로팅 버튼 개선 (완료)
4. 🔄 하드코딩된 색상 값 토큰화

### 중간 우선순위
5. 헤더 섹션 재사용 가능한 컴포넌트로 분리
6. `!important` 제거 및 선택자 특정성 개선

### 낮은 우선순위
7. 성능 최적화 (Intersection Observer)
8. 공통 스타일 믹스인 생성

## 다음 단계

1. **색상 토큰화 작업**
   - `design-tokens.css`에 브라운 스킨 색상 추가
   - `MainPage.scss`, `App.scss`, `Card.scss`에서 하드코딩된 색상 교체

2. **헤더 섹션 컴포넌트화**
   - `HeaderGreetingSection` 컴포넌트 생성
   - MainPage에서 새 컴포넌트 사용
   - 다른 페이지에서도 재사용 가능하도록 설계

3. **스타일 정리**
   - `!important` 사용 최소화
   - 공통 믹스인 생성
   - 선택자 특정성 개선





