/**
 * BNR 레거시 코드 호환성 레이어
 * 외부 의존성을 제거하고 더미 함수로 대체
 * 문진 기능은 향후 사용 가능성이 있어 인터페이스 유지
 */

// BNR 캠페인용 고객 정보 조회 - Mediarc에서는 미사용
export const checkQuestionnaireStatus = async (mkt_uuid: string) => {
  console.warn('[레거시] checkQuestionnaireStatus - Mediarc에서 미사용');
  return {
    success: false,
    customer_info: {
      name: null,
      phoneno: null,
      birthday: null
    }
  };
};

// BNR 캠페인용 페이지 트래킹 - Mediarc에서는 미사용
export const getMktUuidFromUrl = (): string | null => {
  console.warn('[레거시] getMktUuidFromUrl - Mediarc에서 미사용');
  return null;
};

// BNR 캠페인용 설문 API - Mediarc에서는 미사용 (향후 통합 가능)
export const questionnaireAPI = {
  getQuestionnaire: async (mkt_uuid: string) => {
    console.warn('[레거시] questionnaireAPI.getQuestionnaire - Mediarc에서 미사용');
    return { success: false, data: null };
  },
  
  submitQuestionnaire: async (mkt_uuid: string, answers: any) => {
    console.warn('[레거시] questionnaireAPI.submitQuestionnaire - Mediarc에서 미사용');
    return { success: false };
  },
  
  getPublicTemplate: async (templateId: string) => {
    console.warn('[레거시] questionnaireAPI.getPublicTemplate - Mediarc에서 미사용');
    return { 
      success: false, 
      data: null,
      status: 404
    };
  },
  
  getTemplates: async (templateId: string, partnerId?: string, options?: any) => {
    console.warn('[레거시] questionnaireAPI.getTemplates - Mediarc에서 미사용');
    return { 
      success: false, 
      data: null,
      status: 404
    };
  },
  
  saveDynamicDataPublic: async (payload: any) => {
    console.warn('[레거시] questionnaireAPI.saveDynamicDataPublic - Mediarc에서 미사용');
    return { 
      success: false,
      data: { success: false, message: 'Not implemented' },
      status: 501
    };
  }
};
