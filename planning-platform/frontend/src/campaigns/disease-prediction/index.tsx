import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import PaymentResult from './PaymentResult';

type PageType = 'landing' | 'result';

const DiseasePredictionCampaign: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('landing');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    if (page === 'result') {
      setCurrentPage('result');
    } else {
      setCurrentPage('landing');
    }
  }, []);

  useEffect(() => {
    document.title = 'Xog: 쏙 - AI 질병예측 리포트';
  }, []);

  if (currentPage === 'result') {
    return <PaymentResult />;
  }

  return <LandingPage />;
};

export default DiseasePredictionCampaign;
