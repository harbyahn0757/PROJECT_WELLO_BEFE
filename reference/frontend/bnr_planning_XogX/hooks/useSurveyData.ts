import { useState, useEffect } from 'react';
import { SurveyData, BirthDate, ProgressInfo } from '../types';

export const useSurveyData = () => {
  const [currentQuestion, setCurrentQuestion] = useState<number>(-1); // -1: 생년월일, 0: 시작화면, 1-5: 질문들, 6+: 완료
  const [surveyData, setSurveyData] = useState<SurveyData>({});

  // 총 단계 수 (생년월일 + 질문 5개)
  const totalSteps = 6;

  // 진행 상태 계산
  const getProgressInfo = (): ProgressInfo => {
    let currentStep: number;
    
    if (currentQuestion === -1) {
      currentStep = 1; // 생년월일 = 1단계
    } else if (currentQuestion >= 1 && currentQuestion <= 5) {
      currentStep = currentQuestion + 1; // 질문1=2단계, 질문2=3단계, ..., 질문5=6단계
    } else if (currentQuestion > 5) {
      currentStep = 6; // 완료
    } else {
      currentStep = 1;
    }
    
    const percentage = Math.min(Math.round((currentStep / totalSteps) * 100), 100);
    const stepText = currentQuestion > 5 ? '신청 완료' : `단계 ${currentStep}/${totalSteps}`;
    
    return {
      currentStep,
      totalSteps,
      percentage,
      stepText,
    };
  };

  // 현재 질문이 답변되었는지 확인
  const isCurrentQuestionAnswered = (): boolean => {
    switch (currentQuestion) {
      case -1:
        return Boolean(
          surveyData.birthDate?.year && 
          surveyData.birthDate?.month && 
          surveyData.birthDate?.day
        );
      case 1:
        return Boolean(surveyData.smoking);
      case 2:
        return Boolean(surveyData.familyHistory && surveyData.familyHistory.length > 0);
      case 3:
        return Boolean(surveyData.currentDisease && surveyData.currentDisease.length > 0);
      case 4:
        return Boolean(surveyData.currentCancer && surveyData.currentCancer.length > 0);
      case 5:
        return Boolean(surveyData.drinking);
      default:
        return true;
    }
  };

  // 생년월일 업데이트
  const updateBirthDate = (birthDate: BirthDate) => {
    setSurveyData(prev => ({
      ...prev,
      birthDate,
    }));
  };

  // 라디오 답변 업데이트
  const updateRadioAnswer = (questionName: keyof SurveyData, value: string) => {
    setSurveyData(prev => ({
      ...prev,
      [questionName]: value,
    }));
  };

  // 체크박스 답변 업데이트
  const updateCheckboxAnswer = (questionName: keyof SurveyData, value: string, checked: boolean) => {
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
    if (currentQuestion === -1) {
      if (isCurrentQuestionAnswered()) {
        setCurrentQuestion(1);
      }
    } else if (currentQuestion === 0) {
      setCurrentQuestion(-1);
    } else if (currentQuestion <= 5) {
      if (isCurrentQuestionAnswered()) {
        setCurrentQuestion(prev => prev + 1);
      }
    }
  };

  // 특정 질문으로 이동
  const goToQuestion = (questionNumber: number) => {
    setCurrentQuestion(questionNumber);
  };

  // 설문 완료 여부
  const isCompleted = currentQuestion > 5;

  // 버튼 텍스트 결정
  const getButtonText = (): string => {
    if (currentQuestion === -1) {
      return '다음';
    } else if (currentQuestion === 0) {
      return '시작하기';
    } else if (currentQuestion <= 5) {
      return '다음';
    } else {
      return '확인';
    }
  };

  // 버튼 활성화 상태
  const isButtonEnabled = (): boolean => {
    if (currentQuestion === 0 || isCompleted) {
      return true;
    }
    return isCurrentQuestionAnswered();
  };

  return {
    currentQuestion,
    surveyData,
    progressInfo: getProgressInfo(),
    isCurrentQuestionAnswered: isCurrentQuestionAnswered(),
    isCompleted,
    buttonText: getButtonText(),
    isButtonEnabled: isButtonEnabled(),
    
    // Actions
    updateBirthDate,
    updateRadioAnswer,
    updateCheckboxAnswer,
    goToNextQuestion,
    goToQuestion,
    setCurrentQuestion,
  };
}; 