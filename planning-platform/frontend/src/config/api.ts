/**
 * WELNO API 설정 - 완전 단순화
 */

// 환경 감지 (localhost에서 시작할 때 = 개발 모드)
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_PRODUCTION = !IS_DEVELOPMENT;

// API 베이스 URL
const API_BASE_URL = IS_PRODUCTION ? window.location.origin : '';

// 파트너 마케팅 API 설정
// 개발 환경: 프록시 사용 (상대 경로)
// 프로덕션: 절대 경로 사용
const PARTNER_MARKETING_API_BASE = IS_DEVELOPMENT 
  ? '' // 개발 모드: 프록시 사용 (craco.config.js의 /api/partner-marketing 프록시)
  : window.location.origin;

// 캠페인 리다이렉트 URL 설정
const CAMPAIGN_REDIRECT_URL = IS_DEVELOPMENT
  ? 'http://localhost:3012'
  : `${window.location.origin}/campaigns/bnr_planning_XogXAims`;

// 웰노 파트너 API 키
const WELNO_PARTNER_API_KEY = 'welno_5a9bb40b5108ecd8ef864658d5a2d5ab';

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

// WELNO API 엔드포인트
export const API_ENDPOINTS = {
  // 환자 관련 (welno.welno_patients 테이블 조회)
  PATIENT: (uuid: string) => createApiUrl(`/welno-api/v1/welno/patients/${uuid}`),
  
  // 병원 관련
  HOSPITAL: (hospitalId: string) => createApiUrl(`/welno-api/v1/welno/hospitals/${hospitalId}`),
  
  // 건강 데이터 관련
  HEALTH_DATA: (uuid: string, hospitalId: string) => 
    createApiUrl(`/welno-api/v1/welno/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  // 기존 데이터 확인 및 검색
  CHECK_EXISTING_DATA: (uuid: string, hospitalId: string) => 
    createApiUrl(`/welno-api/v1/welno/check-existing-data?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  FIND_PATIENT: createApiUrl('/welno-api/v1/welno/find-patient'),
  
  // 건강데이터 삭제
  DELETE_HEALTH_DATA: (uuid: string, hospitalId: string) => 
    createApiUrl(`/welno-api/v1/welno/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  // 약관 동의 저장
  SAVE_TERMS_AGREEMENT: (uuid: string, hospitalId: string) => 
    createApiUrl(`/welno-api/v1/welno/terms-agreement?uuid=${uuid}&hospital_id=${hospitalId}`),
  
  // Tilko 인증 관련
  TILKO_SESSION_START: createApiUrl('/welno-api/v1/tilko/session/start'),
  TILKO_SESSION_STATUS: (sessionId: string) => createApiUrl(`/welno-api/v1/tilko/session/${sessionId}/status`),
  TILKO_COLLECT_DATA: (sessionId: string) => createApiUrl(`/welno-api/v1/tilko/session/${sessionId}/collect-data`),
  
  // 약품 상세정보 관련
  DRUG_DETAIL: (drugCode: string) => createApiUrl(`/welno-api/v1/welno/drug-detail/${drugCode}`),
  
  // MDX 동기화 관련
  MDX_SYNC: {
    GET_MDX_PATIENTS: (phoneno: string, birthday: string, name: string) =>
      createApiUrl(`/welno-api/v1/sync/mdx-patients?phoneno=${phoneno}&birthday=${birthday}&name=${encodeURIComponent(name)}`),
  },
  
  // 파트너 마케팅 인증 관련
  // 개발 환경: 절대 경로 사용 (CORS 허용되어 있음)
  // 프로덕션: 절대 경로 사용
  PARTNER_AUTH: `${PARTNER_MARKETING_API_BASE}/api/partner-marketing/partner-auth`,
  
  // 비밀번호 관련
  PASSWORD: {
    CHECK_PASSWORD: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/check?hospital_id=${hospitalId}`),
    SET_PASSWORD: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/set?hospital_id=${hospitalId}`),
    VERIFY_PASSWORD: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/verify?hospital_id=${hospitalId}`),
    CHANGE_PASSWORD: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/change?hospital_id=${hospitalId}`),
        PROMPT_CHECK: (uuid: string, hospitalId: string) => 
          createApiUrl(`/welno-api/v1/patients/${uuid}/password/should-prompt?hospital_id=${hospitalId}`),
    PROMPT_UPDATE: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/update-prompt?hospital_id=${hospitalId}`),
    ACCESS_UPDATE: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/password/access-update?hospital_id=${hospitalId}`),
    
    // 세션 관리 API
    CREATE_SESSION: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/sessions/create?hospital_id=${hospitalId}`),
    VERIFY_SESSION: () => 
      createApiUrl(`/welno-api/v1/sessions/verify`),
    INVALIDATE_SESSION: (sessionToken: string) => 
      createApiUrl(`/welno-api/v1/sessions/${sessionToken}`),
    GET_SESSIONS: (uuid: string, hospitalId: string) => 
      createApiUrl(`/welno-api/v1/patients/${uuid}/sessions?hospital_id=${hospitalId}`),
    CLEANUP_SESSIONS: () => 
      createApiUrl(`/welno-api/v1/sessions/cleanup`)
  }
};

// 디버그 정보
console.log('🔧 [WELNO API 설정]', {
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
  // 파트너 마케팅 관련 상수
  PARTNER_MARKETING_API_BASE,
  CAMPAIGN_REDIRECT_URL,
  WELNO_PARTNER_API_KEY,
};