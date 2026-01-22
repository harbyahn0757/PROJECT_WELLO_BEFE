/**
 * Google Analytics (gtag.js) 이벤트 추적 유틸리티
 */

// gtag 타입 정의
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Google Analytics 이벤트 전송
 */
export const sendGTMEvent = (eventName: string, eventData?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventData || {});
    console.log(`[GA] Event sent: ${eventName}`, eventData);
  }
};

/**
 * 페이지 뷰 추적
 */
export const trackPageView = (pageName: string, pageData?: Record<string, any>) => {
  sendGTMEvent('page_view', {
    page_name: pageName,
    ...pageData
  });
};

/**
 * 랜딩 페이지 이벤트
 */
export const trackLandingPage = (action: 'view' | 'start_button_click', data?: Record<string, any>) => {
  sendGTMEvent('landing_page', {
    action,
    ...data
  });
};

/**
 * 동의 패널 이벤트
 */
export const trackAgreementPanel = (
  action: 'panel_open' | 'panel_close' | 'agreement_check' | 'agreement_uncheck' | 'all_check' | 'all_uncheck' | 'create_click',
  data?: Record<string, any>
) => {
  sendGTMEvent('agreement_panel', {
    action,
    ...data
  });
};

/**
 * 문진 단계 이벤트
 */
export const trackSurveyStep = (
  action: 'step_start' | 'step_complete' | 'step_previous' | 'step_skip' | 'answer_change' | 'survey_complete',
  data?: Record<string, any>
) => {
  sendGTMEvent('survey_step', {
    action,
    ...data
  });
};

/**
 * 로딩 화면 이벤트
 */
export const trackLoading = (
  action: 'loading_start' | 'loading_end' | 'loading_timeout',
  data?: Record<string, any>
) => {
  sendGTMEvent('loading_screen', {
    action,
    ...data
  });
};

/**
 * 리포트 화면 이벤트
 */
export const trackReportPage = (
  action: 'page_view' | 'filter_change' | 'card_swipe' | 'card_click' | 'download_click',
  data?: Record<string, any>
) => {
  sendGTMEvent('report_page', {
    action,
    ...data
  });
};

