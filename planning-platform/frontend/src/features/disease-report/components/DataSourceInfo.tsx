/**
 * 데이터 출처 정보 표시 컴포넌트
 * 
 * Tilko/IndexedDB/파트너 데이터의 건수와 마지막 동기화 시각을 표시합니다.
 */

import React from 'react';
import type { UnifiedStatus, UnifiedStatusDataSource } from '../hooks/useUnifiedStatus';

interface DataSourceInfoProps {
  dataSources: UnifiedStatus['data_sources'];
  primarySource: UnifiedStatus['primary_source'];
  className?: string;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '없음';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '알 수 없음';
  }
};

const getSourceLabel = (sourceKey: string): string => {
  const labels: Record<string, string> = {
    tilko: 'Tilko 인증',
    indexeddb: '클라이언트 동기화',
    partner: '파트너사 제공',
  };
  return labels[sourceKey] || sourceKey;
};

/**
 * 데이터 출처 정보 표시 컴포넌트
 * 
 * @example
 * ```tsx
 * <DataSourceInfo 
 *   dataSources={status.data_sources} 
 *   primarySource={status.primary_source} 
 * />
 * ```
 */
export const DataSourceInfo: React.FC<DataSourceInfoProps> = ({
  dataSources,
  primarySource,
  className = '',
}) => {
  const sources = Object.entries(dataSources)
    .filter(([_, data]) => (data as UnifiedStatusDataSource).count > 0)
    .map(([key, data]) => ({
      key,
      label: getSourceLabel(key),
      data: data as UnifiedStatusDataSource,
      isPrimary: key === primarySource,
    }));

  if (sources.length === 0) {
    return (
      <div className={`data-source-info empty ${className}`}>
        <p className="text-gray-500">데이터 출처 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`data-source-info ${className}`}>
      <h4 className="font-semibold text-sm text-gray-700 mb-2">데이터 출처</h4>
      <ul className="space-y-2">
        {sources.map(({ key, label, data, isPrimary }) => (
          <li
            key={key}
            className={`flex items-center justify-between p-2 rounded ${
              isPrimary ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isPrimary ? 'text-blue-700' : 'text-gray-700'}`}>
                {label}
              </span>
              {isPrimary && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  주 출처
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {formatDate(data.last_synced_at)}
              </p>
              <p className="text-xs text-gray-400">
                {data.count}건
              </p>
            </div>
          </li>
        ))}
      </ul>
      {primarySource && (
        <p className="mt-3 text-xs text-gray-500">
          주 데이터 출처: <span className="font-medium text-blue-600">{getSourceLabel(primarySource)}</span>
        </p>
      )}
    </div>
  );
};

export default DataSourceInfo;
