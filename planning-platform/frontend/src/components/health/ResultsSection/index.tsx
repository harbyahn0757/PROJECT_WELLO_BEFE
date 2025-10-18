/**
 * 검진 결과 섹션 컴포넌트
 */
import React from 'react';
import { ResultsSectionProps } from '../../../types/health';
import { healthConnectService } from '../../../services/health/HealthConnectService';
import './styles.scss';

interface ExtendedResultsSectionProps extends ResultsSectionProps {
  selectedResults?: string[];
  onSelectionChange?: (resultId: string) => void;
}

const ResultsSection: React.FC<ExtendedResultsSectionProps> = ({
  results,
  loading = false,
  onResultClick,
  sortBy = 'date',
  sortOrder = 'desc',
  onSortChange,
  selectedResults = [],
  onSelectionChange
}) => {
  /**
   * 정렬 헤더 클릭 처리
   */
  const handleSortClick = (field: 'date' | 'hospital' | 'status') => {
    if (onSortChange) {
      onSortChange(field);
    }
  };

  /**
   * 결과 상태 아이콘
   */
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case '정상':
        return '✅';
      case '이상':
      case '비정상':
        return '⚠️';
      case '관찰':
      case '추적관찰':
        return '👁️';
      default:
        return '📋';
    }
  };

  /**
   * 결과 상태 클래스
   */
  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case '정상':
        return 'status--normal';
      case '이상':
      case '비정상':
        return 'status--abnormal';
      case '관찰':
      case '추적관찰':
        return 'status--warning';
      default:
        return 'status--unknown';
    }
  };

  if (loading) {
    return (
      <div className="results-section">
        <div className="results-section__loading">
          <div className="loading-skeleton">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-item">
                <div className="skeleton-line skeleton-line--title"></div>
                <div className="skeleton-line skeleton-line--subtitle"></div>
                <div className="skeleton-line skeleton-line--content"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="results-section">
        <div className="results-section__empty">
          <div className="empty-icon">📋</div>
          <h3>검진 결과가 없습니다</h3>
          <p>필터 조건을 변경하거나 새로운 데이터를 추가해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-section">
      {/* 헤더 */}
      <div className="results-section__header">
        <h3 className="results-section__title">
          검진 결과 ({results.length}건)
        </h3>
        
        {/* 정렬 옵션 */}
        <div className="sort-options">
          <button
            className={`sort-button ${sortBy === 'date' ? 'active' : ''}`}
            onClick={() => handleSortClick('date')}
          >
            날짜순 {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortBy === 'hospital' ? 'active' : ''}`}
            onClick={() => handleSortClick('hospital')}
          >
            병원순 {sortBy === 'hospital' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-button ${sortBy === 'status' ? 'active' : ''}`}
            onClick={() => handleSortClick('status')}
          >
            상태순 {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* 결과 목록 */}
      <div className="results-section__content">
        {results.map((result) => (
          <div
            key={result.id}
            className={`result-card ${selectedResults.includes(result.id) ? 'result-card--selected' : ''}`}
            onClick={() => onResultClick?.(result)}
          >
            {/* 선택 체크박스 */}
            {onSelectionChange && (
              <div className="result-card__checkbox">
                <input
                  type="checkbox"
                  checked={selectedResults.includes(result.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectionChange(result.id);
                  }}
                />
              </div>
            )}

            {/* 메인 정보 */}
            <div className="result-card__main">
              <div className="result-card__header">
                <div className="result-card__date">
                  {healthConnectService.formatDate(result.date)}
                </div>
                <div className={`result-card__status ${getStatusClass(result.overallStatus || '')}`}>
                  {getStatusIcon(result.overallStatus || '')}
                  {result.overallStatus}
                </div>
              </div>

              <div className="result-card__info">
                <h4 className="result-card__hospital">
                  {result.hospitalName}
                </h4>
                {result.doctorName && (
                  <p className="result-card__doctor">
                    담당의: {result.doctorName}
                  </p>
                )}
              </div>
            </div>

            {/* 카테고리 요약 */}
            <div className="result-card__categories">
              {result.categories.map((category, index) => (
                <div key={index} className="category-summary">
                  <span className="category-name">{category.name}</span>
                  <span className="category-count">
                    {category.items.length}개 항목
                  </span>
                </div>
              ))}
            </div>

            {/* 상세 정보 */}
            <div className="result-card__details">
              {result.categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="category-detail">
                  <h5 className="category-title">{category.name}</h5>
                  <div className="category-items">
                    {category.items.slice(0, 3).map((item, itemIndex) => (
                      <div key={itemIndex} className="item-summary">
                        <span className="item-name">{item.name}</span>
                        <span className={`item-value ${item.isNormal ? 'normal' : 'abnormal'}`}>
                          {healthConnectService.normalizeValue(item.value, item.unit)}
                        </span>
                      </div>
                    ))}
                    {category.items.length > 3 && (
                      <div className="item-more">
                        +{category.items.length - 3}개 더
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 권고사항 */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="result-card__recommendations">
                <h5>권고사항</h5>
                <ul>
                  {result.recommendations.slice(0, 2).map((recommendation, index) => (
                    <li key={index}>{recommendation}</li>
                  ))}
                  {result.recommendations.length > 2 && (
                    <li>+{result.recommendations.length - 2}개 더</li>
                  )}
                </ul>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="result-card__actions">
              <button className="action-button secondary">
                상세보기
              </button>
              <button className="action-button secondary">
                공유하기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsSection;
