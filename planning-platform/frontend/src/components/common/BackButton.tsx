import React from 'react';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const BackButton: React.FC<BackButtonProps> = ({ 
  onClick, 
  className = '', 
  style = {},
  children = '←'
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // 기본 동작: 브라우저 뒤로가기
      window.history.back();
    }
  };

  return (
    <div className={`back-button-container ${className}`}>
      <button 
        className="back-button" 
        onClick={handleClick}
        style={style}
        type="button"
      >
        {children}
      </button>
    </div>
  );
};

export default BackButton;
