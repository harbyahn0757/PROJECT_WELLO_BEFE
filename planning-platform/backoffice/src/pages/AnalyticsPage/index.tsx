import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatDateTime } from '../../utils/dateFormat';
import {
  BRAND_BROWN, BRAND_BROWN_HOVER, BRAND_BROWN_DARKER,
  ACCENT_ORANGE, ACCENT_ORANGE_CALM,
  SUCCESS, ERROR, SATISFACTION_MID,
  PIE_PALETTE, GRAY_300,
} from '../../styles/colorTokens';
import './styles.scss';

const API = getApiBase();

// ── Types ──
interface AnalyticsSummary {
  total_sessions: number;
  high_risk: number;
  follow_up_needed: number;
  avg_engagement: number;
  follow_up_rate: number;
}

interface DistItem { name: string; value: number }
interface CategoryItem { category: string; count: number }
interface PainPointItem { area: string; count: number }
interface InterestItem { topic: string; count: number }
interface DailyTrendItem { date: string; low: number; medium: number; high: number }

interface SessionItem {
  session_id: string;
  hospital_name: string;
  created_at: string;
  risk_level: string;
  sentiment: string;
  action_intent: string;
  engagement_score: number;
  follow_up_needed: boolean;
  buying_signal: string;
  vip_risk_score: string;
  summary: string;
  interest_tags: { topic: string; intensity: string }[];
  commercial_tags: { category: string; product_hint: string; segment: string }[];
  key_concerns: string[];
}

interface AnalyticsResponse {
  summary: AnalyticsSummary;
  risk_distribution: DistItem[];
  sentiment_distribution: DistItem[];
  intent_distribution: DistItem[];
  engagement_distribution: DistItem[];
  buying_signal_distribution: DistItem[];
  commercial_categories: CategoryItem[];
  vip_risk_distribution: DistItem[];
  pain_points: PainPointItem[];
  interest_tags: InterestItem[];
  key_concerns: string[];
  daily_trend: DailyTrendItem[];
  sessions: SessionItem[];
  total_sessions_in_page: number;
  page: number;
  page_size: number;
}

interface FilterState {
  hospital_id?: string;
  date_from?: string;
  date_to?: string;
  risk_levels?: string[];
  sentiments?: string[];
  buying_signals?: string[];
  vip_risks?: string[];
  follow_up_only?: boolean;
  page: number;
  page_size: number;
}

// ── Color maps ──
const RISK_COLORS: Record<string, string> = { high: ERROR, medium: ACCENT_ORANGE, low: SUCCESS };
const VIP_COLORS: Record<string, string> = { red_alert: ERROR, watch: ACCENT_ORANGE, normal: SUCCESS };
const SIGNAL_COLORS: Record<string, string> = { high: SUCCESS, mid: ACCENT_ORANGE_CALM, low: GRAY_300 };

const RISK_OPTIONS = ['high', 'medium', 'low'];
const SENTIMENT_OPTIONS = ['positive', 'negative', 'neutral', 'worried', 'grateful'];
const SIGNAL_OPTIONS = ['high', 'mid', 'low'];
const VIP_OPTIONS = ['red_alert', 'watch', 'normal'];

const AnalyticsPage: React.FC = () => {
  useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State ──
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(() => ({
    hospital_id: searchParams.get('hospital_id') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    risk_levels: searchParams.getAll('risk_level'),
    sentiments: searchParams.getAll('sentiment'),
    buying_signals: searchParams.getAll('buying_signal'),
    vip_risks: searchParams.getAll('vip_risk'),
    follow_up_only: searchParams.get('follow_up_only') === 'true',
    page: parseInt(searchParams.get('page') || '1'),
    page_size: 10,
  }));

  // ── Sync filters → URL ──
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.hospital_id) p.set('hospital_id', filters.hospital_id);
    if (filters.date_from) p.set('date_from', filters.date_from);
    if (filters.date_to) p.set('date_to', filters.date_to);
    filters.risk_levels?.forEach(v => p.append('risk_level', v));
    filters.sentiments?.forEach(v => p.append('sentiment', v));
    filters.buying_signals?.forEach(v => p.append('buying_signal', v));
    filters.vip_risks?.forEach(v => p.append('vip_risk', v));
    if (filters.follow_up_only) p.set('follow_up_only', 'true');
    if (filters.page > 1) p.set('page', String(filters.page));
    setSearchParams(p, { replace: true });
  }, [filters, setSearchParams]);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        page: filters.page,
        page_size: filters.page_size,
      };
      if (filters.hospital_id) body.hospital_id = filters.hospital_id;
      if (filters.date_from) body.date_from = filters.date_from;
      if (filters.date_to) body.date_to = filters.date_to;
      if (filters.risk_levels?.length) body.risk_levels = filters.risk_levels;
      if (filters.sentiments?.length) body.sentiments = filters.sentiments;
      if (filters.buying_signals?.length) body.buying_signals = filters.buying_signals;
      if (filters.vip_risks?.length) body.vip_risks = filters.vip_risks;
      if (filters.follow_up_only) body.follow_up_only = true;

      const res = await fetchWithAuth(`${API}/partner-office/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const d: AnalyticsResponse = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filter helpers ──
  const toggleFilter = (key: 'risk_levels' | 'sentiments' | 'buying_signals' | 'vip_risks', val: string) => {
    setFilters(prev => {
      const arr = prev[key] || [];
      const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
      return { ...prev, [key]: next, page: 1 };
    });
  };

  const resetFilters = () => {
    setFilters({ page: 1, page_size: 10 });
  };

  const totalPages = data ? Math.ceil((data.summary?.total_sessions || 0) / filters.page_size) : 0;

  // ── Render chart helpers ──
  const renderDonut = (chartData: DistItem[], colors: Record<string, string>, title: string) => (
    <div className="analytics-page__chart-card">
      <h3 className="analytics-page__chart-title">{title}</h3>
      {chartData.length === 0 ? (
        <div className="analytics-page__chart-empty">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ strokeWidth: 1 }} style={{ fontSize: 11 }}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={colors[entry.name] || PIE_PALETTE[i % PIE_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const renderBar = (chartData: { name?: string; category?: string; area?: string; topic?: string; count?: number; value?: number }[], title: string, dataKey: string, nameKey: string) => (
    <div className="analytics-page__chart-card">
      <h3 className="analytics-page__chart-title">{title}</h3>
      {chartData.length === 0 ? (
        <div className="analytics-page__chart-empty">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 9 }} width={58} />
            <Tooltip />
            <Bar dataKey={dataKey} fill={BRAND_BROWN} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <div className="analytics-page">
      {error && <div className="analytics-page__error">{error}</div>}

      {/* ── Filters ── */}
      <div className="analytics-page__filters">
        <div className="analytics-page__filter-row">
          <input type="date" className="analytics-page__date-input" value={filters.date_from || ''}
            onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value || undefined, page: 1 }))} />
          <span className="analytics-page__filter-sep">~</span>
          <input type="date" className="analytics-page__date-input" value={filters.date_to || ''}
            onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value || undefined, page: 1 }))} />
          <label className="analytics-page__checkbox">
            <input type="checkbox" checked={filters.follow_up_only || false}
              onChange={e => setFilters(prev => ({ ...prev, follow_up_only: e.target.checked, page: 1 }))} />
            후속 필요만
          </label>
          <button className="analytics-page__reset-btn" onClick={resetFilters}>초기화</button>
          {loading && <span className="analytics-page__loading">로딩...</span>}
        </div>
        <div className="analytics-page__chip-groups">
          <div className="analytics-page__chip-group">
            <span className="analytics-page__chip-label">위험도:</span>
            {RISK_OPTIONS.map(v => (
              <button key={v} className={`analytics-page__chip ${filters.risk_levels?.includes(v) ? 'active' : ''}`}
                style={filters.risk_levels?.includes(v) ? { background: RISK_COLORS[v], color: '#fff' } : {}}
                onClick={() => toggleFilter('risk_levels', v)}>{v}</button>
            ))}
          </div>
          <div className="analytics-page__chip-group">
            <span className="analytics-page__chip-label">구매신호:</span>
            {SIGNAL_OPTIONS.map(v => (
              <button key={v} className={`analytics-page__chip ${filters.buying_signals?.includes(v) ? 'active' : ''}`}
                onClick={() => toggleFilter('buying_signals', v)}>{v}</button>
            ))}
          </div>
          <div className="analytics-page__chip-group">
            <span className="analytics-page__chip-label">VIP위험:</span>
            {VIP_OPTIONS.map(v => (
              <button key={v} className={`analytics-page__chip ${filters.vip_risks?.includes(v) ? 'active' : ''}`}
                style={filters.vip_risks?.includes(v) ? { background: VIP_COLORS[v], color: '#fff' } : {}}
                onClick={() => toggleFilter('vip_risks', v)}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="analytics-page__kpi-row">
            <div className="analytics-page__kpi-card">
              <div className="analytics-page__kpi-value">{data.summary.total_sessions}</div>
              <div className="analytics-page__kpi-label">총 세션</div>
            </div>
            <div className="analytics-page__kpi-card analytics-page__kpi-card--danger">
              <div className="analytics-page__kpi-value">{data.summary.high_risk}</div>
              <div className="analytics-page__kpi-label">고위험</div>
            </div>
            <div className="analytics-page__kpi-card">
              <div className="analytics-page__kpi-value">{data.summary.follow_up_needed}</div>
              <div className="analytics-page__kpi-label">후속 필요</div>
            </div>
            <div className="analytics-page__kpi-card">
              <div className="analytics-page__kpi-value">{data.summary.avg_engagement.toFixed(1)}</div>
              <div className="analytics-page__kpi-label">평균 참여도</div>
            </div>
            <div className="analytics-page__kpi-card">
              <div className="analytics-page__kpi-value">{data.summary.follow_up_rate.toFixed(1)}%</div>
              <div className="analytics-page__kpi-label">후속 비율</div>
            </div>
          </div>

          {/* ── Charts Grid ── */}
          <div className="analytics-page__charts-grid">
            {renderDonut(data.risk_distribution, RISK_COLORS, '위험도 분포')}
            {renderDonut(data.sentiment_distribution, {}, '감정 분포')}
            {renderDonut(data.intent_distribution, {}, '행동 의향 분포')}
            {renderDonut(data.engagement_distribution, {}, '참여도 분포')}

            {renderDonut(data.buying_signal_distribution, SIGNAL_COLORS, '구매 신호 분포')}
            {renderDonut(data.vip_risk_distribution, VIP_COLORS, 'VIP 위험 분포')}
            {renderBar(data.commercial_categories, '상업 카테고리 TOP', 'count', 'category')}
            {renderBar(data.pain_points, 'Pain Points', 'count', 'area')}
          </div>

          {/* ── Daily Trend ── */}
          {data.daily_trend.length > 1 && (
            <div className="analytics-page__trend-card">
              <h3 className="analytics-page__chart-title">일별 위험도 추이</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="high" name="high" stroke={ERROR} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="medium" name="medium" stroke={ACCENT_ORANGE} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="low" name="low" stroke={SUCCESS} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Interest Tags + Key Concerns ── */}
          <div className="analytics-page__two-col">
            {renderBar(data.interest_tags, '관심사 태그 TOP', 'count', 'topic')}
            <div className="analytics-page__chart-card">
              <h3 className="analytics-page__chart-title">주요 우려사항</h3>
              {data.key_concerns.length === 0 ? (
                <div className="analytics-page__chart-empty">데이터 없음</div>
              ) : (
                <ul className="analytics-page__concern-list">
                  {data.key_concerns.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              )}
            </div>
          </div>

          {/* ── Drilldown Table ── */}
          <div className="analytics-page__table-card">
            <h3 className="analytics-page__chart-title">세션 상세 ({data.summary.total_sessions}건)</h3>
            <div className="analytics-page__table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>병원</th>
                    <th>위험도</th>
                    <th>감정</th>
                    <th>의향</th>
                    <th>참여도</th>
                    <th>구매신호</th>
                    <th>VIP위험</th>
                    <th>후속</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#a0aec0' }}>데이터 없음</td></tr>
                  ) : data.sessions.map(s => (
                    <React.Fragment key={s.session_id}>
                      <tr className="analytics-page__session-row"
                        onClick={() => setExpandedSession(expandedSession === s.session_id ? null : s.session_id)}>
                        <td>{formatDateTime(s.created_at)}</td>
                        <td>{s.hospital_name || '-'}</td>
                        <td><span className="analytics-page__risk-dot" style={{ background: RISK_COLORS[s.risk_level] || GRAY_300 }}>{s.risk_level}</span></td>
                        <td>{s.sentiment || '-'}</td>
                        <td>{s.action_intent || '-'}</td>
                        <td>{s.engagement_score}</td>
                        <td><span className="analytics-page__signal-badge" style={{ background: SIGNAL_COLORS[s.buying_signal] || GRAY_300 }}>{s.buying_signal || '-'}</span></td>
                        <td><span className="analytics-page__risk-dot" style={{ background: VIP_COLORS[s.vip_risk_score] || GRAY_300 }}>{s.vip_risk_score || '-'}</span></td>
                        <td>{s.follow_up_needed ? '필요' : '-'}</td>
                      </tr>
                      {expandedSession === s.session_id && (
                        <tr>
                          <td colSpan={9} className="analytics-page__expanded-cell">
                            <div className="analytics-page__expanded-info">
                              <div><strong>요약:</strong> {s.summary || '-'}</div>
                              {s.interest_tags?.length > 0 && (
                                <div><strong>관심사:</strong> {s.interest_tags.map(t => t.topic).join(', ')}</div>
                              )}
                              {s.commercial_tags?.length > 0 && (
                                <div><strong>상업태그:</strong> {s.commercial_tags.map(t => `${t.category}(${t.product_hint})`).join(', ')}</div>
                              )}
                              {s.key_concerns?.length > 0 && (
                                <div><strong>우려사항:</strong> {s.key_concerns.join(', ')}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="analytics-page__pagination">
                <button className="analytics-page__page-btn" disabled={filters.page <= 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}>이전</button>
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                  const start = Math.max(1, Math.min(filters.page - 4, totalPages - 9));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} className={`analytics-page__page-btn ${p === filters.page ? 'active' : ''}`}
                      onClick={() => setFilters(prev => ({ ...prev, page: p }))}>{p}</button>
                  );
                })}
                <button className="analytics-page__page-btn" disabled={filters.page >= totalPages}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}>다음</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
