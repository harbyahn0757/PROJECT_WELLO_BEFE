import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  revisit: '재환가망고객',
  analytics: '데이터 분석',
  'checkup-design': '검진설계',  // 상담+관리 통합 (2026-04-08)
};

// 2026-04-08: 'consultation' 메뉴 제거 (CheckupDesignManagementPage에 탭으로 흡수)
const NAV_ITEMS = [
  { key: 'dashboard', label: '대시보드', path: '/backoffice/dashboard' },
  { key: 'patients', label: '환자 통합', path: '/backoffice/patients' },
  { key: 'embedding', label: '검진결과 상담', path: '/backoffice/embedding' },
  { key: 'survey', label: '만족도 조사', path: '/backoffice/survey' },
  { key: 'revisit', label: '재환가망고객', path: '/backoffice/revisit' },
  { key: 'analytics', label: '데이터 분석', path: '/backoffice/analytics' },
  { key: 'checkup-design', label: '검진설계', path: '/backoffice/checkup-design' },
];

interface HospitalOption {
  hospital_id: string;
  hospital_name: string;
}

const PartnerOfficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── 모바일 사이드바 drawer ──
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 라우트 변경 시 drawer 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // ESC 키 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // drawer 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const isEmbed = searchParams.has('api_key');
  const queryStr = searchParams.toString();

  const segment = NAV_ITEMS.find(item => location.pathname.endsWith(item.key))?.key || 'dashboard';
  const pageTitle = PAGE_TITLES[segment] || '대시보드';

  // ── 병원 선택기 ──
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospFilter, setHospFilter] = useState('');
  const [hospOpen, setHospOpen] = useState(false);
  const [summaryCounts, setSummaryCounts] = useState<{new_chats: number; new_surveys: number; new_revisit: number}>({new_chats: 0, new_surveys: 0, new_revisit: 0});
  const selectedHospId = searchParams.get('hospital_id') || '';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEmbed) return;
    fetchWithAuth(`${API}/partner-office/hospitals`)
      .then(r => r.json())
      .then(d => setHospitals(d.hospitals || []))
      .catch(() => {});
  }, [isEmbed]);

  // 로그인 모드: 인증으로 summary-counts 조회 (병원 필터 포함)
  useEffect(() => {
    if (isEmbed) return;
    const hosParam = selectedHospId ? `?hospital_id=${selectedHospId}` : '';
    fetchWithAuth(`${API}/admin/embedding/summary-counts${hosParam}`)
      .then(r => r.json())
      .then(d => setSummaryCounts({new_chats: d.new_chats || 0, new_surveys: d.new_surveys || 0, new_revisit: d.new_revisit_candidates || 0}))
      .catch(() => {});
  }, [isEmbed, selectedHospId]);

  // iframe(embed) 모드: 로그인 없이 summary-counts 조회 후 부모 창에 개별 숫자 전달
  useEffect(() => {
    if (!isEmbed) return;
    const apiBase = window.location.hostname === 'welno.kindhabit.com' ? '/welno-api/v1' : '/api/v1';
    const hosParam = selectedHospId ? `?hospital_id=${selectedHospId}` : '';
    fetch(`${apiBase}/admin/embedding/summary-counts${hosParam}`)
      .then(r => r.json())
      .then(d => {
        const counts = { new_chats: d.new_chats || 0, new_surveys: d.new_surveys || 0, new_revisit: d.new_revisit_candidates || 0 };
        setSummaryCounts(counts);
        try {
          window.parent.postMessage(
            {
              type: 'welno-backoffice-counts',
              embedding: counts.new_chats,
              survey: counts.new_surveys,
              revisit: counts.new_revisit,
              new_chats: counts.new_chats,
              new_surveys: counts.new_surveys,
            },
            '*'
          );
        } catch (e) {
          // cross-origin 등으로 postMessage 실패 시 무시
        }
      })
      .catch(() => {});
  }, [isEmbed, selectedHospId]);

  // embed 모드에서 주기적으로 숫자 갱신 후 부모에 전달 (선택)
  useEffect(() => {
    if (!isEmbed) return;
    const t = setInterval(() => {
      const apiBase = window.location.hostname === 'welno.kindhabit.com' ? '/welno-api/v1' : '/api/v1';
      const hosParam = selectedHospId ? `?hospital_id=${selectedHospId}` : '';
      fetch(`${apiBase}/admin/embedding/summary-counts${hosParam}`)
        .then(r => r.json())
        .then(d => {
          const counts = { new_chats: d.new_chats || 0, new_surveys: d.new_surveys || 0, new_revisit: d.new_revisit_candidates || 0 };
          setSummaryCounts(counts);
          try {
            window.parent.postMessage(
              {
                type: 'welno-backoffice-counts',
                embedding: counts.new_chats,
                survey: counts.new_surveys,
                revisit: counts.new_revisit,
                new_chats: counts.new_chats,
                new_surveys: counts.new_surveys,
              },
              '*'
            );
          } catch (_) {}
        })
        .catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [isEmbed, selectedHospId]);

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
      {/* 로그인 모드: 사이드바 + 헤더 표시 */}
      {!isEmbed && (
        <>
          <div
            className={`po-layout__backdrop${sidebarOpen ? ' is-open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          <aside className={`po-layout__sidebar${sidebarOpen ? ' is-open' : ''}`}>
            <div className="po-layout__sidebar-head">
              <img
                src={`${process.env.PUBLIC_URL}/welno_logo.png`}
                alt="Welno"
                className="po-layout__logo-img"
              />
            </div>

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
                  {item.key === 'embedding' && summaryCounts.new_chats > 0 && (
                    <span className="po-layout__nav-badge">{summaryCounts.new_chats}</span>
                  )}
                  {item.key === 'survey' && summaryCounts.new_surveys > 0 && (
                    <span className="po-layout__nav-badge">{summaryCounts.new_surveys}</span>
                  )}
                  {item.key === 'revisit' && summaryCounts.new_revisit > 0 && (
                    <span className="po-layout__nav-badge">{summaryCounts.new_revisit}</span>
                  )}
                </NavLink>
              ))}
            </nav>

            <button className="po-layout__logout" onClick={logout}>로그아웃</button>
          </aside>
        </>
      )}

      <div className="po-layout__main">
        {!isEmbed && (
          <header className="po-layout__header">
            <button
              className="po-layout__hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={sidebarOpen}
            >
              <span />
            </button>
            <h1 className="po-layout__header-title">{pageTitle}</h1>
            <div className="po-layout__header-user">
              <span className="po-layout__header-badge">
                {user?.permission_level === 'super_admin' ? '관리자' : '파트너'}
              </span>
              <span className="po-layout__header-name">{user?.display_name}</span>
            </div>
          </header>
        )}
        <main className="po-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PartnerOfficeLayout;
