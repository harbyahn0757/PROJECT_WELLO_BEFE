import React from 'react';
import { HealthDataViewer } from '../components/health/HealthDataViewer';
import { useNavigate, useLocation } from 'react-router-dom';

const ResultsTrendPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
    
    // URL 파라미터가 있으면 메인 페이지로 이동하면서 파라미터 유지
    if (uuid && hospital) {
      navigate(`/?uuid=${uuid}&hospital=${hospital}`);
    } else {
      // 파라미터가 없으면 localStorage에서 확인
      const savedUuid = localStorage.getItem('tilko_patient_uuid');
      const savedHospital = localStorage.getItem('tilko_hospital_id');
      
      if (savedUuid && savedHospital) {
        navigate(`/?uuid=${savedUuid}&hospital=${savedHospital}`);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: '#fdf6f0' }}>
      <HealthDataViewer 
        onBack={handleBack}
      />
    </div>
  );
};

export default ResultsTrendPage;
