/**
 * 백오피스 - 병원 만족도 설문 통계 페이지
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import './styles.scss';

const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};
const API_BASE = getApiBase();

const EMBEDDING_API_BASE = (() => {
  if (typeof window === 'undefined') return '/api/v1/admin/embedding';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1/admin/embedding';
  return '/api/v1/admin/embedding';
})();

interface PartnerHierarchy {
  partner_id: string;
  partner_name: string;
  is_active: boolean;
  hospitals: { partner_id: string; partner_name: string; hospital_id: string; hospital_name: string }[];
}

interface SurveyStats {
  total_count: number;
  averages: Record<string, number>;
  field_labels: Record<string, string>;
  daily_trend: {
    date: string;
    count: number;
    reservation_process: number;
    facility_cleanliness: number;
    staff_kindness: number;
    waiting_time: number;
    overall_satisfaction: number;
  }[];
}

interface SurveyResponse {
  id: number;
  partner_id: string;
  hospital_id: string;
  reservation_process: number;
  facility_cleanliness: number;
  staff_kindness: number;
  waiting_time: number;
  overall_satisfaction: number;
  free_comment: string;
  respondent_uuid: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  reservation_process: '예약 과정',
  facility_cleanliness: '시설 청결',
  staff_kindness: '직원 친절',
  waiting_time: '대기 시간',
  overall_satisfaction: '전반적 만족도',
};

const CHART_COLORS = ['#7c746a', '#e8927c', '#5b9bd5', '#70ad47', '#ffc000'];

const SurveyPage: React.FC = () => {
  const navigate = useNavigate();

  // embed 모드 감지 (iframe에서 쿼리 파라미터로 접속)
  const urlParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      api_key: params.get('api_key'),
      partner_id: params.get('partner_id'),
      hospital_id: params.get('hospital_id'),
    };
  }, []);
  const isEmbedMode = !!(urlParams.api_key && urlParams.partner_id);

  const [hierarchy, setHierarchy] = useState<PartnerHierarchy[]>([]);
  const [collapsedPartners, setCollapsedPartners] = useState<Set<string>>(new Set());
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  const [commentModal, setCommentModal] = useState<string | null>(null);

  // Fetch hierarchy
  const fetchHierarchy = useCallback(async () => {
    try {
      const res = await fetch(`${EMBEDDING_API_BASE}/hierarchy`);
      if (res.ok) {
        const data: PartnerHierarchy[] = await res.json();
        setHierarchy(data);
        if (data.length > 0 && !selectedPartnerId) {
          setSelectedPartnerId(data[0].partner_id);
          if (data[0].hospitals.length > 0) {
            setSelectedHospitalId(data[0].hospitals[0].hospital_id);
          }
        }
      }
    } catch (e) {
      console.error('Hierarchy fetch failed:', e);
    }
  }, [selectedPartnerId]);

  // Fetch stats
  const fetchStats = useCallback(async (hospitalId: string, partnerId: string) => {
    try {
      const params = new URLSearchParams({ partner_id: partnerId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API_BASE}/hospital-survey/${hospitalId}/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error('Stats fetch failed:', e);
    }
  }, [dateFrom, dateTo]);

  // Fetch responses
  const fetchResponses = useCallback(async (hospitalId: string, partnerId: string, p: number) => {
    try {
      const params = new URLSearchParams({
        partner_id: partnerId,
        page: String(p),
        page_size: String(pageSize),
      });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await fetch(`${API_BASE}/hospital-survey/${hospitalId}/responses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responses);
        setTotalResponses(data.total);
      }
    } catch (e) {
      console.error('Responses fetch failed:', e);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isEmbedMode && urlParams.partner_id && urlParams.hospital_id) {
      setSelectedPartnerId(urlParams.partner_id);
      setSelectedHospitalId(urlParams.hospital_id);
    }
    fetchHierarchy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedHospitalId && selectedPartnerId) {
      setLoading(true);
      Promise.all([
        fetchStats(selectedHospitalId, selectedPartnerId),
        fetchResponses(selectedHospitalId, selectedPartnerId, 1),
      ]).finally(() => setLoading(false));
      setPage(1);
    }
  }, [selectedHospitalId, selectedPartnerId, fetchStats, fetchResponses]);

  const handleFilter = () => {
    if (!selectedHospitalId || !selectedPartnerId) return;
    setLoading(true);
    Promise.all([
      fetchStats(selectedHospitalId, selectedPartnerId),
      fetchResponses(selectedHospitalId, selectedPartnerId, 1),
    ]).finally(() => setLoading(false));
    setPage(1);
  };

  const handleResetFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    if (selectedHospitalId && selectedPartnerId) {
      fetchResponses(selectedHospitalId, selectedPartnerId, p);
    }
  };

  const togglePartner = (id: string) => {
    setCollapsedPartners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedHospitalName = useMemo(() => {
    for (const p of hierarchy) {
      for (const h of p.hospitals) {
        if (h.hospital_id === selectedHospitalId && p.partner_id === selectedPartnerId) {
          return h.hospital_name;
        }
      }
    }
    return '';
  }, [hierarchy, selectedHospitalId, selectedPartnerId]);

  // Chart data
  const radarData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(FIELD_LABELS).map(([key, label]) => ({
      field: label,
      score: stats.averages[key] || 0,
      fullMark: 5,
    }));
  }, [stats]);

  const barData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(FIELD_LABELS).map(([key, label]) => ({
      name: label,
      score: stats.averages[key] || 0,
    }));
  }, [stats]);

  const scoreClass = (score: number) => {
    if (score >= 4) return 'survey-page__score-cell--high';
    if (score >= 3) return 'survey-page__score-cell--mid';
    return 'survey-page__score-cell--low';
  };

  const totalPages = Math.ceil(totalResponses / pageSize);

  return (
    <div className="survey-page">
      {!isEmbedMode && (
        <header className="survey-page__header">
          <h1 className="survey-page__title">만족도 조사</h1>
        </header>
      )}

      <div className="survey-page__layout">
        {/* Sidebar */}
        {!isEmbedMode && (
        <aside className="survey-page__sidebar">
          <h2 className="survey-page__sidebar-title">병원 선택</h2>
          {hierarchy.map(partner => {
            const isCollapsed = collapsedPartners.has(partner.partner_id);
            return (
              <div key={partner.partner_id} className="survey-page__partner-group">
                <div className="survey-page__partner-header" onClick={() => togglePartner(partner.partner_id)}>
                  <span className="survey-page__partner-arrow">{partner.hospitals.length > 0 ? (isCollapsed ? '\u25B6' : '\u25BC') : '\u25B6'}</span>
                  <h3 className="survey-page__partner-name">{partner.partner_name}</h3>
                  <span className="survey-page__partner-count">{partner.hospitals.length}</span>
                </div>
                {!isCollapsed && partner.hospitals.length > 0 && (
                  <ul className="survey-page__hospital-list">
                    {partner.hospitals.map(h => (
                      <li key={h.hospital_id}>
                        <button
                          className={`survey-page__hospital-btn ${selectedHospitalId === h.hospital_id && selectedPartnerId === partner.partner_id ? 'is-selected' : ''}`}
                          onClick={() => { setSelectedPartnerId(partner.partner_id); setSelectedHospitalId(h.hospital_id); }}
                        >
                          {h.hospital_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </aside>
        )}

        {/* Main */}
        <main className="survey-page__main">
          {!selectedHospitalId ? (
            <div className="survey-page__empty">
              <h3>병원을 선택하세요</h3>
              <p>왼쪽 사이드바에서 병원을 선택하면 설문 통계를 확인할 수 있습니다.</p>
            </div>
          ) : (
            <>
              {/* Date filter */}
              <div className="survey-page__filters">
                <span className="survey-page__filter-label">{selectedHospitalName} 만족도 조사</span>
                <input type="date" className="survey-page__date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span className="survey-page__filter-label">~</span>
                <input type="date" className="survey-page__date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                <button className="survey-page__filter-btn" onClick={handleFilter}>조회</button>
                {(dateFrom || dateTo) && (
                  <button className="survey-page__filter-reset" onClick={handleResetFilter}>초기화</button>
                )}
              </div>

              {/* Stats cards */}
              <div className="survey-page__stats">
                <div className="survey-page__stat-card survey-page__stat-card--total">
                  <div className="survey-page__stat-value">{stats?.total_count ?? 0}</div>
                  <div className="survey-page__stat-label">총 응답수</div>
                </div>
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className="survey-page__stat-card">
                    <div className="survey-page__stat-value">{(stats?.averages[key] ?? 0).toFixed(1)}</div>
                    <div className="survey-page__stat-label">{label}</div>
                    <div className="survey-page__stat-score">/ 5.0</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              {stats && stats.total_count > 0 && (
                <div className="survey-page__charts">
                  {/* Radar Chart */}
                  <div className="survey-page__chart-card">
                    <h3 className="survey-page__chart-title">항목별 평균 (레이더)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="field" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                        <Radar name="평균" dataKey="score" stroke="#7c746a" fill="#7c746a" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar Chart */}
                  <div className="survey-page__chart-card">
                    <h3 className="survey-page__chart-title">항목별 평균 (막대)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="score" fill="#7c746a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Line Chart (daily trend) */}
                  {stats.daily_trend.length > 1 && (
                    <div className="survey-page__chart-card survey-page__chart-card--wide">
                      <h3 className="survey-page__chart-title">일별 추이</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={stats.daily_trend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {Object.entries(FIELD_LABELS).map(([key, label], idx) => (
                            <Line
                              key={key}
                              type="monotone"
                              dataKey={key}
                              name={label}
                              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Responses table */}
              <div className="survey-page__table-card">
                <div className="survey-page__table-header">
                  <h3 className="survey-page__chart-title" style={{ margin: 0 }}>개별 응답 ({totalResponses}건)</h3>
                </div>
                <div className="survey-page__table-wrapper">
                  <table className="survey-page__table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>예약</th>
                        <th>청결</th>
                        <th>친절</th>
                        <th>대기</th>
                        <th>만족도</th>
                        <th>의견</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responses.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: '#a0aec0', padding: 32 }}>설문 응답이 없습니다.</td></tr>
                      ) : responses.map(r => (
                        <tr key={r.id}>
                          <td>{new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className={`survey-page__score-cell ${scoreClass(r.reservation_process)}`}>{r.reservation_process}</span></td>
                          <td><span className={`survey-page__score-cell ${scoreClass(r.facility_cleanliness)}`}>{r.facility_cleanliness}</span></td>
                          <td><span className={`survey-page__score-cell ${scoreClass(r.staff_kindness)}`}>{r.staff_kindness}</span></td>
                          <td><span className={`survey-page__score-cell ${scoreClass(r.waiting_time)}`}>{r.waiting_time}</span></td>
                          <td><span className={`survey-page__score-cell ${scoreClass(r.overall_satisfaction)}`}>{r.overall_satisfaction}</span></td>
                          <td>
                            {r.free_comment ? (
                              <span className="survey-page__comment-cell" onClick={() => setCommentModal(r.free_comment)} title={r.free_comment}>
                                {r.free_comment}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="survey-page__pagination">
                    <button className="survey-page__page-btn" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>이전</button>
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                      const startPage = Math.max(1, Math.min(page - 4, totalPages - 9));
                      const p = startPage + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          className={`survey-page__page-btn ${p === page ? 'active' : ''}`}
                          onClick={() => handlePageChange(p)}
                        >{p}</button>
                      );
                    })}
                    <button className="survey-page__page-btn" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>다음</button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Comment modal */}
      {commentModal !== null && (
        <div className="survey-page__comment-modal" onClick={() => setCommentModal(null)}>
          <div className="survey-page__comment-modal-content" onClick={e => e.stopPropagation()}>
            <h3>자유 의견</h3>
            <p>{commentModal}</p>
            <button className="survey-page__comment-modal-close" onClick={() => setCommentModal(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyPage;
