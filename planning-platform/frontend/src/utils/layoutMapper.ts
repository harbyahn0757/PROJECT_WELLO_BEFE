import { 
  LayoutType, 
  PAGE_LAYOUT_MAP,
  DEFAULT_HEADER_CONFIG 
} from '../constants/layoutTypes';

/**
 * 레이아웃 설정 인터페이스
 */
export interface LayoutConfig {
  layoutType: LayoutType;
  showAIButton: boolean;
  showFloatingButton: boolean;
  title: string;
  subtitle: string;
  headerMainTitle: string;
  headerImage: string;
  headerImageAlt: string;
  headerSlogan: string;
  headerLogoTitle: string;
  headerLogoSubtitle: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
}

interface PatientData {
  uuid: string;
  name: string;
  hospital: {
    hospital_id: string;
    name: string;
    layout_type: string;
    brand_color: string;
    logo_position: string;
    address: string;
    phone: string;
  };
}

interface HospitalData {
  hospital_id: string;
  name: string;
  layout_type: string;
  brand_color: string;
  logo_position: string;
  address: string;
  phone: string;
}

/**
 * API 호출 함수 (타임아웃 및 재시도 로직 추가)
 */
const fetchWithTimeout = async (url: string, timeout: number = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const fetchPatientData = async (uuid: string): Promise<PatientData> => {
  try {
    // 개발/운영 모두 실제 서버 사용
    const response = await fetchWithTimeout(`https://xogxog.com/api/v1/wello/patients/${uuid}`, 3000);
    
    if (!response.ok) {
      throw new Error(`환자 정보 조회 실패: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('환자 정보 조회 중 오류:', error);
    // API 실패 시 기본값 반환하여 메모리 누수 방지
    throw new Error('API 연결 실패 - 기본 설정으로 전환');
  }
};

const fetchHospitalData = async (hospitalId: string): Promise<HospitalData> => {
  try {
    // 개발/운영 모두 실제 서버 사용
    const response = await fetchWithTimeout(`https://xogxog.com/api/v1/wello/hospitals/${hospitalId}`, 3000);
    
    if (!response.ok) {
      throw new Error(`병원 정보 조회 실패: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('병원 데이터:', data);  // 디버깅용
    return data;
  } catch (error) {
    console.error('병원 정보 조회 중 오류:', error);
    // API 실패 시 기본값 반환하여 메모리 누수 방지
    throw new Error('API 연결 실패 - 기본 설정으로 전환');
  }
};

/**
 * URL에서 파라미터 추출
 */
export const extractParameters = () => {
  const search = window.location.hash.split('?')[1] || window.location.search;
  const urlParams = new URLSearchParams(search);
  return {
    uuid: urlParams.get('uuid'),
    layout: urlParams.get('layout'),
    hospital: urlParams.get('hospital')
  };
};

/**
 * 레이아웃 타입 결정
 */
export const determineLayoutType = async (): Promise<LayoutType> => {
  const { uuid, layout, hospital } = extractParameters();
  
  try {
    // 1. UUID가 있는 경우 - 환자 정보로 병원 레이아웃 결정
    if (uuid) {
      const patientData = await fetchPatientData(uuid);
      return patientData.hospital.layout_type === 'horizontal' ? LayoutType.HORIZONTAL : LayoutType.VERTICAL;
    }
    
    // 2. layout 파라미터가 있는 경우
    if (layout && Object.values(LayoutType).includes(layout as LayoutType)) {
      return layout as LayoutType;
    }
    
    // 3. hospital 파라미터가 있는 경우
    if (hospital) {
      const hospitalData = await fetchHospitalData(hospital);
      return hospitalData.layout_type === 'horizontal' ? LayoutType.HORIZONTAL : LayoutType.VERTICAL;
    }
    
    // 4. 기본값
    return LayoutType.VERTICAL;
    
  } catch (error) {
    console.error('레이아웃 결정 중 오류:', error);
    return LayoutType.VERTICAL;
  }
};

/**
 * 레이아웃 설정 생성
 */
export const createLayoutConfig = async (): Promise<LayoutConfig> => {
  const { uuid, hospital } = extractParameters();
  const layoutType = await determineLayoutType();
  const baseConfig = PAGE_LAYOUT_MAP[layoutType];
  
  try {
    // UUID나 hospital이 있는 경우 동적 설정
    if (uuid) {
      const patientData = await fetchPatientData(uuid);
      
      return {
        ...baseConfig,
        ...DEFAULT_HEADER_CONFIG,
        layoutType,  // 명시적으로 설정
        headerLogoTitle: patientData.hospital.name,
        title: `안녕하세요 ${patientData.name}님,\n${patientData.hospital.name}입니다`,
        subtitle: `${patientData.hospital.name}에서\n더 의미있는 내원이 되시길 바라며\n준비한 건강관리 서비스를 제공해드립니다.`,
        hospitalAddress: patientData.hospital.address, // 실제 병원 주소
        hospitalPhone: patientData.hospital.phone // 실제 병원 전화번호
      };
    }
    
    if (hospital) {
      const hospitalData = await fetchHospitalData(hospital);
      
      return {
        ...baseConfig,
        ...DEFAULT_HEADER_CONFIG,
        layoutType,  // 명시적으로 설정
        headerLogoTitle: hospitalData.name,
        title: `안녕하세요\n${hospitalData.name}입니다`,
        subtitle: `${hospitalData.name}에서\n더 의미있는 내원이 되시길 바라며\n준비한 건강관리 서비스를 제공해드립니다.`
      };
    }
    
    // 기본 설정 반환
    return {
      ...baseConfig,
      ...DEFAULT_HEADER_CONFIG,
      layoutType  // 명시적으로 설정
    };
    
  } catch (error) {
    console.error('레이아웃 설정 생성 중 오류:', error);
    return {
      ...baseConfig,
      ...DEFAULT_HEADER_CONFIG,
      layoutType  // 명시적으로 설정
    };
  }
};

/**
 * 현재 URL 기반 레이아웃 설정 가져오기
 */
export const getCurrentLayoutConfig = async (): Promise<LayoutConfig> => {
  return await createLayoutConfig();
};

/**
 * 디버그용: 현재 매핑 상태 로깅
 */
export const debugLayoutMapping = async () => {
  const params = extractParameters();
  const layoutType = await determineLayoutType();
  const config = await createLayoutConfig();
  
  console.group('🎨 Layout Mapping Debug');
  console.log('URL:', window.location.href);
  console.log('Parameters:', params);
  console.log('Layout Type:', layoutType);
  console.log('Config:', config);
  console.groupEnd();
  
  return { params, layoutType, config };
};