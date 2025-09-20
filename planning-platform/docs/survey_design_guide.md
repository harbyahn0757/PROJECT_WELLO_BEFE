# 설문조사 디자인 가이드

## 🎨 디자인 시스템

### 색상 변수
```scss
$brand-brown: #7C746A;         // 주 브랜드 색상
$brand-brown-hover: #6A635A;   // 호버 상태
$brand-brown-light: #F5F3F2;   // 연한 브랜드 색상

$background-beige: #FAF9F8;    // 배경색

$white: #FFFFFF;
$gray-50: #F9FAFB;
$gray-200: #E5E7EB;
$gray-300: #D1D5DB;
$gray-400: #9CA3AF;
$gray-600: #4B5563;
$gray-700: #374151;
$gray-800: #1F2937;
```

### 타이포그래피
```scss
$font-family-base: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

$font-sm: 0.875rem;    // 14px
$font-base: 1rem;      // 16px
$font-lg: 1.125rem;    // 18px
$font-xl: 1.25rem;     // 20px
$font-2xl: 1.5rem;     // 24px
$font-3xl: 1.875rem;   // 30px

$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
```

### 간격
```scss
$spacing-xs: 0.25rem;   // 4px
$spacing-sm: 0.5rem;    // 8px
$spacing-md: 1rem;      // 16px
$spacing-lg: 1.5rem;    // 24px
$spacing-xl: 2rem;      // 32px
```

### 그림자
```scss
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

### 테두리 반경
```scss
$border-radius-lg: 0.5rem;     // 8px
$border-radius-xl: 0.75rem;    // 12px
$border-radius-2xl: 1rem;      // 16px
$border-radius-full: 9999px;   // 원형
```

## 📱 컴포넌트 스타일

### 1. 설문 컨테이너
```scss
.survey-page {
  min-height: 100vh;
  background: $background-beige;
  padding: $spacing-lg;
  
  .survey-content {
    max-width: 600px;
    margin: 0 auto;
    background: $white;
    border-radius: $border-radius-xl;
    padding: $spacing-xl;
    box-shadow: $shadow-md;
  }
}
```

### 2. 설문 제목
```scss
.question__title {
  margin-top: $spacing-xl;
  
  &-text {
    font-family: $font-family-base;
    font-size: $font-2xl;
    line-height: 1.6;
    font-weight: $font-weight-bold;
    color: $gray-800;
  }
}
```

### 3. 라디오/체크박스 버튼
```scss
.question__content-input-button {
  input[type="radio"] + span,
  input[type="checkbox"] + span {
    background: $white;
    border: 2px solid $gray-300;
    border-radius: $border-radius-xl;
    box-shadow: $shadow-sm;
    padding: $spacing-md $spacing-lg;
    transition: all 0.3s ease;
    
    &:hover {
      border-color: $brand-brown;
      background: $brand-brown-light;
    }
  }
  
  input:checked + span {
    background: $brand-brown;
    border-color: $brand-brown;
    color: $white;
    transform: translateY(-1px);
    box-shadow: $shadow-md;
  }
}
```

### 4. 입력 필드
```scss
.question__content-input {
  background: $white;
  border: 2px solid $brand-brown;
  border-radius: $border-radius-xl;
  font-size: $font-xl;
  height: 52px;
  padding: $spacing-md;
  width: 100%;
  
  &:focus {
    border-color: $brand-brown-hover;
    box-shadow: 0 0 0 3px rgba(124, 116, 106, 0.1);
  }
}
```

### 5. 플로팅 버튼
```scss
.survey-floating-button {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: $white;
  border-top: 1px solid $gray-200;
  padding: $spacing-md $spacing-lg;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  
  &__btn {
    background: $brand-brown;
    border-radius: $border-radius-2xl;
    color: $white;
    font-size: $font-lg;
    height: 56px;
    width: 100%;
    transition: all 0.3s ease;
    
    &:hover {
      background: $brand-brown-hover;
      transform: translateY(-2px);
      box-shadow: $shadow-lg;
    }
  }
}
```

### 6. 뒤로가기 버튼
```scss
.back-button {
  background: $white;
  border: 2px solid $gray-300;
  border-radius: $border-radius-full;
  width: 60px;
  height: 48px;
  position: absolute;
  top: $spacing-lg;
  left: $spacing-lg;
  
  &:hover {
    border-color: $brand-brown;
    background: $brand-brown-light;
    transform: translateY(-1px);
  }
}
```

## 🎯 사용 예시

### 기본 설문 페이지 구조
```html
<div class="survey-page">
  <div class="back-button-container">
    <button class="back-button">←</button>
  </div>
  
  <div class="survey-content">
    <div class="question__title">
      <span class="question__title-text">설문 제목</span>
    </div>
    
    <div class="question__content">
      <div class="question__content-input-area">
        <!-- 설문 내용 -->
      </div>
    </div>
  </div>
  
  <div class="survey-floating-button">
    <button class="survey-floating-button__btn">다음</button>
  </div>
</div>
```

### 라디오 버튼 그룹
```html
<div class="question__content-input-button">
  <label>
    <input type="radio" name="question" value="1">
    <span>선택지 1</span>
  </label>
  <label>
    <input type="radio" name="question" value="2">
    <span>선택지 2</span>
  </label>
</div>
```

### 체크박스 그룹
```html
<div class="question__content-input-button">
  <label>
    <input type="checkbox" name="options" value="1">
    <span>옵션 1</span>
  </label>
  <label>
    <input type="checkbox" name="options" value="2">
    <span>옵션 2</span>
  </label>
</div>
```

## 📱 반응형 디자인

### 모바일 최적화
```scss
// 메인 컨테이너
.main-container {
  width: 100%;
  min-height: 100vh;
  
  // 데스크톱: 모바일 시뮬레이션
  @media (min-width: 768px) {
    max-width: 448px;
    margin: 0 auto;
    border-radius: $border-radius-xl;
    box-shadow: $shadow-lg;
    max-height: 900px;
    height: 100vh;
  }
}
```

## 🎨 디자인 가이드라인

1. **일관성**: 모든 컴포넌트에서 동일한 색상, 간격, 폰트 변수 사용
2. **접근성**: 충분한 색상 대비와 클릭 영역 제공
3. **피드백**: 모든 상호작용에 시각적 피드백 제공 (호버, 포커스, 활성 상태)
4. **여백**: 여유로운 여백으로 가독성 확보
5. **애니메이션**: 부드러운 전환 효과로 사용자 경험 향상

## 🔧 커스터마이징

### 브랜드 색상 변경
```scss
// _variables.scss
$brand-brown: #YOUR_COLOR;
$brand-brown-hover: darken($brand-brown, 10%);
$brand-brown-light: mix($brand-brown, $white, 10%);
```

### 폰트 변경
```scss
// _variables.scss
$font-family-base: 'YOUR_FONT', sans-serif;
```

### 반경 조정
```scss
// _variables.scss
$border-radius-xl: 1rem;  // 더 둥근 모서리
$border-radius-2xl: 1.5rem;
```
