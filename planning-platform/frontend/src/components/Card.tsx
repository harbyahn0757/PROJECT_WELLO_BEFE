import React from 'react';
import './Card.scss';

export type CardIconType = 'chart' | 'design' | 'habit' | 'prediction';
export type CardType = 'vertical' | 'horizontal';

interface CardProps {
  type: CardType;
  icon: CardIconType;
  title: string;
  description: string;
  shortcutText?: string; // 바로가기 텍스트 (선택적)
  onClick?: () => void; // 클릭 이벤트 핸들러
  imageUrl?: string; // 오른쪽 이미지 URL (선택적)
  imageAlt?: string; // 이미지 alt 텍스트
}

const Card: React.FC<CardProps> = ({ type, icon, title, description, shortcutText, onClick, imageUrl, imageAlt }) => {
  const renderIcon = () => {
    switch (icon) {
      case 'chart':
        return (
          <svg className="card__icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21l4-4 4 4"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3v18h18"></path>
          </svg>
        );
      case 'design':
        return (
          <svg className="card__icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
        );
      case 'habit':
        return (
          <svg className="card__icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      case 'prediction':
        return (
          <span className="card__icon-text">70%</span>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`card card--${type} ${onClick ? 'card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card__main-content">
        {/* 아이콘 제거 - 이미지만 표시 */}
        <div className="card__content">
          <h3 className="card__title">{title}</h3>
          <p className="card__description">{description}</p>
        </div>
        {/* 오른쪽 이미지 영역 (배경색 없음) */}
        <div className="card__image-area">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={imageAlt || title}
              className="card__image"
              onError={(e) => {
                // 이미지 로드 실패 시 placeholder 표시
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement?.classList.add('card__image-area--placeholder');
              }}
            />
          ) : (
            <div className="card__image-placeholder">
              <span className="card__image-placeholder-text">이미지 영역</span>
            </div>
          )}
        </div>
      </div>
      {shortcutText && (
        <div className="card__shortcut">
          <span className="card__shortcut-text">{shortcutText}</span>
        </div>
      )}
    </div>
  );
};

export default Card;