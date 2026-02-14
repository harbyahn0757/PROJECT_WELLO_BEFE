import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import './styles.scss';

const API = getApiBase();

const PAGE_TITLES: Record<string, string> = {
  dashboard: '대시보드',
  patients: '환자 통합',
  embedding: '검진결과 상담',
  survey: '만족도 조사',
};

const NAV_ITEMS = [
  { key: 'dashboard', label: '대시보드', path: '/backoffice/dashboard' },
  { key: 'patients', label: '환자 통합', path: '/backoffice/patients' },
  { key: 'embedding', label: '검진결과 상담', path: '/backoffice/embedding' },
  { key: 'survey', label: '만족도 조사', path: '/backoffice/survey' },
];

interface HospitalOption {
  hospital_id: string;
  hospital_name: string;
}

const PartnerOfficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // window.location.search 직접 사용 — React Router 상태 의존 X
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), [location.search]);
  const isEmbed = urlParams.has('api_key');
  const queryStr = urlParams.toString();

  const segment = location.pathname.split('/').pop() || 'dashboard';
  const pageTitle = PAGE_TITLES[segment] || '대시보드';

  // ── 병원 선택기 ──
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospFilter, setHospFilter] = useState('');
  const [hospOpen, setHospOpen] = useState(false);
  const selectedHospId = searchParams.get('hospital_id') || '';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEmbed) return;
    fetchWithAuth(`${API}/partner-office/hospitals`)
      .then(r => r.json())
      .then(d => setHospitals(d.hospitals || []))
      .catch(() => {});
  }, [isEmbed]);

  // 드롭다운 밖 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHospOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectHospital = useCallback((id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set('hospital_id', id);
    } else {
      next.delete('hospital_id');
    }
    setSearchParams(next, { replace: true });
    setHospOpen(false);
    setHospFilter('');
  }, [searchParams, setSearchParams]);

  const selectedHospName = hospitals.find(h => h.hospital_id === selectedHospId)?.hospital_name || '';

  const filteredHospitals = hospFilter
    ? hospitals.filter(h => h.hospital_name.toLowerCase().includes(hospFilter.toLowerCase()))
    : hospitals;

  // iframe: 대시보드 제외, 현재 페이지 메뉴만
  const visibleNav = isEmbed
    ? NAV_ITEMS.filter(item => item.key === segment)
    : NAV_ITEMS;

  // 네비 링크에 hospital_id 전달
  const navTo = (path: string) => {
    if (isEmbed) return `${path}?${queryStr}`;
    if (selectedHospId) return `${path}?hospital_id=${selectedHospId}`;
    return path;
  };

  return (
    <div className={`po-layout${isEmbed ? ' po-layout--embed' : ''}`}>
      <aside className="po-layout__sidebar">
        <div className="po-layout__sidebar-head">
          <img
            src={`${process.env.PUBLIC_URL}/welno_logo.png`}
            alt="Welno"
            className="po-layout__logo-img"
          />
        </div>

        {/* 병원 선택 드롭다운 */}
        {!isEmbed && (
          <div className="po-layout__hosp-select" ref={dropdownRef}>
            <button
              className="po-layout__hosp-btn"
              onClick={() => setHospOpen(!hospOpen)}
            >
              <span className="po-layout__hosp-label">
                {selectedHospName || '전체 병원'}
              </span>
              <span className="po-layout__hosp-arrow">{hospOpen ? '▲' : '▼'}</span>
            </button>
            {hospOpen && (
              <div className="po-layout__hosp-dropdown">
                <input
                  className="po-layout__hosp-input"
                  type="text"
                  placeholder="병원명 검색..."
                  value={hospFilter}
                  onChange={e => setHospFilter(e.target.value)}
                  autoFocus
                />
                <div className="po-layout__hosp-list">
                  <div
                    className={`po-layout__hosp-item${!selectedHospId ? ' po-layout__hosp-item--active' : ''}`}
                    onClick={() => selectHospital('')}
                  >전체 병원</div>
                  {filteredHospitals.map(h => (
                    <div
                      key={h.hospital_id}
                      className={`po-layout__hosp-item${selectedHospId === h.hospital_id ? ' po-layout__hosp-item--active' : ''}`}
                      onClick={() => selectHospital(h.hospital_id)}
                    >{h.hospital_name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <nav className="po-layout__nav">
          {visibleNav.map(item => (
            <NavLink
              key={item.key}
              to={navTo(item.path)}
              className={({ isActive }) =>
                `po-layout__nav-item${isActive ? ' po-layout__nav-item--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {!isEmbed && (
          <button className="po-layout__logout" onClick={logout}>로그아웃</button>
        )}
      </aside>

      <div className="po-layout__main">
        <header className="po-layout__header">
          <h1 className="po-layout__header-title">{pageTitle}</h1>
          {!isEmbed && (
            <div className="po-layout__header-user">
              <span className="po-layout__header-badge">
                {user?.permission_level === 'super_admin' ? '관리자' : '파트너'}
              </span>
              <span className="po-layout__header-name">{user?.display_name}</span>
            </div>
          )}
        </header>
        <main className="po-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PartnerOfficeLayout;
