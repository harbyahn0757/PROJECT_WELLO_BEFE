import React from 'react';
import { ICardData } from '../models/CardData';
import { IconService } from '../services/IconService';
import './Card.scss';

export type CardType = 'vertical' | 'horizontal';

interface EnhancedCardProps {
  type: CardType;
  data: ICardData;
  onClick?: (cardData: ICardData) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 향상된 Card 컴포넌트 (객체지향적 설계)
 * 
 * 특징:
 * - 데이터 모델 기반 (ICardData)
 * - 의존성 주입 (IconService)
 * - 확장 가능한 props
 * - 타입 안전성
 */
const EnhancedCard: React.FC<EnhancedCardProps> = ({
  type,
  data,
  onClick,
  className = '',
  style = {}
}) => {
  const iconService = IconService.getInstance();

  /**
   * 아이콘 렌더링
   */
  const renderIcon = (): React.ReactElement | null => {
    return iconService.getIcon(data.icon);
  };

  /**
   * 설명 텍스트 포맷팅 (**굵기**, 줄바꿈 처리)
   */
  const formatDescription = (description: string): React.ReactElement[] => {
    return description.split('\n').map((line, lineIndex) => (
      <React.Fragment key={lineIndex}>
        {line.split('**').map((part, partIndex) => {
          // **텍스트** 형태를 <strong>으로 변환
          if (partIndex % 2 === 1) {
            return <strong key={partIndex}>{part}</strong>;
          }
          return part;
        })}
        {lineIndex < description.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  /**
   * 카드 클릭 핸들러
   */
  const handleClick = (): void => {
    if (onClick) {
      onClick(data);
    }
  };

  /**
   * 접근성 속성
   */
  const accessibilityProps = {
    role: onClick ? "button" : undefined,
    tabIndex: onClick ? 0 : undefined,
    'aria-label': `${data.title} 카드${onClick ? ', 클릭 가능' : ''}`,
    'aria-describedby': `card-description-${data.id}`
  };

  /**
   * CSS 클래스 조합
   */
  const cardClasses = [
    'card',
    `card--${type}`,
    data.category && `card--category-${data.category}`,
    onClick && 'card--clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      style={style}
      onClick={handleClick}
      {...accessibilityProps}
    >
      {/* 카드 헤더: 아이콘 + 제목 */}
      <div className="card__header">
        <div className="card__icon" aria-hidden="true">
          {renderIcon()}
        </div>
        <h3 className="card__title">{data.title}</h3>
      </div>
      
      {/* 카드 콘텐츠: 설명 */}
      <div className="card__content">
        <p 
          className="card__description"
          id={`card-description-${data.id}`}
        >
          {formatDescription(data.description)}
        </p>
        
        {/* 메타데이터 표시 (선택적) */}
        {data.metadata && process.env.NODE_ENV === 'development' && (
          <div className="card__metadata" aria-label="카드 메타데이터">
            <small>
              Priority: {data.priority}, Category: {data.category}
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedCard;
