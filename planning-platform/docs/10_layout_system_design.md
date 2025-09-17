# 레이아웃 시스템 설계 문서

## 📋 개요

건강검진 데이터 추출 시스템의 표준화된 레이아웃 컴포넌트 시스템을 정의합니다.
각 레이아웃 타입별로 헤더, 서브헤더, 섹션 구성을 체계화하여 재사용 가능한 템플릿을 제공합니다.

## 🏗️ 레이아웃 아키텍처

### 기본 구조

```
┌─────────────────────────────────────────┐
│               Header                     │ ← 고정 (모든 레이아웃)
├─────────────────────────────────────────┤
│            Sub Header                    │ ← 선택적
├─────────────────────────────────────────┤
│              Content Area                │ ← 가변 (레이아웃 타입별)
└─────────────────────────────────────────┘
```

## 📐 레이아웃 타입 정의

### 1. BasicLayout (기본 레이아웃)
**구조**: Header + Single Content
```
┌─────────────────────────────────────────┐
│               Header                     │
├─────────────────────────────────────────┤
│                                         │
│              Main Content               │
│                                         │
└─────────────────────────────────────────┘
```

**사용 케이스**: 
- 단순 페이지
- 로그인/회원가입
- 에러 페이지

### 2. TwoColumnLayout (2열 레이아웃)
**구조**: Header + Sub Header + 2 Columns
```
┌─────────────────────────────────────────┐
│               Header                     │
├─────────────────────────────────────────┤
│            Sub Header                    │
├─────────────────┬───────────────────────┤
│     Left        │       Right           │
│   Column        │     Column            │
│    (2fr)        │      (1fr)            │
└─────────────────┴───────────────────────┘
```

**사용 케이스**:
- 메인-사이드바 구조
- 리스트-디테일 뷰

**비율 옵션**:
- `[1, 1]`: 균등 분할
- `[2, 1]`: 왼쪽 우세 (기본값)
- `[1, 2]`: 오른쪽 우세

### 3. ThreeColumnLayout (3열 레이아웃) - 현재 사용 중
**구조**: Header + Sub Header + 3 Columns
```
┌─────────────────────────────────────────┐
│               Header                     │
├─────────────────────────────────────────┤
│            Sub Header                    │
├─────────┬─────────────────┬─────────────┤
│ Left    │     Center      │    Right    │
│Column   │    Column       │   Column    │
│ (1fr)   │     (2fr)       │   (1fr)     │
└─────────┴─────────────────┴─────────────┘
```

**사용 케이스**:
- 복잡한 작업 화면
- 다단계 프로세스

**비율 옵션**:
- `[1, 2, 1]`: 센터 포커스 (기본값)
- `[1, 1, 1]`: 균등 분할
- `[2, 1, 1]`: 왼쪽 포커스
- `[1, 1, 2]`: 오른쪽 포커스

### 4. GridLayout (그리드 레이아웃)
**구조**: Header + Sub Header + Grid (2x2, 3x2 등)
```
┌─────────────────────────────────────────┐
│               Header                     │
├─────────────────────────────────────────┤
│            Sub Header                    │
├─────────────────┬───────────────────────┤
│     Card 1      │       Card 2          │
├─────────────────┼───────────────────────┤
│     Card 3      │       Card 4          │
└─────────────────┴───────────────────────┘
```

**사용 케이스**:
- 대시보드
- 카드 기반 인터페이스

### 5. TabLayout (탭 레이아웃)
**구조**: Header + Tab Navigation + Content
```
┌─────────────────────────────────────────┐
│               Header                     │
├─────────────────────────────────────────┤
│  Tab1  │  Tab2  │  Tab3  │              │
├─────────────────────────────────────────┤
│                                         │
│            Tab Content                  │
│                                         │
└─────────────────────────────────────────┘
```

**사용 케이스**:
- 다단계 양식
- 설정 페이지

## 🧩 컴포넌트 정의

### Header Types
1. **StandardHeader**: 기본 헤더 (제목 + 버튼들)
2. **BrandHeader**: 브랜드 로고 포함
3. **NavigationHeader**: 네비게이션 메뉴 포함

### Sub Header Types
1. **BreadcrumbSubHeader**: 경로 표시
2. **ActionsSubHeader**: 액션 버튼들
3. **SearchSubHeader**: 검색 기능
4. **StatusSubHeader**: 상태 정보

### Section Types
1. **ContentSection**: 일반 컨텐츠
2. **FormSection**: 폼 입력
3. **ListSection**: 리스트 표시
4. **GridSection**: 그리드 표시
5. **PlaceholderSection**: 빈 상태

## 🔧 사용법 예시

### 현재 사용 중인 3열 레이아웃
```javascript
<ThreeColumnLayout
  header={<StandardHeader />}
  subHeader={<BreadcrumbSubHeader />}
  leftSection={<FormSection title="파일 업로드" />}
  centerSection={<PlaceholderSection title="테이블 데이터" />}
  rightSection={<FormSection title="관계 설정" />}
  columnRatios={[1, 2, 1]}
/>
```

### 2열 레이아웃 예시
```javascript
<TwoColumnLayout
  header={<StandardHeader />}
  subHeader={<ActionsSubHeader />}
  leftSection={<ListSection title="파일 목록" />}
  rightSection={<ContentSection title="파일 상세" />}
  columnRatios={[1, 2]}
/>
```

## 📱 반응형 규칙

### 브레이크포인트별 동작
- **1400px+**: 원본 레이아웃 유지
- **1200px**: 비율 조정 (예: 2:1 → 1.5:1)
- **992px**: 간격/패딩 축소
- **768px**: 세로 스택으로 전환
- **480px**: 최소 크기 적용

### 스택 순서 (모바일)
1. Sub Header (고정 상단)
2. Primary Section (주 컨텐츠)
3. Secondary Sections (보조 컨텐츠)

## 🎨 테마 시스템

### 색상 테마
- **Light Theme**: 기본 밝은 테마
- **Professional Theme**: 비즈니스용 차분한 테마
- **High Contrast**: 접근성 개선 고대비 테마

### 간격 시스템
- **Compact**: 좁은 간격 (모바일 최적화)
- **Normal**: 표준 간격 (기본값)
- **Spacious**: 넓은 간격 (대형 화면 최적화)

## 🚀 구현 우선순위

### Phase 1 (현재)
- [x] ThreeColumnLayout 기본 구현
- [x] 반응형 시스템
- [x] 표준 Header/SubHeader

### Phase 2 (다음)
- [ ] TwoColumnLayout 구현
- [ ] BasicLayout 구현
- [ ] Section 타입 확장

### Phase 3 (향후)
- [ ] GridLayout 구현
- [ ] TabLayout 구현
- [ ] 테마 시스템 구축

## 📚 네이밍 컨벤션

### 레이아웃 컴포넌트
- `{Purpose}Layout`: 목적별 레이아웃 (예: DashboardLayout, FormLayout)
- `{Columns}ColumnLayout`: 열 수별 레이아웃 (예: TwoColumnLayout)

### 섹션 컴포넌트
- `{Type}Section`: 타입별 섹션 (예: FormSection, ListSection)
- `{Purpose}Section`: 목적별 섹션 (예: UploadSection, SettingsSection)

### Props 네이밍
- `columnRatios`: 열 비율 배열
- `sectionGap`: 섹션 간 간격
- `theme`: 테마 타입
- `responsive`: 반응형 활성화 여부

## 🔄 확장성

### 새로운 레이아웃 추가
1. 레이아웃 타입 정의
2. 컴포넌트 구현
3. CSS 반응형 규칙 추가
4. 문서 업데이트

### 커스텀 섹션 추가
1. Section 베이스 컴포넌트 상속
2. 특화된 스타일 정의
3. Props 인터페이스 정의
4. 사용 예시 작성

---

## 📝 업데이트 이력

- **2025-01-24**: 초기 레이아웃 시스템 설계 문서 작성
- 현재 ThreeColumnLayout 기반으로 표준화 진행 중
