/**
 * 카카오 인앱 브라우저 감지 유틸리티
 */
export const isKakaoInApp = (): boolean =>
  typeof navigator !== 'undefined' && /KAKAOTALK/i.test(navigator.userAgent);

export const getMobileEnv = () => ({
  isKakao: isKakaoInApp(),
  isIOS: typeof navigator !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent),
  isAndroid: typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent),
  isMobile: typeof navigator !== 'undefined' && /iPhone|iPad|Android|Mobile/.test(navigator.userAgent),
  ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
});
