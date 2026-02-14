import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './styles.scss';

const PAGE_TITLES: Record<string, string> = {
  dashboard: '대시보드',
  embedding: '검진결과 상담',
  survey: '만족도 조사',
};

const NAV_ITEMS = [
  { key: 'dashboard', label: '대시보드', path: '/backoffice/dashboard' },
  { key: 'embedding', label: '검진결과 상담', path: '/backoffice/embedding' },
  { key: 'survey', label: '만족도 조사', path: '/backoffice/survey' },
];

const PartnerOfficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // window.location.search 직접 사용 — React Router 상태 의존 X
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), [location.search]);
  const isEmbed = urlParams.has('api_key');
  const queryStr = urlParams.toString();

  const segment = location.pathname.split('/').pop() || 'dashboard';
  const pageTitle = PAGE_TITLES[segment] || '대시보드';

  // iframe: 대시보드 제외, 현재 페이지 메뉴만
  const visibleNav = isEmbed
    ? NAV_ITEMS.filter(item => item.key === segment)
    : NAV_ITEMS;

  return (
    <div className={`po-layout${isEmbed ? ' po-layout--embed' : ''}`}>
      <aside className="po-layout__sidebar">
        <div className="po-layout__sidebar-head">
          <img
            src={`${process.env.PUBLIC_URL}/welno_logo.png`}
            alt="Welno"
            className="po-layout__logo-img"
          />
          {!isEmbed && (
            <span className="po-layout__user-name">{user?.display_name || user?.username}</span>
          )}
        </div>

        <nav className="po-layout__nav">
          {visibleNav.map(item => (
            <NavLink
              key={item.key}
              to={isEmbed ? `${item.path}?${queryStr}` : item.path}
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
