import React, { useState, useCallback, useEffect, useRef } from 'react';
import DynamicSurvey from '../../components/DynamicSurvey';
import { Survey, SurveyResponse } from '../../types/survey';
import surveyService from '../../services/surveyService';
import apiConfig from '../../config/api';

type Phase = 'loading' | 'survey' | 'complete' | 'error';

const AgentSurveyPage: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [customerName, setCustomerName] = useState('');
  const [customerUuid, setCustomerUuid] = useState('');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const didAutoVerify = useRef(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  // 페이지 로드 시 토큰으로 자동 인증 → 바로 설문 진입
  useEffect(() => {
    if (didAutoVerify.current) return;
    didAutoVerify.current = true;

    if (!token) {
      setErrorMsg('유효하지 않은 링크입니다.');
      setPhase('error');
      return;
    }

    const autoVerify = async () => {
      try {
        const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
        const resp = await fetch(`${baseUrl}/api/v1/agent-survey/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          setErrorMsg(data.detail || data.message || '인증에 실패했습니다.');
          setPhase('error');
          return;
        }

        setCustomerName(data.data.name || '');
        setCustomerUuid(data.data.uuid || '');

        const surveyData = await surveyService.getSurvey('agent-health-survey');
        setSurvey(surveyData);
        setPhase('survey');
      } catch (e: any) {
        setErrorMsg(e.message || '서버 오류가 발생했습니다.');
        setPhase('error');
      }
    };

    autoVerify();
  }, [token]);

  const handleComplete = useCallback(async (response: SurveyResponse) => {
    try {
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      await fetch(`${baseUrl}/api/v1/surveys/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: customerUuid,
          hospital_id: 'agent',
          partner_id: 'agent',
          survey_id: 'agent-health-survey',
          answers: response.answers,
        }),
      });
      setPhase('complete');
    } catch {
      setPhase('complete'); // 에러여도 완료 화면 표시
    }
  }, [customerUuid]);

  const handleSave = useCallback(async () => {
    // 중간 저장 — agent 설문은 생략
  }, []);

  // 스타일
  const containerStyle: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  };

  if (phase === 'error') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>!</p>
          <p style={{ fontSize: 18, color: '#333', marginBottom: 8 }}>{errorMsg}</p>
          <p style={{ fontSize: 14, color: '#999' }}>에이전트에게 새 링크를 요청해주세요.</p>
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>OK</p>
          <p style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8 }}>
            설문이 제출되었습니다
          </p>
          <p style={{ fontSize: 14, color: '#999' }}>
            담당자가 결과를 확인 후 안내드리겠습니다.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 18, color: '#333' }}>설문을 준비하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // phase === 'survey'
  if (!survey) return null;

  return (
    <DynamicSurvey
      survey={survey}
      onSave={handleSave}
      onComplete={handleComplete}
      onBack={() => {}} // 뒤로가기 비활성
    />
  );
};

export default AgentSurveyPage;
