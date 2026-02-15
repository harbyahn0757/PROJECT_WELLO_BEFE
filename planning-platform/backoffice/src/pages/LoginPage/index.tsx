import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './styles.scss';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();
    if (!trimmedUser || !trimmedPass) {
      setError('아이디와 비밀번호를 입력하세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(trimmedUser, trimmedPass);
      navigate('/backoffice/dashboard');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('서버에 연결할 수 없습니다. 네트워크를 확인하세요.');
      } else {
        setError(msg || '아이디 또는 비밀번호를 확인하세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-page__card" onSubmit={handleSubmit}>
        <h1 className="login-page__title">WELNO Partner Office</h1>
        <p className="login-page__subtitle">파트너오피스에 로그인하세요</p>

        {error && <div className="login-page__error">{error}</div>}

        <label className="login-page__label">
          아이디
          <input
            className="login-page__input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoFocus
            required
          />
        </label>

        <label className="login-page__label">
          비밀번호
          <input
            className="login-page__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            required
          />
        </label>

        <button className="login-page__btn" type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
