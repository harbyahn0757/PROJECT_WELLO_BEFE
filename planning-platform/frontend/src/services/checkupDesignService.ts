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
    weight_change?: string;
    exercise_frequency?: string;
    family_history?: string[];
    smoking?: string;
    drinking?: string;
    sleep_hours?: string;
    stress_level?: string;
    additional_concerns?: string;
  };
  additional_info?: Record<string, any>;
}

export interface CheckupDesignResponse {
  success: boolean;
  data: {
    recommended_items: Array<{
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
    analysis: string;
    total_count: number;
  };
  message?: string;
}

class CheckupDesignService {
  /**
   * 검진 설계 생성 (GPT 기반)
   */
  async createCheckupDesign(request: CheckupDesignRequest): Promise<CheckupDesignResponse> {
    try {
      const url = API_BASE_URL 
        ? `${API_BASE_URL}/wello-api/v1/checkup-design/create`
        : `/wello-api/v1/checkup-design/create`;
      
      console.log('🔍 [검진설계] API 호출:', {
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

