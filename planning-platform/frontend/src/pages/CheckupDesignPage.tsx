import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DynamicSurvey from '../components/DynamicSurvey';
import { Survey, SurveyResponse, SurveySubmitRequest } from '../types/survey';
import surveyService from '../services/surveyService';

const CheckupDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSurvey = async () => {
      try {
        setLoading(true);
        const surveyData = await surveyService.getSurvey('checkup-design');
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
      
      // 완료 후 검진 항목 추천 페이지로 이동 (URL 파라미터 유지)
      const queryString = location.search;
      navigate(`/checkup-recommendations${queryString}`, { state: { surveyResponse: response } });
    } catch (error) {
      console.error('설문조사 제출 실패:', error);
    }
  };

  const handleBack = () => {
    // URL 파라미터 유지하여 메인 페이지로 이동
    const queryString = location.search;
    navigate(`/${queryString}`);
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
              <button onClick={handleBack} className="question__footer-button">
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

export default CheckupDesignPage;
