/**
 * 필터 섹션 컴포넌트
 */
import React from 'react';
import { FilterSectionProps } from '../../../types/health';
import './styles.scss';

const FilterSection: React.FC<FilterSectionProps & { type?: 'checkup' | 'prescription' }> = ({
  filters,
  onFilterChange,
  disabled = false,
  type = 'checkup'
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const categories = [
    { value: 'all', label: '전체' },
    { value: 'basic', label: '기본 검진' },
    { value: 'blood', label: '혈액 검사' },
    { value: 'urine', label: '소변 검사' },
    { value: 'imaging', label: '영상 검사' },
    { value: 'cancer', label: '암 검진' },
    { value: 'other', label: '기타' }
  ];

  const departments = [
    { value: 'all', label: '전체' },
    { value: '내과', label: '내과' },
    { value: '외과', label: '외과' },
    { value: '정형외과', label: '정형외과' },
    { value: '피부과', label: '피부과' },
    { value: '안과', label: '안과' },
    { value: '이비인후과', label: '이비인후과' },
    { value: '산부인과', label: '산부인과' },
    { value: '소아과', label: '소아과' },
    { value: '정신건강의학과', label: '정신건강의학과' }
  ];

  return (
    <div className={`filter-section ${disabled ? 'filter-section--disabled' : ''}`}>
      <div className="filter-section__header">
        <h3 className="filter-section__title">필터</h3>
        <button 
          className="filter-section__reset"
          onClick={() => onFilterChange({
            year: 0,
            category: 'all',
            searchTerm: '',
            hospitalName: '',
            startDate: '',
            endDate: '',
            department: ''
          })}
          disabled={disabled}
        >
          초기화
        </button>
      </div>

      <div className="filter-section__content">
        {/* 연도 필터 */}
        <div className="filter-group">
          <label className="filter-label">연도</label>
          <select
            className="filter-select"
            value={filters.year || ''}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              year: e.target.value ? parseInt(e.target.value) : 0 
            })}
            disabled={disabled}
          >
            <option value="">전체</option>
            {years.map(year => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </div>

        {type === 'checkup' ? (
          <>
            {/* 카테고리 필터 */}
            <div className="filter-group">
              <label className="filter-label">검진 종류</label>
              <select
                className="filter-select"
                value={filters.category || 'all'}
                onChange={(e) => onFilterChange({ 
                  ...filters, 
                  category: e.target.value 
                })}
                disabled={disabled}
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* 날짜 범위 필터 (처방전용) */}
            <div className="filter-group">
              <label className="filter-label">시작일</label>
              <input
                type="date"
                className="filter-input"
                value={filters.startDate || ''}
                onChange={(e) => onFilterChange({ 
                  ...filters, 
                  startDate: e.target.value 
                })}
                disabled={disabled}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">종료일</label>
              <input
                type="date"
                className="filter-input"
                value={filters.endDate || ''}
                onChange={(e) => onFilterChange({ 
                  ...filters, 
                  endDate: e.target.value 
                })}
                disabled={disabled}
              />
            </div>

            {/* 진료과 필터 */}
            <div className="filter-group">
              <label className="filter-label">진료과</label>
              <select
                className="filter-select"
                value={filters.department || 'all'}
                onChange={(e) => onFilterChange({ 
                  ...filters, 
                  department: e.target.value === 'all' ? '' : e.target.value 
                })}
                disabled={disabled}
              >
                {departments.map(dept => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* 병원명 필터 */}
        <div className="filter-group">
          <label className="filter-label">병원명</label>
          <input
            type="text"
            className="filter-input"
            placeholder="병원명을 입력하세요"
            value={filters.hospitalName || ''}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              hospitalName: e.target.value 
            })}
            disabled={disabled}
          />
        </div>

        {/* 검색어 필터 */}
        <div className="filter-group">
          <label className="filter-label">검색</label>
          <input
            type="text"
            className="filter-input"
            placeholder="검색어를 입력하세요"
            value={filters.searchTerm || ''}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              searchTerm: e.target.value 
            })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterSection;
