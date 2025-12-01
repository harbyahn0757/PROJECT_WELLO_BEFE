/**
 * 채팅 인터페이스 메인 컴포넌트
 * 단계별 플로우로 처방/검진/진료 기록 선택
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../../../contexts/WelloDataContext';
import { analyzePrescriptionPatterns, formatEffectPatternMessage, MedicationEffectPattern } from '../../../utils/prescriptionPatternAnalyzer';
import { ChatMessage, ChatOption, ChatStep, ChatInterfaceState } from './types';
import ChatMessageComponent from './ChatMessage';
import ChatOptionButton from './ChatOptionButton';
import MedicationCard from './MedicationCard';
import CheckupCard from './CheckupCard';
import HealthTrendsHeader from '../../health/HealthTrendsHeader';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

// 메시지 딜레이 상수 (모든 버블이 동일한 템포로 표시)
const INITIAL_MESSAGE_DELAY = 500; // 처음 메시지 딜레이 (ms)
const MESSAGE_DELAY = 800; // 메시지 간 기본 딜레이 (ms)
const THINKING_DELAY = 1200; // 고민하는 시간 (ms)
const SPINNER_DURATION = 2000; // 스피너가 돌아가는 시간 (ms) - THINKING_DELAY보다 길게
const OPTIONS_SHOW_DELAY = 2500; // 옵션 카드 표시 딜레이 (ms) - 더 길게 설정
const USER_RESPONSE_DELAY = 300; // 사용자 응답 후 딜레이 (ms)
const CONFIRMATION_DELAY = 500; // 확인 메시지 딜레이 (ms)
const THINKING_TEXT_DELAY = 600; // 중얼중얼 텍스트 변경 딜레이 (ms) - 더 천천히

interface ChatInterfaceProps {
  healthData: any;
  prescriptionData: any;
  onNext: (items: Set<string>, selectedConcerns: any[], surveyResponses?: any) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  healthData,
  prescriptionData,
  onNext
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: welloState } = useWelloData();
  const patientName = welloState.patient?.name || '';
  const [state, setState] = useState<ChatInterfaceState>({
    currentStep: 'prescription_analysis',
    messages: [],
    selectedPrescriptionEffects: [],
    selectedCheckupRecords: [],
    selectedTreatmentRecords: []
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const [prescriptionAnalysis, setPrescriptionAnalysis] = useState<any>(null);
  // 초기화 플래그 (컴포넌트 마운트 시에만 체크)
  const [hasInitialized, setHasInitialized] = useState(false);
  const [activeDotIndex, setActiveDotIndex] = useState(0); // 닷 네비게이터 활성 인덱스
  const [showOptions, setShowOptions] = useState(false); // 옵션 표시 여부 (순서 제어)
  const [isOptionsVisible, setIsOptionsVisible] = useState(false); // 옵션 애니메이션 제어
  const [isThinking, setIsThinking] = useState(false); // 고민 중 스피너 표시 여부
  const [isThinkingForOptions, setIsThinkingForOptions] = useState(false); // 카드 표시 전 스피너 (오른쪽 정렬)
  const [isSpinnerFadingOut, setIsSpinnerFadingOut] = useState(false); // 스피너 페이드아웃 상태
  const [thinkingText, setThinkingText] = useState<string>(''); // 띵킹 모드 중얼중얼 텍스트
  const messageIndexRef = useRef(0); // 메시지 순서 추적
  const pendingMessageRef = useRef<{ type: ChatMessage['type'], content: string, data?: any, options?: ChatOption[] } | null>(null); // 대기 중인 메시지

  // 뒤로가기 핸들러
  const handleBack = () => {
    const queryString = location.search;
    navigate(`/${queryString}`);
  };

  // 처방 패턴 분석 (초기화 플래그로 중복 방지)
  useEffect(() => {
    if (prescriptionData && state.currentStep === 'prescription_analysis' && !hasInitialized) {
      setShowOptions(false); // 옵션 초기화
      const prescriptionList = Array.isArray(prescriptionData) 
        ? prescriptionData 
        : prescriptionData.ResultList || [];
      
      if (prescriptionList.length > 0) {
        const analysis = analyzePrescriptionPatterns(prescriptionList);
        setPrescriptionAnalysis(analysis);
        setHasInitialized(true); // 초기화 완료 표시
        
        // 초기 메시지 추가 (딜레이 후, 스피너 없음)
        setTimeout(() => {
          const greetingText = patientName 
            ? `안녕하세요 ${patientName}님! 검진 항목을 설계하기 위해 먼저 처방 이력을 확인해볼게요.`
            : '안녕하세요! 검진 항목을 설계하기 위해 먼저 처방 이력을 확인해볼게요.';
          addBotMessage('bot_intro', greetingText, undefined, false);
        }, INITIAL_MESSAGE_DELAY);
        
        // 분석 결과 메시지 추가 (순차적으로, 동일한 템포)
        if (analysis.topEffects.length > 0) {
          setTimeout(() => {
            // 분석 결과 메시지 전에 스피너 표시 (오른쪽) - 띵킹 모드
            setIsThinkingForOptions(true);
            // 실제 데이터 기반 중얼중얼 효과 시작
            const prescriptionCount = prescriptionList.length;
            const effectCount = analysis.topEffects.length;
            const thinkingTexts = [
              `처방 이력 ${prescriptionCount}건 확인 중...`,
              `약품 효과 ${effectCount}개 분석 중...`,
              ...analysis.topEffects.slice(0, 2).map((pattern: MedicationEffectPattern) => 
                `${pattern.effect} 약품 확인 중...`
              )
            ];
            let textIndex = 0;
            const thinkingInterval = setInterval(() => {
              if (textIndex < thinkingTexts.length) {
                setThinkingText(thinkingTexts[textIndex]);
                textIndex++;
              } else {
                clearInterval(thinkingInterval);
              }
            }, THINKING_TEXT_DELAY); // 더 천천히 텍스트 변경
            
            setTimeout(() => {
              clearInterval(thinkingInterval);
              setIsThinkingForOptions(false);
              setThinkingText('');
              let analysisText = '분석 결과, 다음과 같은 약품을 복용하셨어요:\n';
              analysis.topEffects.slice(0, 5).forEach((pattern, index) => {
                analysisText += `\n${index + 1}. ${formatEffectPatternMessage(pattern)}`;
              });
              // 왼쪽 스피너 없이 바로 메시지 표시 (오른쪽 스피너만 사용)
              addBotMessage('bot_analysis', analysisText, undefined, false);
            
              // 선택 옵션 메시지 추가 (동일한 템포)
              setTimeout(() => {
                addBotMessageWithOptions('bot_question', 
                  '특히 고민해야 할 처방 이력을 선택해주세요:',
                  generatePrescriptionOptions(analysis.topEffects)
                );
              }, MESSAGE_DELAY);
            }, THINKING_DELAY);
          }, MESSAGE_DELAY);
        } else {
          setTimeout(() => {
            addBotMessage('bot_analysis', '처방 이력이 없어서 다음 단계로 넘어가겠습니다.');
            setTimeout(() => {
              moveToNextStep();
            }, MESSAGE_DELAY + THINKING_DELAY);
          }, MESSAGE_DELAY);
        }
      }
    }
  }, [prescriptionData, state.currentStep, hasInitialized]);

  // 검진 데이터 준비 (초기화 플래그로 중복 방지)
  useEffect(() => {
    if (state.currentStep === 'checkup_selection' && healthData && !hasInitialized) {
      setShowOptions(false); // 옵션 초기화
      const healthList = Array.isArray(healthData) 
        ? healthData 
        : healthData.ResultList || [];
      
      if (healthList.length > 0) {
        setHasInitialized(true); // 초기화 완료 표시
        setTimeout(() => {
          addBotMessage('bot_intro', '이제 검진 이력을 확인해볼게요.', undefined, false);
          
          setTimeout(() => {
            // 검진 데이터 기반 중얼중얼 효과
            setIsThinkingForOptions(true);
            const healthCount = healthList.length;
            const thinkingTexts = [
              `검진 기록 ${healthCount}건 확인 중...`,
              ...healthList.slice(0, 2).map((checkup: any) => {
                const year = checkup.year || checkup.Year || '2023';
                return `${year}년 검진 확인 중...`;
              })
            ];
            let textIndex = 0;
            const thinkingInterval = setInterval(() => {
              if (textIndex < thinkingTexts.length) {
                setThinkingText(thinkingTexts[textIndex]);
                textIndex++;
              } else {
                clearInterval(thinkingInterval);
              }
            }, 400);
            
            setTimeout(() => {
              clearInterval(thinkingInterval);
              setIsThinkingForOptions(false);
              setThinkingText('');
              addBotMessageWithOptions('bot_question',
                '다음 검진 기록 중에서 특히 주의 깊게 봐야 할 항목을 선택해주세요:',
                generateCheckupOptions(healthList)
              );
            }, THINKING_DELAY);
          }, MESSAGE_DELAY);
        }, MESSAGE_DELAY);
      } else {
        setTimeout(() => {
          setShowOptions(false);
          setState(prev => ({ ...prev, currentStep: 'complete' }));
        }, MESSAGE_DELAY);
      }
    }
  }, [state.currentStep, healthData, hasInitialized]);

  // 메시지 추가 함수 (고민 중 스피너 표시 후 메시지 추가)
  const addBotMessage = (type: ChatMessage['type'], content: string, data?: any, showThinking: boolean = true) => {
    const currentIndex = messageIndexRef.current++;
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${currentIndex}`,
      type,
      sender: 'bot',
      content,
      timestamp: new Date(),
      data,
      animationDelay: 0 // 애니메이션 delay는 CSS에서 처리
    };
    
    if (showThinking) {
      // 고민 중 스피너 표시 (딜레이 옵션일 경우에만)
      setIsThinking(true);
      pendingMessageRef.current = { type, content, data };
      
      // 실제 데이터 기반 중얼중얼 효과 시작 (왼쪽 스피너용)
      const thinkingTexts: string[] = [];
      if (prescriptionAnalysis?.topEffects) {
        thinkingTexts.push(`처방 패턴 분석 중...`);
        if (prescriptionAnalysis.topEffects.length > 0) {
          thinkingTexts.push(`${prescriptionAnalysis.topEffects[0].effect} 확인 중...`);
        }
      } else {
        thinkingTexts.push('데이터 확인 중...', '분석 중...');
      }
      
      let textIndex = 0;
      const thinkingInterval = setInterval(() => {
        if (textIndex < thinkingTexts.length) {
          setThinkingText(thinkingTexts[textIndex]);
          textIndex++;
        } else {
          clearInterval(thinkingInterval);
        }
      }, THINKING_TEXT_DELAY); // 더 천천히 텍스트 변경
      
      // 스피너가 돌아가는 시간 후 부드럽게 사라지고 메시지 표시
      setTimeout(() => {
        clearInterval(thinkingInterval);
        setThinkingText('');
        // 스피너 페이드아웃 시작 (300ms)
        setIsSpinnerFadingOut(true);
        setTimeout(() => {
          setIsThinking(false);
          setIsSpinnerFadingOut(false);
          // 스피너가 사라진 후 메시지 페이드인 (300ms 딜레이)
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, message]
            }));
            pendingMessageRef.current = null;
          }, 300);
        }, 300);
      }, SPINNER_DURATION);
    } else {
      // 즉시 메시지 표시 (스피너 없음)
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));
    }
  };

  const addUserMessage = (content: string, data?: any) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type: 'user_selection',
      sender: 'user',
      content,
      timestamp: new Date(),
      data
    };
    
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  };

  const addBotMessageWithOptions = (
    type: ChatMessage['type'],
    content: string,
    options: ChatOption[],
    showThinking: boolean = true
  ) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      sender: 'bot',
      content,
      timestamp: new Date(),
      options
    };
    
    if (showThinking) {
      // 고민 중 스피너 표시 (딜레이 옵션일 경우에만)
      setIsThinking(true);
      pendingMessageRef.current = { type, content, options };
      
      // 스피너가 돌아가는 시간 후 메시지 표시
      setTimeout(() => {
        setIsThinking(false);
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, message]
        }));
        // 메시지 표시 후 딜레이를 주고 카드 표시 전 스피너 표시 (오른쪽 정렬)
        setTimeout(() => {
          setIsThinkingForOptions(true);
          // 실제 데이터 기반 중얼중얼 효과 시작 (카드 표시 전)
          const thinkingTexts: string[] = [];
          if (options && options.length > 0) {
            thinkingTexts.push(`선택지 ${options.length}개 준비 중...`);
            if (options[0]?.data?.type === 'prescription' && options[0]?.data?.pattern) {
              thinkingTexts.push(`${options[0].data.pattern.effect} 카드 준비 중...`);
            } else if (options[0]?.data?.type === 'checkup') {
              thinkingTexts.push('검진 기록 카드 준비 중...');
            }
          } else {
            thinkingTexts.push('선택지 준비 중...');
          }
          
          let textIndex = 0;
          const thinkingInterval = setInterval(() => {
            if (textIndex < thinkingTexts.length) {
              setThinkingText(thinkingTexts[textIndex]);
              textIndex++;
            } else {
              clearInterval(thinkingInterval);
            }
          }, THINKING_TEXT_DELAY); // 더 천천히 텍스트 변경
          
          setTimeout(() => {
            clearInterval(thinkingInterval);
            setIsThinkingForOptions(false);
            setThinkingText('');
            setShowOptions(true);
            // 부드러운 애니메이션을 위한 약간의 딜레이
            setTimeout(() => {
              setIsOptionsVisible(true);
            }, 50);
          }, OPTIONS_SHOW_DELAY);
        }, MESSAGE_DELAY);
        pendingMessageRef.current = null;
      }, SPINNER_DURATION);
    } else {
      // 즉시 메시지 표시 (스피너 없음)
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));
      // 메시지 표시 후 딜레이를 주고 카드 표시 전 스피너 표시 (오른쪽 정렬)
      setTimeout(() => {
        setIsThinkingForOptions(true);
        setTimeout(() => {
          setIsThinkingForOptions(false);
          setShowOptions(true);
          // 부드러운 애니메이션을 위한 약간의 딜레이
          setTimeout(() => {
            setIsOptionsVisible(true);
          }, 50);
        }, OPTIONS_SHOW_DELAY);
      }, MESSAGE_DELAY);
    }
  };

  // 처방 옵션 생성
  const generatePrescriptionOptions = (patterns: MedicationEffectPattern[]): ChatOption[] => {
    const options: ChatOption[] = patterns.slice(0, 5).map((pattern, index) => ({
      id: `prescription-${pattern.effect}`,
      label: pattern.effect,
      description: formatEffectPatternMessage(pattern),
      data: { type: 'prescription', pattern }
    }));

    // 추가 옵션
    options.push({
      id: 'prescription-all',
      label: '모두 선택',
      description: '모든 처방 이력 선택',
      data: { type: 'prescription', all: true }
    });

    options.push({
      id: 'prescription-skip',
      label: '건너뛰기',
      description: '처방 이력 선택 건너뛰기',
      data: { type: 'prescription', skip: true }
    });

    return options;
  };

  // 검진 옵션 생성
  const generateCheckupOptions = (healthList: any[]): ChatOption[] => {
    return healthList.map((checkup, index) => {
      const year = checkup.year || checkup.Year || '2023';
      const date = checkup.CheckUpDate || checkup.checkup_date || '';
      const location = checkup.Location || checkup.location || '국민건강보험공단';
      
      // 이상/경계 건수 계산 (간단한 예시)
      const abnormalCount = 0; // TODO: 실제 계산 로직 필요
      const warningCount = 0; // TODO: 실제 계산 로직 필요

      return {
        id: `checkup-${index}`,
        label: `${year}년 건강검진`,
        description: `${location} - ${date}`,
        data: { type: 'checkup', checkup, index }
      };
    });
  };

  // 옵션 선택 핸들러
  const handleOptionClick = (option: ChatOption) => {
    const { type, ...data } = option.data;

    if (type === 'prescription') {
      if (data.skip) {
        // 모든 시스템 메시지가 완료된 후 사용자 메시지 추가
        setTimeout(() => {
          addUserMessage('건너뛰기');
          setTimeout(() => {
            addBotMessage('bot_confirmation', '알겠습니다. 다음 단계로 넘어가겠습니다.');
            setTimeout(() => moveToNextStep(), MESSAGE_DELAY + THINKING_DELAY);
          }, CONFIRMATION_DELAY);
        }, USER_RESPONSE_DELAY);
      } else if (data.all) {
        const allEffects = prescriptionAnalysis?.topEffects.map((p: MedicationEffectPattern) => p.effect) || [];
        setState(prev => ({
          ...prev,
          selectedPrescriptionEffects: allEffects
        }));
        setTimeout(() => {
          addUserMessage('모두 선택');
          setTimeout(() => {
            addBotMessage('bot_confirmation', `모든 처방 이력(${allEffects.length}개)을 선택하셨습니다.`);
            setTimeout(() => moveToNextStep(), MESSAGE_DELAY + THINKING_DELAY);
          }, CONFIRMATION_DELAY);
        }, USER_RESPONSE_DELAY);
      } else {
        const effect = data.pattern.effect;
        setState(prev => ({
          ...prev,
          selectedPrescriptionEffects: [...prev.selectedPrescriptionEffects, effect]
        }));
        setTimeout(() => {
          addUserMessage(effect);
          setTimeout(() => {
            addBotMessage('bot_confirmation', `${effect}를 선택하셨네요. 추가로 선택하시겠어요?`);
          }, CONFIRMATION_DELAY);
        }, USER_RESPONSE_DELAY);
      }
    } else if (type === 'checkup') {
      const checkupId = `checkup-${data.index}`;
      setState(prev => ({
        ...prev,
        selectedCheckupRecords: [...prev.selectedCheckupRecords, checkupId]
      }));
      setTimeout(() => {
        addUserMessage(`${data.checkup.year || data.checkup.Year}년 건강검진`);
        setTimeout(() => {
          addBotMessage('bot_confirmation', '검진 기록을 선택하셨습니다. 추가로 선택하시겠어요?');
        }, CONFIRMATION_DELAY);
      }, USER_RESPONSE_DELAY);
    }
  };

  // 다음 단계로 이동
  const moveToNextStep = () => {
    setShowOptions(false); // 옵션 숨김
    if (state.currentStep === 'prescription_analysis') {
      setState(prev => ({ ...prev, currentStep: 'checkup_selection' }));
    } else if (state.currentStep === 'checkup_selection') {
      // 완료 처리
      handleComplete();
    }
  };

  // 완료 처리
  const handleComplete = () => {
    addBotMessage('bot_confirmation', '선택하신 정보를 바탕으로 검진 설계를 진행하겠습니다.');
    
    // 기존 ConcernSelection 형식으로 변환
    setTimeout(() => {
      const selectedItems = new Set<string>([
        ...state.selectedPrescriptionEffects.map(e => `prescription-${e}`),
        ...state.selectedCheckupRecords
      ]);

      const selectedConcerns: any[] = [];
      
      // 처방 데이터 변환
      state.selectedPrescriptionEffects.forEach(effect => {
        const pattern = prescriptionAnalysis?.topEffects.find((p: MedicationEffectPattern) => p.effect === effect);
        if (pattern) {
          selectedConcerns.push({
            type: 'medication',
            effect: pattern.effect,
            data: pattern
          });
        }
      });

      // 검진 데이터 변환
      const healthList = Array.isArray(healthData) 
        ? healthData 
        : healthData.ResultList || [];
      
      state.selectedCheckupRecords.forEach(recordId => {
        const index = parseInt(recordId.replace('checkup-', ''), 10);
        if (healthList[index]) {
          selectedConcerns.push({
            type: 'checkup',
            data: healthList[index]
          });
        }
      });

      onNext(selectedItems, selectedConcerns);
    }, MESSAGE_DELAY + THINKING_DELAY);
  };

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // 현재 메시지의 옵션 가져오기 (showOptions가 true일 때만)
  const currentOptions = useMemo(() => {
    if (!showOptions) return [];
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage?.options || [];
  }, [state.messages, showOptions]);

  return (
    <div className="chat-interface">
      <HealthTrendsHeader
        onBack={handleBack}
        title="검진 항목 설계"
        description={`기존 검진/처방 이력중 설계에서\n유의 하게 보실게 있으면 선택해주세요`}
        headerType="large"
      />
      
      <div className="chat-interface__body">
        <div className="chat-interface__messages">
          {state.messages.map((message, index) => (
            <ChatMessageComponent 
              key={message.id} 
              message={message}
              style={{ animationDelay: '0s' }}
            />
          ))}
          
          {/* 고민 중 스피너 (웰로 이미지) - 봇 메시지 전 (왼쪽 정렬) */}
          {isThinking && (
            <div className={`chat-interface__thinking chat-interface__thinking--left ${isSpinnerFadingOut ? 'fade-out' : ''}`}>
              <div className="chat-interface__thinking-spinner">
                <img
                  src={WELLO_LOGO_IMAGE}
                  alt="로딩 중"
                  className="chat-interface__thinking-wello-icon wello-icon-blink"
                />
              </div>
              {thinkingText && (
                <span className="chat-interface__thinking-text">{thinkingText}</span>
              )}
            </div>
          )}
          
          {/* 카드 표시 전 스피너 (오른쪽 정렬) */}
          {isThinkingForOptions && (
            <div className="chat-interface__thinking chat-interface__thinking--right">
              <div className="chat-interface__thinking-spinner">
                <img
                  src={WELLO_LOGO_IMAGE}
                  alt="로딩 중"
                  className="chat-interface__thinking-wello-icon wello-icon-blink"
                />
              </div>
              {thinkingText && (
                <span className="chat-interface__thinking-text">{thinkingText}</span>
              )}
            </div>
          )}
          
          {/* 옵션 표시 영역 - 채팅 영역 안에 배치 */}
          {currentOptions.length > 0 && (
            <div 
              className={`chat-interface__options ${isOptionsVisible ? 'is-visible' : ''}`}
              ref={optionsContainerRef}
              onScroll={(e) => {
                // 스크롤 위치에 따라 활성 닷 인덱스 계산
                const container = e.currentTarget;
                const scrollLeft = container.scrollLeft;
                const cardWidth = 180 + 16; // 카드 너비 (180px) + gap (16px)
                const newIndex = Math.round(scrollLeft / cardWidth);
                setActiveDotIndex(Math.min(newIndex, currentOptions.length - 1));
              }}
            >
              {currentOptions.map((option, index) => {
                if (option.data?.type === 'prescription' && option.data?.pattern) {
                  return (
                    <MedicationCard
                      key={option.id}
                      pattern={option.data.pattern}
                      onClick={() => handleOptionClick(option)}
                      selected={state.selectedPrescriptionEffects.includes(option.data.pattern.effect)}
                      animationDelay={index * 200} // 카드 하나씩 순차적으로 나타나게 (200ms 간격)
                    />
                  );
                } else if (option.data?.type === 'checkup') {
                  const checkup = option.data.checkup;
                  return (
                    <CheckupCard
                      key={option.id}
                      id={option.id}
                      year={checkup.year || checkup.Year || '2023'}
                      date={checkup.CheckUpDate || checkup.checkup_date || ''}
                      location={checkup.Location || checkup.location || '국민건강보험공단'}
                      abnormalCount={0}
                      warningCount={0}
                      onClick={() => handleOptionClick(option)}
                      selected={state.selectedCheckupRecords.includes(option.id)}
                      animationDelay={index * 200} // 카드 하나씩 순차적으로 나타나게 (200ms 간격)
                    />
                  );
                } else {
                  return (
                    <ChatOptionButton
                      key={option.id}
                      option={option}
                      onClick={handleOptionClick}
                      animationDelay={index * 200} // 카드 하나씩 순차적으로 나타나게 (200ms 간격)
                    />
                  );
                }
              })}
              
              {/* 닷 네비게이터 */}
              {currentOptions.length > 1 && (
                <div className="chat-interface__dots">
                  {currentOptions.map((_, index) => (
                    <button
                      key={index}
                      className={`chat-interface__dot ${index === activeDotIndex ? 'chat-interface__dot--active' : ''}`}
                      onClick={() => {
                        if (optionsContainerRef.current) {
                          const cardWidth = 180 + 16; // 카드 너비 (180px) + gap (16px)
                          optionsContainerRef.current.scrollTo({
                            left: index * cardWidth,
                            behavior: 'smooth'
                          });
                          setActiveDotIndex(index);
                        }
                      }}
                      aria-label={`슬라이드 ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {state.currentStep !== 'complete' && (
          <div className="chat-interface__progress">
            {state.currentStep === 'prescription_analysis' && '1/2 단계: 처방 이력 선택'}
            {state.currentStep === 'checkup_selection' && '2/2 단계: 검진 기록 선택'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;

