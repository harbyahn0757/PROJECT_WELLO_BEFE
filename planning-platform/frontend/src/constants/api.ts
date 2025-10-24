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

// Tilko API 엔드포인트 (올바른 경로로 수정)
export const TILKO_API = {
  // 세션 관리 (wello-api 경로로 통일)
  SESSION_START: () => `/wello-api/v1/tilko/session/start`,
  
  SESSION_STATUS: (sessionId: string) => `/wello-api/v1/tilko/session/${sessionId}/status`,
  
  SESSION_CLEANUP_USER: (userName: string) => `/wello-api/v1/tilko/session/cleanup-user/${encodeURIComponent(userName)}`,
  
  SESSION_DELETE: (sessionId: string) => `/wello-api/v1/tilko/session/${sessionId}`,
  
  SESSION_MESSAGES: (sessionId: string) => `/wello-api/v1/tilko/session/${sessionId}/messages`,
  
  // 데이터 수집 (통합)
  COLLECT_DATA: (sessionId: string) => `/wello-api/v1/tilko/session/${sessionId}/collect-data`,
  
  // 인증
  SIMPLE_AUTH: (sessionId: string) => `/wello-api/v1/tilko/session/simple-auth?session_id=${sessionId}`,
  
  // 데이터 수집
  COLLECT_HEALTH_DATA: (sessionId: string) => `/wello-api/v1/tilko/session/${sessionId}/collect-health-data`
} as const;

// WELLO API 엔드포인트 (wello-api로 통일)
export const WELLO_API = {
  PATIENT_DATA: (patientId: string) => `/wello-api/v1/wello/patients/${patientId}`,
  HEALTH_RECORDS: (patientId: string) => `/wello-api/v1/wello/patients/${patientId}/health-records`,
  PATIENT_HEALTH_DATA: (uuid: string, hospitalId: string) => `/wello-api/v1/wello/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`
} as const;

// 기타 API 엔드포인트 (하위 호환성)
export const API_ENDPOINTS = {
  PATIENT_DATA: (patientId: string) => `/wello-api/v1/wello/patients/${patientId}`,
  HEALTH_RECORDS: (patientId: string) => `/wello-api/v1/wello/patients/${patientId}/health-records`
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

