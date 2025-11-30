import React from 'react';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

export type ProcessingStage = 
  | 'preparing'      // 데이터 준비 중
  | 'sending'        // 서버 전송 중
  | 'analyzing'      // AI 분석 중
  | 'designing'      // 검진 설계 생성 중
  | 'saving';        // 결과 저장 중

interface ProcessingModalProps {
  isOpen: boolean;
  stage: ProcessingStage;
  progress: number; // 0-100
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, stage, progress }) => {
  if (!isOpen) return null;

  const stageConfig = {
    preparing: {
      title: '데이터 준비 중',
      description: '선택하신 건강 항목과 설문 응답을 정리하고 있습니다.',
      details: [
        '선택한 염려 항목 확인',
        '설문 응답 데이터 정리',
        '건강검진 이력 데이터 준비',
        '약물 복용 이력 데이터 준비'
      ]
    },
    sending: {
      title: '서버로 전송 중',
      description: '정리된 데이터를 서버로 안전하게 전송하고 있습니다.',
      details: [
        '데이터 암호화 처리',
        '서버 연결 확인',
        '데이터 전송 진행',
        '전송 완료 확인'
      ]
    },
    analyzing: {
      title: 'AI 분석 중',
      description: 'Perplexity AI가 최신 의학 논문과 가이드라인을 참고하여 분석하고 있습니다.',
      details: [
        '최신 의학 논문 검색',
        '건강검진 가이드라인 참조',
        '환자 데이터 종합 분석',
        '위험도 평가 및 우선순위 결정'
      ]
    },
    designing: {
      title: '검진 설계 생성 중',
      description: '분석 결과를 바탕으로 맞춤형 검진 계획을 생성하고 있습니다.',
      details: [
        '우선순위별 검진 항목 선정',
        '카테고리별 분류',
        '의학적 근거 및 참고 자료 추가',
        '의사 추천 메시지 작성'
      ]
    },
    saving: {
      title: '결과 저장 중',
      description: '생성된 검진 설계 결과를 안전하게 저장하고 있습니다.',
      details: [
        '검진 설계 데이터 저장',
        '업셀링 데이터 기록',
        '저장 완료 확인',
        '결과 페이지 준비'
      ]
    }
  };

  const currentStage = stageConfig[stage];

  return (
    <div className="processing-modal">
      <div className="processing-modal__overlay"></div>
      <div className="processing-modal__content">
        <div className="processing-modal__header">
          <h3 className="processing-modal__title">{currentStage.title}</h3>
        </div>
        
        <div className="processing-modal__body">
          <div className="processing-modal__spinner-container">
            <div className="processing-modal__spinner">
              <img
                src={WELLO_LOGO_IMAGE}
                alt="로딩 중"
                className="processing-modal__wello-icon wello-icon-blink"
              />
            </div>
          </div>
          
          <p className="processing-modal__description">{currentStage.description}</p>
          
          <div className="processing-modal__progress">
            <div className="processing-modal__progress-bar">
              <div 
                className="processing-modal__progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="processing-modal__progress-text">{progress}%</span>
          </div>
          
          <div className="processing-modal__details">
            <h4 className="processing-modal__details-title">진행 단계:</h4>
            <ul className="processing-modal__details-list">
              {currentStage.details.map((detail, index) => {
                const itemProgress = (index + 1) / currentStage.details.length * 100;
                const isCompleted = progress >= itemProgress;
                const isCurrent = progress >= (index / currentStage.details.length * 100) && 
                                 progress < itemProgress;
                
                return (
                  <li 
                    key={index}
                    className={`processing-modal__details-item ${
                      isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'
                    }`}
                  >
                    <span className="processing-modal__details-icon">
                      {isCompleted ? '✓' : isCurrent ? '⟳' : '○'}
                    </span>
                    <span className="processing-modal__details-text">{detail}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingModal;

