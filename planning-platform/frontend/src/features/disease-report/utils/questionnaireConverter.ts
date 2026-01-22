/**
 * 문진 템플릿 스키마 변환 유틸리티
 * 템플릿 스키마를 QuestionInfo 배열로 변환하여 기존 컴포넌트 재사용
 */

import { QuestionInfo, OptionItem } from '../types';

/**
 * 템플릿 스키마를 QuestionInfo 배열로 변환
 * 기존 QuestionCard 컴포넌트를 재사용하기 위한 변환
 * 
 * @param schema - 템플릿 스키마 (questionnaire_schema)
 * @param templateName - 템플릿 이름 (옵션)
 * @returns QuestionInfo 배열
 */
export const convertSchemaToQuestionInfo = (
  schema: any,
  templateName?: string
): QuestionInfo[] => {
  if (!schema || !schema.properties) {
    console.warn('[questionnaireConverter] 스키마 또는 properties가 없습니다.');
    return [];
  }
  
  const questions: QuestionInfo[] = [];
  const properties = schema.properties;
  const required = schema.required || [];
  
  // properties를 배열로 변환
  const questionEntries = Object.entries(properties);
  
  questionEntries.forEach(([key, config]: [string, any], index) => {
    // 질문 타입 결정
    let questionType: 'radio' | 'checkbox' | 'birthdate' = 'radio';
    
    // widget 타입 확인
    if (config.widget === 'checkbox') {
      questionType = 'checkbox';
    } else if (config.widget === 'radio') {
      questionType = 'radio';
    } else if (config.widget === 'dropdown') {
      questionType = 'radio'; // dropdown도 radio로 처리
    } else if (key.toLowerCase().includes('birth') || key.toLowerCase().includes('date')) {
      questionType = 'birthdate';
    } else if (config.type === 'array' && config.items) {
      // array 타입은 checkbox로 처리
      questionType = 'checkbox';
    } else if (config.enum && Array.isArray(config.enum) && config.enum.length > 0) {
      // enum이 있으면 radio로 처리 (기본값)
      questionType = 'radio';
    } else {
      // 기본값은 radio
      questionType = 'radio';
    }
    
    // 옵션 변환
    let options: OptionItem[] | undefined;
    
    // checkbox 타입인 경우 items.enum 확인
    if (questionType === 'checkbox' && config.items) {
      const items = config.items;
      if (items.enum && items.enumNames) {
        // items.enum과 items.enumNames가 모두 있는 경우
        options = items.enum.map((value: string, idx: number) => ({
          value,
          label: items.enumNames[idx] || value,
          id: `${key}_${value}`
        }));
      } else if (items.enum) {
        // items.enum만 있는 경우
        options = items.enum.map((value: string) => ({
          value,
          label: value,
          id: `${key}_${value}`
        }));
      }
    } else if (config.enum && config.enumNames) {
      // enum과 enumNames가 모두 있는 경우 (radio)
      options = config.enum.map((value: string, idx: number) => ({
        value,
        label: config.enumNames[idx] || value,
        id: `${key}_${value}`
      }));
    } else if (config.enum) {
      // enum만 있는 경우 (radio)
      options = config.enum.map((value: string) => ({
        value,
        label: value,
        id: `${key}_${value}`
      }));
    }
    
    // QuestionInfo 생성
    const question: QuestionInfo = {
      number: index + 1,
      title: config.title || key,
      subtitle: config.description,
      type: questionType,
      options: options,
      name: key  // 질문 ID (스키마의 key)
    };
    
    questions.push(question);
  });
  
  console.log(`[questionnaireConverter] ${questions.length}개의 질문으로 변환 완료`);
  
  return questions;
};

/**
 * 템플릿 데이터에서 QuestionInfo 배열 추출
 * API 응답에서 직접 사용 가능
 * 
 * @param templateData - 템플릿 데이터 (API 응답)
 * @returns QuestionInfo 배열
 */
export const extractQuestionsFromTemplate = (templateData: any): QuestionInfo[] => {
  if (!templateData) {
    return [];
  }
  
  // questionnaire_schema가 있는 경우
  if (templateData.questionnaire_schema) {
    return convertSchemaToQuestionInfo(
      templateData.questionnaire_schema,
      templateData.content_name
    );
  }
  
  // 이미 변환된 questions 배열이 있는 경우 (호환성)
  if (Array.isArray(templateData.questions)) {
    return templateData.questions.map((q: any, index: number) => ({
      number: index + 1,
      title: q.title || q.id,
      subtitle: q.description,
      type: (q.type === 'checkbox' ? 'checkbox' : q.type === 'birthdate' ? 'birthdate' : 'radio') as 'radio' | 'checkbox' | 'birthdate',
      options: q.options?.map((opt: any) => ({
        value: opt.value,
        label: opt.label,
        id: `${q.id || q.name}_${opt.value}`
      })),
      name: q.id || q.name
    }));
  }
  
  return [];
};

