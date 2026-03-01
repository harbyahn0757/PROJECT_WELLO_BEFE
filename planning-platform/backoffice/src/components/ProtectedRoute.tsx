import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const EMBED_ALLOWED_PATHS = ['/backoffice/embedding', '/backoffice', '/backoffice/survey'];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // iframe 임베드: api_key 우회는 embedding·survey 경로에서 허용
  const params = new URLSearchParams(window.location.search);
  const apiKey = params.get('api_key');
  const isEmbedAllowed = !!apiKey && apiKey.length > 0
    && EMBED_ALLOWED_PATHS.includes(location.pathname);
  if (isEmbedAllowed || isAuthenticated) return <>{children}</>;

  return <Navigate to="/backoffice/login" replace />;
};

export default ProtectedRoute;
