import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import '../styles/_auth.scss';

const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => {
    // 1순위: location.state에서 from 정보 확인
    const from = (location.state as any)?.from;
    
    // 2순위: 현재 URL에서 원래 페이지 정보 추출 (UUID와 hospital이 있으면 메인 페이지로 이동)
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital');
    const layout = urlParams.get('layout');
    
    if (from) {
      console.log('↩️ [인증페이지] 이전 페이지로 이동:', from);
      const targetUrl = `${window.location.origin}/wello${from}`;
      window.location.href = targetUrl;
    } else if (uuid && hospital) {
      console.log('↩️ [인증페이지] UUID와 hospital로 메인 페이지로 이동');
      // React Router navigate 사용하여 basename 포함된 경로로 이동
      const queryString = `uuid=${uuid}&hospital=${hospital}${layout ? `&layout=${layout}` : ''}`;
      navigate(`/?${queryString}`);
    } else {
      console.log('↩️ [인증페이지] 메인 페이지로 이동');
      // React Router로 안전하게 메인 페이지로 이동
      navigate('/');
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