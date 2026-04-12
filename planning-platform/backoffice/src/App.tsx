import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PartnerOfficeLayout from './layouts/PartnerOfficeLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmbeddingPage from './pages/EmbeddingPage';
import SurveyPage from './pages/SurveyPage';
import PatientPage from './pages/PatientPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RevisitPage from './pages/RevisitPage';
import CheckupDesignManagementPage from './pages/CheckupDesignManagementPage';
import ConsultationPage from './pages/ConsultationPage';
import HealthReportPage from './pages/HealthReportPage';
import './App.scss';

/** iframe/페이지 로드 시 웰노 로고 스피너 */
const BackofficeLoader: React.FC = () => {
  const [logoError, setLogoError] = useState(false);
  return (
    <div className="backoffice-loader">
      <div className="backoffice-loader__spinner" aria-hidden="true" />
      {!logoError ? (
        <img
          src={`${process.env.PUBLIC_URL}/welno_logo.png`}
          alt="WELNO"
          className="backoffice-loader__logo"
          onError={() => setLogoError(true)}
        />
      ) : (
        <span className="backoffice-loader__brand">WELNO</span>
      )}
      <p className="backoffice-loader__text">로딩 중...</p>
    </div>
  );
};

/** /backoffice 인덱스: api_key 있으면 embedding, 없으면 dashboard */
const BackofficeIndex: React.FC = () => {
  const [searchParams] = useSearchParams();
  const target = searchParams.has('api_key') ? 'embedding' : 'dashboard';
  return <Navigate to={`${target}?${searchParams.toString()}`} replace />;
};

const App: React.FC = () => {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setShowLoader(false));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  if (showLoader) return <BackofficeLoader />;

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 로그인 */}
          <Route path="/backoffice/login" element={<LoginPage />} />

          {/* 파트너오피스 (인증 필요 / api_key 있으면 데모 모드) */}
          <Route
            path="/backoffice"
            element={
              <ProtectedRoute>
                <PartnerOfficeLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<BackofficeIndex />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="patients" element={<PatientPage />} />
            <Route path="embedding" element={<EmbeddingPage />} />
            <Route path="survey" element={<SurveyPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="revisit" element={<RevisitPage />} />
            <Route path="checkup-design" element={<CheckupDesignManagementPage />} />
            <Route path="health-report" element={<HealthReportPage />} />
            {/* /consultation: CheckupDesignManagementPage로 통합됨 (2026-04-08). legacy 북마크 호환 redirect */}
            <Route path="consultation" element={<Navigate to="/backoffice/checkup-design" replace />} />
          </Route>

          {/* 기본 리다이렉트 */}
          <Route path="/" element={<Navigate to="/backoffice/login" replace />} />
          <Route path="*" element={<Navigate to="/backoffice/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
