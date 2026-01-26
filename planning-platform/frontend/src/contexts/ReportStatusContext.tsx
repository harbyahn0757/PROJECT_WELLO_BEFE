/**
 * 리포트 상태 Context
 * 
 * DiseaseReportPage와 App.tsx의 FloatingButton 간 상태 공유를 위한 Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UnifiedStatus } from '../features/disease-report/hooks/useUnifiedStatus';

interface ReportStatusContextType {
  loading: boolean;
  error: string | null;
  hasReport: boolean;
  reportUrl: string | null;
  unifiedStatus: UnifiedStatus | null;
  updateStatus: (status: Partial<ReportStatusState>) => void;
}

interface ReportStatusState {
  loading: boolean;
  error: string | null;
  hasReport: boolean;
  reportUrl: string | null;
  unifiedStatus: UnifiedStatus | null;
}

const ReportStatusContext = createContext<ReportStatusContextType | null>(null);

interface ReportStatusProviderProps {
  children: ReactNode;
}

/**
 * 리포트 상태 Provider
 * 
 * DiseaseReportPage에서 상태 변경 시 custom event를 발생시키면,
 * 이 Provider가 이벤트를 수신하여 전역 상태를 업데이트합니다.
 * 
 * @example
 * ```tsx
 * // App.tsx
 * <ReportStatusProvider>
 *   <YourApp />
 * </ReportStatusProvider>
 * ```
 */
export const ReportStatusProvider: React.FC<ReportStatusProviderProps> = ({ children }) => {
  const [state, setState] = useState<ReportStatusState>({
    loading: false,
    error: null,
    hasReport: false,
    reportUrl: null,
    unifiedStatus: null,
  });

  // DiseaseReportPage에서 상태 업데이트를 위한 custom event 리스너
  useEffect(() => {
    const handleReportStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<ReportStatusState>>;
      setState((prev) => ({
        ...prev,
        ...customEvent.detail,
      }));
    };

    window.addEventListener('report-status-change', handleReportStatusChange);
    return () => window.removeEventListener('report-status-change', handleReportStatusChange);
  }, []);

  const updateStatus = (status: Partial<ReportStatusState>) => {
    setState((prev) => ({
      ...prev,
      ...status,
    }));
  };

  return (
    <ReportStatusContext.Provider value={{ ...state, updateStatus }}>
      {children}
    </ReportStatusContext.Provider>
  );
};

/**
 * 리포트 상태 Hook
 * 
 * @throws {Error} - ReportStatusProvider 외부에서 사용 시 에러 발생
 * 
 * @example
 * ```tsx
 * // FloatingButton에서 사용
 * const { loading, error, hasReport, reportUrl, unifiedStatus } = useReportStatus();
 * 
 * if (loading) return null;
 * if (!hasReport) return <button>데이터 가져오기</button>;
 * return <button onClick={() => window.open(reportUrl)}>더 자세히 알아보기</button>;
 * ```
 */
export const useReportStatus = (): ReportStatusContextType => {
  const context = useContext(ReportStatusContext);
  
  if (!context) {
    throw new Error('useReportStatus must be used within ReportStatusProvider');
  }
  
  return context;
};

/**
 * DiseaseReportPage에서 상태를 브로드캐스트하는 Helper 함수
 * 
 * @example
 * ```tsx
 * // DiseaseReportPage.tsx
 * useEffect(() => {
 *   broadcastReportStatus({
 *     loading,
 *     error,
 *     hasReport: !!reportData,
 *     reportUrl,
 *     unifiedStatus,
 *   });
 * }, [loading, error, reportData, reportUrl, unifiedStatus]);
 * ```
 */
export const broadcastReportStatus = (status: Partial<ReportStatusState>) => {
  window.dispatchEvent(
    new CustomEvent('report-status-change', {
      detail: status,
    })
  );
};
