/**
 * 백오피스 — 재환가망고객 관리 페이지
 * CRM 선진사례 기반: 시간 세분화, 위험도 우선순위, 3종 메시지
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { downloadWorkbook, dateSuffix } from '../../utils/excelExport';
import { ExportButtons } from '../../components/ExportButtons';
import { Spinner } from '../../components/Spinner';
import './styles.scss';

interface MessageVariants {
  care_message?: string;
  action_message?: string;
  info_message?: string;
}

interface Candidate {
  session_id: string;
  patient_name: string;
  hospital_name: string;
  interest_tags: Array<{ topic: string; intensity: string }>;
  risk_level: string;
  action_intent: string;
  follow_up_needed: boolean;
  message_variants: MessageVariants;
  conversation_summary: string | null;
  counselor_recommendations: string[];
  key_concerns: string[];
  engagement_score: number;
  buying_signal: string;
  days_since_chat: number;
  last_chat_date: string | null;
}

const RISK_COLORS: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#059669' };
const RISK_LABELS: Record<string, string> = { high: '고위험', medium: '중위험', low: '저위험' };
const INTENT_LABELS: Record<string, string> = { active: '적극적', considering: '고려중', passive: '소극적' };
const MSG_LABELS: Record<string, string> = { care_message: '케어', action_message: '행동유도', info_message: '정보제공' };
const MSG_ICONS: Record<string, string> = { care_message: '💛', action_message: '🎯', info_message: '📋' };

/** 경과일 기반 색상 */
const daysColor = (d: number) => d <= 3 ? '#059669' : d <= 7 ? '#d97706' : '#dc2626';
const daysLabel = (d: number) => d <= 3 ? '3일 이내' : d <= 7 ? '1주 이내' : d <= 14 ? '2주 경과' : '14일+';

const RevisitPage: React.FC = () => {
  const { isEmbedMode, embedParams } = useEmbedParams();
  const API = getApiBase();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [highRisk, setHighRisk] = useState(0);
  const [avgEngagement, setAvgEngagement] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const hospitalId = embedParams.hospitalId || '';

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const fetcher = isEmbedMode ? fetch : fetchWithAuth;
      const res = await fetcher(`${API}/partner-office/revisit-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospital_id: hospitalId, days: 30, limit: 100 }),
      });
      const data = await res.json();
      setCandidates(data.candidates || []);
      setTotal(data.total || 0);
      setHighRisk(data.high_risk_count || 0);
      setAvgEngagement(data.avg_engagement || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [API, hospitalId, isEmbedMode]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const weeklyNew = useMemo(() => candidates.filter(c => c.days_since_chat <= 7).length, [candidates]);

  const filtered = useMemo(() => {
    let list = candidates;
    if (riskFilter) list = list.filter(c => c.risk_level === riskFilter);
    if (intentFilter) list = list.filter(c => c.action_intent === intentFilter);
    if (daysFilter === '3') list = list.filter(c => c.days_since_chat <= 3);
    else if (daysFilter === '7') list = list.filter(c => c.days_since_chat <= 7);
    else if (daysFilter === '14') list = list.filter(c => c.days_since_chat <= 14);
    else if (daysFilter === '14+') list = list.filter(c => c.days_since_chat > 14);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.patient_name.toLowerCase().includes(q) ||
        c.hospital_name.toLowerCase().includes(q) ||
        c.interest_tags.some(t => t.topic.toLowerCase().includes(q))
      );
    }
    return list;
  }, [candidates, riskFilter, intentFilter, daysFilter, search]);

  const selected = useMemo(() => filtered.find(c => c.session_id === selectedId), [filtered, selectedId]);

  const handleCopy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleExcel = () => {
    const data = filtered.map(c => ({
      '환자명': c.patient_name || '-',
      '병원명': c.hospital_name || '-',
      '관심사': c.interest_tags.map(t => t.topic).join(', '),
      '위험도': RISK_LABELS[c.risk_level] || c.risk_level,
      '경과일': c.days_since_chat,
      '참여도': c.engagement_score,
      '의도': INTENT_LABELS[c.action_intent] || c.action_intent,
      '케어 메시지': c.message_variants?.care_message || '',
      '행동유도 메시지': c.message_variants?.action_message || '',
      '정보제공 메시지': c.message_variants?.info_message || '',
      '대화 요약': c.conversation_summary || '',
      '마지막 상담': c.last_chat_date || '',
    }));
    downloadWorkbook([{ name: '재환가망고객', data }], `revisit_${dateSuffix()}.xlsx`);
  };

  if (loading) return <Spinner />;

  return (
    <div className="revisit-page">
      <div className="revisit-page__header">
        <h2 className="revisit-page__title">재환가망고객</h2>
        <ExportButtons onExcel={handleExcel} />
      </div>

      {/* KPI 카드 */}
      <div className="revisit-page__kpi">
        <div className="revisit-page__kpi-card">
          <span className="revisit-page__kpi-label">총 후보</span>
          <span className="revisit-page__kpi-value">{total}<small>명</small></span>
        </div>
        <div className="revisit-page__kpi-card revisit-page__kpi-card--danger">
          <span className="revisit-page__kpi-label">고위험</span>
          <span className="revisit-page__kpi-value">{highRisk}<small>명</small></span>
        </div>
        <div className="revisit-page__kpi-card">
          <span className="revisit-page__kpi-label">이번주 신규</span>
          <span className="revisit-page__kpi-value">{weeklyNew}<small>명</small></span>
        </div>
        <div className="revisit-page__kpi-card">
          <span className="revisit-page__kpi-label">평균 참여도</span>
          <span className="revisit-page__kpi-value">{avgEngagement}<small>점</small></span>
        </div>
      </div>

      {/* 필터 */}
      <div className="revisit-page__filters">
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="">위험도 전체</option>
          <option value="high">고위험</option>
          <option value="medium">중위험</option>
          <option value="low">저위험</option>
        </select>
        <select value={intentFilter} onChange={e => setIntentFilter(e.target.value)}>
          <option value="">의향 전체</option>
          <option value="active">적극적</option>
          <option value="considering">고려중</option>
          <option value="passive">소극적</option>
        </select>
        <select value={daysFilter} onChange={e => setDaysFilter(e.target.value)}>
          <option value="">경과일 전체</option>
          <option value="3">3일 이내</option>
          <option value="7">1주 이내</option>
          <option value="14">2주 이내</option>
          <option value="14+">14일 초과</option>
        </select>
        <input
          className="revisit-page__search"
          placeholder="환자명·관심사 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="revisit-page__body">
        {/* 후보 목록 */}
        <div className="revisit-page__list">
          <table className="revisit-page__table">
            <thead>
              <tr>
                <th>환자명</th>
                <th>병원명</th>
                <th>관심사</th>
                <th>위험도</th>
                <th>경과일</th>
                <th>참여도</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.session_id}
                  className={selectedId === c.session_id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(c.session_id)}
                >
                  <td>{c.patient_name || '-'}</td>
                  <td>{c.hospital_name || '-'}</td>
                  <td>
                    {c.interest_tags.slice(0, 3).map((t, i) => (
                      <span key={i} className={`revisit-page__tag revisit-page__tag--${t.intensity}`}>
                        {t.topic}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className="revisit-page__badge" style={{ background: RISK_COLORS[c.risk_level] }}>
                      {RISK_LABELS[c.risk_level] || c.risk_level}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: daysColor(c.days_since_chat), fontWeight: 600 }}>
                      {c.days_since_chat}일
                    </span>
                  </td>
                  <td>{c.engagement_score}점</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="revisit-page__empty">재방문 후보가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="revisit-page__detail">
            <div className="revisit-page__detail-header">
              <h3>{selected.patient_name || '(이름 없음)'}</h3>
              <span className="revisit-page__badge" style={{ background: RISK_COLORS[selected.risk_level] }}>
                {RISK_LABELS[selected.risk_level]}
              </span>
              <span className="revisit-page__days-badge" style={{ color: daysColor(selected.days_since_chat) }}>
                {daysLabel(selected.days_since_chat)}
              </span>
            </div>

            {/* 대화 요약 */}
            {selected.conversation_summary && (
              <div className="revisit-page__section">
                <h4>대화 요약</h4>
                <p>{selected.conversation_summary}</p>
              </div>
            )}

            {/* 주요 우려 */}
            {selected.key_concerns.length > 0 && (
              <div className="revisit-page__section">
                <h4>주요 우려사항</h4>
                <ul>{selected.key_concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}

            {/* AI 조언 */}
            {selected.counselor_recommendations.length > 0 && (
              <div className="revisit-page__section">
                <h4>AI 상담 조언</h4>
                <ul>{selected.counselor_recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}

            {/* 추천 메시지 3종 카드 */}
            <div className="revisit-page__section">
              <h4>추천 메시지</h4>
              <div className="revisit-page__msg-cards">
                {(['care_message', 'action_message', 'info_message'] as const).map(key => {
                  const msg = selected.message_variants?.[key];
                  if (!msg) return null;
                  return (
                    <div key={key} className="revisit-page__msg-card">
                      <div className="revisit-page__msg-card-head">
                        <span>{MSG_ICONS[key]} {MSG_LABELS[key]}</span>
                        <button
                          className="revisit-page__copy-btn"
                          onClick={() => handleCopy(key, msg)}
                        >
                          {copiedKey === key ? '복사됨!' : '복사'}
                        </button>
                      </div>
                      <p className="revisit-page__msg-text">{msg}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="revisit-page__meta">
              참여도 {selected.engagement_score}점 · {INTENT_LABELS[selected.action_intent] || selected.action_intent} · 마지막 상담 {selected.last_chat_date || '-'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevisitPage;
