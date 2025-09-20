# BNR Planning XogX 캠페인

건강 검진 질병 예측 리포트 캠페인 React 컴포넌트입니다.

## 🚀 주요 기능

- **스킨 시스템**: URL 파라미터(`?skin=O|B`)로 오렌지/파란색 테마 지원
- **반응형 디자인**: 모바일 최적화된 UI/UX
- **모듈화된 구조**: 재사용 가능한 컴포넌트 설계
- **TypeScript 지원**: 완전한 타입 안정성
- **커스텀 캘린더**: 생년월일 입력을 위한 전용 컴포넌트

## 📁 폴더 구조

```
bnr_planning_XogX/
├── index.tsx                 # 메인 진입점
├── EventPage.tsx            # 이벤트 메인 페이지
├── SurveyPage.tsx           # 설문 페이지
├── components/              # 재사용 컴포넌트
│   ├── CustomCalendar.tsx   # 커스텀 캘린더
│   ├── ProgressBar.tsx      # 진행상태바
│   ├── QuestionCard.tsx     # 질문 카드
│   └── OptionItem.tsx       # 옵션 아이템
├── hooks/                   # 커스텀 훅
│   ├── useCampaignSkin.ts   # 스킨 관리
│   └── useSurveyData.ts     # 설문 데이터 관리
├── types/                   # TypeScript 타입
│   └── index.ts
├── styles/                  # 스타일시트
│   └── campaign.scss
└── assets/                  # 정적 자원
    └── images/
```

## 🎨 스킨 시스템

### O 버전 (오렌지)
- Primary: `#f59e0b`
- 기본 테마

### B 버전 (파란색)
- Primary: `#1d4ed8`
- URL에 `?skin=B` 파라미터 추가

## 📋 사용법

### 기본 사용

```tsx
import { BnrPlanningXogXCampaign } from '@/campaigns/bnr_planning_XogX';

function App() {
  return (
    <div>
      <BnrPlanningXogXCampaign />
    </div>
  );
}
```

### 고급 사용 (페이지 제어)

```tsx
import { BnrPlanningXogXCampaign } from '@/campaigns/bnr_planning_XogX';
import { useState } from 'react';

function App() {
  const [currentPage, setCurrentPage] = useState<'event' | 'survey'>('event');

  const handlePageChange = (page: 'event' | 'survey') => {
    console.log('Page changed to:', page);
    setCurrentPage(page);
  };

  return (
    <div>
      <BnrPlanningXogXCampaign
        initialPage={currentPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
```

### 개별 컴포넌트 사용

```tsx
import { EventPage, SurveyPage } from '@/campaigns/bnr_planning_XogX';

function MyCustomCampaign() {
  const [showSurvey, setShowSurvey] = useState(false);

  if (showSurvey) {
    return (
      <SurveyPage 
        onComplete={() => setShowSurvey(false)}
      />
    );
  }

  return (
    <EventPage 
      onStartSurvey={() => setShowSurvey(true)}
    />
  );
}
```

## 🔧 커스텀 훅 사용

### 스킨 관리

```tsx
import { useCampaignSkin } from '@/campaigns/bnr_planning_XogX';

function MyComponent() {
  const { 
    skinType, 
    changeSkin, 
    appliedColors 
  } = useCampaignSkin();

  return (
    <div>
      <p>현재 스킨: {skinType}</p>
      <button onClick={() => changeSkin('B')}>
        파란색으로 변경
      </button>
      <div style={{ color: appliedColors.primary }}>
        테마 색상 적용
      </div>
    </div>
  );
}
```

### 설문 데이터 관리

```tsx
import { useSurveyData } from '@/campaigns/bnr_planning_XogX';

function MyCustomSurvey() {
  const {
    currentQuestion,
    surveyData,
    progressInfo,
    updateBirthDate,
    updateRadioAnswer,
  } = useSurveyData();

  return (
    <div>
      <p>현재 질문: {currentQuestion}</p>
      <p>진행률: {progressInfo.percentage}%</p>
      {/* 커스텀 UI */}
    </div>
  );
}
```

## 🌐 URL 기반 스킨 적용

스킨은 URL 파라미터로 자동 감지됩니다:

- `https://example.com/campaign?skin=O` → 오렌지 테마
- `https://example.com/campaign?skin=B` → 파란색 테마
- `https://example.com/campaign` → 기본값 (오렌지)

## 📱 반응형 지원

- **데스크톱**: 최적화된 레이아웃
- **태블릿**: 768px 이하 대응
- **모바일**: 480px 이하 최적화

## 🎯 확장성

새로운 캠페인 추가 시 동일한 구조로 개발:

```
src/campaigns/
├── bnr_planning_XogX/    # 현재 캠페인
├── new_campaign_name/        # 새 캠페인
│   ├── index.tsx
│   ├── EventPage.tsx
│   ├── SurveyPage.tsx
│   └── ...
```

## 📦 의존성

- React 18+
- TypeScript 4.5+
- SCSS 지원
- Pretendard 폰트 (자동 로드)

## 🚀 개발 및 배포

개발 시 스타일 변경 사항은 `styles/campaign.scss`에서 수정하며, 모든 색상은 CSS 변수로 관리되어 스킨 시스템과 연동됩니다.

## 📝 주의사항

1. **이미지 경로**: `assets/images/`에 이미지를 배치하고 import로 사용
2. **스킨 일관성**: 모든 UI 요소는 CSS 변수(`--primary`, `--primary-hover` 등) 사용
3. **타입 안정성**: 모든 props와 데이터는 TypeScript 타입 정의 필수
4. **모바일 최적화**: 모든 컴포넌트는 모바일 우선으로 설계 