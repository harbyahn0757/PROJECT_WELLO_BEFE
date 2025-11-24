/**
 * 페이지 전환 로딩 컴포넌트
 * 페이지 이동 시 화면을 뿌옇게 하고 웰로 스피너를 표시
 */
import React, { useEffect } from 'react';
import { WELLO_LOGO_IMAGE } from '../../constants/images';
import './styles.scss';

interface PageTransitionLoaderProps {
  isVisible: boolean;
}

const PageTransitionLoader: React.FC<PageTransitionLoaderProps> = ({ isVisible }) => {
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (isVisible) {
      console.log('🔄 [로딩스피너] 표시됨');
      setShouldRender(true);
      // 다음 프레임에 애니메이션 시작
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      console.log('🔄 [로딩스피너] 숨김 시작');
      // fade out 애니메이션
      setIsAnimating(false);
      // 애니메이션 완료 후 DOM에서 제거
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // fade out 애니메이션 시간과 맞춤
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div className={`page-transition-loader ${isAnimating ? 'fade-in' : 'fade-out'}`}>
      <div className="page-transition-overlay">
        <div className="page-transition-spinner">
          <img 
            src={WELLO_LOGO_IMAGE}
            alt="로딩 중" 
            className="wello-icon-blink"
          />
        </div>
      </div>
    </div>
  );
};

export default PageTransitionLoader;

