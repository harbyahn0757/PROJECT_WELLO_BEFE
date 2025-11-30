# 건강 추이 페이지 레이아웃 분리 계획

## 구조 원칙

### 공용 컴포넌트
- **헤더**: `HealthTrendsHeader` (모든 페이지 공용)
- **토글**: `HealthTrendsToggle` (건강 추이 페이지 전용이지만 헤더 아래 공용 영역)

### 페이지별 레이아웃
- **랜딩 페이지**: 기존 구조 유지
- **건강 추이 페이지**: 헤더 아래부터 별도 레이아웃

## 현재 구조

```
랜딩 페이지:
- MainPage (기존 구조 유지)

건강 추이 페이지:
- HealthDataViewer
  - HealthTrendsHeader (공용)
  - HealthTrendsToggle (공용)
  - health-trends-content (페이지별)
    - TrendsSection / UnifiedHealthTimeline
```

## 목표 구조

```
랜딩 페이지:
- MainPage (기존 구조 유지)

건강 추이 페이지:
- HealthDataViewer
  - HealthTrendsHeader (공용)
  - HealthTrendsToggle (공용)
  - HealthTrendsContentLayout (건강 추이 전용)
    - TrendsSection / UnifiedHealthTimeline
```

## 작업 계획

### Phase 1: 건강 추이 컨텐츠 레이아웃 컴포넌트 생성
1. `HealthTrendsContentLayout` 컴포넌트 생성
   - 위치: `frontend/src/components/health/HealthTrendsContentLayout/`
   - 역할: 토글 하단부터 시작하는 컨텐츠 영역 관리
   - 스타일: 토글 하단(180px) + 간격(30px) = 210px 패딩

### Phase 2: HealthDataViewer에서 레이아웃 적용
1. `HealthTrendsContentLayout` import
2. 기존 `health-trends-content` div를 레이아웃 컴포넌트로 교체
3. Pull-to-refresh 로직을 레이아웃에 전달

### Phase 3: 스타일 정리
1. `HealthTrendsContentLayout/styles.scss` 생성
   - 컨텐츠 영역 스타일 정의
   - 토글과의 간격 관리
2. `HealthDataViewer/styles.scss` 정리
   - 레이아웃 관련 스타일 제거
   - 공용 스타일만 유지

## 파일 구조

```
frontend/src/components/health/
├── HealthTrendsHeader/ (공용)
├── HealthTrendsToggle/ (공용)
├── HealthTrendsContentLayout/ (건강 추이 전용)
│   ├── index.tsx
│   └── styles.scss
└── HealthDataViewer/
    ├── index.tsx
    └── styles.scss
```

## 스타일 정의

### HealthTrendsContentLayout
- `padding-top: 210px` (토글 하단 180px + 간격 30px)
- `background: #F5F5F5`
- `overflow-y: auto`
- `min-height: calc(100vh - 210px)`

### 하위 섹션
- `trends-section`: `padding-top: 0`
- `health-metrics-wrapper`: `padding-top: 0` (좌우만 유지)








