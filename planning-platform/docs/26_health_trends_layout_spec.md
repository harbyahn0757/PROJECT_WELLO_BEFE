# 건강 추이 페이지 레이아웃 및 색상 시스템 명세

## 📐 전체 페이지 구조

```
HealthDataViewer (전체 컨테이너)
├── HealthTrendsHeader (sticky, top: 0)
│   ├── 시간 (좌상단)
│   ├── 뒤로가기 버튼 (시간 아래)
│   ├── 로고 + 환자 인사말 (중앙) [추가 필요]
│   ├── 제목 "건강 추이" (중앙)
│   └── 마지막 업데이트 (우상단)
├── HealthTrendsTabs (sticky, top: 헤더 높이)
│   ├── "건강검진 결과 추이" (활성)
│   └── "의료 기록 타임라인" (비활성)
└── question__content (스크롤 영역)
    └── TrendsSection
        ├── analysis-card
        │   ├── card-header (제목 + 정보)
        │   └── health-metrics-wrapper
        │       ├── health-metrics-container
        │       │   └── health-metrics-slider (가로 스크롤)
        │       │       └── health-metric-card (12개)
        │       └── slider-dots (페이지네이션)
        └── [하단 버튼 영역]
```

## 📏 간격 시스템 (Spacing)

### 1. 헤더 영역 (HealthTrendsHeader)
```scss
// 전체 헤더
padding: $spacing-sm $spacing-md;        // 12px 16px
min-height: 56px;                        // 최소 높이
gap: 0;                                  // 내부 요소 간격 없음

// 시간 (좌상단)
position: absolute;
top: $spacing-xs;                        // 8px
left: $spacing-md;                       // 16px

// 뒤로가기 버튼
position: absolute;
top: 2rem;                               // 32px (시간 아래)
left: $spacing-md;                       // 16px
width: 40px;
height: 40px;

// 제목 (중앙)
padding: 0 60px;                         // 좌우 버튼 영역 확보

// 업데이트 정보 (우상단)
position: absolute;
top: $spacing-xs;                        // 8px
right: $spacing-md;                      // 16px
gap: 4px;                                // 아이콘-텍스트 간격
```

### 2. 탭 영역 (HealthTrendsTabs)
```scss
// 전체 탭
padding: 0;
margin: 0;
gap: 0;
border-bottom: 1px solid $border-beige;
position: sticky;
top: 56px;                               // 헤더 높이

// 개별 탭
padding: 0.875rem $spacing-md;          // 14px 16px
font-size: 14px;
```

### 3. 메인 콘텐츠 영역 (TrendsSection)
```scss
// TrendsSection 전체
padding-top: $spacing-md;                // 16px (탭과 간격)

// analysis-card
margin-bottom: $spacing-lg;               // 24px

// card-header
margin-bottom: $spacing-md;               // 16px

// health-metrics-wrapper
padding: 0 $spacing-lg;                  // 좌우 24px

// health-metrics-slider
gap: $spacing-md;                        // 카드 간격 16px
padding: $spacing-xs 0 $spacing-sm 0;    // 상하 8px 0 12px 0

// slider-dots
gap: $spacing-xs;                        // 닷 간격 8px
margin: $spacing-xs 0 $spacing-sm 0;    // 상하 8px 0 12px 0
```

### 4. 건강 지표 카드 (health-metric-card)
```scss
// 카드 전체
min-width: 300px;
max-width: 320px;
padding: $spacing-lg;                    // 24px
border-radius: $border-radius-lg;         // 8px
gap: 0;

// metric-header (재구성 필요)
display: flex;
flex-direction: column;
gap: $spacing-xs;                        // 8px (제목-값 간격)
margin-bottom: $spacing-sm;              // 12px (값-그래프 간격)

// metric-title (제목)
font-size: $font-base;                   // 16px
margin-bottom: $spacing-xs;              // 8px

// metric-value (값)
gap: 6px;                                // 값-단위 간격
margin-bottom: $spacing-sm;              // 12px

// "측정" 버튼 (새로 추가)
position: absolute;
top: $spacing-lg;                        // 24px
right: $spacing-lg;                       // 24px
padding: 6px 12px;
border-radius: $border-radius-md;        // 6px

// metric-chart (그래프)
height: 170px;
margin-bottom: $spacing-sm;              // 12px

// 측정일 (카드 하단, 새로 추가)
margin-top: $spacing-sm;                  // 12px
padding-top: $spacing-sm;                // 12px
border-top: 1px solid $border-beige;
font-size: $font-xs;                     // 12px
```

## 🎨 색상 시스템

### 배경색
```scss
// 전체 페이지 배경
$background-cream: #FEF9EE;              // 메인 배경색

// 헤더 배경
background: $background-cream;

// 탭 배경
// 활성: $background-cream
// 비활성: $brand-brown-dark

// 카드 배경
background: $overlay-strong;              // rgba(255, 255, 255, 0.9)
```

### 브랜드 브라운 계열
```scss
$brand-brown: #7c746a;                   // 기본 브라운
$brand-brown-dark: #A16A51;              // 진한 브라운 (탭 비활성, 측정 버튼)
$brand-brown-darker: #55433B;            // 매우 진한 브라운 (텍스트)
$brand-brown-hover-dark: #8B5A47;        // 호버 브라운
$brand-brown-text: #8B6F5E;              // 브라운톤 텍스트
$brand-brown-card: #E8DCC8;               // 브라운 카드 배경
```

### 텍스트 색상
```scss
// 제목/강조 텍스트
color: $black;                            // #000000
color: $gray-800;                        // 진한 회색

// 본문 텍스트
color: $gray-600;                        // 중간 회색
color: $gray-550;                        // #737373 (헤더 업데이트)
color: $gray-450;                        // #565656 (본문)

// 값 표시
color: $brand-brown;                      // 기본 값
color: $brand-brown-dark;                // 강조 값
```

### 경계선 색상
```scss
$border-beige: #EAE4D7;                  // 베이지 경계선 (탭, 헤더 구분선)
border: 1px solid $border-beige;
```

### 상태 배지 색상 (제거 예정)
```scss
// status-badge는 이미지에 없으므로 제거
// 대신 "측정" 버튼 사용
```

### 그림자
```scss
$shadow-subtle: 0 1px 2px rgba(128, 128, 128, 0.08);  // 헤더 하단
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);           // 카드 기본
$shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);           // 카드 호버
```

## 🔄 변경 사항

### 1. 헤더 구조 변경
- [ ] 로고 추가 (병원 로고)
- [ ] 환자 인사말 축소형 추가 ("안녕하세요 {이름}님, {병원명}입니다")
- [ ] 레이아웃 재배치 (시간, 뒤로가기, 로고+인사말, 제목, 업데이트)

### 2. 카드 구조 변경
- [ ] status-badge 제거
- [ ] "측정" 버튼 추가 (우상단, $brand-brown-dark 배경)
- [ ] 측정일을 카드 하단으로 이동
- [ ] 레이아웃 재배치:
  - 제목 (좌상단)
  - 측정 버튼 (우상단)
  - 값 (중앙 큰 텍스트)
  - 그래프 (중앙 하단)
  - 측정일 (카드 하단)

### 3. 색상 토큰 적용
- [ ] 하드코딩된 색상값을 모두 토큰으로 교체
- [ ] 배경색: $background-cream
- [ ] 카드 배경: $overlay-strong
- [ ] 브라운 계열: $brand-brown-* 토큰 사용
- [ ] 회색 계열: $gray-* 토큰 사용

### 4. 간격 토큰 적용
- [ ] 하드코딩된 간격값을 모두 $spacing-* 토큰으로 교체
- [ ] 일관된 간격 시스템 적용

## 📱 반응형

### 모바일 (max-width: 480px)
```scss
// 헤더
padding: $spacing-sm $spacing-sm;        // 12px 12px
min-height: 52px;

// 탭
padding: 0.75rem $spacing-xs;            // 12px 8px
font-size: 13px;

// 카드
min-width: 280px;
max-width: 300px;
padding: $spacing-md;                    // 16px

// 슬라이더
gap: $spacing-sm;                        // 12px
```

## ✅ 체크리스트

- [ ] 헤더에 로고 + 인사말 추가
- [ ] 카드 구조 재배치 (status-badge 제거, 측정 버튼 추가)
- [ ] 측정일 카드 하단으로 이동
- [ ] 모든 색상 토큰 적용
- [ ] 모든 간격 토큰 적용
- [ ] 반응형 확인
- [ ] 전체 레이아웃 일관성 확인

