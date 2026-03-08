import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiConfig from '../../config/api';

type Phase = 'loading' | 'error';

const AgentSurveyPage: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const didAutoVerify = useRef(false);
  const navigate = useNavigate();

  const token = new URLSearchParams(window.location.search).get('token') || '';

  // 토큰 인증 → 질병예측 리포트 랜딩으로 리다이렉트
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

        // link_type에 따라 분기
        const linkType = data.data.link_type || 'landing';
        const params = new URLSearchParams();
        if (data.data.uuid) params.set('uuid', data.data.uuid);
        if (data.data.name) params.set('name', data.data.name);
        if (data.data.birth_date) params.set('birth', data.data.birth_date);

        if (linkType === 'survey') {
          // 설문 포함: 메인(/)으로 이동
          navigate(`/?${params.toString()}`, { replace: true });
        } else {
          // 기본(landing): 질병예측 리포트 랜딩
          navigate(`/campaigns/disease-prediction?${params.toString()}`, { replace: true });
        }
      } catch (e: any) {
        setErrorMsg(e.message || '서버 오류가 발생했습니다.');
        setPhase('error');
      }
    };

    autoVerify();
  }, [token, navigate]);

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

  // loading
  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ fontSize: 18, color: '#333' }}>페이지를 준비하고 있습니다...</p>
      </div>
    </div>
  );
};

export default AgentSurveyPage;
