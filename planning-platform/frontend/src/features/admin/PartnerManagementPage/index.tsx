import React, { useState, useEffect } from 'react';
import './styles.scss';

interface PendingHospital {
  id: number;
  hospital_id: string;
  first_seen_at: string;
  last_seen_at: string;
  request_count: number;
  status: string;
}

interface Hospital {
  partner_id: string;
  hospital_id: string;
  hospital_name: string;
  is_active: boolean;
  config: Record<string, any>;
}

interface PartnerStats {
  partner_info: {
    partner_id: string;
    partner_name: string;
  };
  stats: {
    registered_hospitals: number;
    pending_hospitals: number;
    chat_sessions_30d: number;
  };
}

const PartnerManagementPage: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState({
    hospital_name: '',
    config: {}
  });

  const API_BASE = '/api/v1/partner-management';

  const authenticate = async () => {
    if (!apiKey.trim()) {
      setError('API Key를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 파트너 상태 확인으로 인증 테스트
      const response = await fetch('/api/v1/rag-chat/partner/status', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || '인증 실패');
      }
    } catch (err) {
      setError('인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      const [pendingRes, hospitalsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/pending-hospitals`, { headers }),
        fetch(`${API_BASE}/hospitals`, { headers }),
        fetch(`${API_BASE}/stats`, { headers })
      ]);

      if (pendingRes.ok) {
        setPendingHospitals(await pendingRes.json());
      }
      if (hospitalsRes.ok) {
        setHospitals(await hospitalsRes.json());
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      setError('데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const registerHospital = async (hospitalId: string) => {
    if (!registrationData.hospital_name.trim()) {
      setError('병원명을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/hospitals/register?hospital_id=${hospitalId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hospital_id: hospitalId,
          hospital_name: registrationData.hospital_name,
          config: registrationData.config
        })
      });

      if (response.ok) {
        setSelectedHospital(null);
        setRegistrationData({ hospital_name: '', config: {} });
        loadData(); // 데이터 새로고침
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || '병원 등록 실패');
      }
    } catch (err) {
      setError('병원 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="partner-management-page">
        <div className="auth-container">
          <h1>파트너 관리 페이지</h1>
          <div className="auth-form">
            <div className="form-group">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="파트너 API Key를 입력하세요"
                onKeyPress={(e) => e.key === 'Enter' && authenticate()}
              />
            </div>
            <button 
              onClick={authenticate} 
              disabled={loading}
              className="auth-button"
            >
              {loading ? '인증 중...' : '로그인'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="partner-management-page">
      <header className="page-header">
        <h1>파트너 관리 대시보드</h1>
        {stats && (
          <div className="partner-info">
            <span className="partner-name">{stats.partner_info.partner_name}</span>
            <span className="partner-id">({stats.partner_info.partner_id})</span>
          </div>
        )}
        <button 
          onClick={() => setIsAuthenticated(false)}
          className="logout-button"
        >
          로그아웃
        </button>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* 통계 카드 */}
      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <h3>등록된 병원</h3>
            <div className="stat-value">{stats.stats.registered_hospitals}</div>
          </div>
          <div className="stat-card">
            <h3>대기 중인 병원</h3>
            <div className="stat-value">{stats.stats.pending_hospitals}</div>
          </div>
          <div className="stat-card">
            <h3>최근 30일 채팅</h3>
            <div className="stat-value">{stats.stats.chat_sessions_30d}</div>
          </div>
        </div>
      )}

      {/* 대기 목록 */}
      <section className="pending-section">
        <h2>대기 중인 병원 목록</h2>
        {pendingHospitals.length === 0 ? (
          <p className="empty-message">대기 중인 병원이 없습니다.</p>
        ) : (
          <div className="pending-list">
            {pendingHospitals.map((hospital) => (
              <div key={hospital.id} className="pending-item">
                <div className="hospital-info">
                  <h4>{hospital.hospital_id}</h4>
                  <p>요청 횟수: {hospital.request_count}회</p>
                  <p>최근 접근: {new Date(hospital.last_seen_at).toLocaleString()}</p>
                </div>
                <div className="actions">
                  <button
                    onClick={() => setSelectedHospital(hospital.hospital_id)}
                    className="register-button"
                  >
                    등록
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 등록된 병원 목록 */}
      <section className="hospitals-section">
        <h2>등록된 병원 목록</h2>
        {hospitals.length === 0 ? (
          <p className="empty-message">등록된 병원이 없습니다.</p>
        ) : (
          <div className="hospitals-list">
            {hospitals.map((hospital) => (
              <div key={hospital.hospital_id} className="hospital-item">
                <div className="hospital-info">
                  <h4>{hospital.hospital_name}</h4>
                  <p className="hospital-id">{hospital.hospital_id}</p>
                  <p className={`status ${hospital.is_active ? 'active' : 'inactive'}`}>
                    {hospital.is_active ? '활성' : '비활성'}
                  </p>
                </div>
                <div className="actions">
                  <button className="config-button">설정</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 병원 등록 모달 */}
      {selectedHospital && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>병원 등록</h3>
            <p className="hospital-id">병원 ID: {selectedHospital}</p>
            
            <div className="form-group">
              <label htmlFor="hospitalName">병원명</label>
              <input
                id="hospitalName"
                type="text"
                value={registrationData.hospital_name}
                onChange={(e) => setRegistrationData(prev => ({
                  ...prev,
                  hospital_name: e.target.value
                }))}
                placeholder="병원명을 입력하세요"
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setSelectedHospital(null)}
                className="cancel-button"
              >
                취소
              </button>
              <button
                onClick={() => registerHospital(selectedHospital)}
                disabled={loading}
                className="confirm-button"
              >
                {loading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loading-overlay">로딩 중...</div>}
    </div>
  );
};

export default PartnerManagementPage;