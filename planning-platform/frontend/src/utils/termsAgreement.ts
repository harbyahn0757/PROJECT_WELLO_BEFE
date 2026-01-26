/**
 * 약관 동의 관리 유틸리티
 * 
 * - 로컬 저장 (LocalStorage)
 * - 서버 동기화
 * - 유효기간 관리 (3일)
 * - 각 약관별 개별 타임스탬프
 */

// ==================== 타입 정의 ====================

export interface IndividualTermAgreement {
  agreed: boolean;
  agreed_at: string | null;
  expires_at: string | null;
  synced_to_server: boolean;
  server_synced_at: string | null;
}

export interface TermsAgreementLocal {
  uuid: string;
  partner_id: string;
  
  // 각 약관별 개별 관리
  terms_service: IndividualTermAgreement;
  terms_privacy: IndividualTermAgreement;
  terms_sensitive: IndividualTermAgreement;
  terms_marketing: IndividualTermAgreement;
  
  // 메타데이터
  last_updated: string;
  all_required_agreed: boolean;
}

export interface TermCheckResult {
  termType: 'service' | 'privacy' | 'sensitive' | 'marketing';
  agreed: boolean;
  agreedAt: string | null;
  isExpired: boolean;
  needsReAgreement: boolean;
  source: 'none' | 'local' | 'server';
}

export interface AllTermsCheckResult {
  needsAgreement: boolean;
  terms: {
    service: TermCheckResult;
    privacy: TermCheckResult;
    sensitive: TermCheckResult;
    marketing: TermCheckResult;
  };
  missingRequiredTerms: string[];
  showReminderToast: boolean;
  toastMessage?: string;
  message?: string;
}

// ==================== 헬퍼 함수 ====================

function createEmptyTermCheck(termType: 'service' | 'privacy' | 'sensitive' | 'marketing'): TermCheckResult {
  return {
    termType,
    agreed: false,
    agreedAt: null,
    isExpired: false,
    needsReAgreement: true,
    source: 'none',
  };
}

function parseServerTerm(termType: 'service' | 'privacy' | 'sensitive' | 'marketing', serverTerm: any): TermCheckResult {
  return {
    termType,
    agreed: serverTerm?.agreed || false,
    agreedAt: serverTerm?.agreed_at || null,
    isExpired: false,
    needsReAgreement: false,
    source: 'server',
  };
}

function getTermName(termType: string): string {
  const names: Record<string, string> = {
    service: '서비스 이용약관',
    privacy: '개인정보 처리방침',
    sensitive: '민감정보 수집',
    marketing: '마케팅 활용',
  };
  return names[termType] || termType;
}

function getLocalStorageKey(uuid: string, partnerId: string): string {
  return `TERMS_AGREEMENT_${uuid}_${partnerId}`;
}

// ==================== 메인 함수 ====================

/**
 * 약관 동의 체크 (로컬 + 서버)
 * 
 * 우선순위:
 * 1. 서버 데이터 확인 (가장 신뢰할 수 있는 소스)
 * 2. 로컬 데이터 확인 (서버 실패 시 폴백)
 * 3. 유효기간 체크 (3일)
 */
export async function checkAllTermsAgreement(
  uuid: string,
  partnerId: string = 'kindhabit'
): Promise<AllTermsCheckResult> {
  
  const result: AllTermsCheckResult = {
    needsAgreement: false,
    terms: {
      service: createEmptyTermCheck('service'),
      privacy: createEmptyTermCheck('privacy'),
      sensitive: createEmptyTermCheck('sensitive'),
      marketing: createEmptyTermCheck('marketing'),
    },
    missingRequiredTerms: [],
    showReminderToast: false,
  };
  
  // 1. 서버 체크 (우선순위)
  try {
    console.log('[약관체크] 서버 조회 시작:', { uuid, partnerId });
    
    const response = await fetch(
      `/api/v1/terms/check?uuid=${encodeURIComponent(uuid)}&partner_id=${encodeURIComponent(partnerId)}`
    );
    
    if (response.ok) {
      const serverData = await response.json();
      console.log('[약관체크] 서버 응답:', serverData);
      
      if (serverData.agreed && serverData.terms_detail) {
        // 서버에서 각 약관별 정보 파싱
        result.terms.service = parseServerTerm('service', serverData.terms_detail.terms_service);
        result.terms.privacy = parseServerTerm('privacy', serverData.terms_detail.terms_privacy);
        result.terms.sensitive = parseServerTerm('sensitive', serverData.terms_detail.terms_sensitive);
        result.terms.marketing = parseServerTerm('marketing', serverData.terms_detail.terms_marketing);
        
        // 필수 약관 체크
        const requiredTerms: Array<'service' | 'privacy' | 'sensitive'> = ['service', 'privacy', 'sensitive'];
        const allRequiredAgreed = requiredTerms.every(
          term => result.terms[term].agreed
        );
        
        if (allRequiredAgreed) {
          console.log('[약관체크] 서버에서 모든 필수 약관 동의 확인');
          return {
            ...result,
            needsAgreement: false,
            showReminderToast: false,
          };
        }
      }
    }
  } catch (error) {
    console.warn('[약관체크] 서버 조회 실패, 로컬 체크로 전환:', error);
  }
  
  // 2. 로컬 체크
  const localKey = getLocalStorageKey(uuid, partnerId);
  const localDataStr = localStorage.getItem(localKey);
  
  if (!localDataStr) {
    console.log('[약관체크] 로컬 데이터 없음 - 약관 동의 필요');
    result.needsAgreement = true;
    result.missingRequiredTerms = ['service', 'privacy', 'sensitive'];
    return result;
  }
  
  try {
    const terms: TermsAgreementLocal = JSON.parse(localDataStr);
    const now = new Date();
    
    console.log('[약관체크] 로컬 데이터:', terms);
    
    // 각 약관별 체크
    const termTypes: Array<'service' | 'privacy' | 'sensitive' | 'marketing'> = 
      ['service', 'privacy', 'sensitive', 'marketing'];
    let hasExpiredTerm = false;
    let oldestAgreedAt: Date | null = null;
    
    for (const termType of termTypes) {
      const term = terms[`terms_${termType}`];
      
      if (!term.agreed) {
        result.terms[termType] = {
          termType,
          agreed: false,
          agreedAt: null,
          isExpired: false,
          needsReAgreement: true,
          source: 'none',
        };
        continue;
      }
      
      // 서버 동기화 완료된 약관
      if (term.synced_to_server) {
        result.terms[termType] = {
          termType,
          agreed: true,
          agreedAt: term.agreed_at,
          isExpired: false,
          needsReAgreement: false,
          source: 'server',
        };
        continue;
      }
      
      // 로컬 약관 - 유효기간 체크 (3일)
      const expiresAt = new Date(term.expires_at!);
      const isExpired = now > expiresAt;
      
      if (isExpired) {
        hasExpiredTerm = true;
        result.terms[termType] = {
          termType,
          agreed: false,
          agreedAt: term.agreed_at,
          isExpired: true,
          needsReAgreement: true,
          source: 'local',
        };
      } else {
        result.terms[termType] = {
          termType,
          agreed: true,
          agreedAt: term.agreed_at,
          isExpired: false,
          needsReAgreement: false,
          source: 'local',
        };
        
        // 가장 오래된 동의 시점 추적 (토스트 메시지용)
        const agreedAt = new Date(term.agreed_at!);
        if (!oldestAgreedAt || agreedAt < oldestAgreedAt) {
          oldestAgreedAt = agreedAt;
        }
      }
    }
    
    // 필수 약관 체크
    const requiredTerms: Array<'service' | 'privacy' | 'sensitive'> = ['service', 'privacy', 'sensitive'];
    result.missingRequiredTerms = requiredTerms.filter(
      term => result.terms[term].needsReAgreement
    );
    
    result.needsAgreement = result.missingRequiredTerms.length > 0 || hasExpiredTerm;
    
    // 토스트 메시지 생성
    if (!result.needsAgreement && oldestAgreedAt) {
      const formattedDate = oldestAgreedAt.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      result.showReminderToast = true;
      result.toastMessage = `${formattedDate}에 동의하신 약관으로 진행합니다.`;
      result.message = result.toastMessage;
      console.log('[약관체크] 로컬 약관 유효:', result.toastMessage);
    }
    
    if (hasExpiredTerm) {
      const expiredTermNames = termTypes
        .filter(t => result.terms[t].isExpired)
        .map(t => getTermName(t))
        .join(', ');
      
      result.toastMessage = `${expiredTermNames} 약관 동의가 만료되었습니다. 다시 동의해주세요.`;
      result.message = result.toastMessage;
      console.warn('[약관체크] 만료된 약관:', result.toastMessage);
    }
    
    return result;
    
  } catch (error) {
    console.error('[약관체크] 로컬 데이터 파싱 실패:', error);
    localStorage.removeItem(localKey);
    result.needsAgreement = true;
    result.missingRequiredTerms = ['service', 'privacy', 'sensitive'];
    return result;
  }
}

/**
 * 약관 동의 저장 (로컬 + 서버)
 * 
 * @param uuid 사용자 UUID
 * @param partnerId 파트너 ID
 * @param termsAgreement 약관 동의 정보
 * @param oid 주문 번호 (옵션)
 * @param userInfo 사용자 정보 (옵션)
 * @returns 저장 성공 여부
 */
export async function saveTermsAgreement(
  uuid: string,
  partnerId: string,
  termsAgreement: {
    terms_service: boolean;
    terms_privacy: boolean;
    terms_sensitive: boolean;
    terms_marketing: boolean;
  },
  oid?: string,
  userInfo?: any,
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3일 후
  
  // 각 약관별 개별 데이터 생성
  const createTermData = (agreed: boolean): IndividualTermAgreement => ({
    agreed,
    agreed_at: agreed ? now.toISOString() : null,
    expires_at: agreed ? expiresAt.toISOString() : null,
    synced_to_server: false,
    server_synced_at: null,
  });
  
  // 로컬 저장 데이터 구조
  const localData: TermsAgreementLocal = {
    uuid,
    partner_id: partnerId,
    terms_service: createTermData(termsAgreement.terms_service),
    terms_privacy: createTermData(termsAgreement.terms_privacy),
    terms_sensitive: createTermData(termsAgreement.terms_sensitive),
    terms_marketing: createTermData(termsAgreement.terms_marketing),
    last_updated: now.toISOString(),
    all_required_agreed:
      termsAgreement.terms_service &&
      termsAgreement.terms_privacy &&
      termsAgreement.terms_sensitive,
  };
  
  // 1. 로컬 저장 (즉시)
  const localKey = getLocalStorageKey(uuid, partnerId);
  try {
    localStorage.setItem(localKey, JSON.stringify(localData));
    console.log('✅ [약관저장] 로컬 저장 완료:', localData);
  } catch (error) {
    console.error('❌ [약관저장] 로컬 저장 실패:', error);
    return { success: false, error: '로컬 저장 실패' };
  }
  
  // 2. 서버 저장 시도 (비동기, 실패해도 로컬은 유효)
  if (uuid && oid) {
    try {
      const response = await fetch('/api/v1/campaigns/disease-prediction/register-patient/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          oid,
          user_info: userInfo,
          terms_agreement_detail: {
            terms_service: {
              agreed: termsAgreement.terms_service,
              agreed_at: termsAgreement.terms_service ? now.toISOString() : null,
            },
            terms_privacy: {
              agreed: termsAgreement.terms_privacy,
              agreed_at: termsAgreement.terms_privacy ? now.toISOString() : null,
            },
            terms_sensitive: {
              agreed: termsAgreement.terms_sensitive,
              agreed_at: termsAgreement.terms_sensitive ? now.toISOString() : null,
            },
            terms_marketing: {
              agreed: termsAgreement.terms_marketing,
              agreed_at: termsAgreement.terms_marketing ? now.toISOString() : null,
            },
          },
          api_key: apiKey,
          partner_id: partnerId,
        }),
      });
      
      if (response.ok) {
        // 서버 저장 성공 - 로컬 데이터 업데이트
        const syncTime = new Date().toISOString();
        localData.terms_service.synced_to_server = true;
        localData.terms_service.server_synced_at = syncTime;
        localData.terms_privacy.synced_to_server = true;
        localData.terms_privacy.server_synced_at = syncTime;
        localData.terms_sensitive.synced_to_server = true;
        localData.terms_sensitive.server_synced_at = syncTime;
        localData.terms_marketing.synced_to_server = true;
        localData.terms_marketing.server_synced_at = syncTime;
        
        localStorage.setItem(localKey, JSON.stringify(localData));
        
        console.log('✅ [약관저장] 서버 동기화 완료');
        return { success: true };
      } else {
        console.warn('⚠️ [약관저장] 서버 저장 실패 (로컬 3일 유효)');
        return { success: true }; // 로컬 저장은 성공
      }
    } catch (error) {
      console.error('❌ [약관저장] 서버 저장 오류 (로컬 3일 유효):', error);
      return { success: true }; // 로컬 저장은 성공
    }
  }
  
  return { success: true };
}

/**
 * 로컬 약관 데이터 삭제
 */
export function clearLocalTermsAgreement(uuid: string, partnerId: string): void {
  const localKey = getLocalStorageKey(uuid, partnerId);
  localStorage.removeItem(localKey);
  console.log('[약관삭제] 로컬 데이터 삭제:', localKey);
}
