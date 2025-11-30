# 레이아웃 간섭 문제 분석

## 문제점

### 1. 헤더 레이아웃 재사용 가능성
- ✅ `ContentLayoutWithHeader`는 재사용 가능한 구조
- ❌ 현재 `HealthDataViewer`에서만 사용 중
- ❌ 로딩/에러 상태에서는 레이아웃을 사용하지 않음

### 2. 스타일 간섭 문제

#### 현재 구조:
```
HealthDataViewer
├── 로딩 상태: question__content 사용 (레이아웃 없음)
├── 에러 상태: question__content 사용 (레이아웃 없음)
└── 정상 상태: ContentLayoutWithHeader 사용
```

#### 문제:
1. **로딩/에러 상태**에서 `question__content` 클래스 사용
   - 다른 페이지의 스타일과 간섭 가능
   - 레이아웃이 일관되지 않음

2. **HealthDataViewer 스타일**이 전역에 영향
   - `.health-data-viewer` 스타일이 다른 컴포넌트에 영향
   - `question__content` 클래스가 다른 곳에서도 사용됨

3. **데이터 없을 때** 처리 불일치
   - TrendsSection: `.no-data` 표시
   - UnifiedHealthTimeline: 빈 상태 표시
   - HealthDataViewer: 데이터 없을 때 처리 없음

## 해결 방안

### 1. 모든 상태에서 ContentLayoutWithHeader 사용
- 로딩 상태도 레이아웃 사용
- 에러 상태도 레이아웃 사용
- 일관된 레이아웃 구조

### 2. 스타일 격리
- HealthDataViewer 스타일을 더 구체적으로 제한
- `question__content` 대신 전용 클래스 사용
- 레이아웃별 스타일 분리

### 3. 데이터 없을 때 처리
- EmptyState 컴포넌트 활용
- 일관된 빈 상태 표시








