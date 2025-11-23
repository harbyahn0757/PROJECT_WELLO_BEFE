import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DynamicSurvey from '../components/DynamicSurvey';
import WelloModal from '../components/common/WelloModal';
import { Survey, SurveyResponse, SurveySubmitRequest } from '../types/survey';
import surveyService from '../services/surveyService';
import './CheckupDesignPage.scss';

const CheckupDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnderDevelopmentModal, setShowUnderDevelopmentModal] = useState(false);

  // 모달 상태 디버깅
  useEffect(() => {
    console.log('🔍 [검진설계] 모달 상태 변경:', showUnderDevelopmentModal);
  }, [showUnderDevelopmentModal]);

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
    console.log('✅ [검진설계] handleComplete 호출됨');
    // API가 미구현 상태이므로 바로 모달 표시
    console.log('✅ [검진설계] 모달 표시:', showUnderDevelopmentModal);
    setShowUnderDevelopmentModal(true);
    console.log('✅ [검진설계] 모달 상태 업데이트 완료');
    
    // 백그라운드에서 API 호출 시도 (실패해도 무시)
    try {
      const request: SurveySubmitRequest = {
        surveyId: response.surveyId,
        sessionId: response.sessionId,
        answers: response.answers,
        pageId: response.currentPageId,
        isComplete: true
      };
      
      await surveyService.submitSurvey(request);
      
      // 성공 시 모달 닫고 페이지 이동
      setShowUnderDevelopmentModal(false);
      const queryString = location.search;
      navigate(`/checkup-recommendations${queryString}`, { state: { surveyResponse: response } });
    } catch (error) {
      // 실패해도 이미 모달이 표시되어 있으므로 무시
      console.log('✅ [검진설계] API 실패 - 모달 유지');
    }
  };

  const handleModalConfirm = () => {
    setShowUnderDevelopmentModal(false);
    // 목업 검진 추천 페이지로 이동 (URL 파라미터 유지)
    const queryString = location.search;
    navigate(`/checkup-recommendations${queryString}`);
  };

  const handleModalCancel = () => {
    setShowUnderDevelopmentModal(false);
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
    <>
      <DynamicSurvey
        survey={survey}
        onSave={handleSave}
        onComplete={handleComplete}
        onBack={handleBack}
        hideNavigation={true}
      />
      
      {/* 미개발 안내 모달 */}
      <WelloModal
        isOpen={showUnderDevelopmentModal}
        onClose={handleModalCancel}
        showCloseButton={true}
        showWelloIcon={true}
        size="medium"
      >
        <div className="checkup-design-modal">
          <h2 className="checkup-design-modal__title">
            아직 미개발
          </h2>
          <p className="checkup-design-modal__description">
            검진 항목 설계 기능은<br />
            현재 개발 중입니다.<br />
            <br />
            목업 검진 추천 페이지로<br />
            이동하시겠습니까?
          </p>
          <div className="checkup-design-modal__actions">
            <button
              className="checkup-design-modal__btn checkup-design-modal__btn--cancel"
              onClick={handleModalCancel}
            >
              취소
            </button>
            <button
              className="checkup-design-modal__btn checkup-design-modal__btn--confirm"
              onClick={handleModalConfirm}
            >
              이동하기
            </button>
          </div>
        </div>
      </WelloModal>
    </>
  );
};

export default CheckupDesignPage;
