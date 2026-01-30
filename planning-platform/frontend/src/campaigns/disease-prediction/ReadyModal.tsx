import React, { useState } from 'react';
import './styles/ready-modal.scss';

// 리포트 이미지 임포트
import reportB1 from './assets/report_b_1.png';
import reportB2 from './assets/report_b_2.png';
import reportB3 from './assets/report_b_3.png';
import reportB4 from './assets/report_b_4.png';
import reportB5 from './assets/report_b_5.png';
import reportB6 from './assets/report_b_6.png';
import reportB7 from './assets/report_b_7-1.png';

interface ReportSlide {
  image: string;
  title: string;
  description: string;
}

const REPORT_SLIDES: ReportSlide[] = [
  {
    image: reportB1,
    title: 'AI 질병예측 리포트',
    description: '10대 주요 질환의 발병 위험도를 AI가 분석합니다'
  },
  {
    image: reportB2,
    title: '개인 맞춤 건강 분석',
    description: '나의 건강 상태를 한눈에 확인하세요'
  },
  {
    image: reportB3,
    title: '상세한 지표 분석',
    description: '건강검진 결과를 기반으로 상세하게 분석합니다'
  },
  {
    image: reportB4,
    title: '질환별 위험도',
    description: '각 질환별 발병 가능성을 확인할 수 있습니다'
  },
  {
    image: reportB5,
    title: '건강 관리 가이드',
    description: '개인 맞춤형 건강관리 방법을 제공합니다'
  },
  {
    image: reportB6,
    title: '트렌드 분석',
    description: '건강 지표의 변화 추이를 확인하세요'
  },
  {
    image: reportB7,
    title: '전문가 리포트',
    description: '의료 전문가 수준의 분석 리포트를 제공합니다'
  }
];

interface ReadyModalProps {
  onGenerate: () => void;
  onClose: () => void;
  userName?: string;
}

const ReadyModal: React.FC<ReadyModalProps> = ({ onGenerate, onClose, userName }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStart, setMouseStart] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const handleGenerate = () => {
    setIsGenerating(true);
    onGenerate();
  };

  const goToSlide = (index: number) => {
    if (index < 0 || index >= REPORT_SLIDES.length || isAnimating) return;
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

  // 터치 이벤트
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

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

  // 마우스 이벤트
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
    <div className="ready-modal">
      <div className="ready-modal__overlay" onClick={onClose} />
      <div className="ready-modal__modal">
        {/* 닫기 버튼 */}
        <button 
          className="ready-modal__close-btn"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>

        {/* 슬라이드 컨테이너 */}
        <div 
          className={`ready-modal__slide-container ${isAnimating ? 'ready-modal__slide-container--animating' : ''} ${isDragging ? 'ready-modal__slide-container--dragging' : ''}`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div 
            className="ready-modal__slide-wrapper"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {REPORT_SLIDES.map((slide, index) => (
              <div key={index} className="ready-modal__slide">
                {/* 이미지 영역 */}
                <div className="ready-modal__image-container">
                  <img 
                    src={slide.image} 
                    alt={slide.title}
                    className="ready-modal__image"
                  />
                </div>
                {/* 텍스트 영역 */}
                <div className="ready-modal__text-area">
                  <h2 className="ready-modal__title">{slide.title}</h2>
                  <p className="ready-modal__description">{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인디케이터 */}
        <div className="ready-modal__indicators">
          {REPORT_SLIDES.map((_, index) => (
            <button
              key={index}
              className={`ready-modal__indicator ${index === currentSlide ? 'ready-modal__indicator--active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="ready-modal__actions">
          <button 
            className="ready-modal__action-btn ready-modal__action-btn--later"
            onClick={onClose}
            disabled={isGenerating}
          >
            나중에 하기
          </button>
          <button 
            className="ready-modal__action-btn ready-modal__action-btn--generate"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '생성 중...' : '리포트 생성하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadyModal;
