import React from 'react';
import { useCampaignSkin } from './hooks/useCampaignSkin';

interface RevokePageProps {
  revokeInfo?: {
    reason: string;
    revoked_at: string;
    revoked_by: string;
  };
  customerName?: string;
}

export const RevokePage: React.FC<RevokePageProps> = ({ revokeInfo, customerName }) => {
  const { skinType } = useCampaignSkin();

  const formatRevokeDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`campaign-container skin-${skinType.toLowerCase()}`}>
      <div className="revoke-page">
        <div className="container">
          <div className="revoke-content">
            {/* 헤더 */}
            <div className="revoke-header">
              <div className="revoke-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" fill="#fef2f2"/>
                  <path d="M15 9l-6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M9 9l6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="revoke-title">
                캠페인이 철회되었습니다
              </h1>
              <p className="revoke-subtitle">
                죄송합니다. 이 캠페인은 더 이상 이용할 수 없습니다.
              </p>
            </div>

            {/* 철회 정보 */}
            <div className="revoke-info-section">
              <div className="revoke-info-card">
                <h2>철회 정보</h2>
                
                {customerName && (
                  <div className="info-item">
                    <span className="info-label">신청자</span>
                    <span className="info-value">{customerName}</span>
                  </div>
                )}
                
                {revokeInfo?.revoked_at && (
                  <div className="info-item">
                    <span className="info-label">철회 일시</span>
                    <span className="info-value">{formatRevokeDate(revokeInfo.revoked_at)}</span>
                  </div>
                )}
                
                {revokeInfo?.reason && (
                  <div className="info-item">
                    <span className="info-label">철회 사유</span>
                    <span className="info-value">{revokeInfo.reason}</span>
                  </div>
                )}
                
                {revokeInfo?.revoked_by && (
                  <div className="info-item">
                    <span className="info-label">철회 담당자</span>
                    <span className="info-value">{revokeInfo.revoked_by}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 문의 안내 */}
            <div className="contact-info-section">
              <div className="contact-card">
                <h3>문의하기</h3>
                <p>
                  캠페인 철회에 대한 문의사항이 있으시면<br />
                  아래 연락처로 문의해 주세요.
                </p>
                
                <div className="contact-methods">
                  <div className="contact-method">
                    <strong>📞 고객센터</strong>
                    <p>1588-0000 (평일 09:00~18:00)</p>
                  </div>
                  
                  <div className="contact-method">
                    <strong>✉️ 이메일</strong>
                    <p>support@peernine.co.kr</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="revoke-actions">
              <button 
                className="btn-close"
                onClick={() => {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.close();
                  }
                }}
              >
                페이지 닫기
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .revoke-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          padding: 40px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .container {
          max-width: 600px;
          width: 100%;
        }

        .revoke-content {
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .revoke-header {
          text-align: center;
          padding: 50px 40px 30px;
          background: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
        }

        .revoke-icon {
          margin-bottom: 20px;
        }

        .revoke-title {
          font-size: 28px;
          font-weight: 700;
          color: #dc2626;
          margin-bottom: 10px;
          line-height: 1.3;
        }

        .revoke-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin: 0;
        }

        .revoke-info-section {
          padding: 30px 40px;
          border-bottom: 1px solid #f3f4f6;
        }

        .revoke-info-card h2 {
          font-size: 20px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 20px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid #f9fafb;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-label {
          font-weight: 500;
          color: #6b7280;
          min-width: 100px;
        }

        .info-value {
          color: #374151;
          text-align: right;
          flex: 1;
          word-break: break-word;
        }

        .contact-info-section {
          padding: 30px 40px;
        }

        .contact-card h3 {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 15px;
        }

        .contact-card p {
          color: #6b7280;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .contact-methods {
          display: grid;
          gap: 15px;
        }

        .contact-method {
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .contact-method strong {
          display: block;
          color: #374151;
          margin-bottom: 5px;
        }

        .contact-method p {
          margin: 0;
          color: #4b5563;
          font-size: 14px;
        }

        .revoke-actions {
          padding: 30px 40px;
          text-align: center;
          background: #f9fafb;
        }

        .btn-close {
          background: #6b7280;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #4b5563;
          transform: translateY(-1px);
        }

        /* 모바일 최적화 */
        @media (max-width: 768px) {
          .revoke-page {
            padding: 20px 15px;
          }

          .revoke-header {
            padding: 40px 30px 25px;
          }

          .revoke-title {
            font-size: 24px;
          }

          .revoke-info-section,
          .contact-info-section,
          .revoke-actions {
            padding: 25px 30px;
          }

          .info-item {
            flex-direction: column;
            gap: 5px;
          }

          .info-label {
            min-width: auto;
          }

          .info-value {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default RevokePage;