import React, { useEffect } from 'react';
import { useCampaignSkin } from './hooks/useCampaignSkin';
import CAMPAIGN_CONFIG from './config/env';
import './styles/campaign.scss';
import './styles/campaign-fixed.scss';
import eventImage1 from './assets/images/event_page_01.5b52f2b4.jpg';
import eventImage2 from './assets/images/event_page_02.bea69c18.jpg';
import eventImage3 from './assets/images/event_page_03.649437f3.jpg';

interface EventPageFixedProps {
  onStartSurvey?: () => void;
  className?: string;
}

export const EventPageFixed: React.FC<EventPageFixedProps> = ({
  onStartSurvey,
  className = '',
}) => {
  const { skinType, createUrlWithSkin } = useCampaignSkin();

  const handleStartSurvey = () => {
    console.log('질병예측 문진 시작 - 생년월일 입력으로 이동, 스킨:', skinType);
    
    if (onStartSurvey) {
      onStartSurvey();
    } else {
      // 기본 동작: 설문 페이지로 이동
      const surveyUrl = createUrlWithSkin('/survey');
      window.location.href = surveyUrl;
    }
  };

  const handleImageLoad = () => {
    console.log('이벤트 이미지 로드 완료');
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('이벤트 이미지 로드 실패:', e.currentTarget.src);
  };

  // 화면 회전 대응 및 초기 스크롤 위치 설정
  useEffect(() => {
    const handleOrientationChange = () => {
      setTimeout(() => {
        // 환경에 따라 스크롤 위치 설정
        if (CAMPAIGN_CONFIG.IMAGE_LOAD_SCROLL_POSITION === 'top') {
          window.scrollTo(0, 0);
        } else {
          // 배포 환경: 아래로 스크롤
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      }, 100);
    };

    // 초기 스크롤 위치 설정
    const setInitialScrollPosition = () => {
      if (CAMPAIGN_CONFIG.IMAGE_LOAD_SCROLL_POSITION === 'top') {
        window.scrollTo(0, 0);
      } else {
        // 배포 환경: 이미지가 아래에서 시작하도록 스크롤
        setTimeout(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }, 100);
      }
    };

    // 초기 스크롤 위치 설정
    setInitialScrollPosition();

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return (
    <div className={`event-page-fixed campaign-container ${className}`}>
      <div className="container">
        <div 
          className="images-container"
          style={{
            justifyContent: CAMPAIGN_CONFIG.IMAGE_CONTAINER_INITIAL_POSITION,
          }}
        >
          <div className="event-image">
            <img 
              src={eventImage1}
              alt="Xog 건강 검진 이벤트 1"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>
          <div className="event-image">
            <img 
              src={eventImage2}
              alt="Xog 건강 검진 이벤트 2"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>
          <div className="event-image">
            <img 
              src={eventImage3}
              alt="Xog 건강 검진 이벤트 3"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>
        </div>
        
        <div className="bottom-button-container-fixed">
          <button 
            className="bottom-button-fixed" 
            onClick={handleStartSurvey}
            type="button"
          >
            질병 예측 리포트로 맞춤형 검진 설계하기
          </button>
        </div>
      </div>
    </div>
  );
};
};