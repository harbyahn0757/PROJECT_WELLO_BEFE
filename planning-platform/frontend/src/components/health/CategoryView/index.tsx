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
  showHealthAgeGlow?: boolean; // 건강나이 반짝임 효과
  onCategoryClick?: (categoryId: string) => void; // 외부 핸들러 (선택사항)
  onDepthChange?: (depth: number) => void; // 뎁스 변경 콜백 (0: 그리드, 1: 상세, 2: 모달)
  onBackRequest?: () => void; // 외부에서 뒤로가기 요청 시 호출
}

const CategoryView: React.FC<CategoryViewProps> = ({
  healthData,
  year,
  compact = false,
  patientName,
  healthAge,
  actualAge,
  showHealthAgeGlow = false,
  onCategoryClick,
  onDepthChange,
  onBackRequest
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  // 사용 가능한 년도 목록 추출 (최신순 정렬)
  const availableYears = useMemo(() => {
    const years = healthData.map(d => d.Year.replace('년', '')).filter(Boolean);
    // 중복 제거 및 정렬 (최신순)
    return Array.from(new Set(years)).sort((a, b) => parseInt(b) - parseInt(a));
  }, [healthData]);
  
  // 선택된 년도 관리 (props에서 받은 year 또는 최신 년도)
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (year) return year;
    return availableYears[0] || new Date().getFullYear().toString();
  });
  
  // 카테고리 데이터 처리 (선택된 년도로 필터링)
  const categories = useMemo(() => {
    return processHealthDataToCategories(healthData, selectedYear);
  }, [healthData, selectedYear]);
  
  // 연도 추출 (현재 선택된 년도)
  const currentYear = useMemo(() => {
    return selectedYear;
  }, [selectedYear]);
  
  // 카테고리 클릭 핸들러
  const handleCategoryClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    }
    setSelectedCategory(categoryId);
  };
  
  // 뎁스 변경 시 외부에 알림
  React.useEffect(() => {
    if (onDepthChange) {
      if (selectedItem) {
        onDepthChange(2); // 모달
      } else if (selectedCategory) {
        onDepthChange(1); // 카테고리 상세
      } else {
        onDepthChange(0); // 그리드
      }
    }
  }, [selectedCategory, selectedItem, onDepthChange]);

  // 외부에서 뒤로가기 요청 시 처리 (이벤트 리스너)
  React.useEffect(() => {
    const handleExternalBack = () => {
      // 1뎁스: 모달이 열려있으면 먼저 닫기
      if (selectedItem) {
        setSelectedItem(null);
        return;
      }
      // 2뎁스: 카테고리 상세가 열려있으면 닫기
      if (selectedCategory) {
        setSelectedCategory(null);
      }
    };
    window.addEventListener('categoryViewBack', handleExternalBack);
    return () => {
      window.removeEventListener('categoryViewBack', handleExternalBack);
    };
  }, [selectedCategory, selectedItem]);

  // 뒤로 가기 핸들러 (2뎁스 처리: 모달 → 카테고리 상세 → 카테고리 그리드)
  const handleBack = () => {
    // 1뎁스: 모달이 열려있으면 먼저 닫기
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }
    // 2뎁스: 카테고리 상세가 열려있으면 닫기
    if (selectedCategory) {
      setSelectedCategory(null);
    }
  };
  
  // 항목 클릭 핸들러
  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName);
  };
  
  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setSelectedItem(null);
  };
  
  // 년도 변경 핸들러
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
  };
  
  return (
    <div className="category-view">
      {!selectedCategory ? (
        <CategoryCardsGrid
          categories={categories}
          onCategoryClick={handleCategoryClick}
          compact={compact}
          showHealthAge={!compact && (healthAge !== undefined && healthAge !== null) && (actualAge !== undefined && actualAge !== null)}
          healthAge={healthAge}
          actualAge={actualAge}
          patientName={patientName}
          showHealthAgeGlow={showHealthAgeGlow}
        />
      ) : (
        <CategoryDetailView
          categoryId={selectedCategory}
          healthData={healthData}
          year={currentYear}
          availableYears={availableYears}
          onYearChange={handleYearChange}
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
          showRangeIndicator={true}
        />
      )}
    </div>
  );
};

export default CategoryView;
