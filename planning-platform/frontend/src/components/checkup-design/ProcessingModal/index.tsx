import React, { useState, useEffect, useRef } from 'react';
import { WELNO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

export type ProcessingStage = 
  | 'preparing'      // 데이터 준비 중
  | 'sending'        // 서버 전송 중
  | 'analyzing'      // AI 분석 중
  | 'designing'      // 검진 설계 생성 중
  | 'saving';        // 결과 저장 중

interface Step1Result {
  survey_reflection?: string;
  selected_concerns_analysis?: Array<{
    concern_name: string;
    concern_type: string;
    trend_analysis: string;
    reflected_in_design: string;
  }>;
}

interface ProcessingModalProps {
  isOpen: boolean;
  stage: ProcessingStage;
  progress: number; // 0-100
  patientName?: string; // 환자명
  selectedConcernsCount?: number; // 선택한 염려 항목 수
  healthDataCount?: number; // 건강검진 이력 수
  prescriptionDataCount?: number; // 처방전 이력 수
  step1Result?: Step1Result | null; // STEP 1 결과 (타이핑 효과용)
}

const THINKING_TEXT_DELAY = 1000; // 중얼중얼 텍스트 변경 딜레이 (ms)
const TYPING_SPEED = 80; // 타이핑 속도 (ms per character) - 더 천천히
const FIRST_CARD_DELAY = 7000; // 첫 번째 카드 표시 전 딜레이 (ms) - 7초로 증가
const CARD_SLIDE_DELAY = 800; // 카드 전환 딜레이 (ms)

const ProcessingModal: React.FC<ProcessingModalProps> = ({ 
  isOpen, 
  stage, 
  progress,
  patientName,
  selectedConcernsCount = 0,
  healthDataCount = 0,
  prescriptionDataCount = 0,
  step1Result
}) => {
  const [thinkingText, setThinkingText] = useState<string>('');
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [typingText, setTypingText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0); // 0: 기본, 1: 문진, 2: 선택항목, 3: 프로세스
  const typingStateRef = useRef<{ cardIndex: number; textIndex: number }>({ cardIndex: 0, textIndex: 0 });
  const [card1TypingComplete, setCard1TypingComplete] = useState<boolean>(false);
  const [card2TypingComplete, setCard2TypingComplete] = useState<boolean>(false);

  // 실제 데이터 기반 thinking 텍스트 생성 함수
  const generateThinkingTexts = (baseTexts: string[]): string[] => {
    return baseTexts.map(text => {
      // 환자명이 있으면 포함
      if (patientName && text.includes('항목')) {
        return text.replace('항목', `${patientName}님의 항목`);
      }
      // 실제 숫자 포함
      if (text.includes('선택한 항목') && selectedConcernsCount > 0) {
        return `선택한 항목 ${selectedConcernsCount}개 확인 중...`;
      }
      if (text.includes('건강검진 이력') && healthDataCount > 0) {
        return `건강검진 이력 ${healthDataCount}건 준비 중...`;
      }
      if (text.includes('약물 복용 이력') && prescriptionDataCount > 0) {
        return `약물 복용 이력 ${prescriptionDataCount}건 준비 중...`;
      }
      return text;
    });
  };

  const stageConfig = {
    preparing: {
      title: '입력하신 정보 확인 중',
      description: '입력하신 건강 항목과 설문 응답을 확인하고 있습니다.',
      details: [
        selectedConcernsCount > 0 ? `입력하신 건강 항목 ${selectedConcernsCount}개 확인` : '입력하신 건강 항목 확인',
        '입력하신 설문 응답 확인',
        healthDataCount > 0 ? `과거 검진 이력 ${healthDataCount}건 확인` : '과거 검진 이력 확인',
        prescriptionDataCount > 0 ? `복용 중인 약물 정보 ${prescriptionDataCount}건 확인` : '복용 중인 약물 정보 확인'
      ],
      thinkingTexts: [
        selectedConcernsCount > 0 ? `입력하신 건강 항목 ${selectedConcernsCount}개를 확인하고 있습니다...` : '입력하신 건강 항목을 확인하고 있습니다...',
        '입력하신 설문 응답을 확인하고 있습니다...',
        healthDataCount > 0 ? `과거 검진 이력 ${healthDataCount}건을 확인하고 있습니다...` : '과거 검진 이력을 확인하고 있습니다...',
        prescriptionDataCount > 0 ? `복용 중인 약물 정보 ${prescriptionDataCount}건을 확인하고 있습니다...` : '복용 중인 약물 정보를 확인하고 있습니다...'
      ],
      estimatedTime: '약 2초'
    },
    sending: {
      title: '서버로 전송 중',
      description: '정리된 데이터를 서버로 안전하게 전송하고 있습니다.',
      details: [
        '데이터 암호화 처리',
        '서버 연결 확인',
        '데이터 전송 진행',
        '전송 완료 확인'
      ],
      thinkingTexts: [
        '데이터 암호화 중...',
        '서버 연결 확인 중...',
        '데이터 전송 중...',
        '전송 완료 확인 중...'
      ],
      estimatedTime: '약 1초'
    },
    analyzing: {
      title: '건강 상태 분석 중',
      description: '입력하신 정보를 바탕으로 건강 상태를 분석하고 있습니다.',
      details: [
        '입력하신 정보 확인 완료',
        selectedConcernsCount > 0 ? `선택하신 건강 항목 ${selectedConcernsCount}개 분석 중` : '선택하신 건강 항목 분석 중',
        '입력하신 설문 응답 반영 중',
        healthDataCount > 0 ? `과거 검진 이력 ${healthDataCount}건 검토 중` : '과거 검진 이력 검토 중',
        '건강 상태 종합 분석 중',
        '분석 결과 정리 중'
      ],
      thinkingTexts: [
        '입력하신 정보를 확인하고 있습니다...',
        selectedConcernsCount > 0 ? `선택하신 건강 항목 ${selectedConcernsCount}개를 분석하고 있습니다...` : '선택하신 건강 항목을 분석하고 있습니다...',
        '입력하신 설문 응답을 반영하고 있습니다...',
        healthDataCount > 0 ? `과거 검진 이력 ${healthDataCount}건을 검토하고 있습니다...` : '과거 검진 이력을 검토하고 있습니다...',
        patientName ? `${patientName}님의 건강 상태를 종합적으로 분석하고 있습니다...` : '건강 상태를 종합적으로 분석하고 있습니다...',
        '분석 결과를 정리하고 있습니다...'
      ],
      estimatedTime: '약 15초'
    },
    designing: {
      title: '맞춤 검진 계획 작성 중',
      description: '입력하신 정보와 분석 결과를 바탕으로 맞춤형 검진 계획을 작성하고 있습니다.',
      details: [
        '입력하신 정보 기반 분석 결과 확인',
        selectedConcernsCount > 0 ? `선택하신 건강 항목 ${selectedConcernsCount}개 반영 중` : '선택하신 건강 항목 반영 중',
        '입력하신 설문 응답 반영 중',
        '맞춤 검진 항목 선정 중',
        '의학적 근거 확인 중',
        '검진 계획 정리 중'
      ],
      thinkingTexts: [
        '입력하신 정보를 바탕으로 한 분석 결과를 확인하고 있습니다...',
        selectedConcernsCount > 0 ? `선택하신 건강 항목 ${selectedConcernsCount}개를 반영하여 검진 계획을 작성하고 있습니다...` : '선택하신 건강 항목을 반영하여 검진 계획을 작성하고 있습니다...',
        '입력하신 설문 응답을 반영하고 있습니다...',
        '맞춤형 검진 항목을 선정하고 있습니다...',
        '의학적 근거를 확인하고 있습니다...',
        '검진 계획을 정리하고 있습니다...'
      ],
      estimatedTime: '약 60초'
    },
    saving: {
      title: '결과 저장 중',
      description: '생성된 검진 설계 결과를 안전하게 저장하고 있습니다.',
      details: [
        '검진 설계 데이터 저장',
        '업셀링 데이터 기록',
        '저장 완료 확인',
        '결과 페이지 준비'
      ],
      thinkingTexts: [
        '검진 설계 데이터 저장 중...',
        '업셀링 데이터 기록 중...',
        '저장 완료 확인 중...',
        '결과 페이지 준비 중...'
      ],
      estimatedTime: '약 2초'
    }
  };

  const currentStage = stageConfig[stage];

  // 단계 변경 시 thinking 텍스트 시작
  useEffect(() => {
    if (!isOpen) {
      setThinkingText('');
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      return;
    }

    // 이전 인터벌 정리
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }

    // 새로운 thinking 텍스트 시작
    const thinkingTexts = currentStage.thinkingTexts || [];
    if (thinkingTexts.length > 0) {
      let textIndex = 0;
      setThinkingText(thinkingTexts[0]); // 첫 번째 텍스트 즉시 표시
      
      thinkingIntervalRef.current = setInterval(() => {
        textIndex++;
        if (textIndex < thinkingTexts.length) {
          setThinkingText(thinkingTexts[textIndex]);
        } else {
          // 마지막 텍스트 유지
          if (thinkingIntervalRef.current) {
            clearInterval(thinkingIntervalRef.current);
            thinkingIntervalRef.current = null;
          }
        }
      }, THINKING_TEXT_DELAY);
    }

    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
    };
  }, [stage, isOpen, currentStage.thinkingTexts]);

  // 하이라이트 텍스트 파싱 함수 ({highlight}...{/highlight} 태그 처리)
  const parseHighlightText = (text: string): React.ReactNode => {
    if (!text) return text;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // {highlight}...{/highlight} 패턴 찾기
    const highlightRegex = /\{highlight\}(.*?)\{\/highlight\}/g;
    let match;
    
    while ((match = highlightRegex.exec(text)) !== null) {
      // 하이라이트 전 텍스트
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // 하이라이트 텍스트
      parts.push(
        <span key={match.index} className="processing-modal__highlight">
          {match[1]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // 남은 텍스트
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // STEP 1 결과 타이핑 효과 (analyzing 단계에서 시작, designing/saving 단계에서 유지)
  useEffect(() => {
    // STEP 1 결과가 없거나, preparing/sending 단계에서는 타이핑 시작하지 않음
    if (!step1Result) {
      setTypingText('');
      setIsTyping(false);
      setCurrentCardIndex(0);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // analyzing, designing, saving 단계에서만 타이핑 효과 표시
    if (stage !== 'analyzing' && stage !== 'designing' && stage !== 'saving') {
      // preparing, sending 단계에서는 타이핑 텍스트 제거
      if (stage === 'preparing' || stage === 'sending') {
        setTypingText('');
        setIsTyping(false);
        setCurrentCardIndex(0);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
      // 다른 단계에서는 타이핑 텍스트 유지 (이미 타이핑이 완료된 경우)
      return;
    }

    // 이미 타이핑이 완료된 경우 (isTyping === false && typingText가 있음)
    // designing 또는 saving 단계에서는 텍스트만 유지
    if (!isTyping && typingText && (stage === 'designing' || stage === 'saving')) {
      // 타이핑이 완료된 상태이므로 추가 작업 없음 (텍스트 유지)
      return;
    }

    // 타이핑이 진행 중이거나 아직 시작하지 않은 경우에만 새로 시작
    if (isTyping || !typingText) {
      // 타이핑 시작 (이미 시작된 경우는 무시)
      if (typingText && !isTyping) {
        // 이미 타이핑이 완료된 상태
        return;
      }
    }

    // 타이핑할 카드별 텍스트 구성
    const cardsToType: Array<{ cardIndex: number; text: string }> = [];
    
    // 카드 1: survey_reflection
    if (step1Result.survey_reflection) {
      // {highlight}...{/highlight} 태그 제거 (타이핑 메시지에서만)
      let cleanedText = step1Result.survey_reflection
        .replace(/\{\{highlight\}\}(.*?)\{\{\/highlight\}\}/g, '$1') // 이중 중괄호
        .replace(/\{highlight\}(.*?)\{\/highlight\}/g, '$1') // 정상 태그
        .replace(/\{\{highlight\}\}(.*?)\{\}/g, '$1') // 잘못된 닫는 태그
        .replace(/\{highlight\}(.*?)\{\}/g, '$1'); // 잘못된 닫는 태그
      
      cardsToType.push({
        cardIndex: 0,
        text: cleanedText
      });
    }
    
    // 카드 2: selected_concerns_analysis
    if (step1Result.selected_concerns_analysis && step1Result.selected_concerns_analysis.length > 0) {
      const concernsText = step1Result.selected_concerns_analysis.map((item: any, index: number) => {
        let itemText = `${index + 1}. ${item.concern_name || '항목'}`;
        if (item.trend_analysis) {
          itemText += `\n추이 분석: ${item.trend_analysis}`;
        }
        if (item.reflected_in_design) {
          itemText += `\n설계 반영: ${item.reflected_in_design}`;
        }
        return itemText;
      }).join('\n\n');
      
      cardsToType.push({
        cardIndex: 1,
        text: concernsText
      });
    }

    if (cardsToType.length === 0) {
      return;
    }

    // 첫 번째 카드(문진)부터 시작
    typingStateRef.current = { cardIndex: 0, textIndex: 0 };
    setTypingText('');
    // 카드 0(기본)에서 카드 1(문진)로 전환
    setCurrentCardIndex(1);

    const typeNextChar = () => {
      const state = typingStateRef.current;
      const currentCard = cardsToType[state.cardIndex];
      if (!currentCard) {
        setIsTyping(false);
        typingTimeoutRef.current = null;
        return;
      }

      if (state.textIndex < currentCard.text.length) {
        setTypingText(currentCard.text.substring(0, state.textIndex + 1));
        state.textIndex++;
        typingTimeoutRef.current = setTimeout(typeNextChar, TYPING_SPEED);
      } else {
        // 현재 카드 타이핑 완료
        setIsTyping(false);
        typingTimeoutRef.current = null;
        
        // 카드별 완료 상태 업데이트
        if (state.cardIndex === 0) {
          setCard1TypingComplete(true);
          // 카드 1 완료 후 카드 2로 전환
          setTimeout(() => {
            setCurrentCardIndex(2);
            // 카드 2로 전환 시 바로 타이핑 시작 (텍스트 초기화)
            typingStateRef.current.textIndex = 0;
            setIsTyping(true);
            setTypingText('');
            typingTimeoutRef.current = setTimeout(typeNextChar, 100);
          }, CARD_SLIDE_DELAY);
        } else if (state.cardIndex === 1) {
          setCard2TypingComplete(true);
          // 카드 2 완료 후 프로세스 카드로 전환 (계속 순환)
          setTimeout(() => {
            setCurrentCardIndex(0); // 프로세스 카드로 돌아감
            // 프로세스 카드 표시 후 다시 분석 카드로 (무한 반복)
            setTimeout(() => {
              // 다시 첫 번째 분석 카드로 (순환)
              typingStateRef.current = { cardIndex: 0, textIndex: 0 };
              setCard1TypingComplete(false); // 상태 리셋
              setCard2TypingComplete(false); // 상태 리셋
              setCurrentCardIndex(1);
              setIsTyping(true);
              setTypingText('');
              typingTimeoutRef.current = setTimeout(typeNextChar, 100);
            }, 2000); // 프로세스 카드 표시 시간
          }, CARD_SLIDE_DELAY);
        }
        
        // 다음 카드가 있으면 이동
        if (state.cardIndex < cardsToType.length - 1 && state.cardIndex !== 1) {
          setTimeout(() => {
            state.cardIndex++;
            state.textIndex = 0;
            // 카드 인덱스: 0=기본, 1=문진, 2=선택항목, 3=프로세스
            const nextCardIndex = state.cardIndex === 0 ? 1 : 2;
            setCurrentCardIndex(nextCardIndex);
            setIsTyping(true);
            setTypingText('');
            typingTimeoutRef.current = setTimeout(typeNextChar, 100);
          }, CARD_SLIDE_DELAY); // 카드 전환 딜레이
        }
      }
    };

    // 첫 번째 카드(카드 1) 표시 전 7초 딜레이, 그 후 카드 슬라이드와 함께 타이핑 시작
    typingTimeoutRef.current = setTimeout(() => {
      // 카드 슬라이드와 동시에 타이핑 시작 (텍스트는 빈 상태로 시작)
      setIsTyping(true);
      setTypingText('');
      typeNextChar();
    }, FIRST_CARD_DELAY);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [step1Result, stage]);

  // STEP 1 결과가 있으면 타이핑 완료 후에도 텍스트 유지 (STEP 2 진행 중에도)
  useEffect(() => {
    if (step1Result && !isTyping && typingText && (stage === 'designing' || stage === 'saving')) {
      // 타이핑이 완료된 상태에서 designing 또는 saving 단계에서는 텍스트 유지
      // 추가 작업 없음 (이미 표시 중)
    }
  }, [step1Result, isTyping, typingText, stage]);

  // 두 번째 단계 완료 후 3초 있다가 카드 3 표시
  useEffect(() => {
    if (card2TypingComplete && stage === 'designing') {
      // 두 번째 단계 타이핑 완료 후 3초 후 카드 3으로 전환
      const timer = setTimeout(() => {
        setCurrentCardIndex(3);
      }, 3000); // 3초 딜레이
      
      return () => clearTimeout(timer);
    }
  }, [card2TypingComplete, stage]);

  // 모든 Hook 호출 후 조건부 반환
  if (!isOpen) return null;

  return (
    <div className="processing-modal">
      <div className="processing-modal__overlay"></div>
      <div className="processing-modal__content">
        <div className="processing-modal__header">
          <h3 className="processing-modal__title">{currentStage.title}</h3>
        </div>
        
        <div className="processing-modal__body">
          {/* 스피너 영역 - 상단 고정 (크기 축소) */}
          <div className="processing-modal__spinner-container">
            <div className="processing-modal__spinner">
              <img
                src={WELNO_LOGO_IMAGE}
                alt="로딩 중"
                className="processing-modal__welno-icon welno-icon-blink"
              />
            </div>
            {thinkingText && !typingText && (
              <p className="processing-modal__thinking-text">{thinkingText}</p>
            )}
          </div>
          
          {/* 카드 슬라이드 영역 (4개 카드) - 항상 표시, 고정 높이 */}
          <div className="processing-modal__cards-container">
            <div className="processing-modal__cards-wrapper">
              {/* 카드 0: 기본 프로세스 단계 + 전체 프로그레스 (처음부터 표시) */}
              <div className={`processing-modal__step1-card ${currentCardIndex === 0 ? 'active' : currentCardIndex > 0 ? 'slide-out' : 'active'}`}>
                <div className="processing-modal__step1-card-header">
                  <h4 className="processing-modal__step1-card-title">제공 사항 분석 중...</h4>
                  {currentStage.estimatedTime && (
                    <span className="processing-modal__details-time">{currentStage.estimatedTime}</span>
                  )}
                </div>
                <div className="processing-modal__step1-card-content">
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
                  
                  {/* 전체 프로그레스 바 (카드 내부) */}
                  <div className="processing-modal__progress processing-modal__progress--in-card">
                    <div className="processing-modal__progress-bar">
                      <div 
                        className="processing-modal__progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="processing-modal__progress-text">{progress}%</span>
                  </div>
                </div>
              </div>

              {/* 카드 1: 첫 단계 + 전체 프로그레스 (빈 카드로 시작) */}
              {step1Result?.survey_reflection && (
                <div className={`processing-modal__step1-card ${currentCardIndex === 1 ? 'active' : currentCardIndex > 1 ? 'slide-out' : ''}`}>
                  <div className="processing-modal__step1-card-header">
                    <h4 className="processing-modal__step1-card-title">문진 반영 내용:</h4>
                  </div>
                  <div className="processing-modal__step1-card-content">
                    {currentCardIndex === 1 && isTyping ? (
                      typingText ? (
                        <>
                          {parseHighlightText(typingText)}
                          <span className="processing-modal__typing-cursor"></span>
                        </>
                      ) : (
                        // 타이핑 시작 전 빈 상태
                        <span className="processing-modal__typing-cursor"></span>
                      )
                    ) : currentCardIndex === 1 && card1TypingComplete ? (
                      parseHighlightText(step1Result.survey_reflection)
                    ) : (
                      // 빈 카드 상태
                      <div className="processing-modal__empty-card">준비 중...</div>
                    )}
                  </div>
                  
                  {/* 전체 프로그레스 바 (카드 내부) */}
                  <div className="processing-modal__progress processing-modal__progress--in-card">
                    <div className="processing-modal__progress-bar">
                      <div 
                        className="processing-modal__progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="processing-modal__progress-text">{progress}%</span>
                  </div>
                </div>
              )}
              
              {/* 카드 2: 첫 단계 + 두 번째 단계 + 전체 프로그레스 (빈 카드로 시작) */}
              {step1Result?.selected_concerns_analysis && step1Result.selected_concerns_analysis.length > 0 && (
                <div className={`processing-modal__step1-card ${currentCardIndex === 2 ? 'active' : currentCardIndex > 2 ? 'slide-out' : ''}`}>
                  <div className="processing-modal__step1-card-header">
                    <h4 className="processing-modal__step1-card-title">선택하신 항목 분석:</h4>
                  </div>
                  <div className="processing-modal__step1-card-content">
                    {/* 첫 단계 요약 (작게) */}
                    {card1TypingComplete && (
                      <div className="processing-modal__step1-summary">
                        <strong>문진 반영:</strong> {step1Result.survey_reflection ? step1Result.survey_reflection.substring(0, 50) + '...' : ''}
                      </div>
                    )}
                    
                    {/* 두 번째 단계 내용 */}
                    {currentCardIndex === 2 && isTyping ? (
                      typingText ? (
                        <>
                          {parseHighlightText(typingText)}
                          <span className="processing-modal__typing-cursor"></span>
                        </>
                      ) : (
                        // 타이핑 시작 전 빈 상태
                        <span className="processing-modal__typing-cursor"></span>
                      )
                    ) : currentCardIndex === 2 && card2TypingComplete ? (
                      step1Result.selected_concerns_analysis.map((item: any, index: number) => (
                        <div key={index} className="processing-modal__step1-concern-item">
                          <div className="processing-modal__step1-concern-name">
                            {index + 1}. {item.concern_name || '항목'}
                          </div>
                          {item.trend_analysis && (
                            <div className="processing-modal__step1-concern-detail">
                              <strong>추이 분석:</strong> {parseHighlightText(item.trend_analysis)}
                            </div>
                          )}
                          {item.reflected_in_design && (
                            <div className="processing-modal__step1-concern-detail">
                              <strong>설계 반영:</strong> {parseHighlightText(item.reflected_in_design)}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      // 빈 카드 상태
                      <div className="processing-modal__empty-card">준비 중...</div>
                    )}
                  </div>
                  
                  {/* 전체 프로그레스 바 (카드 내부) */}
                  <div className="processing-modal__progress processing-modal__progress--in-card">
                    <div className="processing-modal__progress-bar">
                      <div 
                        className="processing-modal__progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="processing-modal__progress-text">{progress}%</span>
                  </div>
                </div>
              )}

              {/* 카드 3: 전체 프로그레스 (최종) */}
              <div className={`processing-modal__step1-card ${currentCardIndex === 3 ? 'active' : ''}`}>
                <div className="processing-modal__step1-card-header">
                  <h4 className="processing-modal__step1-card-title">제공 사항 분석 중...</h4>
                  {currentStage.estimatedTime && (
                    <span className="processing-modal__details-time">{currentStage.estimatedTime}</span>
                  )}
                </div>
                <div className="processing-modal__step1-card-content">
                  <ul className="processing-modal__details-list">
                    {currentStage.details.map((detail, index) => {
                      const itemProgress = (index + 1) / currentStage.details.length * 100;
                      const isCompleted = progress >= itemProgress;
                      
                      return (
                        <li 
                          key={index}
                          className={`processing-modal__details-item ${isCompleted ? 'completed' : 'pending'}`}
                        >
                          <span className="processing-modal__details-icon">
                            {isCompleted ? '✓' : '○'}
                          </span>
                          <span className="processing-modal__details-text">{detail}</span>
                        </li>
                      );
                    })}
                  </ul>
                  
                  {/* 전체 프로그레스 바 (카드 내부) */}
                  <div className="processing-modal__progress processing-modal__progress--in-card">
                    <div className="processing-modal__progress-bar">
                      <div 
                        className="processing-modal__progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="processing-modal__progress-text">{progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 타이핑 텍스트가 없을 때만 description 표시 */}
          {!step1Result && (
            <p className="processing-modal__description">{currentStage.description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingModal;

