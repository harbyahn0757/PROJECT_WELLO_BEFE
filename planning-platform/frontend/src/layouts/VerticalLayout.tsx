import React, { ReactNode } from 'react';
import './VerticalLayout.scss';

interface VerticalLayoutProps {
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
 * VerticalLayout - 세로형 레이아웃
 * 
 * 특징:
 * - 모바일 우선 설계 (가로 100% 사용)
 * - 이미지 헤더 + 메인 콘텐츠 구조
 * - 배경 장식 블롭 포함
 * - 세로 스크롤 지원, 가로 스크롤 방지
 * - 세로 방향으로 콘텐츠 나열
 */
const VerticalLayout: React.FC<VerticalLayoutProps> = ({
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
    <div className="vertical-layout">
      <div className="vertical-layout__container">
        {/* 배경 장식 요소 */}
        <div className="vertical-layout__bg-decoration vertical-layout__bg-decoration--top"></div>
        <div className="vertical-layout__bg-decoration vertical-layout__bg-decoration--bottom"></div>

        {/* 헤더 - 카카오 로그인 시 숨김 */}
        {!hideHeader && (
          <header className="vertical-layout__header">
            <img
              src={headerImage}
              alt={headerImageAlt}
              className="vertical-layout__header-image"
            />
            <div className="vertical-layout__header-overlay"></div>
            <div className="vertical-layout__header-content">
              <p className="vertical-layout__header-slogan">{headerSlogan}</p>
              <div className="vertical-layout__header-logo">
                <h2 className="vertical-layout__header-logo-title">{headerLogoTitle}</h2>
                {headerLogoSubtitle && <p className="vertical-layout__header-logo-subtitle">{headerLogoSubtitle}</p>}
              </div>
              {headerMainTitle && <h1 className="vertical-layout__header-main-title">{headerMainTitle}</h1>}
            </div>
          </header>
        )}

        {/* 메인 콘텐츠 */}
        <main className="vertical-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default VerticalLayout;
