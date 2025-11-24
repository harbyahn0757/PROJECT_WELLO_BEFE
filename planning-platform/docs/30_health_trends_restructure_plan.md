# 건강 추이 페이지 구조 재정의 계획

## 현재 구조 분석

### 현재 HTML 구조
```
<div className="health-data-viewer">
  <HealthTrendsHeader /> (fixed, top: 0, height: 90px)
  <HealthTrendsToggle /> (fixed, top: 120px, height: 60px)
  <div className="health-trends-content"> (relative)
    <div className="trends-section"> (padding-top: 180px)
      <section className="analysis-card">
        <div className="health-metrics-wrapper"> (padding-top: 30px)
          <div className="health-metrics-slider">
            <!-- 카드들 -->
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
```

### 현재 문제점
1. `trends-section`에 `padding-top: 180px`가 있어서 토글 하단 위치를 직접 계산
2. `health-metrics-wrapper`에 `padding-top: 30px`가 중복으로 존재
3. 구조가 복잡하고 간격 관리가 어려움

## 새로운 구조 설계

### 목표 구조
```
<div className="health-data-viewer">
  <HealthTrendsHeader /> (fixed, top: 0, height: 90px)
  <HealthTrendsToggle /> (fixed, top: 120px, height: 60px)
  <div className="health-trends-content"> (컨텐츠 영역)
    <!-- padding-top: 210px (토글 하단 180px + 간격 30px) -->
    <!-- 또는 padding-top: 30px + margin-top: 180px -->
    <div className="trends-section"> (패딩 제거)
      <section className="analysis-card">
        <div className="health-metrics-wrapper"> (패딩 제거)
          <div className="health-metrics-slider">
            <!-- 카드들 -->
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
```

### 계산
- 헤더: 90px (top: 0)
- 헤더-토글 간격: 30px
- 토글: 60px (top: 120px, 하단: 180px)
- 토글-컨텐츠 간격: 30px
- 컨텐츠 영역 시작: 210px (180px + 30px)

## 작업 계획

### Phase 1: 컨텐츠 영역 재정의
1. `health-trends-content` 스타일 수정
   - `padding-top: 210px` (토글 하단 180px + 간격 30px)
   - `background: #F5F5F5`
   - `overflow-y: auto`

### Phase 2: 하위 섹션 패딩 제거
1. `trends-section` 패딩 제거
   - `padding-top: 0`
   - `margin-top: 0`

2. `health-metrics-wrapper` 패딩 제거
   - `padding-top: 0`
   - 좌우 패딩만 유지

### Phase 3: UnifiedHealthTimeline도 동일하게 적용
1. `unified-health-timeline` 패딩 제거
   - `padding-top: 0`
   - `margin-top: 0`

## 파일별 수정 계획

### 1. HealthDataViewer/styles.scss
- `.health-trends-content`: `padding-top: 210px` 설정
- `.trends-section`: `padding-top: 0` 설정
- `.unified-health-timeline`: `padding-top: 0` 설정

### 2. ComprehensiveAnalysisPage/styles.scss
- `.health-metrics-wrapper`: `padding-top: 0` 설정 (좌우 패딩만 유지)

### 3. TrendsSection.tsx
- 구조 변경 없음 (스타일만 수정)

## 최종 구조

```
헤더 (fixed, top: 0, height: 90px)
  ↓ 간격 30px
토글 (fixed, top: 120px, height: 60px, 하단: 180px)
  ↓ 간격 30px
컨텐츠 영역 (padding-top: 210px)
  └─ trends-section (padding: 0)
      └─ analysis-card
          └─ health-metrics-wrapper (padding-top: 0, 좌우만)
              └─ health-metrics-slider (카드들)
```

## 장점
1. 간격 관리가 단순해짐 (컨텐츠 영역에서 한 번에 처리)
2. 하위 섹션들이 간격에 신경 쓸 필요 없음
3. 구조가 명확하고 유지보수 용이







