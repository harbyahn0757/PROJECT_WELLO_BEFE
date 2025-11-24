# 레이아웃 분리 작업 계획

## 구조 원칙

### 레이아웃 분류
1. **랜딩 레이아웃**: MainPage (기존 구조 유지)
2. **컨텐츠 레이아웃 (헤더 있음)**: 공용 헤더 + 페이지별 컨텐츠
3. **컨텐츠 레이아웃 (헤더 없음)**: 헤더 없이 페이지별 컨텐츠

### 색상 시스템
- 모든 레이아웃에서 동일한 색상 시스템 사용
- `_variables.scss`의 색상 토큰 공용 사용

### CSS 관리
- 레이아웃별로 별도 CSS 파일 관리
- 공용 스타일은 `_variables.scss`, `_base.scss`에서 관리

## 레이아웃 구조

### 1. 랜딩 레이아웃 (LandingLayout)
- **위치**: `MainPage.tsx` (기존 유지)
- **특징**: 기존 구조 그대로 유지
- **CSS**: `MainPage.scss`

### 2. 컨텐츠 레이아웃 - 헤더 있음 (ContentLayoutWithHeader)
- **위치**: `frontend/src/layouts/ContentLayoutWithHeader/`
- **구조**:
  ```
  <ContentLayoutWithHeader>
    <HealthTrendsHeader /> (공용)
    <HealthTrendsToggle /> (공용, 선택적)
    <div className="content-layout__content">
      {children} (페이지별 컨텐츠)
    </div>
  </ContentLayoutWithHeader>
  ```
- **사용 페이지**: 건강 추이 페이지 (`/wello/results-trend`)
- **CSS**: `ContentLayoutWithHeader/styles.scss`

### 3. 컨텐츠 레이아웃 - 헤더 없음 (ContentLayoutWithoutHeader)
- **위치**: `frontend/src/layouts/ContentLayoutWithoutHeader/`
- **구조**:
  ```
  <ContentLayoutWithoutHeader>
    <div className="content-layout__content">
      {children} (페이지별 컨텐츠)
    </div>
  </ContentLayoutWithoutHeader>
  ```
- **사용 페이지**: 헤더가 필요 없는 페이지들
- **CSS**: `ContentLayoutWithoutHeader/styles.scss`

## 파일 구조

```
frontend/src/
├── layouts/
│   ├── ContentLayoutWithHeader/
│   │   ├── index.tsx
│   │   └── styles.scss
│   └── ContentLayoutWithoutHeader/
│       ├── index.tsx
│       └── styles.scss
├── components/
│   └── health/
│       ├── HealthTrendsHeader/ (공용)
│       ├── HealthTrendsToggle/ (공용)
│       └── HealthDataViewer/
│           └── index.tsx (레이아웃 사용)
└── pages/
    └── MainPage.tsx (랜딩, 기존 유지)
```

## 작업 단계

### Phase 1: 레이아웃 컴포넌트 생성
1. `ContentLayoutWithHeader` 생성
   - 헤더 컴포넌트 포함
   - 토글 컴포넌트 선택적 포함
   - 컨텐츠 영역 관리
2. `ContentLayoutWithoutHeader` 생성
   - 헤더 없이 컨텐츠 영역만 관리

### Phase 2: 스타일 정의
1. 각 레이아웃별 `styles.scss` 생성
2. 색상은 `_variables.scss`에서 import
3. 레이아웃별 고유 스타일만 정의

### Phase 3: HealthDataViewer에 적용
1. `ContentLayoutWithHeader` import
2. 기존 구조를 레이아웃 컴포넌트로 교체
3. Pull-to-refresh 로직 유지

## 스타일 정의

### ContentLayoutWithHeader
```scss
@use '../../styles/variables' as *;

.content-layout-with-header {
  min-height: 100vh;
  background: #F5F5F5;
  
  &__content {
    padding-top: 210px; // 토글 하단(180px) + 간격(30px)
    padding-left: 0;
    padding-right: 0;
    overflow-y: auto;
    background: #F5F5F5;
  }
}
```

### ContentLayoutWithoutHeader
```scss
@use '../../styles/variables' as *;

.content-layout-without-header {
  min-height: 100vh;
  background: #F5F5F5;
  
  &__content {
    padding: 0;
    overflow-y: auto;
    background: #F5F5F5;
  }
}
```

## 색상 시스템 통일
- 모든 레이아웃에서 `_variables.scss`의 색상 토큰 사용
- 하드코딩된 색상값 금지
- 배경색: `$background-cream`, `$background-beige`, `#F5F5F5` 등 토큰 사용







