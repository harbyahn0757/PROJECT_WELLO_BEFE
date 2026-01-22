// 스킨 타입 - 5가지 의료/건강 테마
export type SkinType = 'G' | 'M' | 'B' | 'R' | 'Br';

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

// 리포트 페이지 색상 토큰
export interface ReportColors {
  panelBackground: string;        // 패널 배경색
  accentColor: string;             // 강조 색상 (스피너, 강조 요소)
  accentBgLight: string;          // 강조 배경 (rgba)
  accentBorder: string;           // 강조 보더 (rgba)
  textPrimary: string;            // 주요 텍스트
  textSecondary: string;          // 보조 텍스트 (rgba)
  textTertiary: string;           // 3차 텍스트 (rgba)
  borderColor: string;             // 보더 색상 (rgba)
  successColor: string;           // 성공 색상
  warningColor: string;           // 경고 색상
  dangerColor: string;            // 위험 색상
  rankValueColor: string;         // 등수 값 색상
  ageCardBg?: string;             // 나이 카드 배경 (rgba) - 옵셔널
  ageCardBorder?: string;         // 나이 카드 보더 (rgba) - 옵셔널
  ageCardCurrentBg?: string;      // 현재 나이 카드 배경
  ageCardCurrentBorder?: string;  // 현재 나이 카드 보더
  ageCardBetterBg: string;        // 건강나이 좋음 배경 (rgba)
  ageCardBetterBorder: string;    // 건강나이 좋음 보더 (rgba)
  ageCardWorseBg: string;         // 건강나이 나쁨 배경 (rgba)
  ageCardWorseBorder: string;     // 건강나이 나쁨 보더 (rgba)
  ageCardDefaultBg?: string;      // 기본 나이 카드 배경
  ageCardDefaultBorder?: string;  // 기본 나이 카드 보더
  sectionBg: string;              // 섹션 배경 (rgba)
  sectionBorder: string;          // 섹션 보더 (rgba)
  cardBg: string;                 // 카드 배경 (rgba)
  cardBorder: string;             // 카드 보더 (rgba)
  spinnerColor: string;           // 스피너 색상
  // 추가 리포트 색상
  ageDiffBadgeBg?: string;        // 나이 차이 배지 배경
  ageDiffBadgeColor?: string;     // 나이 차이 배지 색상
  rankItemMainBg?: string;        // 등수 아이템 메인 배경
  rankItemMainBorder?: string;   // 등수 아이템 메인 보더
  rankItemGoodBg?: string;        // 등수 아이템 좋음 배경
  rankItemGoodBorder?: string;   // 등수 아이템 좋음 보더
  rankItemBadBg?: string;         // 등수 아이템 나쁨 배경
  rankItemBadBorder?: string;     // 등수 아이템 나쁨 보더
  diseaseTagColor?: string;       // 질병 태그 색상
  diseaseCountBg?: string;        // 질병 카운트 배경
  diseaseCountColor?: string;     // 질병 카운트 색상
  chartBackground?: string;       // 차트 배경
  diseaseTypeBg?: string;         // 질병 타입 배경
  diseaseTypeColor?: string;      // 질병 타입 색상
  influenceItemBg?: string;       // 영향 요인 아이템 배경
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
  reportColors: ReportColors;    // 리포트 페이지 전용 색상
} 