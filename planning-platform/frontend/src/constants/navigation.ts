/**
 * 네비게이션 관련 상수 및 유틸리티 함수
 * 페이지 간 이동 정책을 표준화
 */

// 앱 내 라우트 경로
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  WELLO: '/wello',
  RESULTS_TREND: '/results-trend',
  HEALTH_DATA: '/health-data',
  DASHBOARD: '/dashboard'
} as const;

// 네비게이션 타입 정의
export type NavigationType = 'navigate' | 'replace' | 'push_state' | 'back' | 'forward';

// 네비게이션 정책
export const NAVIGATION_POLICY = {
  // React Router 네비게이션 사용 (SPA 내부 이동)
  INTERNAL: {
    type: 'navigate' as const,
    description: 'React Router navigate 사용 - SPA 내부 페이지 이동'
  },
  
  // 브라우저 히스토리 상태 관리 (같은 페이지 내 상태 변경)
  STATE_CHANGE: {
    type: 'push_state' as const,
    description: 'window.history.pushState 사용 - 같은 페이지 내 상태 관리'
  },
  
  // 페이지 교체 (히스토리 스택 교체)
  REPLACE: {
    type: 'replace' as const,
    description: 'React Router replace 사용 - 현재 히스토리 엔트리 교체'
  },
  
  // 뒤로가기/앞으로가기
  BROWSER_NAVIGATION: {
    type: 'back' as const,
    description: 'window.history.back/forward 사용 - 브라우저 네비게이션'
  }
} as const;

// 네비게이션 헬퍼 함수들
export class NavigationHelper {
  /**
   * React Router navigate 함수를 사용한 표준 페이지 이동
   */
  static navigateToPage(navigate: Function, route: string, options?: { replace?: boolean, state?: any }) {
    console.log(`🧭 [네비게이션] ${route}로 이동 (${options?.replace ? 'replace' : 'push'})`);
    navigate(route, options);
  }

  /**
   * 같은 페이지 내에서 상태 변경 (히스토리 스택에 추가)
   */
  static pushState(state: any, title: string = '', url?: string) {
    console.log('📝 [상태변경] 히스토리 상태 추가:', state);
    window.history.pushState(state, title, url || window.location.href);
  }

  /**
   * 현재 히스토리 엔트리 교체
   */
  static replaceState(state: any, title: string = '', url?: string) {
    console.log('🔄 [상태교체] 히스토리 상태 교체:', state);
    window.history.replaceState(state, title, url || window.location.href);
  }

  /**
   * 브라우저 뒤로가기
   */
  static goBack() {
    console.log('⬅️ [브라우저] 뒤로가기');
    window.history.back();
  }

  /**
   * 브라우저 앞으로가기
   */
  static goForward() {
    console.log('➡️ [브라우저] 앞으로가기');
    window.history.forward();
  }

  /**
   * 지연된 페이지 이동 (애니메이션 후 이동 등)
   */
  static delayedNavigate(navigate: Function, route: string, delay: number = 2000, options?: { replace?: boolean, state?: any }) {
    console.log(`⏰ [지연네비게이션] ${delay}ms 후 ${route}로 이동`);
    setTimeout(() => {
      this.navigateToPage(navigate, route, options);
    }, delay);
  }
}

// URL 파라미터 헬퍼
export class URLHelper {
  /**
   * 현재 URL에서 쿼리 파라미터 추출
   */
  static getQueryParams(): URLSearchParams {
    return new URLSearchParams(window.location.search);
  }

  /**
   * React Router location에서 쿼리 파라미터 추출
   */
  static getQueryParamsFromLocation(location: any): URLSearchParams {
    return new URLSearchParams(location.search);
  }

  /**
   * 특정 쿼리 파라미터 값 가져오기
   */
  static getQueryParam(key: string): string | null {
    return this.getQueryParams().get(key);
  }

  /**
   * location에서 특정 쿼리 파라미터 값 가져오기
   */
  static getQueryParamFromLocation(location: any, key: string): string | null {
    return this.getQueryParamsFromLocation(location).get(key);
  }

  /**
   * 쿼리 파라미터를 객체로 변환
   */
  static queryParamsToObject(): Record<string, string> {
    const params = this.getQueryParams();
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * location에서 쿼리 파라미터를 객체로 변환
   */
  static queryParamsToObjectFromLocation(location: any): Record<string, string> {
    const params = this.getQueryParamsFromLocation(location);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Wello 앱의 표준 파라미터 추출 (uuid, hospital, layout)
   */
  static extractWelloParams(location?: any): { uuid: string | null; hospital: string | null; layout: string | null } {
    const params = location ? this.getQueryParamsFromLocation(location) : this.getQueryParams();
    return {
      uuid: params.get('uuid'),
      hospital: params.get('hospital'),
      layout: params.get('layout')
    };
  }

  /**
   * URL 구성 (쿼리 파라미터 추가)
   */
  static buildUrl(baseUrl: string, params: Record<string, string | null | undefined>): string {
    const url = new URL(baseUrl, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  /**
   * 현재 URL에 파라미터 추가/수정
   */
  static updateCurrentUrl(params: Record<string, string | null>): string {
    const currentUrl = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        currentUrl.searchParams.delete(key);
      } else {
        currentUrl.searchParams.set(key, value);
      }
    });
    return currentUrl.toString();
  }

  /**
   * 해시 URL에서 파라미터 추출 (레거시 지원)
   */
  static extractParamsFromHash(): { uuid: string | null; hospital: string | null; layout: string | null } {
    const search = window.location.hash.split('?')[1] || window.location.search;
    const urlParams = new URLSearchParams(search);
    return {
      uuid: urlParams.get('uuid'),
      layout: urlParams.get('layout'),
      hospital: urlParams.get('hospital')
    };
  }
}

// 표준 네비게이션 액션
export const STANDARD_NAVIGATION = {
  // 인증 완료 후 결과 페이지로 이동
  AUTH_TO_RESULTS: (navigate: Function) => 
    NavigationHelper.delayedNavigate(navigate, ROUTES.RESULTS_TREND, 2000),
  
  // 로그인 페이지로 이동
  TO_LOGIN: (navigate: Function) => 
    NavigationHelper.navigateToPage(navigate, ROUTES.LOGIN),
  
  // 홈으로 이동
  TO_HOME: (navigate: Function) => 
    NavigationHelper.navigateToPage(navigate, ROUTES.HOME),
  
  // 뒤로가기
  GO_BACK: () => 
    NavigationHelper.goBack()
} as const;

