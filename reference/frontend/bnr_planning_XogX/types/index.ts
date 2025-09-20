// 스킨 타입 - 4가지 의료/건강 테마
export type SkinType = 'G' | 'M' | 'B' | 'R';

// 생년월일 데이터
export interface BirthDate {
  year: string | null;
  month: string | null;
  day: string | null;
}

// 설문 답변 데이터
export interface SurveyData {
  birthDate?: BirthDate;
  smoking?: string;
  drinking?: string;
  familyHistory?: string[];
  currentDisease?: string[];
  currentCancer?: string[];
}

// 질문 상태
export type QuestionStatus = 'pending' | 'current' | 'completed';

// 옵션 아이템 타입
export interface OptionItem {
  value: string;
  label: string;
  id: string;
}

// 질문 정보
export interface QuestionInfo {
  number: number;
  title: string;
  subtitle?: string;
  type: 'radio' | 'checkbox' | 'birthdate';
  options?: OptionItem[];
  name: string;
}

// 진행 상태
export interface ProgressInfo {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  stepText: string;
}

// 커스텀 캘린더 옵션
export interface CalendarOptions {
  minYear?: number;
  maxYear?: number;
  placeholder?: {
    year: string;
    month: string;
    day: string;
  };
  onChange?: (date: BirthDate, isComplete: boolean) => void;
}

// 캠페인 스킨 설정
export interface SkinConfig {
  type: SkinType;
  name: string;
  description: string;
  theme: string;
  colors: {
    primary: string;
    primaryDark: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    buttonPrimary: string;
    buttonSecondary: string;
    sectionHeader: string;
    // 기존 호환성 유지
    primaryHover: string;
    primaryBgLight: string;
    primaryShadow: string;
    primaryShadowHover: string;
  };
} 