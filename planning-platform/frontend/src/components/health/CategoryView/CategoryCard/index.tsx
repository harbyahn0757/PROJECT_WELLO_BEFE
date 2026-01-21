/**
 * CategoryCard - 건강 카테고리 개별 카드 컴포넌트
 * 상태별 색상 및 스타일 적용
 */
import React from 'react';
import { CategoryData } from '../../../../types/category';
import './styles.scss';

interface CategoryCardProps {
  category: CategoryData;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
  const getCardClass = () => {
    switch (category.status) {
      case 'caution':
        return 'card-caution';
      case 'normal':
        return 'card-normal';
      case 'no_data':
        return 'card-no-data';
      default:
        return 'card-normal';
    }
  };
  
  const getStatusText = () => {
    switch (category.status) {
      case 'caution':
        return '주의';
      case 'normal':
        return '정상';
      case 'no_data':
        return '결과없음';
      default:
        return '정상';
    }
  };
  
  return (
    <div 
      className={`category-card ${getCardClass()}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${category.name} 카테고리, ${getStatusText()}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="card-content">
        <span className="card-name">{category.name}</span>
        <span className={`card-status ${category.status}`}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
};

export default CategoryCard;
