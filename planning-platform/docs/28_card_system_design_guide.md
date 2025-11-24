# 카드 시스템 디자인 가이드

## 📋 문서 정보
**업데이트**: 2025-01-27  
**프로젝트**: 건강 추이 분석 카드 시스템  
**기준 이미지**: 건강 추이 페이지 스크린샷

## 🎯 개요

건강 추이 분석 페이지의 카드 시스템을 공용화하고 디자인 토큰 기반으로 재구성합니다.

## 🎨 디자인 시스템

### 1. 폰트 시스템

#### 기본 폰트
```scss
// 기본 폰트 (모든 텍스트)
$font-family-base: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

#### 수치 폰트
```scss
// 수치 표시용 (큰 숫자)
$font-family-value: 'Sora', 'Noto Sans KR', sans-serif;
$font-color-value: #55433B; // 진한 브라운
$font-weight-value: 600; // 세미볼드
```

#### 차트 축 폰트
```scss
// 차트 X/Y축 레이블
$font-family-chart-axis: 'Poppins', 'Noto Sans KR', sans-serif;
$font-color-chart-axis: #888888; // 중간 회색
```

### 2. 색상 시스템

#### 카드 배경
```scss
$card-background: transparent; // 카드 배경 투명 (섹션 배경 제거)
$card-section-background: transparent; // 섹션 배경도 투명
```

#### 수치 색상
```scss
$value-color: #55433B; // 진한 브라운 (수치 텍스트)
$value-unit-color: #888888; // 단위 색상 (회색)
```

#### 차트 색상
```scss
$chart-line-color: #888888; // 그래프 선 색상 (회색)
$chart-dot-color-normal: #A16A51; // 정상 데이터 포인트 (브라운)
$chart-dot-color-warning: #ed8936; // 경계 데이터 포인트 (주황)
$chart-dot-color-abnormal: #f56565; // 이상 데이터 포인트 (빨강)
$chart-dot-color-selected: #55433B; // 선택된 포인트 (진한 브라운)
$chart-axis-color: #888888; // 축 레이블 색상
$chart-grid-color: rgba(136, 136, 136, 0.2); // 그리드 선 색상
```

#### 뱃지 색상
```scss
// 상태별 뱃지 색상
$badge-normal-bg: #10b981; // 정상 배경 (초록)
$badge-normal-text: #ffffff; // 정상 텍스트 (흰색)
$badge-measure-bg: #888888; // 측정 배경 (회색)
$badge-measure-text: #ffffff; // 측정 텍스트 (흰색)
$badge-warning-bg: #ed8936; // 경계 배경 (주황)
$badge-warning-text: #ffffff; // 경계 텍스트 (흰색)
$badge-abnormal-bg: #f56565; // 이상 배경 (빨강)
$badge-abnormal-text: #ffffff; // 이상 텍스트 (흰색)
```

### 3. 카드 구조

#### 카드 레이아웃
```
┌─────────────────────────────────┐
│ [뱃지]        [제목]            │
│                                 │
│         [큰 수치] [단위]        │
│                                 │
│         [그래프 영역]            │
│                                 │
│    [측정일: YY년 MM월 DD일]     │
└─────────────────────────────────┘
```

#### 카드 높이
```scss
$card-height: 400px; // 카드 높이 (일관성 확보)
$card-min-height: 380px; // 최소 높이
```

### 4. 뱃지 시스템

#### 뱃지 상태
- **정상** (`normal`): 초록 배경, 흰색 텍스트
- **측정** (`measure`): 회색 배경, 흰색 텍스트
- **경계** (`warning`): 주황 배경, 흰색 텍스트
- **이상** (`abnormal`): 빨강 배경, 흰색 텍스트

#### 뱃지 위치
- 우상단 고정
- 둥근 모서리 (6px)
- 작은 폰트 (12px)

### 5. 그래프 시스템

#### 그래프 선
- 색상: 회색 (#888888)
- 두께: 2px
- 스타일: 실선

#### 데이터 포인트 (동그라미)
- 정상: 브라운 (#A16A51), 채워진 원
- 경계: 주황 (#ed8936), 채워진 원
- 이상: 빨강 (#f56565), 채워진 원
- 선택됨: 진한 브라운 (#55433B), 더 큰 원
- 빈 데이터: 스피너 이미지 (`welno_logo 2.png`)

#### 차트 축
- 폰트: Poppins
- 색상: #888888
- 크기: 12px

### 6. 날짜 표시

#### 기본 상태
- 그래프 하단에 최근 측정일 표시
- 형식: "측정일 : YY년 MM월 DD일"
- 폰트: Noto Sans KR, 12px, 회색

#### 선택 상태
- 데이터 포인트 클릭 시 해당 날짜 표시
- 동일한 위치에 동적으로 변경

### 7. 간격 시스템

#### 헤더-토글 간격
```scss
$header-toggle-gap: 20px; // 헤더와 토글 사이 간격 (늘림)
```

#### 토글-카드 간격
```scss
$toggle-card-gap: 8px; // 토글과 카드 사이 간격 (줄임)
```

#### 카드 내부 간격
```scss
$card-padding: 16px; // 카드 내부 패딩
$card-element-gap: 12px; // 카드 내부 요소 간격
```

## 📐 컴포넌트 구조

### HealthMetricCard 컴포넌트
```tsx
<HealthMetricCard
  title="신장"
  value={185.2}
  unit="cm"
  status="measure" // normal | measure | warning | abnormal
  chartData={[...]}
  measurementDate="25년 08월 13일"
  onPointClick={(date) => {...}}
/>
```

### StatusBadge 컴포넌트
```tsx
<StatusBadge
  status="normal" // normal | measure | warning | abnormal
  text="정상"
/>
```

## 🎯 구현 우선순위

1. 폰트 시스템 정의 파일 업데이트
2. 색상 시스템 정의 파일 업데이트
3. 뱃지 시스템 공용 컴포넌트 생성
4. 카드 시스템 공용 컴포넌트 생성
5. 그래프 컴포넌트 수정 (선 색상, 빈 데이터 스피너)
6. 날짜 표시 로직 추가
7. 카드 높이 일관성 확보
8. 간격 조정

## 📝 참고사항

- 모든 색상과 폰트는 디자인 토큰으로 정의
- 하드코딩된 값 금지
- 재사용 가능한 컴포넌트로 구성
- 이미지 기준으로 정확한 색상/크기 적용






