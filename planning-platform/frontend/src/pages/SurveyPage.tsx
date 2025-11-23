import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DynamicSurvey from '../components/DynamicSurvey';
import { Survey, SurveyResponse, SurveySubmitRequest } from '../types/survey';
import surveyService from '../services/surveyService';

const SurveyPage: React.FC = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSurvey = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!surveyId) {
        throw new Error('설문조사 ID가 필요합니다.');
      }

      const surveyData = await surveyService.getSurvey(surveyId);
      setSurvey(surveyData);
    } catch (err) {
      console.error('설문조사 로드 실패:', err);
      setError('설문조사를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (!surveyId) {
      setError('설문조사 ID가 없습니다.');
      setLoading(false);
      return;
    }

    loadSurvey();
  }, [surveyId, loadSurvey]);

  const handleSave = async (response: SurveyResponse) => {
    try {
      const request: SurveySubmitRequest = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId
      };
      
      await surveyService.saveSurveyResponse(request);
      console.log('설문조사 중간저장 완료');
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
      
      // 설문조사 종류별 완료 후 이동 경로
      switch (surveyId) {
        case 'checkup-design':
          navigate('/checkup-recommendations', { state: { surveyResponse: response } });
          break;
        case 'health-habits':
          navigate('/habits-plan', { state: { surveyResponse: response } });
          break;
        case 'disease-prediction':
          navigate('/prediction-results', { state: { surveyResponse: response } });
          break;
        default:
          navigate('/survey-complete', { state: { surveyResponse: response } });
          break;
      }
    } catch (error) {
      console.error('설문조사 제출 실패:', error);
      // 에러가 발생해도 완료 페이지로 이동
      navigate('/survey-complete', { state: { surveyResponse: response } });
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="question__content">
        <div className="question__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p>설문조사를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <>
        {/* 뒤로가기 버튼 */}
        <div className="back-button-container">
          <button className="back-button" onClick={handleBack}>
            ←
          </button>
        </div>
        
        <div className="question__content">
          <div className="question__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ marginBottom: '20px', color: '#e74c3c' }}>{error || '설문조사를 불러올 수 없습니다.'}</p>
            <button 
              onClick={() => navigate('/')}
              style={{
                background: 'transparent',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              메인으로 돌아가기
            </button>
          </div>
        </div>
      </>
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

export default SurveyPage;
