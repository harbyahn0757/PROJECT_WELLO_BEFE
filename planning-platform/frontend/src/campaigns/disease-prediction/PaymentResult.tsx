import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './styles/landing.scss';

const PaymentResult: React.FC = () => {
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);

  const status = query.get('status'); // 'success' or 'fail'
  const message = query.get('message') || '';
  const oid = query.get('oid') || '';

  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 결제 성공 시 페이지 뷰 추적 등을 수행할 수 있습니다.
  }, [status]);

  const handleSendEmail = async () => {
    if (!email || !email.includes('@')) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/campaigns/disease-prediction/update-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oid, email }),
      });

      const data = await response.json();
      if (data.success) {
        setIsSent(true);
        alert('리포트 발송 요청이 완료되었습니다.');
      } else {
        alert('오류가 발생했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('Email update failed:', error);
      alert('서버 통신 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dp-landing">
      <header className="dp-header">
        <div className="logo">쏙(Xog)</div>
        <h1 className="title">결제 결과</h1>
      </header>

      <main className="dp-content">
        <section className="result-section">
          {status === 'success' ? (
            <div className="result-card success">
              <div className="icon">✅</div>
              <h2>결제가 완료되었습니다!</h2>
              <p className="description">
                AI 질병예측 분석을 시작합니다.<br />
                {isSent ? (
                  <strong style={{ color: '#2ecc71' }}>{email}로 리포트 발송을 요청했습니다.</strong>
                ) : (
                  '분석 리포트(PDF)를 받으실 이메일을 확인해 주세요.'
                )}
              </p>

              {!isSent && (
                <div className="email-collection">
                  <p className="hint">리포트를 받으실 이메일 주소를 입력해 주세요.</p>
                  <div className="email-input-group">
                    <input 
                      type="email" 
                      placeholder="example@email.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                    <button onClick={handleSendEmail} disabled={loading || !email}>
                      {loading ? '처리 중...' : '리포트 받기'}
                    </button>
                  </div>
                </div>
              )}

              <div className="order-info">
                <div className="info-item">
                  <span className="label">주문번호</span>
                  <span className="value">{oid}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="result-card fail">
              <div className="icon">❌</div>
              <h2>결제에 실패했습니다.</h2>
              <p className="description">{message || '알 수 없는 이유로 결제가 중단되었습니다.'}</p>
              <button 
                className="retry-button" 
                onClick={() => window.location.href = window.location.pathname}
              >
                다시 시도하기
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="dp-footer">
        <button className="home-button" onClick={() => window.close()}>
          닫기
        </button>
      </footer>
    </div>
  );
};

export default PaymentResult;
