# 건강 추이 페이지 구조

## 라우팅
- **경로**: `/results-trend`
- **컴포넌트**: `HealthDataViewer`
- **위치**: `App.tsx`에서 라우팅 처리

## 현재 구현된 폴더 구조

### 1. 메인 컨테이너
**`frontend/src/components/health/HealthDataViewer/`**
- `index.tsx`: 메인 컨테이너 컴포넌트
  - `ContentLayoutWithHeader` 레이아웃 사용
  - Pull-to-refresh 로직
  - 데이터 로딩 및 상태 관리
  - 토글 모드 전환 (trends/timeline)
- `styles.scss`: HealthDataViewer 전용 스타일
- `TrendsSection.tsx`: 건강지표 추이 분석 섹션

### 2. 공용 헤더
**`frontend/src/components/health/HealthTrendsHeader/`**
- `index.tsx`: 헤더 컴포넌트
  - 뒤로가기 버튼
  - 제목 ("건강 추이")
  - 마지막 업데이트 시간
- `styles.scss`: 헤더 스타일

### 3. 공용 토글
**`frontend/src/components/health/HealthTrendsToggle/`**
- `index.tsx`: 토글 컴포넌트
  - "건강지표 추이 분석" / "의료기록 타임라인" 전환
- `styles.scss`: 토글 스타일

### 4. 건강지표 추이 분석 섹션
**`frontend/src/components/health/HealthDataViewer/TrendsSection.tsx`**
- 건강 지표 카드들 표시
- 필터링 기능
- 차트 및 그래프 표시

### 5. 의료기록 타임라인 섹션
**`frontend/src/components/health/UnifiedHealthTimeline/`**
- `index.tsx`: 통합 타임라인 컴포넌트
  - 건강검진 데이터
  - 처방전 데이터
  - 타임라인 형태로 표시
- `styles.scss`: 타임라인 스타일

### 6. AI 분석 섹션
**`frontend/src/components/health/AIAnalysisSection/`**
- `index.tsx`: AI 종합 분석 컴포넌트
- `styles.scss`: AI 분석 섹션 스타일

### 7. 레이아웃 (최근 생성)
**`frontend/src/layouts/ContentLayoutWithHeader/`**
- `index.tsx`: 헤더 + 토글 + 컨텐츠 레이아웃
- `styles.scss`: 레이아웃 스타일

## 페이지 구성 흐름

```
/results-trend
└── HealthDataViewer (메인 컨테이너)
    └── ContentLayoutWithHeader (레이아웃)
        ├── HealthTrendsHeader (공용 헤더)
        ├── HealthTrendsToggle (공용 토글)
        └── 컨텐츠 영역
            ├── TrendsSection (건강지표 추이 분석)
            │   └── 건강 지표 카드들
            ├── UnifiedHealthTimeline (의료기록 타임라인)
            │   └── 타임라인 형태 데이터
            └── AIAnalysisSection (AI 분석, 조건부 표시)
```

## 토글 모드별 표시 내용

### 1. "건강지표 추이 분석" 모드 (trends)
- `TrendsSection` 컴포넌트 표시
- 건강 지표 카드들 (혈압, 혈당, 콜레스테롤 등)
- 각 지표별 차트 및 그래프
- 필터링 기능

### 2. "의료기록 타임라인" 모드 (timeline)
- `UnifiedHealthTimeline` 컴포넌트 표시
- 건강검진 데이터 타임라인
- 처방전 데이터 타임라인
- 통합 타임라인 형태

## 주요 기능

1. **Pull-to-refresh**: 컨텐츠 영역에서 아래로 당겨서 새로고침
2. **토글 전환**: 두 가지 뷰 모드 전환
3. **데이터 로딩**: IndexedDB 및 API를 통한 데이터 로딩
4. **AI 분석**: 조건부로 AI 종합 분석 섹션 표시

## 스타일 관리

- **레이아웃 스타일**: `ContentLayoutWithHeader/styles.scss`
- **헤더 스타일**: `HealthTrendsHeader/styles.scss`
- **토글 스타일**: `HealthTrendsToggle/styles.scss`
- **컨텐츠 스타일**: 각 섹션별 스타일 파일
- **색상 시스템**: `_variables.scss`에서 공용 사용








