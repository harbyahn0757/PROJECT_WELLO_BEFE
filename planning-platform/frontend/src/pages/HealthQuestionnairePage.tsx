import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DynamicSurvey from '../components/DynamicSurvey';
import { Survey, SurveyResponse, SurveySubmitRequest } from '../types/survey';
import surveyService from '../services/surveyService';

const HealthQuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSurvey = async () => {
      try {
        setLoading(true);
        const surveyData = await surveyService.getSurvey('health-questionnaire');
        setSurvey(surveyData);
      } catch (err) {
        setError('설문조사를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, []);

  const handleSave = async (response: SurveyResponse) => {
    try {
      const request: SurveySubmitRequest = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId
      };
      
      await surveyService.saveSurveyResponse(request);
    } catch (error) {
      console.error('설문조사 저장 실패:', error);
    }
  };

  const handleComplete = async (response: SurveyResponse) => {
    try {
      const request: SurveySubmitRequest = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId,
        isComplete: true
      };
      
      await surveyService.submitSurvey(request);
      
      // 완료 후 결과 페이지로 이동
      navigate('/questionnaire-complete', { state: { surveyResponse: response } });
    } catch (error) {
      console.error('설문조사 제출 실패:', error);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="questionnaire-container">
        <div className="container bg_xog_yellow">
          <div className="wrapper login">
            <div style={{ textAlign: 'center', padding: '50px' }}>
              로딩 중...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="questionnaire-container">
        <div className="container bg_xog_yellow">
          <div className="wrapper login">
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <p>{error || '설문조사를 불러올 수 없습니다.'}</p>
              <button onClick={() => navigate('/')} className="question__footer-button">
                돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DynamicSurvey
      survey={survey}
      onSave={handleSave}
      onComplete={handleComplete}
      onBack={handleBack}
    />
  );
};

export default HealthQuestionnairePage;
