import React, { useState, useEffect, useRef } from 'react';
import './DataCollecting.scss';

interface DataCollectingProps {
  progress?: number;
  currentStatus?: string;
  statusMessage?: string;
  onCancel?: () => void;
}

/**
 * DataCollecting 컴포넌트
 * 
 * 데이터 수집 중 화면을 렌더링합니다.
 * 롤링 메시지와 진행 상태를 표시합니다.
 */
const DataCollecting: React.FC<DataCollectingProps> = ({
  progress = 0,
  currentStatus = 'collecting',
  statusMessage,
  onCancel,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 롤링 메시지 목록
  const rollingMessages = [
    '건강 보험공단에 투약 내역을 요청합니다.',
    '약국 방문이력을 수집 하는 중이에요',
    '병원 방문 이력을 요청 하는 중이에요',
    '건강 검진 내역을 요청 하여 수집하는 중이에요',
  ];
  
  // 메시지 롤링
  useEffect(() => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
    }
    
    messageIntervalRef.current = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % rollingMessages.length);
    }, 5000); // 5초마다 메시지 변경
    
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, [rollingMessages.length]);
  
  /**
   * 현재 메시지 가져오기
   */
  const getCurrentMessage = () => {
    if (statusMessage) {
      return statusMessage;
    }
    return rollingMessages[currentMessageIndex];
  };
  
  /**
   * 상태별 제목 가져오기
   */
  const getTitle = () => {
    switch (currentStatus) {
      case 'manual_collecting':
      case 'data_collecting':
      case 'collecting':
        return '건강정보를 연동하고 있습니다';
      case 'data_completed':
        return '수집이 완료되었습니다';
      case 'error':
        return '오류가 발생했습니다';
      default:
        return '건강정보를 수집하고 있습니다';
    }
  };
  
  return (
    <div className="data-collecting-container">
      <div className="data-collecting-content">
        {/* 제목 */}
        <h2 className="data-collecting-title">{getTitle()}</h2>
        
        {/* 스피너 */}
        <div className="data-collecting-spinner-container">
          <div className="data-collecting-spinner">
            <div className="spinner-circle"></div>
          </div>
        </div>
        
        {/* 현재 작업 메시지 (롤링) */}
        <div className="data-collecting-message">
          <p className="rolling-message">
            {getCurrentMessage()}
          </p>
        </div>
        
        {/* 진행률 표시 (옵션) */}
        {progress > 0 && progress < 100 && (
          <div className="data-collecting-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-text">{progress}% 완료</p>
          </div>
        )}
        
        {/* 안내 메시지 */}
        <div className="data-collecting-info">
          <p className="info-main">
            국민건강보험공단에서 건강검진 데이터를 가져오고 있어요
          </p>
          <p className="info-sub">
            예상 소요 시간: 30초 ~ 1분
          </p>
          <p className="info-warning">
            보험 공단 수집 서비스 상태에 따라 최대 3분 까지도 소요 될 수 있습니다
          </p>
        </div>
        
        {/* 취소 버튼 (옵션) */}
        {onCancel && (
          <div className="data-collecting-cancel">
            <button onClick={onCancel} className="cancel-button">
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCollecting;
