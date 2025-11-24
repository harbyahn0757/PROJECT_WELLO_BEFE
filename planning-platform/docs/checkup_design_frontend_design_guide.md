# 검진 항목 설계 프론트엔드 디자인 가이드

## 📋 개요

검진 항목 설계 기능의 프론트엔드 구현을 위한 디자인 가이드입니다.
기존 디자인 시스템과 상수를 기반으로 일관성 있는 UI를 구성합니다.

**재사용 원칙**: 기존 컴포넌트와 스타일을 최대한 재사용하여 일관성과 개발 효율성을 확보합니다.

## 🔍 기존 컴포넌트 분석

### 1. 검진결과추이 페이지 (HealthDataViewer)
**경로**: `/results-trend`
**주요 컴포넌트**:
- `HealthTrendsHeader` - 헤더 컴포넌트 (뒤로가기, 제목, 업데이트 시간)
- `TrendsSection` - 건강 지표 카드 슬라이더
- `UnifiedHealthTimeline` - 타임라인 뷰

**재사용 가능 요소**:
- 헤더 구조 및 스타일
- 건강 데이터 파싱 로직
- 상태 판정 로직 (정상/경계/이상)

### 2. 검진 항목 추천 페이지 (CheckupRecommendationsPage)
**경로**: `/checkup-recommendations`
**주요 컴포넌트**:
- 아코디언 카드 구조
- 의사 추천 박스
- 검진 항목 체크박스

**재사용 가능 요소**:
- 전체 레이아웃 구조
- 카드 스타일
- 아코디언 애니메이션
- 의사 추천 박스 스타일

## 🎨 디자인 시스템 기반 (상수 상세)

### 색상 변수 (SCSS) - `_variables.scss` 기반

#### 브랜드 컬러
```scss
$brand-brown: #7c746a;                          // 메인 브랜드 컬러
$brand-brown-hover: #696158;                    // 호버 상태
$brand-brown-dark: #A16A51;                     // 진한 브라운 (병원명, 아이콘 배경, 선택된 날짜)
$brand-brown-darker: #55433B;                   // 매우 진한 브라운 (텍스트, 강조선, 하단 버튼)
$brand-brown-light-bg: #F8EDDA;                 // 연한 베이지 배경 (오늘 날짜, 네비게이션 버튼)
$brand-brown-light-bg-hover: #E8DCC8;           // 연한 베이지 호버
$border-beige: #EAE4D7;                         // 베이지 경계선
```

#### 배경 컬러
```scss
$background-cream: #FEF9EE;                     // 크림 배경 (메인 페이지, 헤더)
$background-appointment: #FFFCF6;               // 예약 페이지 배경
$white: #FFFFFF;
$black: #000000;
```

#### 그레이 스케일
```scss
$gray-900: #1a202c;    // 매우 진한 텍스트 (메인 제목)
$gray-800: #2d3748;    // 진한 텍스트 (본문, 제목)
$gray-600: #718096;    // 보조 텍스트 (설명, 힌트)
$gray-550: #737373;    // 중간 회색 (헤더 텍스트)
$gray-500: #a0aec0;    // 힌트/비활성 텍스트
$gray-450: #565656;    // 중간 진한 회색 (본문 텍스트)
$gray-666: #666666;    // 비활성 텍스트 (선택 불가 날짜)
$gray-400: #cbd5e0;    // 경계선/구분선
$gray-200: #edf2f7;    // 매우 연한 배경
$gray-50: #f9fafb;     // 극연한 배경
$gray-888: #888888;    // 중간 회색 (차트 축, 단위 색상)
```

#### 상태 색상
```scss
$success: #48bb78;      // 성공/완료 상태
$warning: #ed8936;      // 주의/경고 상태 (경계)
$error: #f56565;        // 오류/실패 상태 (이상)
$info: #4299e1;         // 정보/알림 상태
```

#### 뱃지 색상 시스템
```scss
$badge-normal-bg: #10b981;      // 정상 배경 (초록)
$badge-normal-text: #ffffff;    // 정상 텍스트
$badge-warning-bg: #ed8936;     // 경계 배경 (주황)
$badge-warning-text: #ffffff;   // 경계 텍스트
$badge-abnormal-bg: #f56565;   // 이상 배경 (빨강)
$badge-abnormal-text: #ffffff;  // 이상 텍스트
$badge-measure-bg: #888888;    // 측정 배경 (회색)
$badge-measure-text: #ffffff;  // 측정 텍스트
```

### CSS 변수 (디자인 토큰) - `design-tokens.css` 기반
```css
/* 브라운 스킨 색상 */
--color-brown-500: #7c746a;   /* 메인 브랜드 컬러 */
--color-brown-600: #696158;   /* 진한 브라운 (호버) */
--color-brown-700: #5a5248;   /* 매우 진한 브라운 */

/* 상태 색상 */
--color-success: #059669;     /* 정상 */
--color-warning: #d97706;     /* 경계 */
--color-danger: #dc2626;      /* 이상 */

/* 배경 */
--bg-primary: var(--color-brown-50);  /* 브라운 스킨 배경 */
--bg-secondary: var(--color-white);
--bg-card: var(--color-white);

/* 텍스트 */
--text-primary: var(--color-gray-900);
--text-secondary: var(--color-gray-600);
--text-tertiary: var(--color-gray-500);

/* 폰트 */
--font-family-primary: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */

/* 폰트 두께 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* 간격 */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
```

### 폰트 시스템 상수
```scss
// 폰트 크기 (rem 기준)
$font-xs: 0.75rem;      // 12px - 힌트/캡션
$font-sm: 0.875rem;     // 14px - 보조 텍스트
$font-base: 1rem;       // 16px - 기본 텍스트
$font-lg: 1.125rem;     // 18px - 소제목
$font-xl: 1.25rem;      // 20px - 제목
$font-2xl: 1.5rem;      // 24px - 대제목
$font-3xl: 1.875rem;    // 30px - 메인 제목

// 폰트 두께
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// 폰트 패밀리
$font-family-base: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
$font-family-value: 'Sora', 'Noto Sans KR', sans-serif; // 수치 표시용
```

### 간격 시스템 상수
```scss
$spacing-xs: 0.5rem;    // 8px
$spacing-sm: 0.75rem;   // 12px
$spacing-md: 1rem;      // 16px
$spacing-lg: 1.5rem;    // 24px
$spacing-xl: 2rem;       // 32px
$spacing-2xl: 3rem;      // 48px
```

### 테두리 및 그림자 상수
```scss
$border-radius-sm: 0.25rem;   // 4px
$border-radius-md: 0.375rem;  // 6px
$border-radius-lg: 0.5rem;    // 8px
$border-radius-xl: 0.75rem;   // 12px
$border-radius-2xl: 1rem;    // 16px
$border-radius-full: 9999px;  // 완전한 원형

$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
$shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

## 📱 페이지 구조

### 1. CheckupDesignPage (수정)
**경로**: `/survey/checkup-design`

**기능**:
- 건강 데이터 확인
- 데이터 파싱
- 염려 항목 선택 화면

**레이아웃**:
```
┌─────────────────────────┐
│ 헤더 (뒤로가기 버튼)     │
├─────────────────────────┤
│ 안내 텍스트              │
│ "염려하시는 항목을       │
│  선택해주세요"           │
├─────────────────────────┤
│ 정상이 아닌 항목 섹션    │
│ ┌─────────────────────┐ │
│ │ [체크박스] 항목명    │ │
│ │ 날짜: YYYY-MM-DD    │ │
│ │ 상태: 경계/이상      │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ 약물 복용 이력 섹션      │
│ ┌─────────────────────┐ │
│ │ [체크박스] 약물명    │ │
│ │ 복용 기간: YYYY-MM  │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ 선택한 항목 요약         │
│ "N개 항목 선택됨"        │
├─────────────────────────┤
│ [다음 단계] 버튼         │
└─────────────────────────┘
```

### 2. CheckupDesignResultPage (신규)
**경로**: `/checkup-design/result`

**기능**:
- GPT 응답 기반 검진 항목 표시
- 카테고리별 아코디언 UI
- 의사 추천 메시지

**레이아웃**: `CheckupRecommendationsPage`와 동일한 구조 재사용

## 🔄 재사용 가능한 컴포넌트 및 로직

### 1. HealthTrendsHeader 컴포넌트
**위치**: `components/health/HealthTrendsHeader/index.tsx`
**재사용 방법**: 검진 설계 페이지에서도 동일한 헤더 구조 사용

**Props**:
```typescript
interface HealthTrendsHeaderProps {
  onBack: () => void;
  title?: string; // 기본값: "건강 추이"
  lastUpdateTime?: string | null;
  patientName?: string;
  onRefresh?: () => void;
}
```

**스타일 상수**:
```scss
// 헤더 높이
height: 90px !important;

// 배경색
background: #FEF9EE !important; // $background-cream

// 패딩
padding-left: $spacing-md !important; // 16px
padding-right: $spacing-md !important; // 16px

// 제목 스타일
font-size: 18px !important;
font-weight: $font-weight-normal !important;
color: $black !important;
font-family: var(--font-family-greeting, 'Noto Sans KR', sans-serif) !important;
```

### 2. TrendsSection 건강 지표 파싱 로직
**위치**: `components/health/HealthDataViewer/TrendsSection.tsx`

**재사용 가능 함수**:
```typescript
// 건강 지표 목록
const healthMetrics = [
  '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
  '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
  'LDL 콜레스테롤', '중성지방', '헤모글로빈'
];

// 필드명 매핑
const getFieldNameForMetric = (metric: string): string => {
  // '신장' → 'height', '체중' → 'weight' 등
};

// 단위 매핑
const getUnitForMetric = (metric: string): string => {
  // '신장' → 'cm', '혈당' → 'mg/dL' 등
};

// 건강 범위 추출
const getHealthRanges = (
  metric: string, 
  healthDataItem: any, 
  gender: string = 'M'
): {
  normal: { min: number; max: number; name?: string } | null;
  borderline: { min: number; max: number; name?: string } | null;
  abnormal: { min: number; max: number; name?: string } | null;
} | null;

// 상태 판정
const getHealthStatus = (
  metric: string, 
  value: number, 
  healthDataItem: any
): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string };
```

**재사용 방법**: 검진 설계 페이지에서 정상이 아닌 항목 추출 시 동일한 로직 사용

### 3. CheckupRecommendationsPage 레이아웃
**위치**: `pages/CheckupRecommendationsPage.tsx`

**재사용 가능 구조**:
- 아코디언 카드 컴포넌트
- 의사 추천 박스 컴포넌트
- 검진 항목 체크박스 스타일

**레이아웃 상수**:
```scss
// 헤더 영역
.main-page__header-greeting-section {
  padding-bottom: $spacing-sm !important; // 12px
  position: fixed !important;
  top: 0;
  max-height: 180px;
  background: $background-cream; // #FEF9EE
}

// 스크롤 가능한 콘텐츠
&__scrollable-content {
  padding-top: calc(var(--header-height, 180px) + $spacing-xs);
  padding-bottom: $spacing-lg; // 24px
}

// 섹션 헤더
&__section-header {
  margin-bottom: $spacing-md; // 16px
  padding-top: $spacing-xs; // 8px
}

// 카드 스타일
&__card {
  background: $white;
  border-radius: $border-radius-xl; // 12px
  box-shadow: $shadow-sm;
  padding: $spacing-md; // 16px
}
```

## 🧩 컴포넌트 스타일

### 1. ConcernSelection 컴포넌트

#### 항목 카드 스타일
**기존 CheckupRecommendationsPage 카드 스타일 재사용**:
```scss
// CheckupRecommendationsPage의 카드 스타일 참고
.checkup-recommendations__card {
  background: $white;
  border-radius: $border-radius-xl; // 12px
  box-shadow: $shadow-sm;
  overflow: hidden;
  transition: all 0.3s ease;
  padding: $spacing-md; // 16px
}

// ConcernSelection 전용 스타일 (카드 기반)
.concern-item-card {
  background: $white;
  border: 1px solid $border-beige; // #EAE4D7
  border-radius: $border-radius-xl; // 12px (카드와 동일)
  padding: $spacing-md; // 16px
  margin-bottom: $spacing-sm; // 12px
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: $shadow-sm; // 카드와 동일한 그림자

  &:hover {
    background: $brand-brown-light-bg; // #F8EDDA
    border-color: $brand-brown; // #7c746a
    box-shadow: $shadow-md; // 호버 시 그림자 강화
  }

  &--selected {
    background: $brand-brown-light-bg; // #F8EDDA
    border-color: $brand-brown-dark; // #A16A51
    box-shadow: $shadow-md;
  }
}

.concern-item-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-xs;
}

.concern-item-checkbox {
  // CheckupRecommendationsPage 체크박스 스타일 재사용
  width: 20px;
  height: 20px;
  border-radius: $border-radius-sm; // 4px
  border: 2px solid $brand-brown-dark; // #A16A51
  background: $white;
  cursor: pointer;
  appearance: none;
  position: relative;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &--checked {
    background: $brand-brown-dark; // #A16A51
    border-color: $brand-brown-dark;

    &::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: $white;
      font-size: 14px;
      font-weight: $font-weight-bold;
    }
  }

  &:hover {
    border-color: $brand-brown-darker; // #55433B
  }
}

.concern-item-name {
  font-size: $font-base;
  font-weight: $font-weight-semibold;
  color: $black;
}

.concern-item-meta {
  font-size: $font-sm;
  color: $gray-666;
  margin-top: $spacing-xs;
}

.concern-item-status {
  // TrendsSection의 status-badge 스타일 참고
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: $border-radius-sm; // 4px
  font-size: $font-xs; // 12px
  font-weight: $font-weight-medium; // 500
  font-family: $font-family-base;

  &--warning {
    background: $badge-warning-bg; // #ed8936
    color: $badge-warning-text; // #ffffff
  }

  &--abnormal {
    background: $badge-abnormal-bg; // #f56565
    color: $badge-abnormal-text; // #ffffff
  }

  &--normal {
    background: $badge-normal-bg; // #10b981
    color: $badge-normal-text; // #ffffff
  }
}
```

### 2. 선택 요약 섹션
**CheckupRecommendationsPage의 섹션 헤더 스타일 참고**:
```scss
.selection-summary {
  // CheckupRecommendationsPage의 섹션 헤더와 유사한 스타일
  background: $brand-brown-light-bg; // #F8EDDA
  border-radius: $border-radius-xl; // 12px
  padding: $spacing-md; // 16px
  margin: $spacing-lg 0; // 24px 상하
  text-align: center;
  box-shadow: $shadow-sm;

  &__count {
    font-size: $font-xl; // 20px
    font-weight: $font-weight-bold; // 700
    color: $brand-brown-darker; // #55433B
    font-family: $font-family-base;
  }

  &__text {
    font-size: $font-sm; // 14px
    color: $gray-450; // #565656
    margin-top: $spacing-xs; // 8px
    font-family: $font-family-base;
  }
}
```

### 3. 다음 단계 버튼
**AppointmentLayout의 하단 버튼 스타일 재사용**:
```scss
.checkup-design-next-button {
  // AppointmentLayout의 하단 버튼과 동일한 스타일
  width: 100%;
  min-height: 56px; // 모바일: 52px
  background-color: $brand-brown-darker; // #55433B (하단 버튼과 동일)
  color: $white;
  border: none;
  border-radius: $border-radius-lg; // 8px
  font-size: 17px; // 모바일: 16px
  font-weight: $font-weight-semibold; // 600
  font-family: var(--font-family-greeting, 'Noto Sans KR', sans-serif);
  padding: 0.75rem 1rem; // 12px 16px
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba($brand-brown-darker, 0.3);

  &:hover:not(:disabled) {
    background-color: darken($brand-brown-darker, 5%);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba($brand-brown-darker, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background-color: $gray-400; // #cbd5e0
    color: $gray-600; // #718096
    cursor: not-allowed;
    opacity: 0.6;
  }

  // 모바일 반응형
  @media (max-width: 767px) {
    min-height: 52px;
    font-size: 16px;
  }
}
```

## 📐 레이아웃 상수 (기존 컴포넌트 기준)

### 컨테이너
**CheckupRecommendationsPage 기준**:
```scss
$max-width-mobile: 448px; // 모바일 최대 너비
$container-padding: $spacing-md; // 16px
$section-spacing: $spacing-lg; // 24px

// 스크롤 가능한 콘텐츠 영역
padding-top: calc(var(--header-height, 180px) + $spacing-xs); // 헤더 높이 + 8px
padding-bottom: $spacing-lg; // 24px
padding-left: 1rem; // 16px
padding-right: 1rem; // 16px
```

### 헤더 영역 상수
**HealthTrendsHeader 기준**:
```scss
// 헤더 높이
$header-height: 90px; // 고정 높이

// 헤더 배경
background: $background-cream; // #FEF9EE

// 헤더 패딩
padding-left: $spacing-md; // 16px
padding-right: $spacing-md; // 16px

// 제목 스타일
font-size: 18px; // 모바일: 16px
font-weight: $font-weight-normal; // 400
color: $black;
font-family: var(--font-family-greeting, 'Noto Sans KR', sans-serif);
```

### 카드 스타일 상수
**CheckupRecommendationsPage 카드 기준**:
```scss
$card-background: $white; // #FFFFFF
$card-border: none; // 테두리 없음 (box-shadow로 구분)
$card-border-radius: $border-radius-xl; // 12px
$card-padding: $spacing-md; // 16px
$card-shadow: $shadow-sm; // 0 1px 2px rgba(0, 0, 0, 0.05)
$card-shadow-hover: $shadow-md; // 호버 시: 0 4px 6px rgba(0, 0, 0, 0.07)
```

### 아코디언 카드 상수
**CheckupRecommendationsPage 아코디언 기준**:
```scss
// 카드 헤더
$card-header-padding: $spacing-md; // 16px
$card-header-gap: $spacing-sm; // 12px

// 카드 제목
$card-title-font-size: $font-base; // 16px
$card-title-font-weight: $font-weight-bold; // 700
$card-title-color: $black;

// 카드 뱃지
$card-badge-padding: 3px 10px;
$card-badge-height: 20px;
$card-badge-font-size: $font-xs; // 12px
$card-badge-background: $brand-brown-dark; // #A16A51
$card-badge-color: $white;
$card-badge-border-radius: $border-radius-full; // 9999px

// 카드 내용 (펼쳐짐)
$card-content-padding: 0 $spacing-md $spacing-md $spacing-md; // 0 16px 16px 16px
```

### 의사 추천 박스 상수
**CheckupRecommendationsPage 의사 추천 박스 기준**:
```scss
$doctor-box-background: $background-cream; // #FEF9EE
$doctor-box-border: 2px solid $brand-brown-dark; // #A16A51
$doctor-box-border-radius: $border-radius-lg; // 8px
$doctor-box-padding: $spacing-md; // 16px
$doctor-box-gap: $spacing-md; // 16px
$doctor-box-image-size: 80px; // 80px × 80px
$doctor-box-font-size: $font-sm; // 14px
$doctor-box-highlight-color: $error; // #f56565 (강조 텍스트)
```

## 🎯 재사용 컴포넌트 상세

### 1. CheckupRecommendationsPage 컴포넌트
**위치**: `pages/CheckupRecommendationsPage.tsx`

**재사용 가능 요소**:
- 전체 레이아웃 구조 (헤더 + 스크롤 영역)
- 아코디언 카드 구조 및 애니메이션
- 의사 추천 박스 컴포넌트
- 검진 항목 체크박스 스타일
- 섹션 헤더 (제목 + 뱃지)

**재사용 방법**:
```tsx
// 1. 레이아웃 구조 재사용
<div className="checkup-recommendations">
  <div className="checkup-recommendations__scrollable-content">
    {/* 컨텐츠 */}
  </div>
</div>

// 2. 아코디언 카드 구조 재사용
<div className="checkup-recommendations__card">
  <div className="checkup-recommendations__card-header">
    {/* 헤더 */}
  </div>
  <div className="checkup-recommendations__card-content">
    {/* 내용 */}
  </div>
</div>

// 3. 의사 추천 박스 재사용
<div className="checkup-recommendations__doctor-box">
  <img className="checkup-recommendations__doctor-illustration" />
  <p className="checkup-recommendations__doctor-box-text">
    {/* 메시지 */}
  </p>
</div>
```

### 2. HealthTrendsHeader 컴포넌트
**위치**: `components/health/HealthTrendsHeader/index.tsx`

**재사용 방법**:
```tsx
import HealthTrendsHeader from '../components/health/HealthTrendsHeader';

<HealthTrendsHeader
  onBack={handleBack}
  title="검진 항목 설계"
  lastUpdateTime={null}
  patientName={patient?.name}
/>
```

### 3. TrendsSection 데이터 파싱 로직
**위치**: `components/health/HealthDataViewer/TrendsSection.tsx`

**재사용 함수**:
```typescript
// 건강 지표 목록 (상수)
const HEALTH_METRICS = [
  '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
  '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
  'LDL 콜레스테롤', '중성지방', '헤모글로빈'
];

// 필드명 매핑 함수 재사용
const getFieldNameForMetric = (metric: string): string;

// 단위 매핑 함수 재사용
const getUnitForMetric = (metric: string): string;

// 건강 범위 추출 함수 재사용
const getHealthRanges = (
  metric: string, 
  healthDataItem: any, 
  gender: string = 'M'
): {
  normal: { min: number; max: number; name?: string } | null;
  borderline: { min: number; max: number; name?: string } | null;
  abnormal: { min: number; max: number; name?: string } | null;
} | null;

// 상태 판정 함수 재사용
const getHealthStatus = (
  metric: string, 
  value: number, 
  healthDataItem: any
): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string };
```

### 4. 기존 스타일 파일
**재사용 가능 스타일**:
- `CheckupRecommendationsPage.scss` - 카드, 아코디언, 의사 추천 박스 스타일
- `HealthTrendsHeader/styles.scss` - 헤더 스타일
- `MainPage.scss` - 헤더 + 인사말 섹션 스타일
- `_variables.scss` - 모든 SCSS 변수
- `design-tokens.css` - CSS 변수
- `AppointmentLayout/styles.scss` - 하단 버튼 스타일

## 📝 데이터 구조 (기존 컴포넌트 기준)

### 염려 항목 타입
**TrendsSection의 건강 지표 데이터 구조 참고**:
```typescript
interface ConcernItem {
  id: string;
  type: 'abnormal_item' | 'medication';
  name: string; // 항목명 (예: '혈당', '총콜레스테롤')
  date: string; // YYYY-MM-DD (검진일 또는 처방일)
  value?: string; // 검진 수치 (예: '120', '250')
  unit?: string; // 단위 (예: 'mg/dL', 'cm')
  status?: 'warning' | 'abnormal'; // 경계 또는 이상
  medicationPeriod?: string; // 약물 복용 기간 (약물인 경우)
  checkupDate?: string; // 검진일 (검진 항목인 경우)
  location?: string; // 병원명
  selected: boolean; // 사용자 선택 여부
}

// 건강 지표 매핑 (TrendsSection에서 재사용)
const HEALTH_METRICS = [
  '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
  '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
  'LDL 콜레스테롤', '중성지방', '헤모글로빈'
];
```

### GPT 응답 타입
**CheckupRecommendationsPage의 목업 데이터 구조 재사용**:
```typescript
// CheckupRecommendationsPage의 RecommendationData 구조 재사용
interface CheckupItem {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  reason?: string; // GPT가 제공한 추천 이유
  priority?: number; // 우선순위 (1-5)
  recommended: boolean;
}

interface DoctorRecommendation {
  hasRecommendation: boolean;
  message: string;
  highlightedText?: string;
}

interface RecommendationCategory {
  categoryName: string;
  categoryNameEn?: string;
  itemCount: number;
  items: CheckupItem[];
  doctorRecommendation?: DoctorRecommendation;
  defaultExpanded: boolean;
}

interface CheckupDesignResponse {
  patientName: string;
  totalCount: number;
  recommended_items: RecommendationCategory[];
  analysis: string; // GPT 종합 분석
}
```

### 건강 데이터 파싱 결과 타입
**TrendsSection의 데이터 구조 참고**:
```typescript
interface ParsedHealthData {
  // 최근 3년간 검진 데이터
  recentCheckups: Array<{
    year: string;
    checkup_date: string;
    location: string;
    items: Array<{
      ItemName: string;
      Value: string;
      ItemReferences: Array<{
        Name: string; // '정상(A)', '정상(B)', '질환의심'
        Value: string; // 범위 문자열
      }>;
    }>;
  }>;
  
  // 정상이 아닌 항목 목록
  abnormalItems: Array<{
    metric: string; // '혈당', '총콜레스테롤' 등
    value: number;
    unit: string;
    status: 'warning' | 'abnormal';
    date: string;
    location: string;
    checkupDate: string;
  }>;
  
  // 약물 복용 이력
  medicationHistory: Array<{
    medicationName: string;
    startDate: string;
    endDate?: string;
    period: string; // 'YYYY-MM ~ YYYY-MM'
    prescriptionDate: string;
    hospitalName: string;
  }>;
}
```

## 🔄 상태 관리 (기존 컴포넌트 패턴)

### 로컬 상태
**CheckupRecommendationsPage와 HealthDataViewer 패턴 참고**:
```typescript
// 염려 항목 선택 상태
const [concernItems, setConcernItems] = useState<ConcernItem[]>([]);
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

// 로딩 상태 (CheckupRecommendationsPage 패턴)
const [isLoading, setIsLoading] = useState(true);
const [isFadingOut, setIsFadingOut] = useState(false);
const [loadingProgress, setLoadingProgress] = useState(0);
const [loadingMessage, setLoadingMessage] = useState('');

// GPT 응답 결과
const [designResult, setDesignResult] = useState<CheckupDesignResponse | null>(null);

// 아코디언 상태 (CheckupRecommendationsPage 패턴)
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
  new Set(
    designResult?.recommended_items
      .filter((cat) => cat.defaultExpanded)
      .map((cat) => cat.categoryName) || []
  )
);
```

### 데이터 로딩 패턴
**HealthDataViewer의 데이터 로딩 패턴 재사용**:
```typescript
// 1. 건강 데이터 확인 (MainPage의 checkHasData 로직 재사용)
const checkHasData = async (uuid: string, hospitalId: string): Promise<boolean>;

// 2. 건강 데이터 로드 (HealthDataViewer의 loadHealthData 패턴 재사용)
const loadHealthData = async () => {
  // IndexedDB 확인 → API 호출 → localStorage 폴백
};

// 3. 데이터 파싱 (TrendsSection의 파싱 로직 재사용)
const parseHealthData = (healthData: any, prescriptionData: any): ParsedHealthData => {
  // 최근 3년간 필터링
  // 정상이 아닌 항목 추출
  // 약물 복용 이력 추출
};
```

## 🎨 애니메이션 (기존 컴포넌트 기준)

### 카드 선택 애니메이션
**CheckupRecommendationsPage의 펼치기 애니메이션 참고**:
```scss
// CheckupRecommendationsPage의 fadeInUp 애니메이션 재사용
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 카드 선택 펄스 애니메이션 (추가)
@keyframes selectPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}

.concern-item-card {
  transition: all 0.2s ease;
  
  &--selected {
    animation: selectPulse 0.3s ease;
  }
}

// 카드 내용 펼치기 (CheckupRecommendationsPage와 동일)
.checkup-recommendations__card-content {
  animation: fadeInUp 0.3s ease-out;
}
```

### 로딩 스피너
**CheckupRecommendationsPage의 로딩 오버레이 재사용**:
```scss
// CheckupRecommendationsPage의 로딩 오버레이 스타일 재사용
.checkup-design-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-in;
  
  &.fade-out {
    animation: fadeOut 0.5s ease-out forwards;
  }
}

// 진행률 바 (CheckupRecommendationsPage와 동일)
.checkup-design-loading-progress {
  width: 200px;
  height: 4px;
  background: $gray-200;
  border-radius: $border-radius-full;
  overflow: hidden;
}

.checkup-design-loading-progress-bar {
  height: 100%;
  background: $brand-brown-dark; // #A16A51
  border-radius: $border-radius-full;
  transition: width 0.3s ease;
  animation: progressGlow 1.5s ease-in-out infinite;
}

@keyframes progressGlow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(161, 106, 81, 0.3);
  }
  50% {
    box-shadow: 0 0 15px rgba(161, 106, 81, 0.6);
  }
}
```

### 페이지 전환 애니메이션
**HealthDataViewer의 페이드 애니메이션 재사용**:
```scss
// TrendsSection과 UnifiedHealthTimeline 페이드 애니메이션 재사용
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.checkup-design-content {
  animation: fadeInUp 0.4s ease-out;
}
```

## 📱 반응형 디자인 (기존 컴포넌트 기준)

### 모바일 (기본)
**CheckupRecommendationsPage 모바일 스타일 기준**:
```scss
// 최대 너비
max-width: 448px;

// 패딩
padding: $spacing-md 1rem; // 16px 좌우

// 폰트 크기
$font-base: 1rem; // 16px (기본)
$font-sm: 0.875rem; // 14px (보조)
$font-xs: 0.75rem; // 12px (캡션)

// 헤더 높이
$header-height-mobile: 52px; // HealthTrendsHeader 모바일 높이

// 버튼 높이
min-height: 52px; // 모바일 하단 버튼
font-size: 16px; // 모바일 버튼 폰트
```

### 태블릿 이상
**CheckupRecommendationsPage 태블릿 스타일 기준**:
```scss
@media (min-width: 768px) {
  // 최대 너비
  max-width: 768px;
  margin: 0 auto; // 중앙 정렬

  // 패딩
  padding: $spacing-xl $spacing-lg; // 32px 24px

  // 폰트 크기
  font-size: $font-lg; // 18px (기본)

  // 헤더
  &__header-greeting-section {
    padding: 0 $spacing-lg $spacing-xl;
  }
}
```

### 브레이크포인트 상수
**`_variables.scss` 기준**:
```scss
$breakpoint-sm: 640px;    // 스몰 태블릿
$breakpoint-md: 768px;    // 태블릿
$breakpoint-lg: 1024px;   // 작은 데스크톱
$breakpoint-xl: 1280px;   // 데스크톱
```

## ✅ 체크리스트 (재사용 중심)

### 디자인 시스템
- [ ] `_variables.scss`의 모든 상수 사용 (하드코딩 금지)
- [ ] `design-tokens.css`의 CSS 변수 사용
- [ ] 기존 색상 변수 재사용 ($brand-brown-*, $gray-*, $badge-*)
- [ ] 기존 간격 변수 재사용 ($spacing-*)
- [ ] 기존 폰트 변수 재사용 ($font-*, $font-weight-*)

### 컴포넌트 재사용
- [ ] `HealthTrendsHeader` 컴포넌트 재사용
- [ ] `CheckupRecommendationsPage` 레이아웃 구조 재사용
- [ ] `TrendsSection`의 데이터 파싱 로직 재사용
- [ ] `CheckupRecommendationsPage`의 아코디언 카드 스타일 재사용
- [ ] `CheckupRecommendationsPage`의 의사 추천 박스 스타일 재사용
- [ ] `AppointmentLayout`의 하단 버튼 스타일 재사용

### 스타일 일관성
- [ ] 카드 border-radius: $border-radius-xl (12px)
- [ ] 카드 padding: $spacing-md (16px)
- [ ] 카드 box-shadow: $shadow-sm
- [ ] 버튼 min-height: 56px (모바일: 52px)
- [ ] 버튼 background: $brand-brown-darker (#55433B)
- [ ] 뱃지 높이: 20px, padding: 3px 10px

### 반응형 디자인
- [ ] 모바일 최대 너비: 448px
- [ ] 태블릿 최대 너비: 768px
- [ ] 헤더 높이: 90px (모바일: 52px)
- [ ] 폰트 크기 반응형 적용

### 기능 구현
- [ ] 건강 데이터 확인 로직 (MainPage의 checkHasData 재사용)
- [ ] 최근 3년간 필터링 로직
- [ ] 정상이 아닌 항목 추출 (TrendsSection의 getHealthStatus 재사용)
- [ ] 약물 복용 이력 추출
- [ ] 다중 선택 기능
- [ ] 로딩 상태 처리 (CheckupRecommendationsPage 패턴)
- [ ] 에러 상태 처리
- [ ] 빈 상태 처리 (항목이 없을 때)

### 애니메이션
- [ ] fadeInUp 애니메이션 재사용
- [ ] 카드 선택 펄스 애니메이션
- [ ] 로딩 진행률 바 애니메이션 (progressGlow)

## 📚 참고 파일 목록

### 컴포넌트
- `components/health/HealthTrendsHeader/index.tsx` - 헤더 컴포넌트
- `components/health/HealthDataViewer/TrendsSection.tsx` - 데이터 파싱 로직
- `pages/CheckupRecommendationsPage.tsx` - 레이아웃 및 카드 구조
- `pages/MainPage.tsx` - 건강 데이터 확인 로직

### 스타일 파일
- `styles/_variables.scss` - 모든 SCSS 변수
- `styles/design-tokens.css` - CSS 변수
- `pages/CheckupRecommendationsPage.scss` - 카드 및 아코디언 스타일
- `components/health/HealthTrendsHeader/styles.scss` - 헤더 스타일
- `layouts/AppointmentLayout/styles.scss` - 하단 버튼 스타일

### 상수 파일
- `constants/images.ts` - 이미지 경로 상수
- `config/api.ts` - API 엔드포인트 상수

