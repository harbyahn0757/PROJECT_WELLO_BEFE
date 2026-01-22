/**
 * CategoryCardsGrid - 건강 카테고리 카드 그리드
 * 3x3 그리드 레이아웃으로 카테고리 카드 표시
 * 재사용 가능 (HealthDataViewer, WelnoRagChatWindow)
 */
import React from 'react';
import { CategoryData } from '../../../../types/category';
import CategoryCard from '../CategoryCard';
import HealthAgeSection from '../../HealthAgeSection';
import './styles.scss';

interface CategoryCardsGridProps {
  categories: CategoryData[];
  onCategoryClick: (categoryId: string) => void;
  compact?: boolean;           // 채팅용 컴팩트 모드
  showHealthAge?: boolean;     // 건강 나이 섹션 표시 여부
  healthAge?: number;          // 건강 나이
  actualAge?: number;          // 실제 나이
  patientName?: string;        // 환자 이름
  showHealthAgeGlow?: boolean; // 건강나이 반짝임 효과
}

const CategoryCardsGrid: React.FC<CategoryCardsGridProps> = ({
  categories,
  onCategoryClick,
  compact = false,
  showHealthAge = false,
  healthAge,
  actualAge,
  patientName,
  showHealthAgeGlow = false
}) => {
  // 주의 항목이 있는 카테고리
  const cautionCategories = categories.filter(c => c.status === 'caution');
  const totalCautionItems = cautionCategories.reduce(
    (sum, cat) => sum + cat.cautionCount, 
    0
  );
  
  return (
    <div className={`category-cards-grid ${compact ? 'compact' : ''}`}>
      {/* 주의 메시지 */}
      {!compact && cautionCategories.length > 0 && (
        <div 
          className="attention-banner clickable"
          onClick={() => {
            const firstCautionCategory = cautionCategories[0];
            if (firstCautionCategory) {
              onCategoryClick(firstCautionCategory.id);
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const firstCautionCategory = cautionCategories[0];
              if (firstCautionCategory) {
                onCategoryClick(firstCautionCategory.id);
              }
            }
          }}
          aria-label={`확인해야 할 주의 항목 ${totalCautionItems}개, 클릭하여 첫 번째 주의 카테고리 보기`}
        >
          <span className="attention-text">
            확인해야 할 <strong>주의</strong> 항목이 {totalCautionItems}개 있어요
          </span>
          <span className="attention-arrow">›</span>
        </div>
      )}
      
      {/* 건강 나이 섹션 - 카드 그리드 위로 이동 */}
      {!compact && showHealthAge && (healthAge !== undefined && healthAge !== null) && (actualAge !== undefined && actualAge !== null) && (
        <HealthAgeSection
          healthAge={healthAge}
          actualAge={actualAge}
          variant="default"
          showGlowEffect={showHealthAgeGlow}
          showBorder={true}
        />
      )}
      
      {/* 카드 그리드 */}
      <div className="cards-grid">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => {
              // 결과없음 카드는 클릭 불가
              if (category.status !== 'no_data') {
                onCategoryClick(category.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryCardsGrid;
