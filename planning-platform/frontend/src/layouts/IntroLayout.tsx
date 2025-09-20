import React, { ReactNode } from 'react';
import './IntroLayout.scss';

interface IntroLayoutProps {
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
 * IntroLayout - 인트로 애니메이션 레이아웃
 * 
 * 특징:
 * - 풀스크린 애니메이션 디자인
 * - 어두운 배경에서 시작하여 부드럽게 전환
 * - 카드별 포커스 애니메이션
 * - 최종적으로 일반 레이아웃으로 전환
 */
const IntroLayout: React.FC<IntroLayoutProps> = ({
  children,
  headerImage = "/doctor-image.png",
  headerImageAlt = "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
  headerSlogan = "행복한 건강생활의 평생 동반자",
  headerLogoTitle = "김현우내과의원",
  headerLogoSubtitle = "",
  headerMainTitle = "건강한 내일을 위한 첫걸음",
  hideHeader = false
}) => {
  return (
    <div className="intro-layout">
      <div className="intro-layout__container">
        {/* 배경 그라데이션 */}
        <div className="intro-layout__background"></div>
        
        {/* 애니메이션 별들 */}
        <div className="intro-layout__stars">
          <div className="star star--1"></div>
          <div className="star star--2"></div>
          <div className="star star--3"></div>
          <div className="star star--4"></div>
        </div>

        {/* 헤더 - 인트로용 중앙 정렬 */}
        {!hideHeader && (
          <header className="intro-layout__header">
            <div className="intro-layout__header-content">
              <p className="intro-layout__header-slogan">{headerSlogan}</p>
              <div className="intro-layout__header-logo">
                <h2 className="intro-layout__header-logo-title">{headerLogoTitle}</h2>
                {headerLogoSubtitle && <p className="intro-layout__header-logo-subtitle">{headerLogoSubtitle}</p>}
              </div>
              {headerMainTitle && <h1 className="intro-layout__header-main-title">{headerMainTitle}</h1>}
            </div>
          </header>
        )}

        {/* 메인 콘텐츠 - 인트로 애니메이션 */}
        <main className="intro-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default IntroLayout;
