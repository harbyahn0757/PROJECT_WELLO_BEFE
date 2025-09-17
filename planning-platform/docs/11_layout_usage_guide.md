# 레이아웃 시스템 사용 가이드

## 📋 개요

건강검진 데이터 추출 시스템의 표준화된 레이아웃 컴포넌트 사용법을 설명합니다.
각 상황에 맞는 최적의 레이아웃 선택과 구현 방법을 안내합니다.

## 🚀 빠른 시작

### 1. 기본 import
```javascript
import { 
  BasicLayout, 
  TwoColumnLayout, 
  MultiSectionLayout,
  LayoutTypes,
  ThemeTypes,
  SpacingTypes 
} from '../shared/components/layout';
```

### 2. 현재 사용 중인 3열 레이아웃
```javascript
function App() {
  return (
    <MultiSectionLayout
      subHeader={<BreadcrumbComponent />}
      section1={<UploadSection />}
      section2={<TableDataSection />}
      section3={<RelationshipSection />}
      sectionRatios={[1, 2, 1]}
      theme="light"
      spacing="normal"
    />
  );
}
```

## 📐 레이아웃 선택 가이드

### 언제 어떤 레이아웃을 사용할까?

#### BasicLayout - 단순한 페이지
```javascript
// ✅ 이런 경우에 사용
// - 로그인/회원가입 페이지
// - 에러 페이지  
// - 단순한 정보 표시 페이지

<BasicLayout centered maxWidth="400px">
  <BasicLayout.Container title="로그인">
    <LoginForm />
  </BasicLayout.Container>
</BasicLayout>
```

#### TwoColumnLayout - 메인-사이드 구조
```javascript
// ✅ 이런 경우에 사용
// - 리스트-상세 뷰
// - 메인 컨텐츠 + 사이드바
// - 설정 페이지

<TwoColumnLayout
  leftSection={<FileListSection />}
  rightSection={<FileDetailSection />}
  columnRatios={[2, 1]}
/>
```

#### MultiSectionLayout - 복잡한 작업 화면
```javascript
// ✅ 이런 경우에 사용 (현재 앱)
// - 다단계 작업 프로세스
// - 여러 도구가 필요한 화면
// - 복잡한 데이터 처리

<MultiSectionLayout
  section1={<Tools />}
  section2={<MainWork />}
  section3={<Settings />}
  sectionRatios={[1, 2, 1]}
/>
```

## 🎨 테마 시스템 사용법

### 테마 변경
```javascript
// Light 테마 (기본)
<BasicLayout theme={ThemeTypes.LIGHT}>

// Professional 테마 (비즈니스용)
<BasicLayout theme={ThemeTypes.PROFESSIONAL}>

// High Contrast 테마 (접근성)
<BasicLayout theme={ThemeTypes.HIGH_CONTRAST}>
```

### 간격 조정
```javascript
// Compact (모바일 최적화)
<TwoColumnLayout spacing={SpacingTypes.COMPACT}>

// Normal (기본)
<TwoColumnLayout spacing={SpacingTypes.NORMAL}>

// Spacious (대형 화면 최적화)
<TwoColumnLayout spacing={SpacingTypes.SPACIOUS}>
```

## 📱 반응형 대응

### 자동 반응형
```javascript
// 모든 레이아웃은 자동으로 반응형 지원
<MultiSectionLayout
  // 데스크톱: 1:2:1 비율 횡배치
  // 태블릿: 1:1.5:1 비율 횡배치
  // 모바일: 세로 스택으로 자동 전환
  sectionRatios={[1, 2, 1]}
/>
```

### 화면 크기별 레이아웃 변경
```javascript
import { layoutUtils } from '../shared/components/layout';

function ResponsiveApp() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  
  const getLayout = () => {
    if (layoutUtils.isMobile(screenWidth)) {
      return (
        <BasicLayout>
          <MobileContent />
        </BasicLayout>
      );
    } else if (layoutUtils.isTablet(screenWidth)) {
      return (
        <TwoColumnLayout
          leftSection={<MainContent />}
          rightSection={<SideContent />}
        />
      );
    } else {
      return (
        <MultiSectionLayout
          section1={<Tools />}
          section2={<MainContent />}
          section3={<Settings />}
        />
      );
    }
  };

  return getLayout();
}
```

## 🧩 섹션 컴포넌트 활용

### BasicLayout 서브 컴포넌트
```javascript
<BasicLayout>
  {/* 컨테이너로 영역 구분 */}
  <BasicLayout.Container 
    title="메인 제목"
    subtitle="부제목"
  >
    <p>내용...</p>
  </BasicLayout.Container>

  {/* 카드로 내용 그룹화 */}
  <BasicLayout.Card title="카드 제목">
    <form>...</form>
  </BasicLayout.Card>

  {/* 카드 그리드 배치 */}
  <div className="basic-cards-grid">
    <BasicLayout.Card title="카드 1">내용1</BasicLayout.Card>
    <BasicLayout.Card title="카드 2">내용2</BasicLayout.Card>
    <BasicLayout.Card title="카드 3">내용3</BasicLayout.Card>
  </div>
</BasicLayout>
```

### TwoColumnLayout 섹션
```javascript
<TwoColumnLayout
  leftSection={
    <TwoColumnLayout.Section title="파일 목록" fullHeight>
      <FileList />
    </TwoColumnLayout.Section>
  }
  rightSection={
    <TwoColumnLayout.Section title="파일 상세">
      <FileDetail />
    </TwoColumnLayout.Section>
  }
/>
```

### MultiSectionLayout 섹션
```javascript
<MultiSectionLayout
  section1={
    <MultiSectionLayout.Section title="도구">
      <ToolPanel />
    </MultiSectionLayout.Section>
  }
  // ...
/>
```

## 🔧 커스터마이징

### 컬럼 비율 조정
```javascript
import { columnRatioPresets } from '../shared/components/layout';

// 프리셋 사용
<TwoColumnLayout columnRatios={columnRatioPresets.sidebar} />

// 커스텀 비율
<MultiSectionLayout sectionRatios={[3, 4, 2]} />
```

### 서브헤더 커스터마이징
```javascript
const CustomSubHeader = () => (
  <MultiSectionLayout.SubHeader>
    <div className="breadcrumb">
      <span>홈</span> → <span>파일 분석</span> → <span>관계 설정</span>
    </div>
    <div className="actions">
      <Button variant="outline">도움말</Button>
      <Button variant="primary">저장</Button>
    </div>
  </MultiSectionLayout.SubHeader>
);

<MultiSectionLayout subHeader={<CustomSubHeader />} />
```

### 헤더 커스터마이징
```javascript
const CustomHeader = () => (
  <Header>
    <div className="custom-header-content">
      <h1>커스텀 제목</h1>
      <div className="custom-actions">
        <Button>액션 1</Button>
        <Button>액션 2</Button>
      </div>
    </div>
  </Header>
);

<BasicLayout header={<CustomHeader />}>
```

## 📋 실제 사용 예시

### 예시 1: 파일 관리 페이지
```javascript
function FileManagePage() {
  return (
    <TwoColumnLayout
      subHeader={
        <div className="breadcrumb">
          파일 관리 → 업로드된 파일
        </div>
      }
      leftSection={
        <TwoColumnLayout.Section title="파일 목록">
          <FileUpload />
          <FileList />
        </TwoColumnLayout.Section>
      }
      rightSection={
        <TwoColumnLayout.Section title="파일 정보">
          <FilePreview />
          <FileActions />
        </TwoColumnLayout.Section>
      }
      columnRatios={[2, 1]}
    />
  );
}
```

### 예시 2: 설정 페이지
```javascript
function SettingsPage() {
  return (
    <BasicLayout maxWidth="800px">
      <BasicLayout.Container title="시스템 설정">
        <BasicLayout.Card title="일반 설정">
          <GeneralSettings />
        </BasicLayout.Card>
        
        <BasicLayout.Card title="알림 설정">
          <NotificationSettings />
        </BasicLayout.Card>
        
        <BasicLayout.Card title="보안 설정">
          <SecuritySettings />
        </BasicLayout.Card>
      </BasicLayout.Container>
    </BasicLayout>
  );
}
```

### 예시 3: 대시보드 (현재 앱 구조)
```javascript
function Dashboard() {
  return (
    <MultiSectionLayout
      subHeader={
        <MultiSectionLayout.SubHeader>
          <div className="breadcrumb">
            대시보드 → 데이터 분석 → 관계 설정
          </div>
        </MultiSectionLayout.SubHeader>
      }
      section1={
        <MultiSectionLayout.Section title="파일 업로드">
          <FileUploadForm />
        </MultiSectionLayout.Section>
      }
      section2={
        <MultiSectionLayout.Section title="테이블 데이터">
          <TableViewer />
        </MultiSectionLayout.Section>
      }
      section3={
        <MultiSectionLayout.Section title="관계 설정">
          <RelationshipManager />
        </MultiSectionLayout.Section>
      }
      sectionRatios={[1, 2, 1]}
      theme="light"
      spacing="normal"
    />
  );
}
```

## 🎯 모범 사례

### ✅ 권장사항
1. **적절한 레이아웃 선택**: 컨텐츠 복잡도에 맞는 레이아웃 사용
2. **일관된 테마**: 앱 전체에서 동일한 테마 사용
3. **반응형 고려**: 모바일 우선으로 설계
4. **섹션 제목**: 명확하고 간결한 섹션 제목 사용
5. **컬럼 비율**: 주요 컨텐츠에 더 큰 비율 할당

### ❌ 피해야 할 것
1. **과도한 섹션**: 3개 이상의 섹션은 신중히 고려
2. **불균형한 비율**: 너무 작은 섹션은 사용성 저하
3. **테마 혼용**: 같은 페이지에서 다른 테마 사용
4. **고정 크기**: 반응형을 고려하지 않은 고정 크기
5. **깊은 중첩**: 섹션 내 과도한 컴포넌트 중첩

## 🔍 디버깅 팁

### 레이아웃 문제 해결
```javascript
// 1. 개발자 도구에서 CSS 그리드 확인
.sections-container {
  grid-template-columns: var(--sections-ratio);
}

// 2. 브레이크포인트별 확인
@media (max-width: 768px) {
  // 모바일에서 세로 스택으로 전환되는지 확인
}

// 3. 높이 문제 해결
.layout-section__content {
  min-height: 0; // flexbox 스크롤 활성화
  overflow-y: auto;
}
```

### 성능 최적화
```javascript
// 1. 레이아웃 컴포넌트를 메모이제이션
const MemoizedSection = React.memo(({ children, title }) => (
  <MultiSectionLayout.Section title={title}>
    {children}
  </MultiSectionLayout.Section>
));

// 2. 불필요한 리렌더링 방지
const sectionRatios = useMemo(() => [1, 2, 1], []);
```

---

## 📝 업데이트 이력

- **2025-01-24**: 레이아웃 시스템 사용 가이드 초안 작성
- 실제 사용 예시 및 모범 사례 포함
