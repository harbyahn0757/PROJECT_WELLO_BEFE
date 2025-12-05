/**
 * IntroTeaser - 처음 접근 유저를 위한 소개 티저 컴포넌트
 * intro 폴더의 이미지를 슬라이드로 보여주며 기능 설명
 */
import React, { useState, useRef, useEffect } from 'react';
import './styles.scss';

interface IntroSlide {
  image: string;
  title: string;
  description: string;
}

// 이미지 경로 (public 폴더 기준)
// public/wello/intro/ 폴더의 이미지를 사용
// 개발 환경과 프로덕션 환경 모두 지원
const getImagePath = (filename: string) => {
  // 개발 환경에서는 webpack-dev-server가 public 폴더를 서빙
  // 프로덕션에서는 FastAPI가 static 폴더를 서빙
  // 둘 다 /wello/intro/ 경로로 접근 가능
  const publicUrl = process.env.PUBLIC_URL || '';
  // PUBLIC_URL이 설정되어 있으면 사용, 없으면 절대 경로 사용
  if (publicUrl) {
    return `${publicUrl}/wello/intro/${filename}`;
  }
  // 개발 환경에서는 절대 경로 사용 (webpack-dev-server가 처리)
  return `/wello/intro/${filename}`;
};

const INTRO_SLIDES: IntroSlide[] = [
  {
    image: getImagePath('planning.png'),
    title: '검진 설계하기',
    description: '최근 검진 그리고 복약내역을 기반으로 이번에 받으실 검진을 설계해드립니다'
  },
  {
    image: getImagePath('trend.png'),
    title: '검진결과 추이보기',
    description: '과거 검진 결과를 한눈에 비교하고 추이를 확인하세요'
  },
  {
    image: getImagePath('trend2.png'),
    title: '트렌드 분석',
    description: '건강 지표의 변화를 시각적으로 분석할 수 있습니다'
  },
  {
    image: getImagePath('book.png'),
    title: '검진 예약하기',
    description: '추천받은 검진 항목으로 바로 예약할 수 있습니다'
  }
];

interface IntroTeaserProps {
  onClose: () => void;
  onDontShowAgain: () => void;
}

const IntroTeaser: React.FC<IntroTeaserProps> = ({ onClose, onDontShowAgain }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  // 최소 스와이프 거리 (px)
  const minSwipeDistance = 50;

  const handleDontShowAgain = () => {
    onDontShowAgain();
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const goToSlide = (index: number) => {
    if (index < 0 || index >= INTRO_SLIDES.length || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
    }, 300);
  };

  const goToNext = () => {
    goToSlide(currentSlide + 1);
  };

  const goToPrev = () => {
    goToSlide(currentSlide - 1);
  };

  // 터치 시작
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // 터치 이동
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // 터치 종료 (스와이프 감지)
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  // 마우스 드래그 지원
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return;
    setTouchEnd(e.clientX);
  };

  const onMouseUp = () => {
    if (!isDragging || mouseStart === null || touchEnd === null) {
      setIsDragging(false);
      return;
    }

    const distance = mouseStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }

    setIsDragging(false);
    setMouseStart(null);
    setTouchEnd(null);
  };

  return (
    <div className="intro-teaser">
      <div className="intro-teaser__overlay" onClick={handleClose} />
      <div className="intro-teaser__modal">
        {/* 닫기 버튼 (우측 상단) */}
        <button 
          className="intro-teaser__close-btn"
          onClick={handleClose}
          aria-label="닫기"
        >
          ×
        </button>

        {/* 슬라이드 컨테이너 (전체 섹션) */}
        <div 
          ref={slideContainerRef}
          className={`intro-teaser__slide-container ${isAnimating ? 'intro-teaser__slide-container--animating' : ''} ${isDragging ? 'intro-teaser__slide-container--dragging' : ''}`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div 
            className="intro-teaser__slide-wrapper"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {INTRO_SLIDES.map((slide, index) => (
              <div key={index} className="intro-teaser__slide">
                {/* 그림 영역 */}
                <div className="intro-teaser__image-container">
                  <img 
                    src={slide.image} 
                    alt={slide.title}
                    className="intro-teaser__image"
                    onError={(e) => {
                      console.error('❌ [인트로티저] 이미지 로드 실패:', slide.image);
                      console.error('❌ [인트로티저] 전체 URL:', window.location.origin + slide.image);
                      // 이미지 로드 실패 시에도 표시 유지 (디버깅용)
                      // (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log('✅ [인트로티저] 이미지 로드 성공:', slide.image);
                    }}
                  />
                </div>
                {/* 텍스트 영역 */}
                <div className="intro-teaser__text-area">
                  <h2 className="intro-teaser__title">{slide.title}</h2>
                  <p className="intro-teaser__description">{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인디케이터 (하단 점) */}
        <div className="intro-teaser__indicators">
          {INTRO_SLIDES.map((_, index) => (
            <button
              key={index}
              className={`intro-teaser__indicator ${index === currentSlide ? 'intro-teaser__indicator--active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>


        {/* 하단 액션 버튼 */}
        <div className="intro-teaser__actions">
          <button 
            className="intro-teaser__action-btn intro-teaser__action-btn--dont-show"
            onClick={handleDontShowAgain}
          >
            다시보지 않기
          </button>
          <button 
            className="intro-teaser__action-btn intro-teaser__action-btn--close"
            onClick={handleClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroTeaser;

