import React, { useState, useEffect, useCallback } from 'react';
import { getMobileEnv } from '../../utils/kakaoInApp';

/** 세션 키 (13개) — 빨간 배경 */
const SESSION_KEYS = [
  'tilko_info_confirming',
  'tilko_auth_waiting',
  'tilko_auth_completed',
  'tilko_auth_requested',
  'tilko_collecting_status',
  'tilko_manual_collect',
  'password_modal_open',
  'tilko_session_id',
  'tilko_session_data',
  'start_info_confirmation',
  'tilko_selected_auth_type',
  'tilko_auth_method_selection',
  'checkup_survey_panel_open',
];

/** 영구 키 (2개) — 초록 배경 */
const PERMANENT_KEYS = [
  'tilko_terms_agreed',
  'welno_intro_teaser_shown',
];

/** 환자 바인딩 키 — 파란 배경 */
const PATIENT_KEYS = [
  'welno_patient_uuid',
  'welno_hospital_id',
];

type KeyCategory = 'session' | 'permanent' | 'patient' | 'other';

const categorize = (key: string): KeyCategory => {
  if (SESSION_KEYS.includes(key)) return 'session';
  if (PERMANENT_KEYS.includes(key)) return 'permanent';
  if (PATIENT_KEYS.includes(key)) return 'patient';
  return 'other';
};

const BG: Record<KeyCategory, string> = {
  session: '#fee2e2',
  permanent: '#dcfce7',
  patient: '#dbeafe',
  other: '#f3f4f6',
};

const formatValue = (raw: string | null): string => {
  if (raw === null) return '(null)';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

const DebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<{ key: string; value: string | null; cat: KeyCategory }[]>([]);
  const [tick, setTick] = useState(0);

  // ?debug=1 체크
  const isDebug = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  const refresh = useCallback(() => {
    const items: { key: string; value: string | null; cat: KeyCategory }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      items.push({ key, value: localStorage.getItem(key), cat: categorize(key) });
    }
    // 카테고리 순서: session > permanent > patient > other, 같은 카테고리 내 알파벳순
    const order: KeyCategory[] = ['session', 'permanent', 'patient', 'other'];
    items.sort((a, b) => {
      const diff = order.indexOf(a.cat) - order.indexOf(b.cat);
      return diff !== 0 ? diff : a.key.localeCompare(b.key);
    });
    setEntries(items);
  }, []);

  useEffect(() => {
    if (!isDebug) return;
    refresh();
  }, [isDebug, refresh, tick]);

  // 주기적 새로고침 (패널 열린 동안만)
  useEffect(() => {
    if (!isDebug || !open) return;
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [isDebug, open]);

  if (!isDebug) return null;

  const params = new URLSearchParams(window.location.search);
  const uuid = params.get('uuid') || params.get('c') || '-';
  const env = getMobileEnv();

  const clearSessionKeys = () => {
    SESSION_KEYS.forEach(k => localStorage.removeItem(k));
    refresh();
  };

  // 인라인 스타일
  const S = {
    toggle: {
      position: 'fixed' as const,
      bottom: 80,
      right: 12,
      zIndex: 99999,
      background: '#1e293b',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '6px 14px',
      fontSize: 13,
      fontWeight: 600 as const,
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    },
    panel: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '50vh',
      zIndex: 99999,
      background: '#fff',
      borderTop: '2px solid #1e293b',
      overflowY: 'auto' as const,
      fontSize: 12,
      fontFamily: 'monospace',
    },
    header: {
      position: 'sticky' as const,
      top: 0,
      background: '#1e293b',
      color: '#fff',
      padding: '8px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    meta: {
      padding: '6px 12px',
      background: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      lineHeight: 1.6,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    },
    th: {
      textAlign: 'left' as const,
      padding: '4px 8px',
      borderBottom: '1px solid #cbd5e1',
      background: '#f1f5f9',
      position: 'sticky' as const,
      top: 40,
    },
    td: {
      padding: '4px 8px',
      borderBottom: '1px solid #e2e8f0',
      verticalAlign: 'top' as const,
      wordBreak: 'break-all' as const,
    },
    btn: {
      background: '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      padding: '4px 10px',
      fontSize: 11,
      cursor: 'pointer',
    },
    closeBtn: {
      background: 'transparent',
      color: '#fff',
      border: '1px solid #94a3b8',
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      cursor: 'pointer',
      marginLeft: 8,
    },
  };

  return (
    <div data-testid="debug-panel">
      {/* 토글 버튼 */}
      {!open && (
        <button style={S.toggle} onClick={() => { setOpen(true); refresh(); }}>
          Debug
        </button>
      )}

      {/* 패널 */}
      {open && (
        <div style={S.panel}>
          <div style={S.header}>
            <span>Debug Panel ({entries.length} keys)</span>
            <div>
              <button style={S.btn} onClick={clearSessionKeys}>
                Reset Session Keys
              </button>
              <button style={S.closeBtn} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>

          {/* 메타 정보 */}
          <div style={S.meta}>
            <div><b>URL:</b> {window.location.href}</div>
            <div><b>UUID/c:</b> {uuid}</div>
            <div>
              <b>Env:</b>{' '}
              {env.isKakao ? 'KakaoInApp' : 'Browser'}
              {env.isIOS ? ' / iOS' : ''}
              {env.isAndroid ? ' / Android' : ''}
              {!env.isMobile ? ' / Desktop' : ''}
            </div>
          </div>

          {/* 키/값 테이블 */}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '30%' }}>Key</th>
                <th style={S.th}>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ key, value, cat }) => (
                <tr key={key} style={{ background: BG[cat] }}>
                  <td style={S.td}>{key}</td>
                  <td style={S.td}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {formatValue(value)}
                    </pre>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={2}>
                    localStorage is empty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
