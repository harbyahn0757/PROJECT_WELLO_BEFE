import React from 'react';

interface SpinnerProps {
  message?: string;
  size?: number;
}

/** 공용 로딩 스피너 — 모든 페이지에서 사용 */
export const Spinner: React.FC<SpinnerProps> = ({ message = '로딩 중...', size = 28 }) => (
  <div className="spinner-wrap">
    <div className="spinner" style={{ width: size, height: size }} />
    {message && <div className="spinner-msg">{message}</div>}
  </div>
);
