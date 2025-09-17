# 김현우내과 건강검진 프로젝트 디자인 가이드라인

## 📋 프로젝트 개요
**프로젝트**: 김현우내과 건강검진 랜딩페이지  
**업데이트**: 2025-01-27  
**플랫폼**: 모바일 우선 반응형 웹  

## 🎨 디자인 컨셉
- **따뜻하고 친근한 병원 이미지**
- **모바일 우선 설계** (Mobile-First)
- **미니멀하고 깔끔한 인터페이스**
- **환자 중심의 사용자 경험**

## 🎯 브랜드 컬러 시스템

### 메인 브랜드 컬러
```scss
// 주요 브랜드 컬러
$brand-brown: #7c746a;           // 메인 브랜드 컬러
$brand-brown-hover: #696158;     // 호버 상태
$brand-brown-light: rgba(124, 116, 106, 0.1); // 연한 배경

// 배경 컬러
$background-beige: #f7e8d3;      // 메인 배경 (따뜻한 베이지)
$white: #ffffff;                 // 카드/모달 배경
```

### 텍스트 컬러
```scss
// 텍스트 색상 - Gray Scale
$gray-900: #1a202c;    // 매우 진한 텍스트 (제목)
$gray-800: #2d3748;    // 진한 텍스트 (본문)
$gray-700: #4a5568;    // 중간 텍스트 (강조)
$gray-600: #718096;    // 보조 텍스트
$gray-500: #a0aec0;    // 힌트/비활성 텍스트
$gray-400: #cbd5e0;    // 경계선/구분선
$gray-300: #e2e8f0;    // 연한 경계선
$gray-200: #edf2f7;    // 매우 연한 배경
$gray-100: #f7fafc;    // 최연한 배경
```

### 상태별 컬러
```scss
// 기능별 상태 색상
$success: #48bb78;     // 성공/완료
$warning: #ed8936;     // 주의/경고
$error: #f56565;       // 오류/실패
$info: #4299e1;        // 정보/알림
$black: #000000;       // 순수 검정
```

## 📱 레이아웃 시스템

### 컨테이너 구조
```scss
// 모바일 우선 반응형
.main-container {
  width: 100%;
  background: rgba(255, 255, 255, 0.5);
  overflow-y: auto;
  overflow-x: hidden; // 가로 스크롤 방지
  
  // 모바일: 전체 화면
  margin: 0;
  border-radius: 0;
  
  // 데스크톱: 중앙 정렬 + 최대 너비
  @media (min-width: 768px) {
    max-width: 448px;
    margin: 0 auto;
    border-radius: $border-radius-xl;
    box-shadow: $shadow-lg;
  }
}
```

### 배경 장식 시스템
```scss
// 배경 블롭 장식
.bg-decoration {
  position: absolute;
  width: 256px;
  height: 256px;
  background-color: $brand-brown;
  border-radius: 50%;
  opacity: 0.1;
  filter: blur(48px);
  z-index: -1;
  
  &--top {
    top: 25%;
    left: -96px;
  }
  
  &--bottom {
    bottom: 25%;
    right: -96px;
  }
}
```

## ✍️ 타이포그래피

### 폰트 시스템
```scss
// 메인 폰트
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;

// 폰트 크기 스케일
$font-xs: 0.75rem;   // 12px - 힌트/캡션
$font-sm: 0.875rem;  // 14px - 보조 텍스트
$font-base: 1rem;    // 16px - 기본 텍스트
$font-lg: 1.125rem;  // 18px - 소제목
$font-xl: 1.25rem;   // 20px - 제목
$font-2xl: 1.5rem;   // 24px - 대제목
$font-3xl: 1.875rem; // 30px - 메인 제목
```

### 폰트 두께
```scss
$font-weight-normal: 400;    // 기본
$font-weight-medium: 500;    // 중간
$font-weight-semibold: 600;  // 약간 두껍게
$font-weight-bold: 700;      // 두껍게
$font-weight-black: 900;     // 매우 두껍게
```

## 📏 간격 시스템

### 스페이싱 토큰
```scss
// 8px 기준 간격 시스템
$spacing-xs: 0.5rem;   // 8px
$spacing-sm: 0.75rem;  // 12px
$spacing-md: 1rem;     // 16px
$spacing-lg: 1.5rem;   // 24px
$spacing-xl: 2rem;     // 32px
$spacing-2xl: 3rem;    // 48px
```

### 컴포넌트별 간격
```scss
// 카드 패딩
.card { padding: $spacing-lg; }

// 버튼 패딩
.button { padding: $spacing-md $spacing-lg; }

// 섹션 간격
.section { margin-bottom: $spacing-xl; }
```

## 🔘 컴포넌트 스타일

### 버튼 시스템
```scss
// 기본 버튼 스타일
.button {
  padding: $spacing-md $spacing-lg;
  border: none;
  border-radius: $border-radius-lg;
  font-weight: $font-weight-medium;
  font-family: 'Pretendard', sans-serif;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  
  // 브랜드 버튼 (Primary)
  &--primary {
    background-color: $brand-brown;
    color: $white;
    
    &:hover {
      background-color: $brand-brown-hover;
    }
  }
  
  // 보조 버튼 (Secondary)
  &--secondary {
    background-color: $white;
    color: $brand-brown;
    border: 2px solid $brand-brown;
    
    &:hover {
      background-color: $brand-brown;
      color: $white;
    }
  }
}
```

### 카드 컴포넌트
```scss
.card {
  background: $white;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-md;
  border: 1px solid $gray-200;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: $brand-brown-light;
    color: $brand-brown;
  }
  
  &__icon {
    width: 48px;
    height: 48px;
    color: $gray-800;
  }
  
  &__title {
    font-size: $font-lg;
    font-weight: $font-weight-bold;
    color: $gray-800;
    margin: $spacing-sm 0;
  }
  
  &__description {
    font-size: $font-sm;
    color: $gray-600;
    line-height: 1.5;
  }
}
```

### 플로팅 버튼
```scss
.floating-button {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.25); // 75% 투명
  backdrop-filter: blur(35px) saturate(250%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: $spacing-md;
  z-index: 1000;
  box-shadow: 0 -2px 40px rgba(0, 0, 0, 0.04);
  
  // 내부 버튼은 브랜드 컬러 유지
  .button {
    background-color: $brand-brown;
    color: $white;
    box-shadow: 0 4px 12px rgba(139, 69, 19, 0.3);
    
    &:hover {
      background-color: $brand-brown-hover;
      transform: translateY(-1px);
    }
  }
}
```

## 🎨 테마 강조 스타일

### 병원명 강조
```scss
.hospital-name {
  color: $brand-brown;
  font-size: 1.1em; // 10% 크기 증가
  font-weight: $font-weight-semibold;
}
```

### 푸터 메시지
```scss
.footer-section__message {
  font-size: $font-xs;
  color: $gray-700;
  font-weight: $font-weight-semibold;
  text-align: center;
}
```

## 📐 모서리 반경 & 그림자

### Border Radius
```scss
$border-radius-sm: 0.25rem;  // 4px
$border-radius-md: 0.375rem; // 6px
$border-radius-lg: 0.5rem;   // 8px
$border-radius-xl: 0.75rem;  // 12px
```

### 그림자 시스템
```scss
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
$shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

## 🚫 사용 금지 사항

### 1. 하드코딩된 색상 금지
```scss
// ❌ 금지
color: #8B4513;
background: rgba(255, 255, 255, 0.8);

// ✅ 올바른 사용
color: $brand-brown;
background: rgba($white, 0.8);
```

### 2. 임의의 크기/간격 금지
```scss
// ❌ 금지
margin: 15px;
padding: 9px 13px;

// ✅ 올바른 사용
margin: $spacing-md;
padding: $spacing-sm $spacing-md;
```

### 3. 이모티콘 사용 금지
- 모든 UI에서 이모티콘 완전 제거
- 아이콘 필요시 SVG 사용
- 전문적이고 깔끔한 인터페이스 유지

## 📱 반응형 브레이크포인트

### 미디어 쿼리 시스템
```scss
// 브레이크포인트 정의
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;

// 믹스인 사용
@mixin respond-to($breakpoint) {
  @media (min-width: $breakpoint) {
    @content;
  }
}
```

### 모바일 우선 접근
```scss
// 기본: 모바일 스타일
.component {
  font-size: $font-sm;
  padding: $spacing-sm;
  
  // 태블릿 이상
  @include respond-to($breakpoint-md) {
    font-size: $font-base;
    padding: $spacing-md;
  }
  
  // 데스크톱
  @include respond-to($breakpoint-lg) {
    font-size: $font-lg;
    padding: $spacing-lg;
  }
}
```

## 📊 현재 구현 상황

### ✅ 완료된 항목
1. **색상 시스템** - 브랜드 컬러 및 그레이 스케일 정의
2. **타이포그래피** - Pretendard 폰트 시스템
3. **간격 시스템** - 8px 기준 스페이싱 토큰
4. **컴포넌트** - Button, Card, Layout 기본 구조
5. **반응형** - 모바일 우선 브레이크포인트
6. **플로팅 UI** - 투명도 기반 플로팅 버튼

### 🎯 품질 기준
- **일관성**: 모든 색상이 변수로 관리 ✅
- **접근성**: 충분한 색상 대비 확보 ✅
- **반응형**: 모바일 우선 설계 ✅
- **성능**: 최적화된 CSS 구조 ✅

---

**이 가이드라인을 통해 일관되고 전문적인 김현우내과 건강검진 서비스를 구현합니다.**