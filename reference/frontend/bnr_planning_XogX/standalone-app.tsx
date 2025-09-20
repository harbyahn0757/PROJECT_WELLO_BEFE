import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BnrPlanningXogXCampaign } from './index';
import './styles/campaign.scss';

// 개발용 - MockupPage만 바로 보여주기 (mockup=true 파라미터 설정)
const StandaloneCampaignApp: React.FC = () => {
  useEffect(() => {
    // URL에 mockup=true 파라미터 추가
    const url = new URL(window.location.href);
    url.searchParams.set('mockup', 'true');
    if (window.location.href !== url.toString()) {
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  return (
    <div className="standalone-campaign-app">
      <BnrPlanningXogXCampaign />
    </div>
  );
};

// DOM에 렌더링
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <StandaloneCampaignApp />
  </React.StrictMode>
);

export default StandaloneCampaignApp; 