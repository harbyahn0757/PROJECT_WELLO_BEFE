/**
 * API 엔드포인트 상수 관리
 * 하드코딩된 URL들을 중앙 집중식으로 관리
 */

// 기본 API 호스트
export const API_HOSTS = {
  LOCAL: 'http://localhost:8082',
  PRODUCTION: 'https://welno.kindhabit.com'
} as const;

// 현재 환경에 따른 API 호스트 선택
const getApiHost = (endpoint: 'local' | 'production' = 'local'): string => {
  return endpoint === 'local' ? API_HOSTS.LOCAL : API_HOSTS.PRODUCTION;
};

// Tilko API 엔드포인트 (올바른 경로로 수정)
export const TILKO_API = {
  // 세션 관리 (welno-api 경로로 통일)
  SESSION_START: () => `/api/v1/tilko/session/start`,
  
  SESSION_STATUS: (sessionId: string) => `/api/v1/tilko/session/${sessionId}/status`,
  
  SESSION_CLEANUP_USER: (userName: string) => `/api/v1/tilko/session/cleanup-user/${encodeURIComponent(userName)}`,
  
  SESSION_DELETE: (sessionId: string) => `/api/v1/tilko/session/${sessionId}`,
  
  SESSION_MESSAGES: (sessionId: string) => `/api/v1/tilko/session/${sessionId}/messages`,
  
  // 데이터 수집 (통합)
  COLLECT_DATA: (sessionId: string) => `/api/v1/tilko/session/${sessionId}/collect-data`,
  
  // 인증
  SIMPLE_AUTH: (sessionId: string) => `/api/v1/tilko/session/simple-auth?session_id=${sessionId}`,
  
  // 데이터 수집
  COLLECT_HEALTH_DATA: (sessionId: string) => `/api/v1/tilko/session/${sessionId}/collect-health-data`
} as const;

// WELNO API 엔드포인트 (welno-api로 통일)
export const WELNO_API = {
  PATIENT_DATA: (patientId: string) => `/api/v1/welno/patients/${patientId}`,
  HEALTH_RECORDS: (patientId: string) => `/api/v1/welno/patients/${patientId}/health-records`,
  PATIENT_HEALTH_DATA: (uuid: string, hospitalId: string) => `/api/v1/welno/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`,
  // AI 분석 엔드포인트
  HEALTH_ANALYSIS: () => `/api/v1/health-analysis/analyze`
} as const;

// 하위 호환성을 위한 WELLO_API 별칭
export const WELLO_API = WELNO_API;

// 기타 API 엔드포인트 (하위 호환성)
export const API_ENDPOINTS = {
  PATIENT_DATA: (patientId: string) => `/api/v1/welno/patients/${patientId}`,
  HEALTH_RECORDS: (patientId: string) => `/api/v1/welno/patients/${patientId}/health-records`
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

