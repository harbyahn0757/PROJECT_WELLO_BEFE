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
}

export interface Step1Result {
  patient_summary: string;
  analysis: string;
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
}

export interface CheckupDesignStep2Request extends CheckupDesignRequest {
  step1_result: Step1Result;
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
    selected_concerns_analysis?: Array<any>;
    basic_checkup_guide?: any;
    // STEP 2 필드들
    summary?: any;
    strategies?: Array<any>;
    doctor_comment?: string;
    _citations?: string[];
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
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/create-step1`
        : `/wello-api/v1/checkup-design/create-step1`;
      
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
        has_selected_concerns_analysis: !!result.data?.selected_concerns_analysis
      });
      
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
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/create-step2`
        : `/wello-api/v1/checkup-design/create-step2`;
      
      console.log('🔍 [STEP2-설계] API 호출:', {
        url,
        uuid: request.uuid,
        hospital_id: request.hospital_id,
        has_step1_result: !!request.step1_result
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
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/delete/${uuid}?hospital_id=${hospitalId}`
        : `/wello-api/v1/checkup-design/delete/${uuid}?hospital_id=${hospitalId}`;
      
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
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/latest/${uuid}?hospital_id=${hospitalId}`
        : `/wello-api/v1/checkup-design/latest/${uuid}?hospital_id=${hospitalId}`;
      
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
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/create`
        : `/wello-api/v1/checkup-design/create`;
      
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
}

export default new CheckupDesignService();

