import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // iframe 임베드: api_key가 있으면 인증 없이 통과 (데모 모드)
  const hasApiKey = new URLSearchParams(window.location.search).has('api_key');
  if (hasApiKey || isAuthenticated) return <>{children}</>;

  return <Navigate to="/backoffice/login" replace />;
};

export default ProtectedRoute;
