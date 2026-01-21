/**
 * CategoryDetailView - 카테고리 상세 뷰
 * 특정 카테고리의 항목들을 상세하게 표시
 */
import React, { useState, useMemo } from 'react';
import { TilkoHealthCheckupRaw } from '../../../../types/health';
import { processHealthDataToCategories, HEALTH_CATEGORIES } from '../../../../utils/categoryDataProcessor';
import CategoryTabs from '../CategoryTabs';
import JudgmentCard from '../JudgmentCard';
import HealthAgeCard from '../HealthAgeCard';
import ItemsList from '../ItemsList';
import './styles.scss';

interface CategoryDetailViewProps {
  categoryId: string;
  healthData: TilkoHealthCheckupRaw[];
  year: string;
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
  onBack,
  onItemClick,
  patientName = '사용자',
  healthAge,
  actualAge
}) => {
  const [selectedTab, setSelectedTab] = useState(categoryId);
  
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
          <button onClick={onBack} className="back-button" aria-label="뒤로 가기">
            ←
          </button>
          <h2 className="detail-title">검진 결과</h2>
        </div>
        <div className="detail-empty">
          <p>카테고리 데이터를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="category-detail-view">
      {/* 헤더 */}
      <div className="detail-header">
        <button 
          onClick={onBack} 
          className="back-button"
          aria-label="뒤로 가기"
        >
          ←
        </button>
        <h2 className="detail-title">검진 결과</h2>
        <div className="header-spacer" />
      </div>
      
      {/* 연도 표시 */}
      <div className="year-display">{year}년</div>
      
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
      
      {/* 건강 나이 카드 */}
      {healthAge && actualAge && (
        <HealthAgeCard
          healthAge={healthAge}
          actualAge={actualAge}
          patientName={patientName}
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
