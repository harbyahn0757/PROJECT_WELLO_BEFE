/**
 * API 엔드포인트 상수 관리
 * 하드코딩된 URL들을 중앙 집중식으로 관리
 */

// 기본 API 호스트
export const API_HOSTS = {
  LOCAL: 'http://localhost:8082',
  PRODUCTION: 'https://xogxog.com'
} as const;

// 현재 환경에 따른 API 호스트 선택
const getApiHost = (endpoint: 'local' | 'production' = 'local'): string => {
  return endpoint === 'local' ? API_HOSTS.LOCAL : API_HOSTS.PRODUCTION;
};

// Tilko API 엔드포인트 (WELLO 전용 경로 - 상대경로 사용)
export const TILKO_API = {
  // 세션 관리 (절대경로 사용 - setupProxy/Nginx가 자동 라우팅)
  SESSION_START: () => `/api/v1/wello/tilko/session/start`,
  
  SESSION_STATUS: (sessionId: string) => `/api/v1/wello/tilko/session/${sessionId}/status`,
  
  SESSION_CLEANUP_USER: (userName: string) => `/api/v1/wello/tilko/session/cleanup-user/${encodeURIComponent(userName)}`,
  
  SESSION_DELETE: (sessionId: string) => `/api/v1/wello/tilko/session/${sessionId}`,
  
  SESSION_MESSAGES: (sessionId: string) => `/api/v1/wello/tilko/session/${sessionId}/messages`,
  
  // 데이터 수집 (통합)
  COLLECT_DATA: (sessionId: string) => `/api/v1/wello/tilko/session/${sessionId}/collect-data`,
  
  // 인증
  SIMPLE_AUTH: (sessionId: string) => `/api/v1/wello/tilko/session/simple-auth?session_id=${sessionId}`,
  
  // 데이터 수집
  COLLECT_HEALTH_DATA: (sessionId: string) => `/api/v1/wello/tilko/session/${sessionId}/collect-health-data`
} as const;

// 기타 API 엔드포인트 (WELLO 전용 경로)
export const API_ENDPOINTS = {
  PATIENT_DATA: (patientId: string) => `/api/v1/wello/patients/${patientId}`,
  HEALTH_RECORDS: (patientId: string) => `/api/v1/wello/patients/${patientId}/health-records`
} as const;

// HTTP 메서드 상수
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;

// API 요청 헤더
export const API_HEADERS = {
  JSON: {
    'Content-Type': 'application/json'
  },
  FORM: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
} as const;

