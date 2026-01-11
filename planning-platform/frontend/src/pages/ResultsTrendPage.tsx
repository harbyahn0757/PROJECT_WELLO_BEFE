import React from 'react';
import { HealthDataViewer } from '../components/health/HealthDataViewer';
import { useNavigate } from 'react-router-dom';

const ResultsTrendPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: '#fdf6f0' }}>
      <HealthDataViewer 
        onBack={() => navigate(-1)}
      />
    </div>
  );
};

export default ResultsTrendPage;
