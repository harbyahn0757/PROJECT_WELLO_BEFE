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
import CheckupDesignSurveyPanel, { SurveyResponses } from '../CheckupDesignSurveyPanel';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

// 메시지 딜레이 상수 (모든 버블이 동일한 템포로 표시)
const INITIAL_MESSAGE_DELAY = 500; // 처음 메시지 딜레이 (ms)
const MESSAGE_DELAY = 800; // 메시지 간 기본 딜레이 (ms)
const THINKING_DELAY = 1200; // 고민하는 시간 (ms)
const SPINNER_DURATION = 2000; // 스피너가 돌아가는 시간 (ms) - THINKING_DELAY보다 길게
const OPTIONS_SHOW_DELAY = 2500; // 옵션 카드 표시 딜레이 (ms) - 더 길게 설정
const USER_RESPONSE_DELAY = 300; // 사용자 응답 후 딜레이 (ms)
const USER_CARD_DISPLAY_DELAY = 2000; // 사용자 선택 후 카드 표시 딜레이 (ms) - 2초
const CONFIRMATION_DELAY = 500; // 확인 메시지 딜레이 (ms)
const THINKING_TEXT_DELAY = 1000; // 중얼중얼 텍스트 변경 딜레이 (ms) - 더 천천히, 부드럽게

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
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const [showSurveyPanel, setShowSurveyPanel] = useState(false); // 문진 패널 표시 여부
  const [showActionButtons, setShowActionButtons] = useState(false); // 다음/건너뛰기 버튼 표시 여부
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
      setShowActionButtons(false); // 버튼 초기화
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
      setShowActionButtons(false); // 버튼 초기화
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
            }, THINKING_TEXT_DELAY); // 통일된 딜레이 사용
            
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
              
              // 모든 카드가 나타난 후 버튼 표시
              // 카드 애니메이션: 각 카드당 200ms 딜레이 + 500ms 애니메이션 시간
              const cardCount = pendingMessageRef.current?.options?.length || 0;
              const lastCardDelay = cardCount > 0 ? (cardCount - 1) * 200 : 0;
              const animationDuration = 500; // slideInFromRight 애니메이션 시간
              const buttonShowDelay = lastCardDelay + animationDuration + 200; // 여유 시간 추가
              
              setTimeout(() => {
                setShowActionButtons(true);
              }, buttonShowDelay);
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
            
            // 모든 카드가 나타난 후 버튼 표시
            const cardCount = options.length;
            const lastCardDelay = cardCount > 0 ? (cardCount - 1) * 200 : 0;
            const animationDuration = 500; // slideInFromRight 애니메이션 시간
            const buttonShowDelay = lastCardDelay + animationDuration + 200; // 여유 시간 추가
            
            setTimeout(() => {
              setShowActionButtons(true);
            }, buttonShowDelay);
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

    // "모두 선택"과 "건너뛰기"는 슬라이더 하단 버튼으로 이동했으므로 옵션에서 제거
    return options;
  };

  // 검진 상태 분석 함수
  const analyzeCheckupStatus = (checkup: any) => {
    const statusCounts = { normal: 0, warning: 0, abnormal: 0 };
    
    if (!checkup?.Inspections) return statusCounts;
    
    const determineItemStatus = (item: any): 'normal' | 'warning' | 'abnormal' => {
      if (!item.Value || !item.ItemReferences || item.ItemReferences.length === 0) {
        return 'normal';
      }
      
      const value = item.Value.toString().toLowerCase();
      if (value.includes('정상') || value.includes('음성')) return 'normal';
      if (value.includes('의심') || value.includes('양성')) return 'abnormal';
      
      const numValue = parseFloat(item.Value.toString().replace(/[^0-9.-]/g, ''));
      if (isNaN(numValue)) return 'normal';
      
      const isInRange = (val: number, rangeStr: string): boolean => {
        if (rangeStr.includes('이상')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val >= threshold;
        }
        if (rangeStr.includes('미만')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val < threshold;
        }
        if (rangeStr.includes('이하')) {
          const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
          return !isNaN(threshold) && val <= threshold;
        }
        if (rangeStr.includes('-')) {
          const [min, max] = rangeStr.split('-').map(s => parseFloat(s.replace(/[^0-9.-]/g, '')));
          return !isNaN(min) && !isNaN(max) && val >= min && val <= max;
        }
        return false;
      };
      
      const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
      if (abnormal && isInRange(numValue, abnormal.Value)) return 'abnormal';
      
      const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
      if (normalB && isInRange(numValue, normalB.Value)) return 'warning';
      
      return 'normal';
    };
    
    checkup.Inspections.forEach((inspection: any) => {
      if (inspection.Illnesses) {
        inspection.Illnesses.forEach((illness: any) => {
          if (illness.Items) {
            illness.Items.forEach((item: any) => {
              const itemName = item.Name;
              // 신체계측 항목은 허리둘레 기준으로만 카운트
              if (itemName === '신장' || itemName === '체중') {
                return; // 개별 카운트하지 않음
              }
              if (itemName === '허리둘레') {
                const status = determineItemStatus(item);
                statusCounts[status]++;
                return;
              }
              
              const status = determineItemStatus(item);
              statusCounts[status]++;
            });
          }
        });
      }
    });
    
    return statusCounts;
  };

  // 검진 옵션 생성
  const generateCheckupOptions = (healthList: any[]): ChatOption[] => {
    return healthList.map((checkup, index) => {
      // checkup 구조: raw_data가 있으면 raw_data 사용, 없으면 checkup 자체 사용
      const checkupData = checkup.raw_data || checkup;
      const year = checkup.year || checkup.Year || checkupData.Year || '2023';
      const date = checkup.CheckUpDate || checkup.checkup_date || checkupData.CheckUpDate || '';
      const location = checkup.Location || checkup.location || checkupData.Location || '국민건강보험공단';
      
      // 실제 이상/경계 건수 계산
      const statusCounts = analyzeCheckupStatus(checkupData);
      const abnormalCount = statusCounts.abnormal;
      const warningCount = statusCounts.warning;

      return {
        id: `checkup-${index}`,
        label: `${year}년 건강검진`,
        description: `${location} - ${date}`,
        data: { type: 'checkup', checkup: checkupData, index, abnormalCount, warningCount }
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
        // 사용자 선택 후 카드 표시 딜레이 (2초)
        setTimeout(() => {
          addUserMessage('모두 선택');
          setTimeout(() => {
            addBotMessage('bot_confirmation', `모든 처방 이력(${allEffects.length}개)을 선택하셨습니다.`);
            setTimeout(() => moveToNextStep(), MESSAGE_DELAY + THINKING_DELAY);
          }, CONFIRMATION_DELAY);
        }, USER_CARD_DISPLAY_DELAY);
      } else {
        // 카드 선택/취소 토글 (메시지 추가 없음)
        const effect = data.pattern.effect;
        setState(prev => {
          const isSelected = prev.selectedPrescriptionEffects.includes(effect);
          return {
            ...prev,
            selectedPrescriptionEffects: isSelected
              ? prev.selectedPrescriptionEffects.filter(e => e !== effect)
              : [...prev.selectedPrescriptionEffects, effect]
          };
        });
      }
    } else if (type === 'checkup') {
      // 카드 선택/취소 토글 (메시지 추가 없음)
      const checkupId = `checkup-${data.index}`;
      setState(prev => {
        const isSelected = prev.selectedCheckupRecords.includes(checkupId);
        return {
          ...prev,
          selectedCheckupRecords: isSelected
            ? prev.selectedCheckupRecords.filter(id => id !== checkupId)
            : [...prev.selectedCheckupRecords, checkupId]
        };
      });
    }
  };

  // 선택된 항목들을 합쳐서 사용자 메시지로 표시
  const addSelectedItemsAsUserMessage = (step: 'prescription_analysis' | 'checkup_selection') => {
    if (step === 'prescription_analysis') {
      const selectedEffects = state.selectedPrescriptionEffects;
      if (selectedEffects.length > 0) {
        const messageText = selectedEffects.length === 1 
          ? selectedEffects[0]
          : `${selectedEffects.slice(0, -1).join(', ')}${selectedEffects.length > 1 ? ', ' : ''}${selectedEffects[selectedEffects.length - 1]}`;
        setTimeout(() => {
          addUserMessage(messageText);
        }, USER_RESPONSE_DELAY);
      }
    } else if (step === 'checkup_selection') {
      const selectedRecords = state.selectedCheckupRecords;
      if (selectedRecords.length > 0) {
        // 검진 기록의 연도 추출
        const healthList = Array.isArray(healthData) ? healthData : healthData.ResultList || [];
        const selectedYears = selectedRecords.map(recordId => {
          const index = parseInt(recordId.replace('checkup-', ''), 10);
          const checkup = healthList[index];
          return checkup?.year || checkup?.Year || '2023';
        });
        const uniqueYears = Array.from(new Set(selectedYears));
        const messageText = uniqueYears.length === 1
          ? `${uniqueYears[0]}년 건강검진`
          : `${uniqueYears.slice(0, -1).join('년, ')}년, ${uniqueYears[uniqueYears.length - 1]}년 건강검진`;
        setTimeout(() => {
          addUserMessage(messageText);
        }, USER_RESPONSE_DELAY);
      }
    }
  };

  // 건너뛰기 핸들러
  const handleSkip = () => {
    setShowOptions(false);
    setShowActionButtons(false);
    setTimeout(() => {
      addUserMessage('건너뛰기');
      setTimeout(() => {
        addBotMessage('bot_confirmation', '알겠습니다. 다음 단계로 넘어가겠습니다.');
        setTimeout(() => moveToNextStep(), MESSAGE_DELAY + THINKING_DELAY);
      }, CONFIRMATION_DELAY);
    }, USER_RESPONSE_DELAY);
  };

  // 다음 단계로 이동
  const moveToNextStep = () => {
    setShowOptions(false); // 옵션 숨김
    setShowActionButtons(false); // 버튼 숨김
    
    if (state.currentStep === 'prescription_analysis') {
      // 선택된 항목들을 사용자 메시지로 표시
      addSelectedItemsAsUserMessage('prescription_analysis');
      
      // 확인 메시지 추가 후 다음 단계로
      setTimeout(() => {
        const count = state.selectedPrescriptionEffects.length;
        addBotMessage('bot_confirmation', count > 0 
          ? `처방 이력 ${count}개를 선택하셨습니다. 다음 단계로 넘어가겠습니다.`
          : '다음 단계로 넘어가겠습니다.'
        );
        setTimeout(() => {
          setState(prev => ({ ...prev, currentStep: 'checkup_selection' }));
          setHasInitialized(false); // 다음 단계 초기화 플래그 리셋
          setShowActionButtons(false); // 버튼 초기화
        }, MESSAGE_DELAY + THINKING_DELAY);
      }, USER_CARD_DISPLAY_DELAY);
    } else if (state.currentStep === 'checkup_selection') {
      // 완료 처리
      handleComplete();
    }
  };

  // 완료 처리
  const handleComplete = () => {
    setShowOptions(false);
    
    // 선택된 항목들을 사용자 메시지로 표시
    addSelectedItemsAsUserMessage('checkup_selection');
    
    // 확인 메시지 추가
    setTimeout(() => {
      const count = state.selectedCheckupRecords.length;
      addBotMessage('bot_confirmation', count > 0
        ? `검진 기록 ${count}개를 선택하셨습니다.`
        : '검진 기록을 건너뛰셨습니다.'
      );
      
      // 문진으로 넘어간다는 메시지 추가
      setTimeout(() => {
        addBotMessage('bot_intro', '이제 문진으로 넘어가겠습니다.');
        
        // 문진 패널 표시
        setTimeout(() => {
          setShowSurveyPanel(true);
        }, MESSAGE_DELAY + THINKING_DELAY);
      }, MESSAGE_DELAY + THINKING_DELAY);
    }, USER_CARD_DISPLAY_DELAY);
  };

  // 문진 패널 제출 핸들러
  const handleSurveySubmit = (surveyResponses: SurveyResponses) => {
    setShowSurveyPanel(false);
    
    // 선택된 항목들 수집
    const selectedItems = new Set<string>([
      ...state.selectedPrescriptionEffects.map(e => `prescription-${e}`),
      ...state.selectedCheckupRecords
    ]);
    
    const selectedConcerns: any[] = [];
    
    // 처방 데이터 변환 (기존 ConcernSelection 구조와 동일)
    const prescriptionList = Array.isArray(prescriptionData) 
      ? prescriptionData 
      : prescriptionData.ResultList || [];
    
    state.selectedPrescriptionEffects.forEach(effect => {
      const pattern = prescriptionAnalysis?.topEffects.find((p: MedicationEffectPattern) => p.effect === effect);
      if (pattern) {
        // 기존 ConcernSelection 구조: { type: 'medication', id, medicationName, period, hospitalName }
        // medicationName: 첫 번째 약물명 또는 효능명
        const medicationName = pattern.medications && pattern.medications.length > 0
          ? pattern.medications[0].name
          : pattern.effect;
        
        // 기간: firstPrescriptionDate ~ lastPrescriptionEndDate (기존 ConcernSelection은 date만 사용)
        const period = pattern.firstPrescriptionDate && pattern.lastPrescriptionEndDate
          ? `${pattern.firstPrescriptionDate} ~ ${pattern.lastPrescriptionEndDate}`
          : pattern.firstPrescriptionDate || pattern.lastPrescriptionDate || '';
        
        // 병원명: 처방 데이터에서 해당 효능의 첫 번째 처방의 병원명 추출
        let hospitalName = '약국'; // 기본값
        if (prescriptionList.length > 0) {
          // 해당 효능의 약물이 포함된 첫 번째 처방 찾기
          for (const prescription of prescriptionList) {
            const medicationList = prescription.RetrieveTreatmentInjectionInformationPersonDetailList || [];
            const hasEffect = medicationList.some((med: any) => {
              const medEffect = med.ChoBangYakPumHyoneung || med.ChoBangYakPumMyung || '';
              return medEffect === effect || med.ChoBangYakPumMyung === medicationName;
            });
            
            if (hasEffect) {
              hospitalName = prescription.hospital_name || prescription.ByungEuiwonYakGukMyung || '약국';
              break;
            }
          }
        }
        
        const medicationConcern = {
          type: 'medication',
          id: `prescription-${pattern.effect}`, // option.id와 동일
          medicationName: medicationName,
          period: period,
          hospitalName: hospitalName
        };
        console.log('🔍 [ChatInterface] 처방 데이터 변환:', medicationConcern);
        selectedConcerns.push(medicationConcern);
      }
    });
    
    // 검진 데이터 변환 (기존 ConcernSelection 구조와 동일)
    const healthList = Array.isArray(healthData) 
      ? healthData 
      : healthData.ResultList || [];
    
    state.selectedCheckupRecords.forEach(recordId => {
      const index = parseInt(recordId.replace('checkup-', ''), 10);
      if (healthList[index]) {
        const checkup = healthList[index];
        const checkupData = checkup.raw_data || checkup;
        
        // 기존 ConcernSelection 구조: { type: 'checkup', id, name, date, location, status, abnormalCount, warningCount }
        const statusCounts = analyzeCheckupStatus(checkupData);
        const date = checkup.CheckUpDate || checkup.checkup_date || checkupData.CheckUpDate || '';
        const location = checkup.Location || checkup.location || checkupData.Location || '국민건강보험공단';
        
        // status 계산 (기존 ConcernSelection 로직과 동일)
        let status: 'warning' | 'abnormal' | undefined = undefined;
        if (statusCounts.abnormal > 0) {
          status = 'abnormal';
        } else if (statusCounts.warning > 0) {
          status = 'warning';
        }
        
        const checkupConcern = {
          type: 'checkup',
          id: recordId, // option.id와 동일 (예: "checkup-0")
          name: '건강검진',
          date: date,
          location: location,
          status: status,
          abnormalCount: statusCounts.abnormal,
          warningCount: statusCounts.warning
        };
        console.log('🔍 [ChatInterface] 검진 데이터 변환:', checkupConcern);
        selectedConcerns.push(checkupConcern);
      }
    });
    
    // 모델 호출 (onNext에 surveyResponses 전달)
    console.log('🔍 [ChatInterface] 최종 selectedConcerns:', JSON.stringify(selectedConcerns, null, 2));
    onNext(selectedItems, selectedConcerns, surveyResponses);
  };

  // 현재 메시지의 옵션 가져오기 (showOptions가 true일 때만)
  const currentOptions = useMemo(() => {
    if (!showOptions) return [];
    const lastMessage = state.messages[state.messages.length - 1];
    return lastMessage?.options || [];
  }, [state.messages, showOptions]);

  // 스크롤 자동 이동 (메시지, 옵션, 카드, 스피너 변경 시) - 버튼 영역까지 포함
  useEffect(() => {
    const scrollToBottom = () => {
      // DOM 업데이트 후 스크롤 (더 긴 딜레이로 부드럽게)
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (bodyRef.current) {
            // 스크롤 컨테이너를 직접 스크롤 (버튼 영역까지 포함)
            bodyRef.current.scrollTo({
              top: bodyRef.current.scrollHeight,
              behavior: 'smooth'
            });
          } else if (messagesEndRef.current) {
            // 폴백: messagesEndRef 사용
            messagesEndRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'end',
              inline: 'nearest'
            });
          }
        }, 200); // 딜레이 증가로 더 부드럽게
      });
    };
    
    scrollToBottom();
  }, [
    state.messages, 
    showOptions, 
    isOptionsVisible, 
    isThinking, 
    isThinkingForOptions, 
    thinkingText,
    currentOptions.length, // 카드 개수 변경 시
    showActionButtons // 버튼 표시 시
  ]);

  return (
    <div className="chat-interface">
      <HealthTrendsHeader
        onBack={handleBack}
        title="검진 항목 설계"
        description={`기존 검진/처방 이력중 설계에서\n유의 하게 보실게 있으면 선택해주세요`}
        headerType="large"
      />
      
      <div className="chat-interface__body" ref={bodyRef}>
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
            >
              {/* 카드 슬라이더 */}
              <div
                className={`chat-interface__options-slider ${
                  currentOptions.length === 0 
                    ? 'chat-interface__options-slider--empty'
                    : currentOptions.length === 1
                    ? 'chat-interface__options-slider--single'
                    : 'chat-interface__options-slider--multiple'
                }`}
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
                    const abnormalCount = option.data.abnormalCount || 0;
                    const warningCount = option.data.warningCount || 0;
                    return (
                      <CheckupCard
                        key={option.id}
                        id={option.id}
                        year={checkup.year || checkup.Year || '2023'}
                        date={checkup.CheckUpDate || checkup.checkup_date || ''}
                        location={checkup.Location || checkup.location || '국민건강보험공단'}
                        abnormalCount={abnormalCount}
                        warningCount={warningCount}
                        onClick={() => handleOptionClick(option)}
                        selected={state.selectedCheckupRecords.includes(option.id)}
                        animationDelay={index * 200} // 카드 하나씩 순차적으로 나타나게 (200ms 간격)
                        checkup={checkup}
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
              </div>
              
              {/* 버튼 영역 - 슬라이더 섹션 내부 하단에 배치 */}
              {showOptions && currentOptions.length > 0 && showActionButtons && (
                <div className="chat-interface__progress-actions chat-interface__progress-actions--visible">
                  <div className="chat-interface__progress-actions-right">
                    <button
                      className="chat-interface__button chat-interface__button--primary chat-interface__button--small"
                      onClick={() => {
                        // 다음 버튼 클릭 처리
                        if (state.currentStep === 'prescription_analysis') {
                          moveToNextStep();
                        } else if (state.currentStep === 'checkup_selection') {
                          // 완료 처리
                          handleComplete();
                        }
                      }}
                    >
                      다음
                    </button>
                    <button
                      className="chat-interface__button chat-interface__button--secondary chat-interface__button--small"
                      onClick={() => {
                        // 건너뛰기 버튼 클릭 처리 (기존 handleSkip 기능)
                        handleSkip();
                      }}
                    >
                      건너뛰기
                    </button>
                  </div>
                </div>
              )}
              
              {/* 닷 네비게이터 - 숨김 처리 (슬라이딩 기능은 유지) */}
              {/* {currentOptions.length > 1 && (
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
              )} */}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 진행 상태 표시 - body 밖으로 이동하여 플로팅 버튼과 분리 */}
      {state.currentStep !== 'complete' && (
        <div className="chat-interface__progress">
          <div className="chat-interface__progress-info">
            {state.currentStep === 'prescription_analysis' && '1/2 단계: 처방 이력 선택'}
            {state.currentStep === 'checkup_selection' && '2/2 단계: 검진 기록 선택'}
          </div>
        </div>
      )}
      
      {/* 문진 패널 */}
      <CheckupDesignSurveyPanel
        isOpen={showSurveyPanel}
        onClose={() => setShowSurveyPanel(false)}
        onSubmit={handleSurveySubmit}
        selectedCount={state.selectedPrescriptionEffects.length + state.selectedCheckupRecords.length}
      />
    </div>
  );
};

export default ChatInterface;

