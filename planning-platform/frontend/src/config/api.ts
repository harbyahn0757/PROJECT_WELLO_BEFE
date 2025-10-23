/**
 * WELLO API 설정 - 완전 단순화
 */

// 환경 감지
const IS_PRODUCTION = window.location.hostname === 'xogxog.com';
const IS_DEVELOPMENT = !IS_PRODUCTION;

// API 베이스 URL
const API_BASE_URL = IS_PRODUCTION ? 'https://xogxog.com' : '';

// API URL 생성
const createApiUrl = (path: string): string => {
  if (IS_DEVELOPMENT) {
    // 개발: 프록시 사용 (상대 경로)
    console.log('🔧 [DEV] API:', path);
    return path;
  } else {
    // 프로덕션: 절대 경로
    console.log('🔧 [PROD] API:', `${API_BASE_URL}${path}`);
    return `${API_BASE_URL}${path}`;
  }
};

// WELLO API 엔드포인트
export const API_ENDPOINTS = {
  // 환자 관련
  PATIENT: (uuid: string) => createApiUrl(`/wello-api/v1/patients/${uuid}`),
  
  // 병원 관련
  HOSPITAL: (hospitalId: string) => createApiUrl(`/wello-api/v1/hospitals/${hospitalId}`),
  
  // 건강 데이터 관련
  HEALTH_DATA: (uuid: string, hospitalId: string) => 
    createApiUrl(`/wello-api/v1/wello/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  // 기존 데이터 확인
  CHECK_EXISTING_DATA: (uuid: string, hospitalId: string) => 
    createApiUrl(`/wello-api/v1/wello/check-existing-data?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  // Tilko 인증 관련
  TILKO_SESSION_START: createApiUrl('/wello-api/v1/tilko/session/start'),
  TILKO_SESSION_STATUS: (sessionId: string) => createApiUrl(`/wello-api/v1/tilko/session/${sessionId}/status`),
  TILKO_COLLECT_DATA: (sessionId: string) => createApiUrl(`/wello-api/v1/tilko/session/${sessionId}/collect-data`),
};

// 디버그 정보
console.log('🔧 [WELLO API 설정]', {
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  API_BASE_URL,
  hostname: window.location.hostname
});

export default {
  API_BASE_URL,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  createApiUrl,
  API_ENDPOINTS,
};