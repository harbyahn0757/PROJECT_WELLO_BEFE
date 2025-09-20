# 설문조사 상세 컴포넌트 가이드

## 📱 페이지 레이아웃

### 1. 모바일 뷰포트 시뮬레이션
```scss
.main-container {
  // 모바일 기본
  width: 100%;
  min-height: 100vh;
  background: rgba(255, 255, 255, 0.5);
  overflow-y: auto;
  position: relative;

  // 데스크톱에서 모바일 시뮬레이션
  @media (min-width: 768px) {
    max-width: 448px;
    margin: 0 auto;
    border-radius: 12px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    max-height: 900px;
  }
}
```

### 2. 배경 장식 요소
```scss
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
    bottom: 10%;
    right: -64px;
  }
}
```

## 📋 설문 페이지 구조

### 1. 페이지 헤더
```scss
.survey-header {
  padding: 24px 20px;
  text-align: center;
  
  &__title {
    font-size: 24px;
    font-weight: 700;
    color: $gray-800;
    margin-bottom: 8px;
  }
  
  &__subtitle {
    font-size: 16px;
    color: $gray-600;
    line-height: 1.5;
  }
  
  // 진행 상태 표시
  &__progress {
    margin-top: 20px;
    
    .progress-bar {
      height: 4px;
      background: $gray-200;
      border-radius: 2px;
      overflow: hidden;
      
      .progress-fill {
        height: 100%;
        background: $brand-brown;
        transition: width 0.3s ease;
      }
    }
    
    .progress-text {
      margin-top: 8px;
      font-size: 14px;
      color: $gray-600;
    }
  }
}
```

### 2. 질문 섹션
```scss
.question-section {
  padding: 24px 20px;
  background: $white;
  border-radius: 16px;
  margin-bottom: 16px;
  
  &__title {
    font-size: 18px;
    font-weight: 600;
    color: $gray-800;
    margin-bottom: 12px;
  }
  
  &__description {
    font-size: 14px;
    color: $gray-600;
    margin-bottom: 20px;
    line-height: 1.6;
  }
}
```

## 🎯 입력 요소 스타일

### 1. 라디오 버튼 (개선된 버전)
```scss
.radio-option {
  display: block;
  margin-bottom: 12px;
  
  input[type="radio"] {
    display: none;
    
    & + label {
      display: flex;
      align-items: center;
      padding: 16px;
      background: $white;
      border: 2px solid $gray-200;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &::before {
        content: "";
        width: 20px;
        height: 20px;
        border: 2px solid $gray-300;
        border-radius: 50%;
        margin-right: 12px;
        transition: all 0.2s ease;
      }
    }
    
    &:checked + label {
      border-color: $brand-brown;
      background: $brand-brown-light;
      
      &::before {
        border-color: $brand-brown;
        background: $brand-brown;
        box-shadow: inset 0 0 0 4px $white;
      }
    }
    
    &:hover + label {
      border-color: $brand-brown;
      background: rgba($brand-brown, 0.05);
    }
  }
}
```

### 2. 체크박스 (개선된 버전)
```scss
.checkbox-option {
  display: block;
  margin-bottom: 12px;
  
  input[type="checkbox"] {
    display: none;
    
    & + label {
      display: flex;
      align-items: center;
      padding: 16px;
      background: $white;
      border: 2px solid $gray-200;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &::before {
        content: "";
        width: 20px;
        height: 20px;
        border: 2px solid $gray-300;
        border-radius: 6px;
        margin-right: 12px;
        transition: all 0.2s ease;
      }
    }
    
    &:checked + label {
      border-color: $brand-brown;
      background: $brand-brown-light;
      
      &::before {
        border-color: $brand-brown;
        background: $brand-brown url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") center/14px no-repeat;
      }
    }
    
    &:hover + label {
      border-color: $brand-brown;
      background: rgba($brand-brown, 0.05);
    }
  }
}
```

### 3. 텍스트 입력 필드 (개선된 버전)
```scss
.text-input {
  position: relative;
  margin-bottom: 20px;
  
  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: $gray-700;
    margin-bottom: 8px;
  }
  
  input {
    width: 100%;
    padding: 14px 16px;
    font-size: 16px;
    border: 2px solid $gray-200;
    border-radius: 12px;
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: $brand-brown;
      box-shadow: 0 0 0 4px rgba($brand-brown, 0.1);
    }
    
    &::placeholder {
      color: $gray-400;
    }
  }
  
  .input-error {
    position: absolute;
    bottom: -20px;
    left: 0;
    font-size: 12px;
    color: #EF4444;
  }
}
```

## 🎨 특수 컴포넌트

### 1. 단계 표시기
```scss
.step-indicator {
  display: flex;
  justify-content: center;
  margin: 24px 0;
  
  .step {
    display: flex;
    align-items: center;
    
    &__number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: $gray-200;
      color: $gray-600;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      
      &--active {
        background: $brand-brown;
        color: $white;
      }
      
      &--completed {
        background: $brand-brown;
        color: $white;
        
        &::after {
          content: "✓";
        }
      }
    }
    
    &__line {
      width: 40px;
      height: 2px;
      background: $gray-200;
      margin: 0 4px;
      
      &--active {
        background: $brand-brown;
      }
    }
  }
}
```

### 2. 조건부 표시 질문
```scss
.conditional-question {
  margin-left: 32px;
  padding-left: 12px;
  border-left: 2px dashed $gray-300;
  margin-top: 12px;
  
  // 부드러운 나타남 효과
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
  
  &--visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. 툴팁
```scss
.tooltip {
  position: relative;
  display: inline-block;
  
  &__icon {
    width: 16px;
    height: 16px;
    background: $gray-400;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: $white;
    font-size: 12px;
    cursor: help;
  }
  
  &__content {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 12px;
    background: $gray-800;
    color: $white;
    font-size: 12px;
    border-radius: 6px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: all 0.2s ease;
    
    &::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: $gray-800;
    }
  }
  
  &:hover &__content {
    opacity: 1;
    transform: translateX(-50%) translateY(-8px);
  }
}
```

## 📱 반응형 타이포그래피

```scss
// 기본 폰트 크기
html {
  font-size: 16px;
  
  @media (max-width: 375px) {
    font-size: 14px;
  }
}

// 제목 크기
.title {
  &--xl {
    font-size: clamp(1.5rem, 5vw, 2rem);
    line-height: 1.2;
  }
  
  &--lg {
    font-size: clamp(1.25rem, 4vw, 1.5rem);
    line-height: 1.3;
  }
  
  &--md {
    font-size: clamp(1rem, 3vw, 1.25rem);
    line-height: 1.4;
  }
}

// 본문 텍스트
.text {
  &--lg {
    font-size: clamp(1rem, 2.5vw, 1.125rem);
    line-height: 1.6;
  }
  
  &--base {
    font-size: 1rem;
    line-height: 1.5;
  }
  
  &--sm {
    font-size: clamp(0.875rem, 2vw, 1rem);
    line-height: 1.4;
  }
}
```

## 🎨 애니메이션

### 1. 페이지 전환
```scss
.page-transition {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.3s ease;
  
  &--enter {
    opacity: 1;
    transform: translateY(0);
  }
  
  &--exit {
    opacity: 0;
    transform: translateY(-20px);
  }
}
```

### 2. 버튼 인터랙션
```scss
.button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  }
  
  &--loading {
    position: relative;
    color: transparent;
    
    &::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 20px;
      height: 20px;
      margin: -10px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: button-loading 0.6s linear infinite;
    }
  }
}

@keyframes button-loading {
  to { transform: rotate(360deg); }
}
```

## 🎯 사용자 피드백

### 1. 에러 상태
```scss
.input-error {
  border-color: #EF4444 !important;
  background: #FEF2F2;
  
  &:focus {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
  }
}

.error-message {
  color: #EF4444;
  font-size: 14px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  
  &::before {
    content: "!";
    width: 16px;
    height: 16px;
    background: #EF4444;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
  }
}
```

### 2. 성공 상태
```scss
.input-success {
  border-color: #10B981 !important;
  
  &:focus {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }
}

.success-message {
  color: #10B981;
  font-size: 14px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  
  &::before {
    content: "✓";
    width: 16px;
    height: 16px;
    background: #10B981;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
  }
}
```

## 📱 모바일 최적화

### 1. 터치 영역
```scss
// 모든 클릭 가능한 요소에 적용
.touchable {
  min-height: 44px; // iOS 권장 최소 터치 영역
  min-width: 44px;
  padding: 12px;
  
  @media (pointer: fine) {
    min-height: 32px;
    min-width: 32px;
    padding: 8px;
  }
}
```

### 2. 스크롤 동작
```scss
.scroll-container {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  
  // 스크롤바 스타일링
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: $gray-100;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: $gray-300;
    border-radius: 4px;
    
    &:hover {
      background: $gray-400;
    }
  }
}
```

## 🎨 테마 변수

```scss
// 색상
$colors: (
  'primary': (
    'light': #F5F3F2,
    'base': #7C746A,
    'dark': #6A635A,
  ),
  'gray': (
    50: #F9FAFB,
    100: #F3F4F6,
    200: #E5E7EB,
    300: #D1D5DB,
    400: #9CA3AF,
    500: #6B7280,
    600: #4B5563,
    700: #374151,
    800: #1F2937,
    900: #111827,
  ),
);

// 간격
$spacing: (
  'xs': 0.25rem,   // 4px
  'sm': 0.5rem,    // 8px
  'md': 1rem,      // 16px
  'lg': 1.5rem,    // 24px
  'xl': 2rem,      // 32px
  '2xl': 2.5rem,   // 40px
  '3xl': 3rem,     // 48px
);

// 폰트 크기
$font-sizes: (
  'xs': 0.75rem,   // 12px
  'sm': 0.875rem,  // 14px
  'base': 1rem,    // 16px
  'lg': 1.125rem,  // 18px
  'xl': 1.25rem,   // 20px
  '2xl': 1.5rem,   // 24px
  '3xl': 1.875rem, // 30px
  '4xl': 2.25rem,  // 36px
);

// 폰트 두께
$font-weights: (
  'normal': 400,
  'medium': 500,
  'semibold': 600,
  'bold': 700,
);

// 그림자
$shadows: (
  'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
);

// 테두리 반경
$radii: (
  'sm': 0.25rem,   // 4px
  'md': 0.375rem,  // 6px
  'lg': 0.5rem,    // 8px
  'xl': 0.75rem,   // 12px
  '2xl': 1rem,     // 16px
  'full': 9999px,
);
```

이 가이드를 사용하면 설문조사의 모든 디자인 요소를 일관되게 구현할 수 있습니다. 각 컴포넌트는 모듈화되어 있어 필요한 부분만 선택적으로 사용할 수 있습니다.
