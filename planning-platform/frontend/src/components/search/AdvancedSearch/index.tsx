/**
 * AdvancedSearch - 고급 검색 및 필터링 컴포넌트
 * 다중 조건 검색, 저장된 필터, 즐겨찾기 기능
 */
import React, { useState, useCallback, useEffect } from 'react';
import { FilterState, HealthStatus } from '../../../types/health';
import './styles.scss';

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  isFavorite: boolean;
  createdAt: string;
  lastUsed?: string;
}

export interface AdvancedSearchProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onSearch: (searchTerm: string) => void;
  savedFilters?: SavedFilter[];
  onSaveFilter?: (name: string, filters: FilterState) => void;
  onLoadFilter?: (filter: SavedFilter) => void;
  onDeleteFilter?: (filterId: string) => void;
  onToggleFavorite?: (filterId: string) => void;
  placeholder?: string;
  showSavedFilters?: boolean;
  showQuickFilters?: boolean;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  filters,
  onFilterChange,
  onSearch,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  onToggleFavorite,
  placeholder = "검색어를 입력하세요...",
  showSavedFilters = true,
  showQuickFilters = true
}) => {
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // 빠른 필터 옵션
  const quickFilters = [
    { label: '최근 1년', key: 'recent_year', filters: { 
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
    }},
    { label: '정상 결과만', key: 'normal_only', filters: { 
      status: ['정상' as HealthStatus] 
    }},
    { label: '주의 결과만', key: 'warning_only', filters: { 
      status: ['주의' as HealthStatus] 
    }},
    { label: '위험 결과만', key: 'danger_only', filters: { 
      status: ['위험' as HealthStatus] 
    }},
    { label: '혈액검사', key: 'blood_test', filters: { 
      category: '혈액검사' 
    }},
    { label: '계측검사', key: 'measurement', filters: { 
      category: '계측검사' 
    }}
  ];

  // 검색어 변경 처리
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    onFilterChange({ ...filters, searchTerm: value });
  }, [filters, onFilterChange]);

  // 검색 실행
  const handleSearch = useCallback(() => {
    onSearch(searchTerm);
  }, [searchTerm, onSearch]);

  // Enter 키 처리
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 필터 변경 처리
  const handleFilterChange = useCallback((key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  // 빠른 필터 적용
  const applyQuickFilter = useCallback((quickFilter: typeof quickFilters[0]) => {
    const newFilters = { ...filters, ...quickFilter.filters };
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  // 필터 저장
  const handleSaveFilter = useCallback(() => {
    if (filterName.trim() && onSaveFilter) {
      onSaveFilter(filterName.trim(), filters);
      setFilterName('');
      setShowSaveDialog(false);
    }
  }, [filterName, filters, onSaveFilter]);

  // 저장된 필터 로드
  const handleLoadFilter = useCallback((savedFilter: SavedFilter) => {
    if (onLoadFilter) {
      onLoadFilter(savedFilter);
    }
  }, [onLoadFilter]);

  // 필터 초기화
  const handleResetFilters = useCallback(() => {
    const resetFilters: FilterState = {
      searchTerm: '',
      year: undefined,
      category: 'all',
      startDate: '',
      endDate: '',
      hospitalName: '',
      department: '',
      status: undefined
    };
    setSearchTerm('');
    onFilterChange(resetFilters);
  }, [onFilterChange]);

  return (
    <div className="advanced-search">
      {/* 메인 검색바 */}
      <div className="advanced-search__main">
        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="search-button"
            onClick={handleSearch}
            aria-label="검색"
          >
            🔍
          </button>
          <button
            className={`filter-toggle ${isExpanded ? 'active' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="고급 필터"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* 빠른 필터 */}
      {showQuickFilters && (
        <div className="advanced-search__quick-filters">
          <div className="quick-filters-label">빠른 필터:</div>
          <div className="quick-filters-list">
            {quickFilters.map((quickFilter) => (
              <button
                key={quickFilter.key}
                className="quick-filter-button"
                onClick={() => applyQuickFilter(quickFilter)}
              >
                {quickFilter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 고급 필터 패널 */}
      {isExpanded && (
        <div className="advanced-search__panel">
          <div className="filter-grid">
            {/* 연도 필터 */}
            <div className="filter-group">
              <label className="filter-label">연도</label>
              <select
                className="filter-select"
                value={filters.year || ''}
                onChange={(e) => handleFilterChange('year', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">전체</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>

            {/* 카테고리 필터 */}
            <div className="filter-group">
              <label className="filter-label">검사 구분</label>
              <select
                className="filter-select"
                value={filters.category || 'all'}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="all">전체</option>
                <option value="계측검사">계측검사</option>
                <option value="혈액검사">혈액검사</option>
                <option value="요검사">요검사</option>
                <option value="영상검사">영상검사</option>
                <option value="골다공증">골다공증</option>
              </select>
            </div>

            {/* 기간 필터 */}
            <div className="filter-group">
              <label className="filter-label">시작일</label>
              <input
                type="date"
                className="filter-input"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">종료일</label>
              <input
                type="date"
                className="filter-input"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            {/* 병원명 필터 */}
            <div className="filter-group">
              <label className="filter-label">병원명</label>
              <input
                type="text"
                className="filter-input"
                placeholder="병원명 검색"
                value={filters.hospitalName || ''}
                onChange={(e) => handleFilterChange('hospitalName', e.target.value)}
              />
            </div>

            {/* 진료과 필터 */}
            <div className="filter-group">
              <label className="filter-label">진료과</label>
              <select
                className="filter-select"
                value={filters.department || ''}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="">전체</option>
                <option value="내과">내과</option>
                <option value="외과">외과</option>
                <option value="정형외과">정형외과</option>
                <option value="산부인과">산부인과</option>
                <option value="소아과">소아과</option>
                <option value="안과">안과</option>
                <option value="이비인후과">이비인후과</option>
                <option value="피부과">피부과</option>
                <option value="정신건강의학과">정신건강의학과</option>
              </select>
            </div>
          </div>

          {/* 필터 액션 */}
          <div className="filter-actions">
            <button
              className="filter-action-button reset"
              onClick={handleResetFilters}
            >
              초기화
            </button>
            
            {onSaveFilter && (
              <button
                className="filter-action-button save"
                onClick={() => setShowSaveDialog(true)}
              >
                필터 저장
              </button>
            )}
          </div>
        </div>
      )}

      {/* 저장된 필터 */}
      {showSavedFilters && savedFilters.length > 0 && (
        <div className="advanced-search__saved-filters">
          <div className="saved-filters-header">
            <h4>저장된 필터</h4>
          </div>
          <div className="saved-filters-list">
            {savedFilters.map((savedFilter) => (
              <div key={savedFilter.id} className="saved-filter-item">
                <button
                  className="saved-filter-button"
                  onClick={() => handleLoadFilter(savedFilter)}
                >
                  <span className="saved-filter-name">{savedFilter.name}</span>
                  {savedFilter.isFavorite && <span className="favorite-icon">⭐</span>}
                </button>
                
                <div className="saved-filter-actions">
                  {onToggleFavorite && (
                    <button
                      className="filter-action-icon"
                      onClick={() => onToggleFavorite(savedFilter.id)}
                      aria-label={savedFilter.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    >
                      {savedFilter.isFavorite ? '⭐' : '☆'}
                    </button>
                  )}
                  
                  {onDeleteFilter && (
                    <button
                      className="filter-action-icon delete"
                      onClick={() => onDeleteFilter(savedFilter.id)}
                      aria-label="필터 삭제"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 저장 다이얼로그 */}
      {showSaveDialog && (
        <div className="save-dialog-overlay">
          <div className="save-dialog">
            <h3>필터 저장</h3>
            <input
              type="text"
              className="save-dialog-input"
              placeholder="필터 이름을 입력하세요"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveFilter()}
              autoFocus
            />
            <div className="save-dialog-actions">
              <button
                className="save-dialog-button cancel"
                onClick={() => {
                  setShowSaveDialog(false);
                  setFilterName('');
                }}
              >
                취소
              </button>
              <button
                className="save-dialog-button save"
                onClick={handleSaveFilter}
                disabled={!filterName.trim()}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
