import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DynamicSurvey from '../../components/DynamicSurvey';
import { Survey, SurveyResponse, SurveySubmitRequest } from '../../types/survey';
import surveyService from '../../services/surveyService';

const HealthQuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSurvey = async () => {
      try {
        setLoading(true);
        // URL 파라미터에서 surveyId 추출 (기본값: health-questionnaire)
        const params = new URLSearchParams(location.search);
        const surveyId = params.get('survey_id') || params.get('surveyId') || 'health-questionnaire';
        
        const surveyData = await surveyService.getSurvey(surveyId);
        setSurvey(surveyData);
      } catch (err) {
        setError('설문조사를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [location.search]);

  const handleSave = async (response: SurveyResponse) => {
    try {
      const params = new URLSearchParams(location.search);
      const uuid = params.get('uuid');
      const hospitalId = params.get('hospital') || params.get('hospital_id') || params.get('hospitalId');

      const request: any = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId,
        uuid: uuid,
        hospital_id: hospitalId
      };
      
      await surveyService.saveSurveyResponse(request);
    } catch (error) {
      console.error('설문조사 저장 실패:', error);
    }
  };

  const handleComplete = async (response: SurveyResponse) => {
    try {
      const params = new URLSearchParams(location.search);
      const uuid = params.get('uuid');
      const hospitalId = params.get('hospital') || params.get('hospital_id') || params.get('hospitalId');

      const request: any = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId,
        isComplete: true,
        uuid: uuid,
        hospital_id: hospitalId
      };
      
      await surveyService.submitSurvey(request);
      
      // 완료 후 결과 페이지로 이동 (URL 파라미터 유지)
      const queryString = location.search;
      navigate(`/questionnaire-complete${queryString}`, { state: { surveyResponse: response } });
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

export default HealthQuestionnairePage;
