/**
 * CategoryDetailView - 카테고리 상세 뷰
 * 특정 카테고리의 항목들을 상세하게 표시
 */
import React, { useState, useMemo } from 'react';
import { TilkoHealthCheckupRaw } from '../../../../types/health';
import { processHealthDataToCategories } from '../../../../utils/categoryDataProcessor';
import { HEALTH_CATEGORIES } from '../../../../utils/healthItemsConfig';
import CategoryTabs from '../CategoryTabs';
import JudgmentCard from '../JudgmentCard';
import HealthAgeCard from '../HealthAgeCard';
import ItemsList from '../ItemsList';
import './styles.scss';

interface CategoryDetailViewProps {
  categoryId: string;
  healthData: TilkoHealthCheckupRaw[];
  year: string;
  availableYears: string[];
  onYearChange: (year: string) => void;
  onBack: () => void;
  onItemClick: (itemName: string) => void;
  patientName?: string;
  healthAge?: number;
  actualAge?: number;
}

const CategoryDetailView: React.FC<CategoryDetailViewProps> = ({
  categoryId,
  healthData,
  year,
  availableYears,
  onYearChange,
  onBack,
  onItemClick,
  patientName = '사용자',
  healthAge,
  actualAge
}) => {
  const [selectedTab, setSelectedTab] = useState(categoryId);
  
  // 년도 전환 핸들러
  const handlePrevYear = () => {
    const currentIndex = availableYears.indexOf(year);
    if (currentIndex < availableYears.length - 1) {
      onYearChange(availableYears[currentIndex + 1]); // 다음 인덱스는 더 오래된 년도
    }
  };
  
  const handleNextYear = () => {
    const currentIndex = availableYears.indexOf(year);
    if (currentIndex > 0) {
      onYearChange(availableYears[currentIndex - 1]); // 이전 인덱스는 더 최신 년도
    }
  };
  
  // 년도 네비게이션 가능 여부
  const canGoPrev = availableYears.indexOf(year) < availableYears.length - 1;
  const canGoNext = availableYears.indexOf(year) > 0;
  
  // 모든 카테고리 데이터 추출
  const allCategories = useMemo(() => {
    return processHealthDataToCategories(healthData, year);
  }, [healthData, year]);
  
  // 현재 선택된 카테고리 데이터
  const currentCategory = useMemo(() => {
    return allCategories.find(c => c.id === selectedTab);
  }, [allCategories, selectedTab]);
  
  // 카테고리 정의 목록
  const categoryDefinitions = Object.values(HEALTH_CATEGORIES);
  
  if (!currentCategory) {
    return (
      <div className="category-detail-view">
        <div className="detail-header">
          <div className="year-display-inline">
            <span className="year-text">{year}년</span>
          </div>
          <div className="header-spacer" />
        </div>
        <div className="detail-empty">
          <p>카테고리 데이터를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="category-detail-view">
      {/* 헤더 - 년도 네비게이션 중앙 정렬 */}
      <div className="detail-header">
        {/* 연도 표시 (화살표 포함) - 중앙 정렬 */}
        <div className="year-display-inline">
          <button 
            className={`year-arrow ${!canGoPrev ? 'disabled' : ''}`}
            onClick={handlePrevYear}
            disabled={!canGoPrev}
            aria-label="이전 년도"
          >
            ←
          </button>
          <span className="year-text">{year}년</span>
          <button 
            className={`year-arrow ${!canGoNext ? 'disabled' : ''}`}
            onClick={handleNextYear}
            disabled={!canGoNext}
            aria-label="다음 년도"
          >
            →
          </button>
        </div>
      </div>
      
      {/* 탭 메뉴 */}
      <CategoryTabs
        categories={categoryDefinitions}
        activeTab={selectedTab}
        onTabChange={setSelectedTab}
        showSummary={true}
      />
      
      {/* 판정 결과 카드 */}
      {currentCategory.judgment && (
        <JudgmentCard
          patientName={patientName}
          judgment={currentCategory.judgment}
          description={currentCategory.description}
        />
      )}
      
      {/* 주의 항목 개수 */}
      {currentCategory.cautionCount > 0 && (
        <div className="caution-notice">
          주의 항목이 <strong>{currentCategory.cautionCount}개</strong> 있어요
        </div>
      )}
      
      {/* 항목 리스트 */}
      {currentCategory.items.length > 0 ? (
        <ItemsList
          items={currentCategory.items}
          onItemClick={onItemClick}
          showStatus={true}
        />
      ) : (
        <div className="items-empty">
          <p>이 카테고리에 검사 항목이 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default CategoryDetailView;
