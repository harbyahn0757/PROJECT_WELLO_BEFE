import React, { useState, useCallback } from 'react';
import DynamicSurvey from '../../components/DynamicSurvey';
import { Survey, SurveyResponse } from '../../types/survey';
import surveyService from '../../services/surveyService';
import apiConfig from '../../config/api';

type Phase = 'verify' | 'survey' | 'complete' | 'error';

const AgentSurveyPage: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('verify');
  const [birthDate, setBirthDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerUuid, setCustomerUuid] = useState('');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  const handleVerify = useCallback(async () => {
    if (!token) {
      setErrorMsg('유효하지 않은 링크입니다.');
      setPhase('error');
      return;
    }
    if (!birthDate || birthDate.length < 8) {
      setErrorMsg('생년월일을 정확히 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const resp = await fetch(`${baseUrl}/api/v1/agent-survey/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, birth_date: birthDate }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setErrorMsg(data.detail || data.message || '인증에 실패했습니다.');
        setLoading(false);
        return;
      }

      setCustomerName(data.data.name || '');
      setCustomerUuid(data.data.uuid || '');

      // 설문 구조 로드
      const surveyData = await surveyService.getSurvey('agent-health-survey');
      setSurvey(surveyData);
      setPhase('survey');
    } catch (e: any) {
      setErrorMsg(e.message || '서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, birthDate]);

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
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 16,
    border: '1px solid #ddd', borderRadius: 8,
    boxSizing: 'border-box', textAlign: 'center',
    letterSpacing: 4,
  };
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '16px', fontSize: 16, fontWeight: 600,
    border: 'none', borderRadius: 12, cursor: 'pointer',
    backgroundColor: '#C4A882', color: '#fff', marginTop: 20,
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

  if (phase === 'verify') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 40, paddingTop: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#333', marginBottom: 8 }}>
            건강 설문
          </h2>
          <p style={{ fontSize: 14, color: '#999' }}>
            본인 확인을 위해 생년월일을 입력해주세요.
          </p>
        </div>

        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
            생년월일 (8자리)
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="19900101"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            style={inputStyle}
          />
          {errorMsg && (
            <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 8 }}>{errorMsg}</p>
          )}
          <button
            onClick={handleVerify}
            disabled={loading || birthDate.length < 8}
            style={{
              ...btnStyle,
              opacity: loading || birthDate.length < 8 ? 0.5 : 1,
            }}
          >
            {loading ? '확인 중...' : '확인'}
          </button>
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
