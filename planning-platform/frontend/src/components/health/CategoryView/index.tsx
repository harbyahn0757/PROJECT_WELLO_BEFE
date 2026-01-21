/**
 * CategoryView - 건강 카테고리 뷰 메인 컨테이너
 * 카드 그리드 ↔ 카테고리 상세 뷰 전환 관리
 */
import React, { useState, useMemo } from 'react';
import { TilkoHealthCheckupRaw } from '../../../types/health';
import { processHealthDataToCategories } from '../../../utils/categoryDataProcessor';
import CategoryCardsGrid from './CategoryCardsGrid';
import CategoryDetailView from './CategoryDetailView';
import ItemTrendModal from './ItemTrendModal';
import './styles.scss';

interface CategoryViewProps {
  healthData: TilkoHealthCheckupRaw[];
  year?: string;
  compact?: boolean;
  patientName?: string;
  healthAge?: number;
  actualAge?: number;
  onCategoryClick?: (categoryId: string) => void; // 외부 핸들러 (선택사항)
}

const CategoryView: React.FC<CategoryViewProps> = ({
  healthData,
  year,
  compact = false,
  patientName,
  healthAge,
  actualAge,
  onCategoryClick
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  // 카테고리 데이터 처리
  const categories = useMemo(() => {
    return processHealthDataToCategories(healthData, year);
  }, [healthData, year]);
  
  // 연도 추출 (최신)
  const currentYear = useMemo(() => {
    if (year) return year;
    if (healthData.length > 0) {
      return healthData[0].Year.replace('년', '');
    }
    return new Date().getFullYear().toString();
  }, [healthData, year]);
  
  // 카테고리 클릭 핸들러
  const handleCategoryClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    }
    setSelectedCategory(categoryId);
  };
  
  // 뒤로 가기 핸들러
  const handleBack = () => {
    setSelectedCategory(null);
  };
  
  // 항목 클릭 핸들러
  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName);
  };
  
  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setSelectedItem(null);
  };
  
  return (
    <div className="category-view">
      {!selectedCategory ? (
        <CategoryCardsGrid
          categories={categories}
          onCategoryClick={handleCategoryClick}
          compact={compact}
          showHealthAge={!compact && !!healthAge && !!actualAge}
          healthAge={healthAge}
          actualAge={actualAge}
          patientName={patientName}
        />
      ) : (
        <CategoryDetailView
          categoryId={selectedCategory}
          healthData={healthData}
          year={currentYear}
          onBack={handleBack}
          onItemClick={handleItemClick}
          patientName={patientName}
          healthAge={healthAge}
          actualAge={actualAge}
        />
      )}
      
      {selectedItem && (
        <ItemTrendModal
          itemName={selectedItem}
          healthData={healthData}
          onClose={handleCloseModal}
          patientName={patientName}
          showRangeIndicator={showRangeIndicator}
        />
      )}
    </div>
  );
};

export default CategoryView;
