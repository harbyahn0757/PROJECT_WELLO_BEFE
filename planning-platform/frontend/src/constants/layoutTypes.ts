/**
 * 레이아웃 타입 정의
 */
export enum LayoutType {
  VERTICAL = 'vertical',
  HORIZONTAL = 'horizontal',
  INTRO = 'intro'
}

/**
 * 페이지 타입별 레이아웃 매핑
 */
export const PAGE_LAYOUT_MAP = {
  // 세로형 레이아웃 (기본)
  [LayoutType.VERTICAL]: {
    layoutType: LayoutType.VERTICAL,
    showAIButton: true,
    showFloatingButton: true,
    title: "2025년 건강검진 대상자이신가요?",
    subtitle: "국가검진부터 AI 맞춤 종합검진까지\n지금 바로 신청하고 건강을 챙기세요.",
    headerMainTitle: "건강검진 안내"
  },
  
  // 가로형 레이아웃
  [LayoutType.HORIZONTAL]: {
    layoutType: LayoutType.HORIZONTAL,
    showAIButton: false,
    showFloatingButton: true,
    title: "건강검진 프로그램",
    subtitle: "더 의미 있는 내원이 되시길 바라며\n준비한 건강관리 서비스를 제공해드립니다.",
    headerMainTitle: ""
  },
  
  // 인트로 애니메이션 레이아웃
  [LayoutType.INTRO]: {
    layoutType: LayoutType.INTRO,
    showAIButton: false,
    showFloatingButton: false,
    title: "김현우내과의원이 준비한",
    subtitle: "당신을 위한 맞춤 건강검진 서비스",
    headerMainTitle: "건강한 내일을 위한 첫걸음"
  }
} as const;

/**
 * URL 파라미터별 레이아웃 매핑
 */
export const URL_LAYOUT_MAP: Record<string, LayoutType> = {
  // 기본값
  'default': LayoutType.VERTICAL,
  
  // 세로형 레이아웃
  'list': LayoutType.VERTICAL,
  'vertical': LayoutType.VERTICAL,
  'standard': LayoutType.VERTICAL,
  
  // 가로형 레이아웃
  'cards': LayoutType.HORIZONTAL,
  'horizontal': LayoutType.HORIZONTAL,
  'slide': LayoutType.HORIZONTAL,
  'swipe': LayoutType.HORIZONTAL,
  
  // 인트로 애니메이션 레이아웃
  'intro': LayoutType.INTRO,
  'animation': LayoutType.INTRO,
  'welcome': LayoutType.INTRO,
  'onboarding': LayoutType.INTRO,
} as const;

/**
 * 기본 헤더 정보
 */
export const DEFAULT_HEADER_CONFIG = {
  headerImage: "/doctor-image.png",
  headerImageAlt: "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
  headerSlogan: "행복한 건강생활의 평생 동반자",
  headerLogoTitle: "건강검진센터",
  headerLogoSubtitle: "HEALTH CHECK-UP CENTER"
} as const;