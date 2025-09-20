// 백엔드 연동을 위한 설문조사 구조 정의

export interface SurveyOption {
  id: string;
  label: string;
  value: string | number | boolean;
  isNone?: boolean; // "해당없음" 옵션 여부
}

export interface SurveyQuestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'radio' | 'checkbox' | 'input' | 'select';
  inputType?: 'text' | 'number' | 'email'; // input type인 경우
  options?: SurveyOption[];
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  // 조건부 질문을 위한 속성
  showIf?: {
    questionId: string;
    value: string | number | boolean;
  };
}

export interface SurveySection {
  id: string;
  title: string;
  subtitle?: string;
  questions: SurveyQuestion[];
}

export interface SurveyPage {
  id: string;
  title: string;
  subtitle?: string;
  sections: SurveySection[];
  // 페이지 진행 조건
  nextPage?: string;
  prevPage?: string;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  pages: SurveyPage[];
  // 설문조사 설정
  settings: {
    allowBack: boolean;
    autoSave: boolean;
    showProgress: boolean;
  };
}

// 설문조사 답변 데이터 구조
export interface SurveyAnswer {
  questionId: string;
  value: string | number | boolean | string[] | number[];
  timestamp: Date;
}

export interface SurveyResponse {
  surveyId: string;
  userId?: string;
  sessionId: string;
  currentPageId: string;
  answers: SurveyAnswer[];
  isCompleted: boolean;
  startedAt: Date;
  completedAt?: Date;
  lastSavedAt: Date;
}

// API 관련 인터페이스
export interface SurveyApiResponse {
  success: boolean;
  data: Survey;
  message?: string;
}

export interface SurveySubmitRequest {
  surveyId: string;
  sessionId: string;
  answers: SurveyAnswer[];
  pageId: string;
  isComplete?: boolean;
}

export interface SurveySubmitResponse {
  success: boolean;
  data: {
    sessionId: string;
    nextPageId?: string;
    isCompleted: boolean;
  };
  message?: string;
}
