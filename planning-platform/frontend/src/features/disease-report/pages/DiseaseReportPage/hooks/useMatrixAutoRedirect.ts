/**
 * useMatrixAutoRedirect Hook
 * 
 * 매트릭스 상태 기반 자동 리다이렉트 처리
 * 
 * 적용 상태:
 * - TERMS_REQUIRED* → 약관 페이지
 * - PAYMENT_REQUIRED → 결제 페이지
 * - ACTION_REQUIRED* → Tilko 인증 (오늘 제외, 로깅만)
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UnifiedStatus } from '../../../hooks/useUnifiedStatus';

export function useMatrixAutoRedirect(
  unifiedStatus: UnifiedStatus | null,
  uuid: string,
  partnerId: string | null
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!unifiedStatus) return;

    const { status } = unifiedStatus;
    
    console.log(`[매트릭스 자동 리다이렉트] status=${status}`);

    // 1. 약관 미동의 → 약관 페이지
    if (status.startsWith('TERMS_REQUIRED')) {
      console.log('[리다이렉트] → 약관 페이지');
      const termsUrl = `/campaigns/disease-prediction?page=terms&uuid=${uuid}&partner=${partnerId || ''}`;
      navigate(termsUrl, { replace: true });
      return;
    }

    // 2. 결제 필요 → 결제 페이지
    if (status === 'PAYMENT_REQUIRED') {
      console.log('[리다이렉트] → 결제 페이지');
      const paymentUrl = `/campaigns/disease-prediction?page=payment&uuid=${uuid}&partner=${partnerId || ''}`;
      navigate(paymentUrl, { replace: true });
      return;
    }

    // 3. 데이터 부족 → Tilko 인증 (오늘은 로깅만)
    if (status === 'ACTION_REQUIRED' || status === 'ACTION_REQUIRED_PAID') {
      console.log('[상태] 데이터 수집 필요 (Tilko 인증 - 오늘 작업 범위 외)');
      // TODO: 나중에 활성화
      // navigate(`/login?return_to=/disease-report&uuid=${uuid}&mode=campaign`, { replace: true });
      return;
    }

    // 4. REPORT_READY → 정상 표시 (리다이렉트 없음)
    if (status === 'REPORT_READY') {
      console.log('[상태] ✅ 리포트 표시 준비 완료');
      return;
    }

    // 5. REPORT_PENDING → 로딩 상태 유지 (폴링 중)
    if (status === 'REPORT_PENDING') {
      console.log('[상태] ⏳ 리포트 생성 중 (폴링 활성)');
      return;
    }

    // 6. REPORT_EXPIRED → 만료 메시지 표시
    if (status === 'REPORT_EXPIRED') {
      console.log('[상태] ⚠️ 리포트 만료됨');
      return;
    }

    // 7. READY_TO_GENERATE → 인트로 페이지 (생성 모달)
    if (status === 'READY_TO_GENERATE') {
      console.log('[리다이렉트] → 생성 준비 완료 (인트로 페이지)');
      const readyUrl = `/campaigns/disease-prediction?page=intro&uuid=${uuid}&partner=${partnerId || ''}&ready=true`;
      navigate(readyUrl, { replace: true });
      return;
    }

  }, [unifiedStatus, navigate, uuid, partnerId]);
}
