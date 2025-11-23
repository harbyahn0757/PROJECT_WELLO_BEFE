import { 
  Survey, 
  SurveyApiResponse, 
  SurveySubmitRequest, 
  SurveySubmitResponse,
  SurveyResponse 
} from '../types/survey';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class SurveyService {
  // 설문조사 구조 가져오기
  async getSurvey(surveyId: string): Promise<Survey> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SurveyApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '설문조사를 불러오는데 실패했습니다.');
      }
      
      return data.data;
    } catch (error) {
      console.error('설문조사 불러오기 오류:', error);
      
      // 백엔드가 없을 때 목업 데이터 반환
      return this.getMockSurvey(surveyId);
    }
  }

  // 설문조사 답변 저장 (중간저장)
  async saveSurveyResponse(request: SurveySubmitRequest): Promise<SurveySubmitResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/surveys/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SurveySubmitResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '설문조사 저장에 실패했습니다.');
      }
      
      return data;
    } catch (error) {
      console.error('설문조사 저장 오류:', error);
      
      // 백엔드가 없을 때 목업 응답 반환
      return {
        success: true,
        data: {
          sessionId: request.sessionId,
          isCompleted: false
        }
      };
    }
  }

  // 설문조사 완료 제출
  async submitSurvey(request: SurveySubmitRequest): Promise<SurveySubmitResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/surveys/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, isComplete: true }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SurveySubmitResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '설문조사 제출에 실패했습니다.');
      }
      
      return data;
    } catch (error) {
      console.error('설문조사 제출 오류:', error);
      
      // 백엔드가 없을 때 목업 응답 반환
      return {
        success: true,
        data: {
          sessionId: request.sessionId,
          isCompleted: true
        }
      };
    }
  }

  // 저장된 설문조사 응답 불러오기
  async getSurveyResponse(surveyId: string, sessionId: string): Promise<SurveyResponse | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}/responses/${sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // 저장된 응답이 없음
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('설문조사 응답 불러오기 오류:', error);
      return null;
    }
  }

  // 목업 데이터 (백엔드 구현 전까지 사용)
  private getMockSurvey(surveyId: string): Survey {
    switch (surveyId) {
      case 'health-questionnaire':
        return {
          id: 'health-questionnaire',
          title: '건강 설문조사',
          description: '귀하의 건강 상태를 파악하기 위한 설문조사입니다',
          pages: [
            {
              id: 'family-history',
              title: '첫번째, 일반정보 중 가족력',
              subtitle: '부모님, 형제, 자매 중에 다음 질환을 앓으셨거나 사망한 경우가 있으신가요?',
              sections: [
                {
                  id: 'family-history-section',
                  title: '',
                  subtitle: '아래 중 해당되는 경우 모두 선택',
                  questions: [
                    {
                      id: 'familyHistory',
                      title: '가족력',
                      type: 'checkbox',
                      required: true,
                      options: [
                        { id: 'familyCerebralHistory', label: '뇌졸중', value: 'familyCerebralHistory' },
                        { id: 'familyHeartDiseaseHistory', label: '심근경색/협심증', value: 'familyHeartDiseaseHistory' },
                        { id: 'familyHypertensionHistory', label: '고혈압', value: 'familyHypertensionHistory' },
                        { id: 'familyDiabetesHistory', label: '당뇨병', value: 'familyDiabetesHistory' },
                        { id: 'familyCancerHistory', label: '암', value: 'familyCancerHistory' },
                        { id: 'none', label: '해당없음', value: 'none', isNone: true }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'personal-history',
              title: '두번째, 일반정보 중 과거력',
              subtitle: '회원님께서는 과거에 다음 질환을 앓으셨거나 현재 앓고 계신 질환이 있으신가요?',
              sections: [
                {
                  id: 'personal-history-section',
                  title: '',
                  subtitle: '아래 중 해당되는 경우 모두 선택',
                  questions: [
                    {
                      id: 'personalHistory',
                      title: '과거력',
                      type: 'checkbox',
                      required: true,
                      options: [
                        { id: 'personalCerebralHistory', label: '뇌졸중', value: 'personalCerebralHistory' },
                        { id: 'personalHeartDiseaseHistory', label: '심근경색/협심증', value: 'personalHeartDiseaseHistory' },
                        { id: 'personalHypertensionHistory', label: '고혈압', value: 'personalHypertensionHistory' },
                        { id: 'personalDiabetesHistory', label: '당뇨병', value: 'personalDiabetesHistory' },
                        { id: 'personalCancerHistory', label: '암', value: 'personalCancerHistory' },
                        { id: 'none', label: '해당없음', value: 'none', isNone: true }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'smoking-habits',
              title: '세번째, 생활습관 중 흡연',
              subtitle: '현재 흡연을 하고 계신가요?',
              sections: [
                {
                  id: 'smoking-section',
                  title: '',
                  subtitle: '선택해주세요',
                  questions: [
                    {
                      id: 'livingHabits_smokingYN',
                      title: '흡연 여부',
                      type: 'radio',
                      required: true,
                      options: [
                        { id: 'smoking_1', label: '흡연', value: '1' },
                        { id: 'smoking_2', label: '금연', value: '2' },
                        { id: 'smoking_0', label: '비흡연', value: '0' }
                      ]
                    },
                    {
                      id: 'livingHabits_smokingTotalPeriod',
                      title: '흡연 기간 (년)',
                      type: 'input',
                      inputType: 'number',
                      showIf: { questionId: 'livingHabits_smokingYN', value: '1' }
                    },
                    {
                      id: 'livingHabits_smokingAveragePerWeek',
                      title: '주당 흡연량 (개비)',
                      type: 'input',
                      inputType: 'number',
                      showIf: { questionId: 'livingHabits_smokingYN', value: '1' }
                    }
                  ]
                }
              ]
            }
          ],
          settings: {
            allowBack: true,
            autoSave: true,
            showProgress: true
          }
        };

      case 'checkup-design':
        return {
          id: 'checkup-design',
          title: '올해 검진 항목 설계',
          description: '맞춤형 검진 프로그램을 설계해보세요',
          pages: [
            {
              id: 'family-history',
              title: '가족력 정보',
              subtitle: '부모님, 형제, 자매 중에 다음 질환을 앓으셨거나 앓고 계신 분이 있나요?',
              sections: [
                {
                  id: 'family-history-section',
                  title: '',
                  subtitle: '해당되는 경우 모두 선택해주세요',
                  questions: [
                    {
                      id: 'family-history',
                      title: '가족력',
                      type: 'checkbox',
                      options: [
                        { id: 'cerebral', label: '뇌혈관질환 (뇌졸중, 뇌출혈 등)', value: 'cerebral' },
                        { id: 'heart', label: '심혈관질환 (심근경색, 협심증 등)', value: 'heart' },
                        { id: 'hypertension', label: '고혈압', value: 'hypertension' },
                        { id: 'diabetes', label: '당뇨병', value: 'diabetes' },
                        { id: 'cancer', label: '암 (모든 종류)', value: 'cancer' },
                        { id: 'none', label: '해당없음', value: 'none', isNone: true }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'recommendations',
              title: '맞춤 검진 추천',
              subtitle: '입력해주신 정보를 바탕으로 추천 검진 항목을 안내해드립니다',
              sections: [
                {
                  id: 'recommendation-result',
                  title: '추천 결과',
                  questions: []
                }
              ]
            }
          ],
          settings: {
            allowBack: true,
            autoSave: true,
            showProgress: true
          }
        };

      case 'health-habits':
        return {
          id: 'health-habits',
          title: '건강습관 설문조사',
          description: '검진 전 건강습관을 분석해보세요',
          pages: [
            {
              id: 'lifestyle-habits',
              title: '생활습관 정보',
              subtitle: '현재 생활습관에 대해 알려주세요',
              sections: [
                {
                  id: 'smoking-section',
                  title: '흡연',
                  questions: [
                    {
                      id: 'smoking-status',
                      title: '흡연 여부',
                      type: 'radio',
                      options: [
                        { id: 'never', label: '비흡연', value: 'never' },
                        { id: 'quit', label: '금연', value: 'quit' },
                        { id: 'current', label: '현재 흡연', value: 'current' }
                      ]
                    },
                    {
                      id: 'smoking-amount',
                      title: '일일 흡연량 (개비)',
                      type: 'input',
                      inputType: 'number',
                      showIf: { questionId: 'smoking-status', value: 'current' }
                    }
                  ]
                },
                {
                  id: 'drinking-section',
                  title: '음주',
                  questions: [
                    {
                      id: 'drinking-frequency',
                      title: '음주 빈도',
                      type: 'radio',
                      options: [
                        { id: 'never', label: '안 마심', value: 'never' },
                        { id: 'sometimes', label: '가끔', value: 'sometimes' },
                        { id: 'frequent', label: '자주', value: 'frequent' }
                      ]
                    }
                  ]
                },
                {
                  id: 'exercise-section',
                  title: '운동',
                  questions: [
                    {
                      id: 'exercise-frequency',
                      title: '운동 빈도',
                      type: 'radio',
                      options: [
                        { id: 'never', label: '안 함', value: 'never' },
                        { id: 'sometimes', label: '가끔', value: 'sometimes' },
                        { id: 'regular', label: '규칙적', value: 'regular' }
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          settings: {
            allowBack: true,
            autoSave: true,
            showProgress: true
          }
        };

      default:
        throw new Error(`Unknown survey ID: ${surveyId}`);
    }
  }
}

const surveyService = new SurveyService();
export default surveyService;
