import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import '../styles/_auth.scss';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // 1순위: location.state에서 from 정보 확인
    const from = (location.state as any)?.from;
    
    // 2순위: 현재 URL에서 원래 페이지 정보 추출 (UUID가 있으면 health-questionnaire로 이동)
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital');
    const layout = urlParams.get('layout');
    
    if (from) {
      console.log('↩️ [인증페이지] 이전 페이지로 이동:', from);
      const targetUrl = `${window.location.origin}${from}`;
      window.location.href = targetUrl;
    } else if (uuid) {
      console.log('↩️ [인증페이지] UUID로 원래 페이지 재구성');
      const originalUrl = `${window.location.origin}/#/health-questionnaire?uuid=${uuid}${hospital ? `&hospital=${hospital}` : ''}${layout ? `&layout=${layout}` : ''}`;
      window.location.href = originalUrl;
    } else {
      console.log('↩️ [인증페이지] 브라우저 히스토리 뒤로가기');
      window.history.back();
    }
  };

  return (
    <div className="questionnaire-container tilko-login">
      <div className="container bg_xog_yellow">
        <div className="wrapper login">
          <AuthForm onBack={handleBack} />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;