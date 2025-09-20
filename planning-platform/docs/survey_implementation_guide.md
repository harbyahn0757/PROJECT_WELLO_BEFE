# 설문조사 구현 가이드

## 📋 컴포넌트 구조

### 1. 설문조사 데이터 구조
```typescript
interface Survey {
  id: string;
  title: string;
  description: string;
  pages: SurveyPage[];
  settings: {
    allowBack: boolean;
    autoSave: boolean;
    showProgress: boolean;
  };
}

interface SurveyPage {
  id: string;
  title: string;
  subtitle?: string;
  sections: SurveySection[];
}

interface SurveySection {
  id: string;
  title?: string;
  subtitle?: string;
  questions: SurveyQuestion[];
}

interface SurveyQuestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'checkbox' | 'radio' | 'input' | 'select';
  required?: boolean;
  options?: SurveyOption[];
  inputType?: 'text' | 'number';
  showIf?: {
    questionId: string;
    value: string | string[];
  };
}

interface SurveyOption {
  id: string;
  label: string;
  value: string | number;
  isNone?: boolean;
}
```

### 2. 응답 데이터 구조
```typescript
interface SurveyResponse {
  surveyId: string;
  sessionId: string;
  currentPageId: string;
  answers: SurveyAnswer[];
  isCompleted?: boolean;
  startedAt: Date;
  completedAt?: Date;
  lastSavedAt: Date;
}

interface SurveyAnswer {
  questionId: string;
  value: string | number | boolean | string[] | number[];
  timestamp: Date;
}
```

## 🎯 주요 기능 구현

### 1. 조건부 질문 표시
```typescript
const shouldShowQuestion = (question: SurveyQuestion): boolean => {
  if (!question.showIf) return true;
  
  const conditionAnswer = getAnswer(question.showIf.questionId);
  if (Array.isArray(question.showIf.value)) {
    return question.showIf.value.includes(conditionAnswer as string);
  }
  return conditionAnswer === question.showIf.value;
};
```

### 2. 체크박스 로직
```typescript
const handleCheckboxChange = (
  questionId: string, 
  optionValue: string, 
  checked: boolean, 
  isNone?: boolean
) => {
  const currentAnswers = getAnswer(questionId) as string[] || [];
  
  if (isNone && checked) {
    // "해당없음" 선택 시 다른 모든 선택 해제
    saveAnswer(questionId, [optionValue]);
  } else if (checked) {
    // 일반 옵션 선택 시 "해당없음" 제거
    const filteredAnswers = currentAnswers.filter(val => {
      const question = findQuestionById(questionId);
      const noneOption = question?.options?.find(opt => opt.isNone);
      return !noneOption || val !== noneOption.value;
    });
    saveAnswer(questionId, [...filteredAnswers, optionValue]);
  } else {
    // 선택 해제
    saveAnswer(questionId, currentAnswers.filter(val => val !== optionValue));
  }
};
```

### 3. 자동 저장 및 진행
```typescript
const handleNext = async () => {
  const response: SurveyResponse = {
    surveyId: survey.id,
    sessionId,
    currentPageId: currentPage.id,
    answers,
    isCompleted: isLastPage,
    startedAt: initialResponse?.startedAt || new Date(),
    completedAt: isLastPage ? new Date() : undefined,
    lastSavedAt: new Date()
  };

  if (survey.settings.autoSave && onSave) {
    await onSave(response);
  }

  if (isLastPage) {
    if (onComplete) {
      await onComplete(response);
    }
  } else {
    setCurrentPageIndex(prev => prev + 1);
  }
};
```

## 📱 컴포넌트 렌더링

### 1. 페이지 구조
```tsx
<>
  {/* 뒤로가기 버튼 */}
  {survey.settings.allowBack && (
    <div className="back-button-container">
      <button className="back-button" onClick={handleBack}>
        ←
      </button>
    </div>
  )}
  
  <div className="question__content">
    {/* 제목 */}
    <div className="question__title">
      <span className="question__title-text--ss">{currentPage.title}</span>
      <span className="question__title-text">
        {survey.settings.showProgress && (
          <>페이지 {currentPageIndex + 1}/{survey.pages.length}<br /></>
        )}
        {currentPage.subtitle}
      </span>
    </div>
    
    {/* 설문 내용 */}
    <div className="question__content-input-area">
      {currentPage.sections.map(renderSection)}
    </div>
    
    {/* 하단 여백 */}
    <div style={{ height: '100px' }}></div>
  </div>
  
  {/* 플로팅 버튼 */}
  <div className="survey-floating-button">
    <button 
      type="button" 
      className="survey-floating-button__btn" 
      onClick={handleNext}
    >
      {isLastPage ? '완료' : '다음'}
    </button>
  </div>
</>
```

### 2. 질문 타입별 렌더링

#### 체크박스
```tsx
<div key={question.id}>
  <span className="question__content-input-label">
    {question.title}
    {question.subtitle && (
      <>
        <br />
        <small>{question.subtitle}</small>
      </>
    )}
  </span>
  <div>
    {question.options?.map(option => (
      <label 
        key={option.id} 
        htmlFor={`${question.id}_${option.id}`} 
        className={`question__content-input-button ${option.isNone ? 'nothing' : ''}`}
      >
        <input
          id={`${question.id}_${option.id}`}
          type="checkbox"
          checked={(answer as string[] || []).includes(option.value as string)}
          onChange={(e) => handleCheckboxChange(
            question.id, 
            option.value as string, 
            e.target.checked, 
            option.isNone
          )}
        />
        <span>{option.label}</span>
      </label>
    ))}
  </div>
</div>
```

#### 라디오 버튼
```tsx
<div key={question.id}>
  <span className="question__content-input-label">
    {question.title}
    {question.subtitle && (
      <>
        <br />
        <small>{question.subtitle}</small>
      </>
    )}
  </span>
  <div>
    {question.options?.map(option => (
      <label 
        key={option.id} 
        htmlFor={`${question.id}_${option.id}`} 
        className="question__content-input-button"
      >
        <input
          id={`${question.id}_${option.id}`}
          type="radio"
          name={question.id}
          value={option.value as string}
          checked={answer === option.value}
          onChange={(e) => handleRadioChange(question.id, e.target.value)}
        />
        <span>{option.label}</span>
      </label>
    ))}
  </div>
</div>
```

#### 입력 필드
```tsx
<div key={question.id}>
  <span className="question__content-input-label">{question.title}</span>
  <input
    type={question.inputType || 'text'}
    className="question__content-input"
    value={answer as string || ''}
    onChange={(e) => handleInputChange(question.id, 
      question.inputType === 'number' ? Number(e.target.value) : e.target.value
    )}
    placeholder={question.subtitle}
  />
</div>
```

#### 선택 상자
```tsx
<div key={question.id}>
  <span className="question__content-input-label">{question.title}</span>
  <select
    className="question__content-input"
    value={answer as string || ''}
    onChange={(e) => handleInputChange(question.id, e.target.value)}
  >
    <option value="">선택해주세요</option>
    {question.options?.map(option => (
      <option key={option.id} value={option.value as string}>
        {option.label}
      </option>
    ))}
  </select>
</div>
```

## 🔄 상태 관리

### 1. 답변 저장
```typescript
const saveAnswer = (questionId: string, value: string | number | boolean | string[] | number[]) => {
  setAnswers(prev => {
    const existingIndex = prev.findIndex(answer => answer.questionId === questionId);
    const newAnswer: SurveyAnswer = {
      questionId,
      value,
      timestamp: new Date()
    };

    if (existingIndex >= 0) {
      const updated = [...prev];
      updated[existingIndex] = newAnswer;
      return updated;
    } else {
      return [...prev, newAnswer];
    }
  });
};
```

### 2. 답변 조회
```typescript
const getAnswer = (questionId: string) => {
  const answer = answers.find(a => a.questionId === questionId);
  return answer?.value;
};
```

## 📱 모바일 최적화

### 1. 터치 영역 최적화
```scss
.question__content-input-button {
  label {
    min-height: 44px;  // iOS 권장 최소 터치 영역
    padding: 12px 16px;
    margin: 4px 0;
    display: flex;
    align-items: center;
  }
}
```

### 2. 스크롤 최적화
```scss
.question__content {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
  max-height: calc(100vh - 180px);  // 헤더와 플로팅 버튼 고려
}
```

## 🎨 테마 커스터마이징

### 1. 브랜드 색상 변경
```scss
// _variables.scss
$brand-colors: (
  primary: (
    light: #F5F3F2,
    base: #7C746A,
    dark: #6A635A,
  ),
  secondary: (
    light: #F0F7FF,
    base: #3B82F6,
    dark: #1D4ED8,
  ),
  accent: (
    light: #FDF2F8,
    base: #EC4899,
    dark: #BE185D,
  ),
);
```

### 2. 폰트 설정
```scss
// _variables.scss
$typography: (
  family: (
    base: ('Pretendard', -apple-system, system-ui, sans-serif),
    heading: ('Pretendard', sans-serif),
  ),
  size: (
    xs: 0.75rem,   // 12px
    sm: 0.875rem,  // 14px
    base: 1rem,    // 16px
    lg: 1.125rem,  // 18px
    xl: 1.25rem,   // 20px
    '2xl': 1.5rem, // 24px
    '3xl': 1.875rem, // 30px
  ),
  weight: (
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  ),
  line-height: (
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  ),
);
```

## 🔧 유틸리티 함수

### 1. 질문 유효성 검사
```typescript
const validateQuestion = (question: SurveyQuestion, answer?: any): boolean => {
  if (!question.required) return true;
  if (!answer) return false;

  switch (question.type) {
    case 'checkbox':
      return Array.isArray(answer) && answer.length > 0;
    case 'radio':
    case 'select':
      return answer !== '';
    case 'input':
      return question.inputType === 'number' 
        ? !isNaN(answer) && answer !== '' 
        : answer.trim() !== '';
    default:
      return true;
  }
};
```

### 2. 페이지 유효성 검사
```typescript
const validatePage = (page: SurveyPage): boolean => {
  for (const section of page.sections) {
    for (const question of section.questions) {
      if (shouldShowQuestion(question)) {
        if (!validateQuestion(question, getAnswer(question.id))) {
          return false;
        }
      }
    }
  }
  return true;
};
```

### 3. 답변 포맷팅
```typescript
const formatAnswer = (question: SurveyQuestion, value: any): string => {
  if (!value) return '';

  switch (question.type) {
    case 'checkbox':
      return (value as string[])
        .map(v => question.options?.find(opt => opt.value === v)?.label)
        .filter(Boolean)
        .join(', ');
    case 'radio':
    case 'select':
      return question.options?.find(opt => opt.value === value)?.label || '';
    case 'input':
      return question.inputType === 'number' 
        ? value.toLocaleString() 
        : value;
    default:
      return String(value);
  }
};
```

## 📊 데이터 저장 및 복구

### 1. 로컬 스토리지 저장
```typescript
const saveToLocalStorage = (response: SurveyResponse) => {
  localStorage.setItem(
    `survey_${response.surveyId}_${response.sessionId}`,
    JSON.stringify(response)
  );
};
```

### 2. 세션 복구
```typescript
const recoverSession = (surveyId: string): SurveyResponse | null => {
  const keys = Object.keys(localStorage);
  const sessionKey = keys.find(key => 
    key.startsWith(`survey_${surveyId}_`) && 
    !key.endsWith('_completed')
  );
  
  if (sessionKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(sessionKey) || '');
      return {
        ...saved,
        startedAt: new Date(saved.startedAt),
        lastSavedAt: new Date(saved.lastSavedAt),
        completedAt: saved.completedAt ? new Date(saved.completedAt) : undefined,
      };
    } catch (e) {
      console.error('세션 복구 실패:', e);
      return null;
    }
  }
  
  return null;
};
```

## 🎯 사용 예시

### 1. 기본 설문조사
```tsx
const BasicSurvey = () => {
  const survey: Survey = {
    id: 'basic-survey',
    title: '기본 설문조사',
    description: '간단한 설문조사입니다.',
    pages: [
      {
        id: 'page1',
        title: '기본 정보',
        sections: [
          {
            id: 'section1',
            questions: [
              {
                id: 'name',
                title: '이름',
                type: 'input',
                required: true
              },
              {
                id: 'age',
                title: '나이',
                type: 'input',
                inputType: 'number',
                required: true
              }
            ]
          }
        ]
      }
    ],
    settings: {
      allowBack: true,
      autoSave: true,
      showProgress: true
    }
  };

  const handleSave = async (response: SurveyResponse) => {
    saveToLocalStorage(response);
  };

  const handleComplete = async (response: SurveyResponse) => {
    // API 호출 등 완료 처리
    console.log('설문 완료:', response);
  };

  return (
    <DynamicSurvey
      survey={survey}
      onSave={handleSave}
      onComplete={handleComplete}
    />
  );
};
```

### 2. 조건부 질문이 있는 설문조사
```tsx
const ConditionalSurvey = () => {
  const survey: Survey = {
    id: 'conditional-survey',
    title: '조건부 설문조사',
    description: '답변에 따라 다른 질문이 표시됩니다.',
    pages: [
      {
        id: 'page1',
        title: '건강 설문',
        sections: [
          {
            id: 'section1',
            questions: [
              {
                id: 'hasMedicalCondition',
                title: '현재 치료 중인 질환이 있습니까?',
                type: 'radio',
                required: true,
                options: [
                  { id: 'yes', label: '예', value: 'yes' },
                  { id: 'no', label: '아니오', value: 'no' }
                ]
              },
              {
                id: 'medicalConditionDetails',
                title: '어떤 질환입니까?',
                type: 'checkbox',
                showIf: {
                  questionId: 'hasMedicalCondition',
                  value: 'yes'
                },
                options: [
                  { id: 'diabetes', label: '당뇨병', value: 'diabetes' },
                  { id: 'hypertension', label: '고혈압', value: 'hypertension' },
                  { id: 'heart', label: '심장질환', value: 'heart' },
                  { id: 'other', label: '기타', value: 'other' }
                ]
              }
            ]
          }
        ]
      }
    ],
    settings: {
      allowBack: true,
      autoSave: true,
      showProgress: true
    }
  };

  return (
    <DynamicSurvey
      survey={survey}
      onSave={async (response) => {
        saveToLocalStorage(response);
      }}
      onComplete={async (response) => {
        console.log('설문 완료:', response);
      }}
    />
  );
};
```
