import React from 'react';
import { HealthDataViewer } from '../../components/health/HealthDataViewer';
import { useNavigate, useLocation } from 'react-router-dom';
import { STORAGE_KEYS, StorageManager } from '../../constants/storage';

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
      // 하위 호환: 레거시 키도 확인
      const savedUuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || localStorage.getItem('tilko_patient_uuid');
      const savedHospital = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || localStorage.getItem('tilko_hospital_id');
      
      // 레거시 키에서 읽었으면 새 키로 마이그레이션
      if (savedUuid && !StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
        StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, savedUuid);
      }
      if (savedHospital && !StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID)) {
        StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, savedHospital);
      }
      
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
