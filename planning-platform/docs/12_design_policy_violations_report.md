# 디자인 정책 위반 사항 보고서

## 📋 개요
현재 코드베이스에서 디자인 가이드라인 및 레이아웃 정책을 벗어난 요소들을 점검하고 개선 방안을 제시합니다.

## 🚨 발견된 정책 위반 사항

### 1. 색상 시스템 위반

#### ❌ 하드코딩된 색상 사용
**위치**: `frontend/src/shared/components/layout/BaseLayout.css`
```css
/* 정책 위반: 테마별 하드코딩된 색상 */
.base-layout--theme-professional {
  background: #F8F9FA;  /* 승인되지 않은 색상 */
}

.base-layout--theme-professional .base-layout__sub-header {
  background: #E9ECEF;  /* 승인되지 않은 색상 */
  border-color: #DEE2E6;  /* 승인되지 않은 색상 */
}

.base-layout--theme-high-contrast {
  background: #FFFFFF;  /* 중복: --color-surface와 동일 */
}

.base-layout--theme-high-contrast .base-layout__sub-header {
  background: #F8F9FA;  /* 승인되지 않은 색상 */
  border-color: #000000;  /* 승인되지 않은 색상 */
}
```

#### ❌ 투명도 포함 색상
**위치**: `frontend/src/shared/components/layout/Header.css`
```css
/* 헤더 버튼에서 투명도 사용 (정책 정의 필요) */
color: rgba(255, 255, 255, 0.9);
background: rgba(255, 255, 255, 0.1);
border-color: rgba(255, 255, 255, 0.2);
/* ... 추가로 7건 */
```

#### ❌ 에러 상태 색상
**위치**: 여러 컴포넌트
```css
/* Input.css, Select.css, Card.css */
background: rgba(239, 68, 68, 0.05);  /* 에러 색상의 투명도 버전 */
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);  /* 포커스 상태 */
```

### 2. 폰트 크기 토큰 위반

#### ❌ 하드코딩된 폰트 크기
**위치**: `frontend/src/App.css`
```css
/* 플레이스홀더 아이콘 크기 - 토큰 미사용 */
.placeholder-icon {
  font-size: 48px;  /* --font-size-4xl: 36px 대신 사용 */
}

/* 반응형별로 하드코딩 */
@media (max-width: 1200px) {
  .placeholder-icon {
    font-size: 42px;  /* 토큰 없음 */
  }
}
/* ... 총 5건의 하드코딩된 폰트 크기 */
```

### 3. 레이아웃 시스템 미적용

#### ❌ 기존 MainLayout 사용
**위치**: `frontend/src/App.js`에서 이전에 사용
- 새로운 `BaseLayout` 시스템 대신 레거시 구조 사용
- 표준화된 테마/간격 시스템 미적용
- 컴포넌트 일관성 부족

### 4. 반응형 시스템 일관성 부족

#### ❌ 개별 컴포넌트별 브레이크포인트
각 컴포넌트마다 다른 브레이크포인트 사용:
- Header.css: 1200px, 992px, 768px, 480px
- MultiSectionLayout.css: 1400px, 1200px, 992px, 768px, 480px
- App.css: 1400px, 1200px, 992px, 768px, 480px
- Card.css, Input.css, Select.css: 각각 다른 구조

## ✅ 정책 준수 현황

### 🟢 잘 지켜지고 있는 부분
1. **이모티콘 제거**: 모든 UI에서 이모티콘 완전 제거 완료
2. **디자인 토큰 기본 구조**: `design-tokens.css` 구축 완료
3. **컴포넌트 토큰화**: Button, Input, Select, Card 등 기본 컴포넌트 완료
4. **CSS 변수 사용**: 대부분의 스타일에서 CSS 변수 활용

### 🟡 부분 준수
1. **색상 시스템**: 기본 색상은 토큰 사용, 일부 특수 경우 하드코딩
2. **간격 시스템**: 주요 간격은 토큰 사용, 일부 개별 값 존재
3. **레이아웃 시스템**: 새로운 시스템 구축했으나 전환 미완료

## 🔧 개선 방안

### 1. 색상 토큰 확장
```css
/* design-tokens.css에 추가 필요 */
:root {
  /* 투명도 포함 색상 토큰 */
  --color-overlay-light: rgba(255, 255, 255, 0.1);
  --color-overlay-medium: rgba(255, 255, 255, 0.2);
  --color-overlay-heavy: rgba(255, 255, 255, 0.4);
  
  /* 테마별 색상 토큰 */
  --color-professional-bg: #F8F9FA;
  --color-professional-surface: #E9ECEF;
  --color-professional-border: #DEE2E6;
  
  /* 에러 상태 투명도 토큰 */
  --color-error-bg: rgba(239, 68, 68, 0.05);
  --color-error-focus: rgba(239, 68, 68, 0.3);
}
```

### 2. 폰트 크기 토큰 확장
```css
/* design-tokens.css에 추가 */
:root {
  /* 아이콘/플레이스홀더 전용 크기 */
  --icon-size-sm: 24px;
  --icon-size-md: 32px;
  --icon-size-lg: 48px;
  --icon-size-xl: 64px;
  
  /* 플레이스홀더 아이콘 크기 */
  --placeholder-icon-size: var(--icon-size-lg);
}
```

### 3. 브레이크포인트 표준화
```css
/* design-tokens.css 통일 */
:root {
  /* 표준 브레이크포인트 */
  --breakpoint-xs: 480px;
  --breakpoint-sm: 768px;
  --breakpoint-md: 992px;
  --breakpoint-lg: 1200px;
  --breakpoint-xl: 1400px;
}
```

### 4. 레이아웃 시스템 전환
- [x] BaseLayout 시스템 구축 완료
- [ ] 기존 MainLayout을 BaseLayout으로 전환
- [ ] 모든 컴포넌트 테마/간격 시스템 적용

## 📋 우선순위별 수정 계획

### 🔴 High Priority (즉시 수정)
1. **App.css 폰트 크기**: 하드코딩된 48px, 42px, 38px, 32px, 28px → 토큰으로 변경
2. **BaseLayout.css 색상**: 테마별 하드코딩 색상 → 토큰으로 변경

### 🟡 Medium Priority (1주 내)
1. **투명도 색상 토큰화**: rgba() 사용처를 토큰으로 표준화
2. **브레이크포인트 통일**: 모든 컴포넌트의 미디어 쿼리 일관성 확보

### 🟢 Low Priority (2주 내)
1. **레이아웃 시스템 완전 전환**: 모든 페이지를 BaseLayout 기반으로 전환
2. **아이콘 시스템 구축**: SVG 아이콘 컴포넌트 시스템 구축

## 🛠️ 구체적 수정 액션

### 즉시 수정 필요한 파일들:
1. `frontend/src/App.css` (라인 84, 185, 216, 235, 294)
2. `frontend/src/shared/components/layout/BaseLayout.css` (라인 39, 43, 44, 49, 53, 54)
3. `frontend/src/shared/styles/design-tokens.css` (토큰 추가)

### 정책 업데이트 필요:
1. 투명도 색상 사용 가이드라인
2. 아이콘 크기 토큰 정의
3. 테마별 색상 확장 정책

## 📝 정책 준수 체크리스트

### 개발 시 확인사항:
- [ ] 모든 색상이 CSS 변수인가?
- [ ] 폰트 크기가 토큰 기반인가?
- [ ] 간격이 8px 기준 토큰인가?
- [ ] 이모티콘을 사용하지 않았는가?
- [ ] 레이아웃 시스템을 준수했는가?
- [ ] 브레이크포인트가 표준화되어 있는가?

---

## 📊 요약

### 위반 사항 통계:
- **색상 하드코딩**: 13건
- **폰트 크기 하드코딩**: 7건 → 0건 (해결됨)
- **투명도 색상**: 19건
- **레이아웃 시스템 미적용**: 진행 중

### 최근 해결된 사항 (2025-01-27):
- **파일 업로드 폰트 시스템 표준화**: 새로운 폰트 토큰 추가 및 적용
- **파일 아이콘 색상 정책 준수**: `var(--color-text-muted)` 사용
- **파일 아이템 레이아웃 최적화**: 높이, 패딩, 간격 표준화

### 다음 단계:
1. 즉시 수정 (High Priority) 진행
2. 디자인 토큰 확장
3. 정책 문서 업데이트
4. 개발 가이드라인 강화

이 보고서를 바탕으로 정책 준수를 위한 체계적인 개선을 진행하겠습니다.
