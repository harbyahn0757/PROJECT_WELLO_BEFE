/**
 * useFloatingButton Hook
 * 
 * 매트릭스 상태 기반 플로팅 버튼 제어
 * 
 * 매트릭스 매핑:
 * - REPORT_READY → "더 자세히 알아보기"
 * - REPORT_EXPIRED → "다시 분석하기"
 * - REPORT_PENDING → "분석 진행 중..."
 * - PAYMENT_REQUIRED → "결제하고 분석받기"
 * - ACTION_REQUIRED* → "건강검진 데이터 수집하기"
 * - TERMS_REQUIRED* → "약관 동의하기"
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UnifiedStatus } from '../../../hooks/useUnifiedStatus';

// 플로팅 버튼 설정 타입
export interface FloatingButtonConfig {
  visible: boolean;
  text: string;
  action: () => void;
}

export function useFloatingButton(
  unifiedStatus: UnifiedStatus | null,
  uuid: string,
  partnerId: string | null
): FloatingButtonConfig {
  const navigate = useNavigate();

  const getConfig = useCallback((): FloatingButtonConfig => {
    if (!unifiedStatus) {
      return { visible: false, text: '', action: () => {} };
    }

    const { status } = unifiedStatus;

    // 1. REPORT_READY → "더 자세히 알아보기" (기본)
    if (status === 'REPORT_READY') {
      return {
        visible: true,
        text: '더 자세히 알아보기',
        action: () => {
          console.log('[플로팅 버튼] 액션: 리포트 상세 (현재 페이지 유지)');
          // 현재 페이지가 이미 리포트 페이지이므로 아무 액션 없음
          // 또는 특정 섹션으로 스크롤 (예: document.getElementById('report-detail')?.scrollIntoView())
        },
      };
    }

    // 2. REPORT_EXPIRED → "다시 분석하기"
    if (status === 'REPORT_EXPIRED') {
      return {
        visible: true,
        text: '다시 분석하기',
        action: () => {
          console.log('[플로팅 버튼] 액션: 리포트 재생성');
          // TODO: 리포트 재생성 API 호출
          alert('리포트 재생성 기능은 곧 제공됩니다.');
        },
      };
    }

    // 3. REPORT_PENDING → "분석 진행 중..." (비활성)
    if (status === 'REPORT_PENDING') {
      return {
        visible: true,
        text: '분석 진행 중...',
        action: () => {
          console.log('[플로팅 버튼] 액션: 분석 중 (클릭 불가)');
        },
      };
    }

    // 4. PAYMENT_REQUIRED → "결제하고 분석받기"
    if (status === 'PAYMENT_REQUIRED') {
      return {
        visible: true,
        text: '결제하고 분석받기',
        action: () => {
          console.log('[플로팅 버튼] 액션: 결제 페이지 이동');
          const paymentUrl = `/campaigns/disease-prediction?page=payment&uuid=${uuid}&partner=${partnerId || ''}`;
          navigate(paymentUrl);
        },
      };
    }

    // 5. ACTION_REQUIRED* → "건강검진 데이터 수집하기"
    if (status === 'ACTION_REQUIRED' || status === 'ACTION_REQUIRED_PAID') {
      return {
        visible: true,
        text: '건강검진 데이터 수집하기',
        action: () => {
          console.log('[플로팅 버튼] 액션: Tilko 인증');
          // TODO: Tilko 인증 페이지로 이동
          navigate(`/login?return_to=/disease-report&uuid=${uuid}&mode=campaign`);
        },
      };
    }

    // 6. TERMS_REQUIRED* → "약관 동의하기"
    if (status.startsWith('TERMS_REQUIRED')) {
      return {
        visible: true,
        text: '약관 동의하기',
        action: () => {
          console.log('[플로팅 버튼] 액션: 약관 페이지 이동');
          const termsUrl = `/campaigns/disease-prediction?page=terms&uuid=${uuid}&partner=${partnerId || ''}`;
          navigate(termsUrl);
        },
      };
    }

    // 7. 기타 상태 → 버튼 숨김
    return { visible: false, text: '', action: () => {} };
  }, [unifiedStatus, uuid, partnerId, navigate]);

  const config = getConfig();

  // App.tsx의 FloatingButton에 설정 전달 (Custom Event 사용)
  useEffect(() => {
    const event = new CustomEvent('floating-button-config', {
      detail: config,
    });
    window.dispatchEvent(event);

    console.log(`[플로팅 버튼 설정] visible=${config.visible}, text="${config.text}"`);
  }, [config]);

  return config;
}
