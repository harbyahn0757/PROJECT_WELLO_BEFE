import React, { ReactNode } from 'react';
import './HorizontalLayout.scss';

interface HorizontalLayoutProps {
  children: ReactNode;
  headerImage?: string;
  headerImageAlt?: string;
  headerSlogan?: string;
  headerLogoTitle?: string;
  headerLogoSubtitle?: string;
  headerMainTitle?: string;
  hideHeader?: boolean;
}

/**
 * HorizontalLayout - 가로형 레이아웃
 * 
 * 특징:
 * - 모바일 우선 설계 (가로 100% 사용)
 * - 이미지 헤더 + 메인 콘텐츠 구조
 * - 배경 장식 블롭 포함
 * - 상단 AI 버튼 없음
 * - 가로 슬라이드 카드 방식
 * - 세로 스크롤 지원, 가로 스크롤 방지
 */
const HorizontalLayout: React.FC<HorizontalLayoutProps> = ({
  children,
  headerImage = "/doctor-image.png",
  headerImageAlt = "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
  headerSlogan = "행복한 건강생활의 평생 동반자",
  headerLogoTitle = "김현우내과의원",
  headerLogoSubtitle = "",
  headerMainTitle = "",
  hideHeader = false
}) => {
  return (
    <div className="horizontal-layout">
      <div className="horizontal-layout__container">
        {/* 배경 장식 요소 */}
        <div className="horizontal-layout__bg-decoration horizontal-layout__bg-decoration--top"></div>
        <div className="horizontal-layout__bg-decoration horizontal-layout__bg-decoration--bottom"></div>

        {/* 헤더 - 카카오 로그인 시 숨김 */}
        {!hideHeader && (
          <header className="horizontal-layout__header">
            <img
              src={headerImage}
              alt={headerImageAlt}
              className="horizontal-layout__header-image"
            />
            <div className="horizontal-layout__header-overlay"></div>
            <div className="horizontal-layout__header-content">
              <p className="horizontal-layout__header-slogan">{headerSlogan}</p>
              <div className="horizontal-layout__header-logo">
                <h2 className="horizontal-layout__header-logo-title">{headerLogoTitle}</h2>
                {headerLogoSubtitle && <p className="horizontal-layout__header-logo-subtitle">{headerLogoSubtitle}</p>}
              </div>
              {headerMainTitle && <h1 className="horizontal-layout__header-main-title">{headerMainTitle}</h1>}
            </div>
          </header>
        )}

        {/* 메인 콘텐츠 - 가로 슬라이드 형태 */}
        <main className="horizontal-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default HorizontalLayout;
