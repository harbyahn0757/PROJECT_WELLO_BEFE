/**
 * 검진 설계 API 서비스
 */
import apiConfig from '../config/api';
import { ConcernItem } from '../types/checkupDesign';

const getApiBaseUrl = () => {
  if (apiConfig.IS_DEVELOPMENT) {
    // 개발: 프록시 사용 (상대 경로)
    return '';
  } else {
    // 프로덕션: 절대 경로
    return apiConfig.API_BASE_URL;
  }
};

const API_BASE_URL = getApiBaseUrl();

export interface CheckupDesignRequest {
  uuid: string;
  hospital_id: string;
  partner_id?: string;
  selected_concerns: ConcernItem[];
  survey_responses?: {
    // 기본 질문
    weight_change?: string;
    exercise_frequency?: string;
    family_history?: string[];
    smoking?: string;
    drinking?: string;
    sleep_hours?: string;
    stress_level?: string;
    additional_concerns?: string;
    // 선택적 추가 질문
    optional_questions_enabled?: string; // 'yes' | 'no'
    cancer_history?: string;
    hepatitis_carrier?: string;
    colonoscopy_experience?: string;
    lung_nodule?: string;
    gastritis?: string;
    imaging_aversion?: string | string[]; // 체크박스의 경우 배열
    genetic_test?: string;
    // 약품 분석 (기존)
    prescription_analysis_text?: string; // 약품 분석 결과 텍스트 (프롬프트용)
    selected_medication_texts?: string[]; // 선택된 약품의 사용자 친화적 텍스트 (프롬프트용)
  };
  additional_info?: Record<string, any>;
  session_id?: string; // 세션 ID (로깅용)
}

export interface Step1Result {
  patient_summary: string;
  analysis: string;
  risk_profile?: Array<{
    organ_system: string;
    risk_level: string; // Low / Moderate / High / Very High
    reason: string;
  }>;
  chronic_analysis?: {
    has_chronic_disease: boolean;
    disease_list: string[];
    complication_risk: string;
  };
  survey_reflection: string;
  selected_concerns_analysis: Array<{
    concern_name: string;
    concern_type: string;
    trend_analysis: string;
    reflected_in_design: string;
    related_items?: number[];
  }>;
  basic_checkup_guide: {
    title: string;
    description: string;
    focus_items: Array<{
      item_name: string;
      why_important: string;
      check_point: string;
    }>;
  };
  session_id?: string; // 세션 ID (STEP 1에서 생성되어 반환됨)
}

export interface CheckupDesignStep2Request extends CheckupDesignRequest {
  step1_result: Step1Result;
  session_id?: string; // 세션 ID (로깅용) - STEP 1에서 전달받음
}

export interface CheckupDesignResponse {
  success: boolean;
  data: {
    recommended_items?: Array<{
      category: string;
      category_en?: string;
      itemCount: number;
      items: Array<{
        name: string;
        nameEn?: string;
        description?: string;
        reason?: string;
        priority?: number;
        recommended: boolean;
      }>;
      doctor_recommendation?: {
        has_recommendation: boolean;
        message: string;
        highlighted_text?: string;
      };
      defaultExpanded: boolean;
    }>;
    analysis?: string;
    total_count?: number;
    // STEP 1 필드들
    patient_summary?: string;
    survey_reflection?: string;
    risk_profile?: Array<{
      organ_system: string;
      risk_level: string;
      reason: string;
    }>;
    chronic_analysis?: {
      has_chronic_disease: boolean;
      disease_list: string[];
      complication_risk: string;
    };
    selected_concerns_analysis?: Array<any>;
    selected_concerns?: string[]; // 사용자가 선택한 항목들
    basic_checkup_guide?: any;
    // STEP 2 필드들
    summary?: any;
    strategies?: Array<any>;
    doctor_comment?: string;
    _citations?: string[];
    rag_evidences?: Array<{
      source_document: string;
      organization: string;
      year: string;
      page: string;
      citation: string;
      full_text: string;
      confidence_score: number;
      query: string;
    }>;
    // 세션 관리
    session_id?: string; // 세션 ID (STEP 1에서 생성되어 반환됨)
    // DB 저장 관련
    design_request_id?: number; // STEP 1에서 DB에 저장된 요청 ID
    // 미완료 설계 조회 시 반환되는 필드들
    id?: number; // 미완료 설계 요청 ID (getIncompleteCheckupDesign 응답)
    uuid?: string;
    hospital_id?: string;
    patient_id?: number;
    status?: string;
    step1_result?: any;
    prescription_analysis_text?: string;
    selected_medication_texts?: string[];
    error_stage?: string;
    error_message?: string;
    retry_count?: number;
    created_at?: string;
    last_retry_at?: string;
  } | null;
  message?: string;
}

class CheckupDesignService {
  /**
   * STEP 1: 빠른 분석 전용 검진 설계 생성
   */
  async createCheckupDesignStep1(request: CheckupDesignRequest): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/create-step1`
        : `/api/v1/checkup-design/create-step1`;
      
      console.log('🔍 [STEP1-분석] API 호출:', {
        url,
        uuid: request.uuid,
        hospital_id: request.hospital_id,
        selected_concerns_count: request.selected_concerns.length
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [STEP1-분석] API 오류:', response.status, errorText);
        throw new Error(`STEP 1 분석 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [STEP1-분석] API 응답 수신:', {
        success: result.success,
        has_analysis: !!result.data?.analysis,
        has_survey_reflection: !!result.data?.survey_reflection,
        has_selected_concerns_analysis: !!result.data?.selected_concerns_analysis,
        session_id: result.data?.session_id
      });
      
      // session_id가 있으면 로그 출력
      if (result.data?.session_id) {
        console.log('🎬 [SessionLogger] STEP 1에서 세션 ID 받음:', result.data.session_id);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [STEP1-분석] API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * STEP 2: 설계 및 근거 확보
   */
  async createCheckupDesignStep2(request: CheckupDesignStep2Request): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/create-step2`
        : `/api/v1/checkup-design/create-step2`;
      
      console.log('🔍 [STEP2-설계] API 호출:', {
        url,
        uuid: request.uuid,
        hospital_id: request.hospital_id,
        has_step1_result: !!request.step1_result,
        session_id: request.session_id
      });
      
      // session_id가 있으면 로그 출력
      if (request.session_id) {
        console.log('🎬 [SessionLogger] STEP 2에 세션 ID 전달:', request.session_id);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [STEP2-설계] API 오류:', response.status, errorText);
        throw new Error(`STEP 2 설계 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [STEP2-설계] API 응답 수신:', {
        success: result.success,
        categories_count: result.data?.recommended_items?.length || 0,
        total_count: result.data?.total_count || 0
      });
      
      return result;
    } catch (error) {
      console.error('❌ [STEP2-설계] API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 검진 설계 요청 삭제 (새로고침 시 사용)
   */
  async deleteCheckupDesign(uuid: string, hospitalId: string): Promise<{ success: boolean; message?: string; deleted_count?: number }> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/delete/${uuid}?hospital_id=${hospitalId}`
        : `/api/v1/checkup-design/delete/${uuid}?hospital_id=${hospitalId}`;
      
      console.log('🗑️ [검진설계삭제] API 호출:', {
        url,
        uuid,
        hospital_id: hospitalId
      });
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [검진설계삭제] API 오류:', response.status, errorText);
        throw new Error(`검진 설계 삭제 실패: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ [검진설계삭제] API 응답 수신:', {
        success: result.success,
        deleted_count: result.deleted_count
      });
      
      return result;
    } catch (error) {
      console.error('❌ [검진설계삭제] API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 최신 검진 설계 결과 조회
   */
  async getLatestCheckupDesign(uuid: string, hospitalId: string): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/latest/${uuid}?hospital_id=${hospitalId}`
        : `/api/v1/checkup-design/latest/${uuid}?hospital_id=${hospitalId}`;
      
      console.log('🔍 [검진설계조회] API 호출:', {
        url,
        uuid,
        hospital_id: hospitalId
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // 설계 결과가 없는 경우는 정상 (처음 설계하는 경우)
          return {
            success: false,
            data: null,
            message: '설계 결과가 없습니다.'
          };
        }
        const errorText = await response.text();
        console.error('❌ [검진설계조회] API 오류:', response.status, errorText);
        throw new Error(`검진 설계 조회 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [검진설계조회] API 응답 수신:', {
        success: result.success,
        has_data: !!result.data
      });
      
      return result;
    } catch (error) {
      console.error('❌ [검진설계조회] API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 검진 설계 생성 (GPT 기반) - 기존 방식 (내부적으로 STEP 1 → STEP 2 호출)
   */
  async createCheckupDesign(request: CheckupDesignRequest): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/create`
        : `/api/v1/checkup-design/create`;
      
      console.log('🔍 [검진설계] API 호출 (2단계 파이프라인):', {
        url,
        uuid: request.uuid,
        hospital_id: request.hospital_id,
        selected_concerns_count: request.selected_concerns.length
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [검진설계] API 오류:', response.status, errorText);
        throw new Error(`검진 설계 생성 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [검진설계] API 응답 수신:', {
        success: result.success,
        categories_count: result.data?.recommended_items?.length || 0,
        total_count: result.data?.total_count || 0
      });
      
      return result;
    } catch (error) {
      console.error('❌ [검진설계] API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 미완료 검진 설계 조회 (step1_completed 상태)
   */
  async getIncompleteCheckupDesign(uuid: string, hospitalId: string): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/incomplete/${uuid}?hospital_id=${hospitalId}`
        : `/api/v1/checkup-design/incomplete/${uuid}?hospital_id=${hospitalId}`;
      
      console.log('🔍 [미완료조회] API 호출:', {
        url,
        uuid,
        hospital_id: hospitalId
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // 미완료 요청이 없는 경우는 정상
          return {
            success: false,
            data: null,
            message: '미완료 검진 설계가 없습니다.'
          };
        }
        const errorText = await response.text();
        console.error('❌ [미완료조회] API 오류:', response.status, errorText);
        throw new Error(`미완료 조회 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [미완료조회] API 응답 수신:', {
        success: result.success,
        has_data: !!result.data
      });
      
      return result;
    } catch (error) {
      console.error('❌ [미완료조회] API 호출 실패:', error);
      return {
        success: false,
        data: null,
        message: '미완료 조회 실패'
      };
    }
  }

  /**
   * 검진 설계 재시도 (step1_completed 상태의 요청을 STEP2부터 재실행)
   */
  async retryCheckupDesign(requestId: number): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/api/v1/checkup-design/retry/${requestId}`
        : `/api/v1/checkup-design/retry/${requestId}`;
      
      console.log('🔄 [재시도] API 호출:', {
        url,
        request_id: requestId
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [재시도] API 오류:', response.status, errorText);
        throw new Error(`재시도 실패: ${response.status} ${errorText}`);
      }
      
      const result: CheckupDesignResponse = await response.json();
      console.log('✅ [재시도] API 응답 수신:', {
        success: result.success,
        has_data: !!result.data
      });
      
      return result;
    } catch (error) {
      console.error('❌ [재시도] API 호출 실패:', error);
      throw error;
    }
  }
}

export default new CheckupDesignService();

