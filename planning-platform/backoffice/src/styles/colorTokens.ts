/**
 * WELNO 디자인 토큰 (JS/TS용)
 * _variables.scss와 동일한 값을 유지합니다.
 * 차트(Recharts) 등 인라인 스타일에서 사용합니다.
 */

// 브랜드 브라운 계열
export const BRAND_BROWN = '#7c746a';
export const BRAND_BROWN_HOVER = '#696158';
export const BRAND_BROWN_DARKER = '#55433B';
export const BRAND_BROWN_700 = '#5a5248';
export const BRAND_BROWN_800 = '#4a433a';

// 베이지 계열
export const BEIGE_300 = '#b8a896';
export const BEIGE_400 = '#9d8e7c';

// 오렌지 액센트
export const ACCENT_ORANGE = '#FF8A00';
export const ACCENT_ORANGE_CALM = '#ed8936';
export const ACCENT_ORANGE_DARK = '#d97706';

// 그레이
export const GRAY_300 = '#e2e8f0';
export const GRAY_500 = '#a0aec0';
export const GRAY_600 = '#718096';
export const GRAY_700 = '#4a5568';

// 상태 색상
export const SUCCESS = '#059669';
export const SUCCESS_LIGHT = '#10b981';
export const ERROR = '#dc2626';
export const ERROR_LIGHT = '#ef4444';

// 만족도 5단계 척도 색상 (서베이)
export const SATISFACTION_VERY_LOW = '#c62828';
export const SATISFACTION_LOW = '#ef6c00';
export const SATISFACTION_MID = '#fbc02d';
export const SATISFACTION_HIGH = '#66bb6a';
export const SATISFACTION_VERY_HIGH = '#2e7d32';

// 만족도 배경
export const SATISFACTION_HIGH_BG = '#e8f5e9';
export const SATISFACTION_MID_BG = '#fff3e0';
export const SATISFACTION_LOW_BG = '#fdecea';

// 차트 보조 색상
export const CHART_BLUE = '#4299e1';
export const CHART_DEEP_BLUE = '#1565c0';
export const CHART_PURPLE = '#6a1b9a';
export const CHART_STAR = '#f59e0b';

// 파이차트 팔레트 (브라운/오렌지/베이지)
export const PIE_PALETTE = [
  BRAND_BROWN,
  ACCENT_ORANGE_CALM,
  BRAND_BROWN_DARKER,
  ACCENT_ORANGE_DARK,
  BEIGE_400,
  BEIGE_300,
  ACCENT_ORANGE,
  BRAND_BROWN_HOVER,
];

// 트렌드 차트 팔레트
export const TREND_PALETTE = [
  BRAND_BROWN,
  SATISFACTION_VERY_LOW,
  SATISFACTION_LOW,
  SATISFACTION_VERY_HIGH,
  CHART_DEEP_BLUE,
  CHART_PURPLE,
];
