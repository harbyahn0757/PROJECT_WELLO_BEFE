import React from 'react';
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
import './App.scss';

/** /backoffice 인덱스: api_key 있으면 embedding, 없으면 dashboard */
const BackofficeIndex: React.FC = () => {
  const [searchParams] = useSearchParams();
  const target = searchParams.has('api_key') ? 'embedding' : 'dashboard';
  return <Navigate to={`${target}?${searchParams.toString()}`} replace />;
};

const App: React.FC = () => {
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
