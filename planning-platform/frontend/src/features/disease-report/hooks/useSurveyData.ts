import { useState, useEffect, useCallback } from 'react';
import { SurveyData, BirthDate, ProgressInfo, QuestionInfo } from '../types';

export const useSurveyData = (questions: QuestionInfo[] = []) => {
  // 동적 질문 배열을 받음 (기본값: 빈 배열)
  const [currentQuestion, setCurrentQuestion] = useState<number>(1);
  const [surveyData, setSurveyData] = useState<Record<string, any>>({});
  const [isRestoring, setIsRestoring] = useState(false); // 데이터 복원 중 플래그
  const [hasRestoredData, setHasRestoredData] = useState(false); // 데이터 복원 완료 플래그

  // 질문이 변경되면 현재 질문 리셋 (복원 중이거나 복원된 데이터가 있으면 리셋하지 않음)
  useEffect(() => {
    if (questions.length > 0 && !isRestoring && !hasRestoredData) {
      setCurrentQuestion(1);
      setSurveyData({});
    }
  }, [questions.length, isRestoring, hasRestoredData]); // 질문 배열이 변경되면 리셋 (복원 중이거나 복원된 데이터가 있으면 리셋하지 않음)

  // 총 단계 수 (동적)
  const totalSteps = questions.length > 0 ? questions.length : 5; // 기본값 5 (하위 호환성)

  // 진행 상태 계산 (동적)
  const getProgressInfo = (): ProgressInfo => {
    let currentStep: number;
    
    if (currentQuestion >= 1 && currentQuestion <= totalSteps) {
      currentStep = currentQuestion;
    } else if (currentQuestion > totalSteps) {
      currentStep = totalSteps; // 완료
    } else {
      currentStep = 1; // 기본값
    }
    
    const percentage = Math.min(Math.round((currentStep / totalSteps) * 100), 100);
    const stepText = currentQuestion > totalSteps ? '신청 완료' : `단계 ${currentStep}/${totalSteps}`;
    
    return {
      currentStep,
      totalSteps,
      percentage,
      stepText,
    };
  };

  // 현재 질문이 답변되었는지 확인 (동적)
  const isCurrentQuestionAnswered = (): boolean => {
    if (questions.length === 0 || currentQuestion > questions.length) {
      // 질문이 없거나 완료 상태면 true 반환
        return true;
    }
    
    const question = questions[currentQuestion - 1];
    if (!question) return false;
    
    const answer = surveyData[question.name];
    
    if (question.type === 'checkbox') {
      return Array.isArray(answer) && answer.length > 0;
    } else if (question.type === 'birthdate') {
      const birthDate = answer as BirthDate | undefined;
      return Boolean(birthDate?.year && birthDate?.month && birthDate?.day);
    }
    
    return Boolean(answer);
  };

  // 생년월일 업데이트 (useCallback으로 메모이제이션하여 무한 루프 방지)
  const updateBirthDate = useCallback((birthDate: BirthDate) => {
    setSurveyData(prev => ({
      ...prev,
      birthDate,
    }));
  }, []);

  // 라디오 답변 업데이트 (동적)
  const updateRadioAnswer = (questionName: string, value: string) => {
    setSurveyData(prev => ({
      ...prev,
      [questionName]: value,
    }));
  };

  // 체크박스 답변 업데이트 (동적)
  const updateCheckboxAnswer = (questionName: string, value: string, checked: boolean) => {
    setSurveyData(prev => {
      const currentValues = (prev[questionName] as string[]) || [];
      
      if (value === 'none') {
        // "없음" 선택 시 다른 모든 값 제거
        return {
          ...prev,
          [questionName]: checked ? ['none'] : [],
        };
      } else {
        // 일반 옵션 선택
        let newValues: string[];
        
        if (checked) {
          // "없음"이 있으면 제거하고 새 값 추가
          newValues = currentValues.filter(v => v !== 'none');
          if (!newValues.includes(value)) {
            newValues.push(value);
          }
        } else {
          // 값 제거
          newValues = currentValues.filter(v => v !== value);
        }
        
        return {
          ...prev,
          [questionName]: newValues,
        };
      }
    });
  };

  // 다음 질문으로 이동
  const goToNextQuestion = () => {
    console.log('➡️ [질문 이동] 다음 질문으로 이동:', {
      currentQuestion,
      totalSteps,
      nextQuestion: currentQuestion + 1,
      willComplete: currentQuestion + 1 > totalSteps
    });
    if (currentQuestion <= totalSteps) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      console.log('✅ [질문 이동] 질문 변경 완료:', {
        from: currentQuestion,
        to: nextQuestion,
        isCompleted: nextQuestion > totalSteps
      });
    } else {
      console.log('⏳ [질문 이동] 이미 마지막 질문 - 이동하지 않음');
    }
  };

  // 이전 질문으로 이동
  const goToPreviousQuestion = () => {
    console.log('⬅️ [질문 이동] 이전 질문으로 이동:', {
      currentQuestion,
      totalSteps
    });
    if (currentQuestion > 1 && currentQuestion <= totalSteps) {
      const prevQuestion = currentQuestion - 1;
      setCurrentQuestion(prevQuestion);
      console.log('✅ [질문 이동] 이전 질문으로 이동 완료:', {
        from: currentQuestion,
        to: prevQuestion
      });
    } else if (currentQuestion > totalSteps) {
      console.log('🔄 [질문 이동] 완료 화면에서 마지막 질문으로 이동');
      setCurrentQuestion(totalSteps); // 완료 화면에서 이전으로 가면 마지막 질문으로
    } else {
      console.log('⏳ [질문 이동] 이미 첫 번째 질문 - 이동하지 않음');
    }
  };

  // 특정 질문으로 이동
  const goToQuestion = (questionNumber: number) => {
    setCurrentQuestion(questionNumber);
  };

  // 설문 완료 여부
  const isCompleted = currentQuestion > totalSteps;

  // 버튼 텍스트 결정
  const getButtonText = (): string => {
    if (currentQuestion <= totalSteps) {
      return '다음';
    } else {
      return '확인';
    }
  };

  // 버튼 활성화 상태
  const isButtonEnabled = (): boolean => {
    if (isCompleted) {
      return true;
    }
    return isCurrentQuestionAnswered();
  };

  // 이전 버튼 표시 여부
  const canGoPrevious = (): boolean => {
    return currentQuestion > 1 && currentQuestion <= totalSteps;
  };

  // 다음 버튼 표시 여부 (현재 질문이 답변되었을 때만)
  const canGoNext = (): boolean => {
    if (currentQuestion >= 1 && currentQuestion < totalSteps) {
      return isCurrentQuestionAnswered();
    }
    return false;
  };

  // 저장된 데이터 복원 함수
  const restoreSurveyData = useCallback((savedData: Record<string, any>) => {
    // 질문이 없으면 복원하지 않음
    if (questions.length === 0) {
      return;
    }
    
    // 복원 시작 플래그 설정 (먼저 설정하여 리셋 방지)
    setIsRestoring(true);
    
    // 저장된 데이터를 surveyData에 복원
    // 질문 이름과 매칭되는 데이터만 복원
    const matchedData: Record<string, any> = {};
    questions.forEach(question => {
      if (savedData[question.name] !== undefined) {
        matchedData[question.name] = savedData[question.name];
      }
    });
    
    // birthDate는 별도 처리 (객체 형태)
    if (savedData.birthDate) {
      matchedData.birthDate = savedData.birthDate;
    }
    
    setSurveyData(matchedData);
    
    // 복원 완료 플래그 설정 (리셋 방지)
    setHasRestoredData(true);
    
    // 마지막으로 답변한 질문 찾기
    let lastAnsweredQuestion = 0;
    questions.forEach((question, index) => {
      const answer = savedData[question.name];
      if (answer !== undefined && answer !== null) {
        if (question.type === 'checkbox') {
          if (Array.isArray(answer) && answer.length > 0) {
            lastAnsweredQuestion = index + 1;
          }
        } else if (question.type === 'birthdate') {
          const birthDate = answer as BirthDate | undefined;
          if (birthDate?.year && birthDate?.month && birthDate?.day) {
            lastAnsweredQuestion = index + 1;
          }
        } else {
          // 라디오 버튼 등
          if (answer !== '' && answer !== null) {
            lastAnsweredQuestion = index + 1;
          }
        }
      }
    });
    
    // 복원 시 항상 첫 번째 질문부터 표시 (답변이 체크되어 있음)
    // 사용자가 답변을 확인할 수 있도록 완료 화면으로 이동하지 않음
    setCurrentQuestion(1);
    
    // 복원 완료 플래그 해제 (약간의 지연 후 - 리셋 방지를 위해 충분한 시간 확보)
    setTimeout(() => {
      setIsRestoring(false);
    }, 500); // 100ms → 500ms로 증가하여 리셋 방지
  }, [questions]);

  return {
    currentQuestion,
    surveyData,
    progressInfo: getProgressInfo(),
    isCurrentQuestionAnswered: isCurrentQuestionAnswered(),
    isCompleted,
    buttonText: getButtonText(),
    isButtonEnabled: isButtonEnabled(),
    canGoPrevious: canGoPrevious(),
    canGoNext: canGoNext(),
    
    // Actions
    updateBirthDate,
    updateRadioAnswer,
    updateCheckboxAnswer,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
    setCurrentQuestion,
    restoreSurveyData, // 저장된 데이터 복원 함수 추가
  };
}; 