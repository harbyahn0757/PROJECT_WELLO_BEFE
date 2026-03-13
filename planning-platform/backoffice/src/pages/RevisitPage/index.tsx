/**
 * 백오피스 — 재환가망고객 관리 페이지
 * CRM 선진사례 기반: 시간 세분화, 위험도 우선순위, 3종 메시지
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  user_phone?: string | null;
  checkup_date?: string | null;
  health_metrics?: Record<string, any> | null;
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
  // 병원 전용
  medical_tags?: string[];
  lifestyle_tags?: string[];
  medical_urgency?: string;
  anxiety_level?: string;
  prospect_type?: string;
  hospital_prospect_score?: number;
  partner_type?: string;
  // Phase H 통합 필드
  conversation_intent?: string;
  health_concerns?: string[];
  engagement_level?: string;
  confidence?: string;
  recommended_action?: string;
}

const RISK_COLORS: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#059669' };
const RISK_LABELS: Record<string, string> = { high: '고위험', medium: '중위험', low: '저위험' };
const INTENT_LABELS: Record<string, string> = { active: '적극적', considering: '고려중', passive: '소극적' };
const MSG_LABELS: Record<string, string> = { care_message: '케어', action_message: '행동유도', info_message: '정보제공' };
const MSG_ICONS: Record<string, string> = { care_message: '💛', action_message: '🎯', info_message: '📋' };

// 병원 전용: prospect_type 배지
const PROSPECT_COLORS: Record<string, string> = {
  borderline_worried: '#d97706', needs_visit: '#dc2626',
  lifestyle_improvable: '#059669', chronic_management: '#2563eb',
};
const PROSPECT_LABELS: Record<string, string> = {
  borderline_worried: '경계+걱정', needs_visit: '진료필요',
  lifestyle_improvable: '생활습관개선', chronic_management: '만성관리',
};
const URGENCY_LABELS: Record<string, string> = { urgent: '긴급', borderline: '경계', normal: '정상' };

/** 경과일 기반 색상 */
const daysColor = (d: number) => d <= 3 ? '#059669' : d <= 7 ? '#d97706' : '#dc2626';
const daysLabel = (d: number) => d <= 3 ? '3일 이내' : d <= 7 ? '1주 이내' : d <= 14 ? '2주 경과' : '14일+';

interface ChatMessage {
  message_type: string;
  message_content: string;
  created_at: string | null;
}

interface SessionTags {
  sentiment: string | null;
  data_quality_score: number | null;
  commercial_tags: Array<{ category: string; product_hint: string; segment: string }> | null;
  nutrition_tags: string[] | null;
  tagging_model: string | null;
}

type DetailTab = 'suggest' | 'chat' | 'health' | 'tags';

const HEALTH_METRIC_LABELS: Record<string, string> = {
  height: '신장(cm)', weight: '체중(kg)', bmi: 'BMI',
  waist: '허리둘레(cm)', bp_systolic: '수축기혈압', bp_diastolic: '이완기혈압',
  fasting_glucose: '공복혈당', total_cholesterol: '총콜레스테롤',
  hdl_cholesterol: 'HDL', ldl_cholesterol: 'LDL', triglyceride: '중성지방',
  hemoglobin: '혈색소', ast: 'AST(GOT)', alt: 'ALT(GPT)', ggt: 'γ-GTP',
  creatinine: '크레아티닌', gfr: '사구체여과율(GFR)',
  checkup_date: '검진일', checkup_place: '검진기관',
};

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
  const [prospectFilter, setProspectFilter] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('suggest');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionTags, setSessionTags] = useState<SessionTags | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

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

  // 후보 변경 시 탭/채팅 데이터 리셋
  useEffect(() => {
    setDetailTab('suggest');
    setChatMessages([]);
    setSessionTags(null);
  }, [selectedId]);

  const fetchChatMessages = useCallback(async (sessionId: string) => {
    setChatLoading(true);
    try {
      const fetcher = isEmbedMode ? fetch : fetchWithAuth;
      const res = await fetcher(`${API}/partner-office/revisit-candidates/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setChatMessages(data.messages || []);
      setSessionTags(data.session_tags || null);
    } catch { /* ignore */ }
    setChatLoading(false);
  }, [API, isEmbedMode]);

  const handleTabChange = useCallback((tab: DetailTab) => {
    setDetailTab(tab);
    if ((tab === 'chat' || tab === 'tags') && selectedId && chatMessages.length === 0) {
      fetchChatMessages(selectedId);
    }
  }, [selectedId, chatMessages.length, fetchChatMessages]);

  // 키보드 방향키 네비게이션
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!filtered.length) return;
      // 입력 필드에 포커스 시 무시
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      const curIdx = selectedId ? filtered.findIndex(c => c.session_id === selectedId) : -1;
      let nextIdx: number;
      if (e.key === 'ArrowDown') {
        nextIdx = curIdx < filtered.length - 1 ? curIdx + 1 : 0;
      } else {
        nextIdx = curIdx > 0 ? curIdx - 1 : filtered.length - 1;
      }
      setSelectedId(filtered[nextIdx].session_id);
      // 선택된 행이 보이도록 스크롤
      const row = tableRef.current?.querySelector(`tbody tr:nth-child(${nextIdx + 1})`) as HTMLElement | null;
      row?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedId]);

  const isHospitalMode = useMemo(() => candidates.some(c => c.partner_type === 'hospital'), [candidates]);
  const weeklyNew = useMemo(() => candidates.filter(c => c.days_since_chat <= 7).length, [candidates]);

  const filtered = useMemo(() => {
    let list = candidates;
    if (riskFilter) list = list.filter(c => c.risk_level === riskFilter);
    if (intentFilter) list = list.filter(c => c.action_intent === intentFilter);
    if (daysFilter === '3') list = list.filter(c => c.days_since_chat <= 3);
    else if (daysFilter === '7') list = list.filter(c => c.days_since_chat <= 7);
    else if (daysFilter === '14') list = list.filter(c => c.days_since_chat <= 14);
    else if (daysFilter === '14+') list = list.filter(c => c.days_since_chat > 14);
    if (prospectFilter) list = list.filter(c => c.prospect_type === prospectFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.patient_name.toLowerCase().includes(q) ||
        c.hospital_name.toLowerCase().includes(q) ||
        c.interest_tags.some(t => t.topic.toLowerCase().includes(q))
      );
    }
    return list;
  }, [candidates, riskFilter, intentFilter, daysFilter, prospectFilter, search]);

  const selected = useMemo(() => filtered.find(c => c.session_id === selectedId), [filtered, selectedId]);

  const handleCopy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleExcel = () => {
    const data = filtered.map(c => ({
      '환자명': c.patient_name || '-',
      '전화번호': c.user_phone || '-',
      '병원명': c.hospital_name || '-',
      '관심사': c.interest_tags.map(t => t.topic).join(', '),
      '위험도': RISK_LABELS[c.risk_level] || c.risk_level,
      '검진일': c.checkup_date || '-',
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
        {isHospitalMode && (
          <select value={prospectFilter} onChange={e => setProspectFilter(e.target.value)}>
            <option value="">분류 전체</option>
            <option value="needs_visit">진료필요</option>
            <option value="borderline_worried">경계+걱정</option>
            <option value="lifestyle_improvable">생활습관개선</option>
            <option value="chronic_management">만성관리</option>
          </select>
        )}
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
          <table className="revisit-page__table" ref={tableRef}>
            <thead>
              <tr>
                <th>환자명</th>
                <th>전화번호</th>
                <th>병원명</th>
                <th>관심사</th>
                <th>위험도</th>
                {isHospitalMode && <th>분류</th>}
                <th>검진일</th>
                <th>경과일</th>
                {isHospitalMode ? <th>가망점수</th> : <th>참여도</th>}
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
                  <td>{c.user_phone || '-'}</td>
                  <td>{c.hospital_name || '-'}</td>
                  <td>
                    {(isHospitalMode && c.medical_tags?.length ? c.medical_tags : c.interest_tags.map(t => t.topic))
                      .slice(0, 3).map((t, i) => (
                        <span key={i} className={`revisit-page__tag revisit-page__tag--${isHospitalMode ? 'high' : (c.interest_tags[i]?.intensity || 'medium')}`}>
                          {typeof t === 'string' ? t : (t as any).topic}
                        </span>
                      ))}
                  </td>
                  <td>
                    <span className="revisit-page__badge" style={{ background: isHospitalMode ? (PROSPECT_COLORS[c.medical_urgency || ''] || RISK_COLORS[c.risk_level]) : RISK_COLORS[c.risk_level] }}>
                      {isHospitalMode ? (URGENCY_LABELS[c.medical_urgency || ''] || RISK_LABELS[c.risk_level]) : (RISK_LABELS[c.risk_level] || c.risk_level)}
                    </span>
                  </td>
                  {isHospitalMode && (
                    <td>
                      {c.prospect_type && (
                        <span className="revisit-page__badge" style={{ background: PROSPECT_COLORS[c.prospect_type] || '#6b7280' }}>
                          {PROSPECT_LABELS[c.prospect_type] || c.prospect_type}
                        </span>
                      )}
                    </td>
                  )}
                  <td>{c.checkup_date || '-'}</td>
                  <td>
                    <span style={{ color: daysColor(c.days_since_chat), fontWeight: 600 }}>
                      {c.days_since_chat}일
                    </span>
                  </td>
                  <td>{isHospitalMode ? `${c.hospital_prospect_score ?? '-'}점` : `${c.engagement_score}점`}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isHospitalMode ? 9 : 8} className="revisit-page__empty">재방문 후보가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 패널 — 오버레이 */}
      {selected && (
        <div className="revisit-page__detail">
          <button className="revisit-page__detail-close" onClick={() => setSelectedId(null)}>&times;</button>
            <div className="revisit-page__detail-header">
              <h3>{selected.patient_name || '(이름 없음)'}</h3>
              <span className="revisit-page__badge" style={{ background: RISK_COLORS[selected.risk_level] }}>
                {RISK_LABELS[selected.risk_level]}
              </span>
              <span className="revisit-page__days-badge" style={{ color: daysColor(selected.days_since_chat) }}>
                {daysLabel(selected.days_since_chat)}
              </span>
              {selected.checkup_date && (
                <span className="revisit-page__checkup-date">검진일: {selected.checkup_date}</span>
              )}
            </div>

            {/* 탭 헤더 */}
            <div className="revisit-page__tabs">
              <button
                className={`revisit-page__tab${detailTab === 'suggest' ? ' revisit-page__tab--active' : ''}`}
                onClick={() => handleTabChange('suggest')}
              >제안</button>
              <button
                className={`revisit-page__tab${detailTab === 'chat' ? ' revisit-page__tab--active' : ''}`}
                onClick={() => handleTabChange('chat')}
              >상담 내역</button>
              <button
                className={`revisit-page__tab${detailTab === 'health' ? ' revisit-page__tab--active' : ''}`}
                onClick={() => handleTabChange('health')}
              >검진결과</button>
              <button
                className={`revisit-page__tab${detailTab === 'tags' ? ' revisit-page__tab--active' : ''}`}
                onClick={() => handleTabChange('tags')}
              >태그/분석</button>
            </div>

            {detailTab === 'suggest' && (
              <>
                {/* 병원 전용: 분류 + 의료태그 */}
                {isHospitalMode && selected.prospect_type && (
                  <div className="revisit-page__section">
                    <h4>병원 가망 분석</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span className="revisit-page__badge" style={{ background: PROSPECT_COLORS[selected.prospect_type] }}>
                        {PROSPECT_LABELS[selected.prospect_type]}
                      </span>
                      {selected.medical_urgency && (
                        <span className="revisit-page__badge" style={{ background: selected.medical_urgency === 'urgent' ? '#dc2626' : selected.medical_urgency === 'borderline' ? '#d97706' : '#059669' }}>
                          {URGENCY_LABELS[selected.medical_urgency]}
                        </span>
                      )}
                      {selected.hospital_prospect_score != null && (
                        <span style={{ fontWeight: 600 }}>가망점수 {selected.hospital_prospect_score}점</span>
                      )}
                    </div>
                    {selected.medical_tags && selected.medical_tags.length > 0 && (
                      <div>
                        <strong>의료 관심:</strong>{' '}
                        {selected.medical_tags.map((t, i) => (
                          <span key={i} className="revisit-page__tag revisit-page__tag--high">{t}</span>
                        ))}
                      </div>
                    )}
                    {selected.lifestyle_tags && selected.lifestyle_tags.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <strong>생활습관:</strong>{' '}
                        {selected.lifestyle_tags.map((t, i) => (
                          <span key={i} className="revisit-page__tag revisit-page__tag--low">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selected.conversation_summary && (
                  <div className="revisit-page__section">
                    <h4>대화 요약</h4>
                    <p>{selected.conversation_summary}</p>
                  </div>
                )}

                {selected.key_concerns.length > 0 && (
                  <div className="revisit-page__section">
                    <h4>주요 우려사항</h4>
                    <ul>{selected.key_concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                )}

                {selected.counselor_recommendations.length > 0 && (
                  <div className="revisit-page__section">
                    <h4>AI 상담 조언</h4>
                    <ul>{selected.counselor_recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}

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
              </>
            )}

            {detailTab === 'chat' && (
              <div className="revisit-page__chat-tab">
                {chatLoading ? (
                  <Spinner />
                ) : chatMessages.length === 0 ? (
                  <div className="revisit-page__empty">채팅 내역이 없습니다.</div>
                ) : (
                  <>
                    {/* 채팅 버블 */}
                    <div className="revisit-page__chat-list">
                      {chatMessages.map((m, i) => (
                        <div
                          key={i}
                          className={`revisit-page__chat-bubble revisit-page__chat-bubble--${m.message_type === 'user' ? 'user' : 'assistant'}`}
                        >
                          <div className="revisit-page__chat-bubble-role">
                            {m.message_type === 'user' ? '사용자' : 'AI'}
                          </div>
                          <div className="revisit-page__chat-bubble-text">
                            {m.message_content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 분석 섹션 */}
                    {sessionTags && (
                      <div className="revisit-page__chat-analysis">
                        <h4>세션 분석</h4>
                        <div className="revisit-page__gauge-row">
                          <div className="revisit-page__gauge">
                            <span className="revisit-page__gauge-label">참여도</span>
                            <div className="revisit-page__gauge-bar">
                              <div className="revisit-page__gauge-fill" style={{ width: `${selected.engagement_score ?? 0}%` }} />
                            </div>
                            <span className="revisit-page__gauge-value">{selected.engagement_score ?? 0}</span>
                          </div>
                          <div className="revisit-page__gauge">
                            <span className="revisit-page__gauge-label">데이터품질</span>
                            <div className="revisit-page__gauge-bar">
                              <div className="revisit-page__gauge-fill revisit-page__gauge-fill--quality" style={{ width: `${sessionTags.data_quality_score ?? 0}%` }} />
                            </div>
                            <span className="revisit-page__gauge-value">{sessionTags.data_quality_score ?? 0}</span>
                          </div>
                        </div>

                        {sessionTags.sentiment && (
                          <div className="revisit-page__section">
                            <strong>감정:</strong> {sessionTags.sentiment}
                          </div>
                        )}

                        {sessionTags.nutrition_tags && sessionTags.nutrition_tags.length > 0 && (
                          <div className="revisit-page__section">
                            <strong>관심사:</strong>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {sessionTags.nutrition_tags.map((t, i) => (
                                <span key={i} className="revisit-page__tag">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {sessionTags.commercial_tags && sessionTags.commercial_tags.length > 0 && (
                          <div className="revisit-page__section">
                            <strong>상업 태그:</strong>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {sessionTags.commercial_tags.map((ct, i) => (
                                <span key={i} className="revisit-page__tag revisit-page__tag--medium">
                                  {ct.category} {ct.product_hint && <small>({ct.product_hint})</small>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selected.counselor_recommendations.length > 0 && (
                          <div className="revisit-page__section">
                            <strong>상담사 권고:</strong>
                            <ul>{selected.counselor_recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          </div>
                        )}

                        <div className="revisit-page__meta">
                          모델: {sessionTags.tagging_model || '-'}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {detailTab === 'health' && (
              <div className="revisit-page__health-tab">
                {(() => {
                  const metrics = selected.health_metrics;
                  if (!metrics || Object.keys(metrics).length === 0) {
                    return <div className="revisit-page__empty">검진 데이터가 없습니다.</div>;
                  }
                  const entries = Object.entries(metrics).filter(([k]) => !k.endsWith('_abnormal') && !k.endsWith('_range'));
                  return (
                    <>
                      <div className="revisit-page__health-header">
                        {metrics.checkup_date && <span>검진일: {metrics.checkup_date}</span>}
                        {metrics.checkup_place && <span>검진기관: {metrics.checkup_place}</span>}
                      </div>
                      <table className="revisit-page__health-table">
                        <thead>
                          <tr><th>항목</th><th>수치</th><th>판정</th><th>참고범위</th></tr>
                        </thead>
                        <tbody>
                          {entries.map(([key, val]) => {
                            const abnormal = metrics[`${key}_abnormal`];
                            const range = metrics[`${key}_range`];
                            const isAbnormal = abnormal && abnormal !== '정상' && abnormal !== '';
                            return (
                              <tr key={key} className={isAbnormal ? 'is-abnormal' : ''}>
                                <td className="td-label">{HEALTH_METRIC_LABELS[key] || key}</td>
                                <td className="td-value">{val || '-'}</td>
                                <td className={`td-status ${isAbnormal ? 'td-status--warn' : ''}`}>{abnormal || '-'}</td>
                                <td className="td-range">{range || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>
            )}

            {detailTab === 'tags' && (
              <div className="revisit-page__tags-tab">
                {chatLoading ? (
                  <Spinner />
                ) : (
                  <>
                    {selected.conversation_summary && (
                      <div className="revisit-page__tags-summary">
                        <h4>대화 요약</h4>
                        <p>{selected.conversation_summary}</p>
                      </div>
                    )}
                    <div className="revisit-page__tags-grid">
                      <div className="revisit-page__tags-item revisit-page__tags-item--wide">
                        <h4>환자 관심사</h4>
                        {selected.interest_tags.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {selected.interest_tags.map((t, i) => (
                              <span key={i} className={`revisit-page__tag revisit-page__tag--${t.intensity || 'medium'}`}>{t.topic}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>-</span>}
                      </div>
                      <div className="revisit-page__tags-item">
                        <h4>위험도</h4>
                        <span className="revisit-page__badge" style={{ background: RISK_COLORS[selected.risk_level] }}>
                          {RISK_LABELS[selected.risk_level] || selected.risk_level}
                        </span>
                      </div>
                      {sessionTags?.sentiment && (
                        <div className="revisit-page__tags-item">
                          <h4>감정 분석</h4>
                          <span className="revisit-page__badge" style={{ background: '#6b7280' }}>
                            {({ positive: '긍정', negative: '부정', neutral: '중립', confused: '혼란', worried: '걱정', grateful: '감사' } as Record<string, string>)[sessionTags.sentiment] || sessionTags.sentiment}
                          </span>
                        </div>
                      )}
                      <div className="revisit-page__tags-item">
                        <h4>참여도</h4>
                        <div className="revisit-page__gauge">
                          <div className="revisit-page__gauge-bar">
                            <div className="revisit-page__gauge-fill" style={{ width: `${selected.engagement_score ?? 0}%` }} />
                          </div>
                          <span className="revisit-page__gauge-value">{selected.engagement_score ?? 0}점</span>
                        </div>
                      </div>
                      <div className="revisit-page__tags-item">
                        <h4>행동 의향</h4>
                        <span className="revisit-page__badge" style={{ background: selected.action_intent === 'active' ? '#059669' : selected.action_intent === 'considering' ? '#d97706' : '#6b7280' }}>
                          {INTENT_LABELS[selected.action_intent] || selected.action_intent}
                        </span>
                      </div>
                      <div className="revisit-page__tags-item">
                        <h4>후속 조치</h4>
                        <span className="revisit-page__badge" style={{ background: selected.follow_up_needed ? '#dc2626' : '#059669' }}>
                          {selected.follow_up_needed ? '필요' : '불필요'}
                        </span>
                      </div>
                      {sessionTags?.nutrition_tags && sessionTags.nutrition_tags.length > 0 && (
                        <div className="revisit-page__tags-item revisit-page__tags-item--wide">
                          <h4>식단/영양 관심</h4>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {sessionTags.nutrition_tags.map((t, i) => (
                              <span key={i} className="revisit-page__tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {sessionTags?.commercial_tags && sessionTags.commercial_tags.length > 0 && (
                        <div className="revisit-page__tags-item revisit-page__tags-item--wide">
                          <h4>상업 태그</h4>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {sessionTags.commercial_tags.map((ct, i) => (
                              <span key={i} className="revisit-page__tag revisit-page__tag--medium">
                                {ct.category} {ct.product_hint && <small>({ct.product_hint})</small>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selected.key_concerns.length > 0 && (
                        <div className="revisit-page__tags-item revisit-page__tags-item--wide">
                          <h4>주요 우려사항</h4>
                          <ul>{selected.key_concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                      )}
                      {selected.counselor_recommendations.length > 0 && (
                        <div className="revisit-page__tags-item revisit-page__tags-item--wide">
                          <h4>상담사 핵심 조언</h4>
                          <ul>{selected.counselor_recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                      )}
                      {sessionTags && (
                        <div className="revisit-page__tags-item">
                          <h4>데이터 품질</h4>
                          <div className="revisit-page__gauge">
                            <div className="revisit-page__gauge-bar">
                              <div className="revisit-page__gauge-fill revisit-page__gauge-fill--quality" style={{ width: `${sessionTags.data_quality_score ?? 0}%` }} />
                            </div>
                            <span className="revisit-page__gauge-value">{sessionTags.data_quality_score ?? 0}점</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {sessionTags && (
                      <div className="revisit-page__meta">
                        모델: {sessionTags.tagging_model || '-'}
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RevisitPage;
