# 카드 시스템 리팩터링 TODO 리스트

## 📋 작업 개요
건강 추이 분석 카드 시스템을 공용화하고 디자인 토큰 기반으로 재구성합니다.

## ✅ 완료된 작업
- [x] 이미지 분석 및 카드 시스템 디자인 가이드 작성

## 🔄 진행 중인 작업
- [ ] 현재 코드 5번 확인 (5개 파일)

## 📝 상세 TODO 리스트

### Phase 1: 정의 파일 업데이트

#### 1.1 폰트 시스템 정의 파일 업데이트
**파일**: `frontend/src/styles/_variables.scss`

**작업 내용**:
- [ ] `$font-family-base`를 'Noto Sans KR'로 통일
- [ ] `$font-family-value: 'Sora', 'Noto Sans KR', sans-serif;` 추가
- [ ] `$font-color-value: #55433B;` 추가
- [ ] `$font-weight-value: 600;` 추가 (세미볼드)
- [ ] `$font-family-chart-axis: 'Poppins', 'Noto Sans KR', sans-serif;` 추가
- [ ] `$font-color-chart-axis: #888888;` 추가

#### 1.2 색상 시스템 정의 파일 업데이트
**파일**: `frontend/src/styles/_variables.scss`

**작업 내용**:
- [ ] `$value-color: #55433B;` 추가 (수치 색상)
- [ ] `$value-unit-color: #888888;` 추가 (단위 색상)
- [ ] `$chart-line-color: #888888;` 추가 (그래프 선 색상)
- [ ] `$chart-dot-color-normal: #A16A51;` 추가
- [ ] `$chart-dot-color-warning: #ed8936;` 추가
- [ ] `$chart-dot-color-abnormal: #f56565;` 추가
- [ ] `$chart-dot-color-selected: #55433B;` 추가
- [ ] `$chart-axis-color: #888888;` 추가
- [ ] `$chart-grid-color: rgba(136, 136, 136, 0.2);` 추가
- [ ] 뱃지 색상 변수 추가:
  - [ ] `$badge-normal-bg: #10b981;`
  - [ ] `$badge-normal-text: #ffffff;`
  - [ ] `$badge-measure-bg: #888888;`
  - [ ] `$badge-measure-text: #ffffff;`
  - [ ] `$badge-warning-bg: #ed8936;`
  - [ ] `$badge-warning-text: #ffffff;`
  - [ ] `$badge-abnormal-bg: #f56565;`
  - [ ] `$badge-abnormal-text: #ffffff;`

#### 1.3 간격 시스템 정의 파일 업데이트
**파일**: `frontend/src/styles/_variables.scss`

**작업 내용**:
- [ ] `$header-toggle-gap: 20px;` 추가
- [ ] `$toggle-card-gap: 8px;` 추가
- [ ] `$card-height: 400px;` 추가
- [ ] `$card-min-height: 380px;` 추가

### Phase 2: 공용 컴포넌트 생성

#### 2.1 뱃지 시스템 공용 컴포넌트 생성
**파일**: `frontend/src/components/shared/StatusBadge/index.tsx`, `styles.scss`

**작업 내용**:
- [ ] StatusBadge 컴포넌트 생성
- [ ] props: `status: 'normal' | 'measure' | 'warning' | 'abnormal'`, `text: string`, `date?: string`
- [ ] 상태별 색상 적용
- [ ] 우상단 위치 스타일
- [ ] 날짜 표시 옵션

#### 2.2 카드 시스템 공용 컴포넌트 생성
**파일**: `frontend/src/components/health/HealthMetricCard/index.tsx`, `styles.scss`

**작업 내용**:
- [ ] HealthMetricCard 컴포넌트 생성
- [ ] props 정의:
  - `title: string`
  - `value: number`
  - `unit: string`
  - `status: 'normal' | 'measure' | 'warning' | 'abnormal'`
  - `chartData: ChartData[]`
  - `measurementDate: string`
  - `onPointClick?: (date: string) => void`
- [ ] StatusBadge 통합
- [ ] 수치 표시 (Sora 폰트, #55433B, 세미볼드)
- [ ] 그래프 영역 통합
- [ ] 날짜 표시 영역

### Phase 3: 그래프 컴포넌트 수정

#### 3.1 LineChart 컴포넌트 수정
**파일**: `frontend/src/components/charts/LineChart.tsx` (또는 해당 파일)

**작업 내용**:
- [ ] 그래프 선 색상 회색(#888888)으로 변경
- [ ] 데이터 포인트 동그라미 색상 상태별 적용
- [ ] 빈 데이터 부분 스피너 이미지(`welno_logo 2.png`) 교체
- [ ] 차트 축 폰트 Poppins, 색상 #888888 적용
- [ ] 그리드 선 색상 rgba(136, 136, 136, 0.2) 적용

### Phase 4: 날짜 표시 로직 추가

#### 4.1 차트 날짜 표시 기능
**파일**: `frontend/src/components/health/HealthDataViewer/TrendsSection.tsx`

**작업 내용**:
- [ ] 선택된 데이터 포인트 상태 관리
- [ ] 데이터 포인트 클릭 핸들러 추가
- [ ] 그래프 하단 날짜 표시 영역 추가
- [ ] 디폴트 날짜(최근 날짜) 표시 로직
- [ ] 선택 시 날짜 업데이트 로직

### Phase 5: 스타일 통합 및 적용

#### 5.1 카드 높이 일관성 확보
**파일**: `frontend/src/pages/ComprehensiveAnalysisPage/styles.scss`

**작업 내용**:
- [ ] `.health-metric-card` 높이 400px로 설정
- [ ] `min-height: 380px` 설정
- [ ] 모든 카드 높이 통일

#### 5.2 간격 조정
**파일들**:
- `frontend/src/components/health/HealthTrendsHeader/styles.scss`
- `frontend/src/components/health/HealthTrendsToggle/styles.scss`
- `frontend/src/components/health/HealthDataViewer/styles.scss`

**작업 내용**:
- [ ] 헤더-토글 간격 20px로 증가
- [ ] 토글 `top` 값 조정 (90px + 20px = 110px)
- [ ] 토글-카드 간격 8px로 감소
- [ ] 콘텐츠 `padding-top` 재계산 (110px + 60px + 8px = 178px)

#### 5.3 카드 스타일 업데이트
**파일**: `frontend/src/pages/ComprehensiveAnalysisPage/styles.scss`

**작업 내용**:
- [ ] 카드 배경 투명 처리
- [ ] 섹션 배경 투명 처리
- [ ] 수치 폰트 Sora 적용
- [ ] 수치 색상 #55433B 적용
- [ ] 단위 색상 #888888 적용
- [ ] 뱃지 스타일 업데이트 (StatusBadge 사용)

### Phase 6: 코드 통합 및 검증

#### 6.1 TrendsSection 컴포넌트 업데이트
**파일**: `frontend/src/components/health/HealthDataViewer/TrendsSection.tsx`

**작업 내용**:
- [ ] HealthMetricCard 컴포넌트 사용
- [ ] StatusBadge 컴포넌트 사용
- [ ] 날짜 표시 로직 통합
- [ ] 하드코딩된 값 제거

#### 6.2 최종 검증
**작업 내용**:
- [ ] 모든 폰트가 디자인 토큰 사용하는지 확인
- [ ] 모든 색상이 디자인 토큰 사용하는지 확인
- [ ] 카드 높이 일관성 확인
- [ ] 간격 정확성 확인
- [ ] 뱃지 상태별 색상 확인
- [ ] 그래프 선/포인트 색상 확인
- [ ] 날짜 표시 기능 확인
- [ ] 빈 데이터 스피너 이미지 확인

## 📊 현재 코드 확인 체크리스트

### 확인할 파일 (5번씩)
1. [ ] `frontend/src/components/health/HealthDataViewer/TrendsSection.tsx` (5번)
2. [ ] `frontend/src/pages/ComprehensiveAnalysisPage/styles.scss` (5번)
3. [ ] `frontend/src/components/health/HealthTrendsToggle/styles.scss` (5번)
4. [ ] `frontend/src/components/health/HealthTrendsHeader/styles.scss` (5번)
5. [ ] `frontend/src/components/health/HealthDataViewer/styles.scss` (5번)

### 확인 사항
- [ ] 현재 카드 구조 파악
- [ ] 현재 뱃지 구현 방식 파악
- [ ] 현재 그래프 구현 방식 파악
- [ ] 현재 폰트/색상 하드코딩 위치 파악
- [ ] 현재 간격 설정 파악

## 🎯 작업 순서

1. **정의 파일 업데이트** (Phase 1)
2. **공용 컴포넌트 생성** (Phase 2)
3. **그래프 컴포넌트 수정** (Phase 3)
4. **날짜 표시 로직 추가** (Phase 4)
5. **스타일 통합 및 적용** (Phase 5)
6. **코드 통합 및 검증** (Phase 6)

## 📝 참고사항

- 모든 작업은 디자인 토큰 기반으로 진행
- 하드코딩된 값 완전 제거
- 재사용 가능한 컴포넌트로 구성
- 이미지 기준으로 정확한 색상/크기 적용




