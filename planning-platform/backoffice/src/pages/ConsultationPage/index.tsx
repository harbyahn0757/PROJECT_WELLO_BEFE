/**
 * 백오피스 — 검진설계 상담 페이지
 * 리스트 전체 너비 + 우측 드로워로 상세 표시
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { Spinner } from '../../components/Spinner';
import './styles.scss';

/* ── 타입 ── */
interface DesignSummary {
  recommended_count: number;
  ai_summary: string;
}

interface ConsultationItem {
  session_id: string;
  uuid: string;
  name: string | null;
  phone: string | null;
  requested_at: string | null;
  status: string;
  consultation_type: string;
  design_summary: DesignSummary | null;
}

interface PatientInfo {
  uuid: string;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  data_source: string;
}

interface HealthRecord {
  year: number | null;
  checkup_date: string | null;
  height: number | null;
  weight: number | null;
  blood_pressure_high: number | null;
  blood_pressure_low: number | null;
  blood_sugar: number | null;
  cholesterol: number | null;
  collected_at: string | null;
  data_source: string;
}

interface DesignResult {
  id: number;
  status: string;
  trigger_source: string | null;
  design_result: any;
  selected_concerns: any[] | null;
  auto_concerns: any[] | null;
  survey_responses: any | null;
  selected_medication_texts: any[] | null;
  step1_result: any | null;
  created_at: string | null;
  data_source: string;
}

interface SessionTags {
  interest_tags: any[] | null;
  risk_tags: any[] | null;
  key_concerns: any[] | null;
  conversation_summary: string | null;
  sentiment: string | null;
  risk_level: string | null;
  counselor_recommendations: any[] | null;
  commercial_tags: any[] | null;
  buying_signal: string | null;
  prospect_type: string | null;
  action_intent: string | null;
  medical_tags: any[] | null;
  lifestyle_tags: any[] | null;
  nutrition_tags: any[] | null;
  anxiety_level: string | null;
  hospital_prospect_score: number | null;
  medical_urgency: string | null;
  engagement_score: number | null;
  suggested_revisit_messages: any[] | null;
}

interface TimingData {
  entry_at: string | null;
  design_start_at: string | null;
  design_complete_at: string | null;
  consultation_requested_at: string | null;
}

interface PrescriptionMed {
  name: string;
  effect: string;
  days: string | null;
}

interface PrescriptionRecord {
  hospital_name: string | null;
  treatment_date: string | null;
  treatment_type: string | null;
  medication_count: number | null;
  medications: PrescriptionMed[];
  data_source: string | null;
}

interface DetailData {
  patient: PatientInfo | null;
  healthData: HealthRecord[];
  designResult: DesignResult[];
  sessionTags: SessionTags | null;
  timing: TimingData | null;
  prescriptionData: PrescriptionRecord[];
}

/* ── 상수 ── */
type StatusFilter = 'all' | 'pending' | 'contacted' | 'completed';
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'contacted', label: '진행중' },
  { key: 'completed', label: '완료' },
];
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', contacted: '진행중', completed: '완료',
};
const SOURCE_LABELS: Record<string, { text: string; cls: string }> = {
  welno_patients: { text: '수검자 입력', cls: 'user' },
  welno_checkup_design_requests: { text: 'AI 추출', cls: 'ai' },
  'welno_checkup_data (Tilko)': { text: '공단 데이터', cls: 'nhis' },
  welno_checkup_data: { text: '공단 데이터', cls: 'nhis' },
  partner: { text: '파트너 제공', cls: 'partner' },
};

const RISK_COLORS: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#059669' };
const RISK_LABELS: Record<string, string> = { high: '고위험', medium: '중위험', low: '저위험' };
const PROSPECT_LABELS: Record<string, string> = {
  borderline_worried: '경계+걱정', needs_visit: '진료필요',
  lifestyle_improvable: '생활습관개선', chronic_management: '만성관리',
};
const SENTIMENT_LABELS: Record<string, string> = {
  positive: '긍정', negative: '부정', neutral: '중립', anxious: '불안', worried: '걱정',
};
const ANXIETY_LABELS: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' };
const URGENCY_LABELS: Record<string, string> = { urgent: '긴급', borderline: '경계', normal: '정상' };
const BUYING_LABELS: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' };

/* ── 추이 이상 판정 ── */
const HEALTH_RANGES: Record<string, { normal: number; warn: number }> = {
  bmi: { normal: 25, warn: 30 },
  blood_pressure_high: { normal: 120, warn: 140 },
  blood_sugar: { normal: 100, warn: 126 },
  cholesterol: { normal: 200, warn: 240 },
};

interface TrendResult { arrow: string; status: string; }

function getTrend(current: number | null, previous: number | null, ranges: { normal: number; warn: number }): TrendResult {
  if (current == null) return { arrow: '—', status: 'new' };
  if (previous == null) return { arrow: '—', status: 'new' };
  const diff = current - previous;
  if (current > ranges.warn) return { arrow: '↑↑', status: 'abnormal' };
  if (current > ranges.normal) return { arrow: '↑', status: 'borderline' };
  if (diff < 0) return { arrow: '↓', status: 'improved' };
  return { arrow: '→', status: 'normal' };
}

function formatTime(dt: string | null): string {
  if (!dt) return '-';
  const t = dt.replace('T', ' ');
  return t.length >= 16 ? t.slice(11, 16) : t;
}

const SourceLabel: React.FC<{ source: string }> = ({ source }) => {
  const info = SOURCE_LABELS[source] || { text: source, cls: 'user' };
  return (
    <span className={`consultation-page__source-label consultation-page__source-label--${info.cls}`}>
      {info.text}
    </span>
  );
};

/* ── 메인 컴포넌트 ── */
const ConsultationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const API = getApiBase();
  const hospitalId = searchParams.get('hospital_id') || '';

  const [items, setItems] = useState<ConsultationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  /* 드로워 ESC 닫기 */
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  /* 드로워 열릴 때 body 스크롤 잠금 */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* 목록 조회 */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status: statusFilter,
        page: '1',
        limit: '50',
      });
      if (hospitalId) qs.set('hospital_id', hospitalId);
      const res = await fetchWithAuth(`${API}/consultation/list?${qs}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [API, hospitalId, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* 상세 조회 */
  const fetchDetail = useCallback(async (uuid: string) => {
    setDetailLoading(true);
    try {
      const qs = hospitalId ? `?hospital_id=${hospitalId}` : '';
      const res = await fetchWithAuth(
        `${API}/consultation/detail/${encodeURIComponent(uuid)}${qs}`,
      );
      setDetail(await res.json());
    } catch { setDetail(null); }
    setDetailLoading(false);
  }, [API, hospitalId]);

  const handleSelect = (item: ConsultationItem) => {
    setSelectedUuid(item.uuid);
    setDrawerOpen(true);
    fetchDetail(item.uuid);
  };

  /* 상태 변경 */
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedUuid) return;
    setStatusUpdating(true);
    try {
      await fetchWithAuth(`${API}/consultation/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: selectedUuid,
          hospital_id: hospitalId || 'PEERNINE',
          status: newStatus,
        }),
      });
      await fetchList();
    } catch { /* ignore */ }
    setStatusUpdating(false);
  };

  const selectedItem = useMemo(
    () => items.find(i => i.uuid === selectedUuid),
    [items, selectedUuid],
  );

  /* 검진설계 추천 항목 파싱 */
  const recommendations = useMemo(() => {
    if (!detail?.designResult?.length) return [];
    const dr = detail.designResult[0]?.design_result;
    return dr?.recommended_items || [];
  }, [detail]);

  const patientSummary = useMemo(() => {
    if (!detail?.designResult?.length) return '';
    return detail.designResult[0]?.design_result?.patient_summary || '';
  }, [detail]);

  if (loading) return <Spinner />;

  return (
    <div className="consultation-page">
      <div className="consultation-page__header">
        <h2>검진설계 상담</h2>
        <span style={{ fontSize: 14, color: '#718096' }}>총 {total}건</span>
      </div>

      <div className="consultation-page__body">
        {/* ── 리스트 (전체 너비) ── */}
        <div className="consultation-page__list-panel">
          <div className="consultation-page__tabs">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                className={`consultation-page__tab${statusFilter === tab.key ? ' consultation-page__tab--active' : ''}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="consultation-page__items">
            {items.length === 0 && (
              <div className="consultation-page__empty">상담 요청이 없습니다</div>
            )}
            {items.map(item => (
              <div
                key={item.session_id}
                className={`consultation-page__item${selectedUuid === item.uuid ? ' consultation-page__item--active' : ''}`}
                onClick={() => handleSelect(item)}
              >
                <div className="consultation-page__item-info">
                  <div className="name">{item.name || '이름 없음'}</div>
                  <div className="meta">
                    {item.requested_at?.replace('T', ' ').slice(0, 16)}
                    {item.design_summary && ` · 추천 ${item.design_summary.recommended_count}항목`}
                  </div>
                </div>
                <span className={`consultation-page__badge consultation-page__badge--${item.status}`}>
                  {STATUS_LABEL[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 드로워 오버레이 + 패널 ── */}
      {drawerOpen && (
        <div className="consultation-page__overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <div className={`consultation-page__drawer${drawerOpen ? ' consultation-page__drawer--open' : ''}`}>
        <div className="consultation-page__drawer-header">
          <div className="consultation-page__drawer-header-left">
            <h3>
              {detail?.patient?.name || selectedItem?.name || '고객 상세'}
              {detail?.patient?.birth_date && detail?.patient?.gender && (
                <span style={{ fontSize: 13, fontWeight: 400, color: '#718096', marginLeft: 8 }}>
                  ({detail.patient.gender === 'M' ? '남' : detail.patient.gender === 'F' ? '여' : '-'})
                </span>
              )}
            </h3>
            {detail?.timing && (
              <div className="consultation-page__timing">
                {detail.timing.entry_at && (
                  <span className="consultation-page__timing-item">
                    <span className="label">유입</span>
                    <span className="value">{formatTime(detail.timing.entry_at)}</span>
                  </span>
                )}
                {detail.timing.design_start_at && (
                  <span className="consultation-page__timing-item">
                    <span className="label">시작</span>
                    <span className="value">{formatTime(detail.timing.design_start_at)}</span>
                  </span>
                )}
                {detail.timing.design_complete_at && (
                  <span className="consultation-page__timing-item">
                    <span className="label">완료</span>
                    <span className="value">{formatTime(detail.timing.design_complete_at)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="consultation-page__drawer-close" onClick={() => setDrawerOpen(false)}>
            &times;
          </button>
        </div>
        <div className="consultation-page__drawer-body">
          {detailLoading && <Spinner />}
          {!detailLoading && detail && (
            <DetailPanel
              detail={detail}
              selectedItem={selectedItem || null}
              recommendations={recommendations}
              patientSummary={patientSummary}
              statusUpdating={statusUpdating}
              onStatusChange={handleStatusChange}
              sessionTags={detail.sessionTags}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ── 상세 패널 하위 컴포넌트 ── */
interface DetailPanelProps {
  detail: DetailData;
  selectedItem: ConsultationItem | null;
  recommendations: any[];
  patientSummary: string;
  statusUpdating: boolean;
  onStatusChange: (s: string) => void;
  sessionTags: SessionTags | null;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  detail, selectedItem, recommendations,
  patientSummary, statusUpdating, onStatusChange, sessionTags,
}) => {
  const currentStatus = selectedItem?.status || 'pending';

  return (
    <div className="consultation-page__split-grid">
      {/* ═══ 좌측: 건강 데이터 ═══ */}
      <div className="consultation-page__split-col">
        <LeftColHealth detail={detail} />
      </div>
      {/* ═══ 우측: 상담 가이드 ═══ */}
      <div className="consultation-page__split-col">
        <RightColGuide
          detail={detail}
          recommendations={recommendations}
          patientSummary={patientSummary}
          sessionTags={sessionTags}
          currentStatus={currentStatus}
          statusUpdating={statusUpdating}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
};

/* ── 좌측 컬럼: 건강 데이터 ── */
const LeftColHealth: React.FC<{ detail: DetailData }> = ({ detail }) => {
  const p = detail.patient;
  const hd = detail.healthData || [];
  const rx = detail.prescriptionData || [];
  const dr0 = detail.designResult?.[0];
  const survey = dr0?.survey_responses;

  // 연도순 정렬 (오래된 것 먼저)
  const sorted = [...hd].sort((a, b) => (a.year || 0) - (b.year || 0));

  return (
    <>
      {/* 기본 정보 */}
      <div className="consultation-page__section">
        <h3>기본 정보 <SourceLabel source={p?.data_source || 'welno_patients'} /></h3>
        <dl className="consultation-page__patient-grid">
          <div><dt>이름</dt><dd>{p?.name || '-'}</dd></div>
          <div><dt>전화번호</dt><dd>{p?.phone || '-'}</dd></div>
          <div>
            <dt>생년월일 / 성별</dt>
            <dd>{p?.birth_date || '-'} / {p?.gender === 'M' ? '남' : p?.gender === 'F' ? '여' : '-'}</dd>
          </div>
        </dl>
      </div>

      {/* 건강검진 연도별 비교 */}
      {sorted.length > 0 && (
        <div className="consultation-page__section">
          <h3>건강검진 데이터 <SourceLabel source={sorted[0]?.data_source || 'welno_checkup_data'} /></h3>
          <table className="consultation-page__health-table">
            <thead>
              <tr>
                <th>연도</th><th>신장</th><th>체중</th>
                <th>혈압(수축)</th><th>혈당</th><th>콜레스테롤</th><th>추이</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h, i) => {
                const prev = i > 0 ? sorted[i - 1] : null;
                const bpT = getTrend(h.blood_pressure_high, prev?.blood_pressure_high, HEALTH_RANGES.blood_pressure_high);
                const bsT = getTrend(h.blood_sugar, prev?.blood_sugar, HEALTH_RANGES.blood_sugar);
                const chT = getTrend(h.cholesterol, prev?.cholesterol, HEALTH_RANGES.cholesterol);
                // 가장 심한 상태를 대표로
                const worst = [bpT, bsT, chT].sort((a, b) => {
                  const order: Record<string, number> = { abnormal: 0, borderline: 1, improved: 2, normal: 3, new: 4 };
                  return (order[a.status] ?? 5) - (order[b.status] ?? 5);
                })[0];
                return (
                  <tr key={i}>
                    <td>{h.year || '-'}</td>
                    <td>{h.height ?? '-'}</td>
                    <td>{h.weight ?? '-'}</td>
                    <td>{h.blood_pressure_high ?? '-'}/{h.blood_pressure_low ?? '-'}</td>
                    <td>{h.blood_sugar ?? '-'}</td>
                    <td>{h.cholesterol ?? '-'}</td>
                    <td>
                      <span className={`consultation-page__trend consultation-page__trend--${worst.status}`}>
                        {worst.arrow}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 투약 내역 */}
      {rx.length > 0 && (
        <div className="consultation-page__section">
          <h3>투약 내역 ({rx.length}건) <SourceLabel source="welno_prescription_data" /></h3>
          {rx.slice(0, 10).map((r, i) => (
            <div key={i} className="consultation-page__rx-card">
              <div className="rx-header">
                <span className="rx-hospital">{r.hospital_name || '-'}</span>
                <span className="rx-date">{r.treatment_date || '-'}</span>
              </div>
              <div className="rx-type">{r.treatment_type || '-'}</div>
              {r.medications.length > 0 && (
                <ul className="rx-meds">
                  {r.medications.slice(0, 3).map((m, j) => (
                    <li key={j}>{m.name}{m.effect ? ` (${m.effect})` : ''}</li>
                  ))}
                  {r.medications.length > 3 && <li>... 외 {r.medications.length - 3}건</li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 문진 응답 요약 */}
      {survey && (
        <div className="consultation-page__section">
          <h3>문진 응답 <SourceLabel source="user_input" /></h3>
          {typeof survey === 'object' && !Array.isArray(survey) ? (
            <dl className="consultation-page__patient-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {Object.entries(survey).slice(0, 12).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p style={{ fontSize: 13, color: '#4a5568' }}>{JSON.stringify(survey)}</p>
          )}
        </div>
      )}
    </>
  );
};

/* ── 우측 컬럼: 상담 가이드 ── */
interface RightColProps {
  detail: DetailData;
  recommendations: any[];
  patientSummary: string;
  sessionTags: SessionTags | null;
  currentStatus: string;
  statusUpdating: boolean;
  onStatusChange: (s: string) => void;
}

const RightColGuide: React.FC<RightColProps> = ({
  detail, recommendations, patientSummary, sessionTags,
  currentStatus, statusUpdating, onStatusChange,
}) => {
  const dr0 = detail.designResult?.[0];
  const sc = dr0?.selected_concerns || [];
  const ac = dr0?.auto_concerns || [];
  const meds = dr0?.selected_medication_texts || [];

  // 업셀링 분류
  const upsellItems = useMemo(() => {
    if (!recommendations.length) return [];
    return recommendations.filter(
      (r: any) => r.category === 'upselling' || r.is_upselling || r.upsell,
    );
  }, [recommendations]);

  const coreItems = useMemo(() => {
    if (!recommendations.length) return [];
    return recommendations.filter(
      (r: any) => r.category !== 'upselling' && !r.is_upselling && !r.upsell,
    );
  }, [recommendations]);

  return (
    <>
      {/* 수검자 선택 항목 */}
      {(sc.length > 0 || ac.length > 0) && (
        <div className="consultation-page__section">
          <h3>수검자 선택 항목 <SourceLabel source="user_input" /></h3>
          {sc.length > 0 && (
            <div className="consultation-page__tag-group">
              {sc.map((c: any, i: number) => (
                <span key={i} className="consultation-page__tag consultation-page__tag--blue">
                  {c.category ? `${c.category} · ` : ''}{c.name || c.label || JSON.stringify(c)}
                </span>
              ))}
            </div>
          )}
          {ac.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 4px' }}>AI 자동 추출</div>
              <div className="consultation-page__tag-group">
                {ac.map((c: any, i: number) => (
                  <span key={i} className="consultation-page__tag" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                    {c.category ? `${c.category} · ` : ''}{c.name || c.label || JSON.stringify(c)}
                  </span>
                ))}
              </div>
            </>
          )}
          {meds.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 4px' }}>복약</div>
              <div className="consultation-page__tag-group">
                {meds.map((m: any, i: number) => (
                  <span key={i} className="consultation-page__tag consultation-page__tag--green">
                    {typeof m === 'string' ? m : JSON.stringify(m)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* AI 추천 검진 항목 */}
      {coreItems.length > 0 && (
        <div className="consultation-page__section">
          <h3>AI 추천 검진 ({coreItems.length}건) <SourceLabel source="welno_checkup_design_requests" /></h3>
          {patientSummary && (
            <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 10 }}>{patientSummary}</p>
          )}
          {coreItems.map((rec: any, i: number) => (
            <div key={i} className="consultation-page__rec-card">
              <div className="rec-name">{rec.item_name || rec.name || `항목 ${i + 1}`}</div>
              {rec.reason && <div className="rec-reason">{rec.reason}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 업셀링 추천 */}
      {upsellItems.length > 0 && (
        <div className="consultation-page__section">
          <h3>업셀링 추천 ({upsellItems.length}건)</h3>
          {upsellItems.map((rec: any, i: number) => (
            <div key={i} className="consultation-page__upsell-card">
              <div className="upsell-name">{rec.item_name || rec.name || `항목 ${i + 1}`}</div>
              {rec.reason && <div className="upsell-reason">{rec.reason}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 고객 프로파일 */}
      {sessionTags && <ProfileSection sessionTags={sessionTags} />}

      {/* 대화 요약 + 관심사 태그 */}
      {sessionTags && (sessionTags.conversation_summary || sessionTags.key_concerns?.length || sessionTags.interest_tags?.length) && (
        <div className="consultation-page__section">
          <h3>대화 요약</h3>
          {sessionTags.conversation_summary && (
            <p className="consultation-page__summary-text">{sessionTags.conversation_summary}</p>
          )}
          {sessionTags.key_concerns && sessionTags.key_concerns.length > 0 && (
            <div className="consultation-page__tag-group">
              <strong>주요 고민:</strong>{' '}
              {sessionTags.key_concerns.map((c: any, i: number) => (
                <span key={i} className="consultation-page__tag consultation-page__tag--warn">
                  {typeof c === 'string' ? c : c?.topic || JSON.stringify(c)}
                </span>
              ))}
            </div>
          )}
          {sessionTags.interest_tags && sessionTags.interest_tags.length > 0 && (
            <div className="consultation-page__tag-group">
              <strong>관심사:</strong>{' '}
              {sessionTags.interest_tags.map((t: any, i: number) => (
                <span key={i} className="consultation-page__tag consultation-page__tag--blue">
                  {typeof t === 'string' ? t : t?.topic || JSON.stringify(t)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 상담 스크립트 제안 */}
      {sessionTags && (sessionTags.counselor_recommendations?.length || sessionTags.suggested_revisit_messages?.length) && (
        <div className="consultation-page__section">
          <h3>상담 스크립트 제안</h3>
          {sessionTags.counselor_recommendations && sessionTags.counselor_recommendations.length > 0 && (
            sessionTags.counselor_recommendations.map((r: any, i: number) => (
              <div key={i} className="consultation-page__script-suggestion">
                {typeof r === 'string' ? r : JSON.stringify(r)}
              </div>
            ))
          )}
          {sessionTags.suggested_revisit_messages && sessionTags.suggested_revisit_messages.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 6px' }}>재방문 스크립트</div>
              {sessionTags.suggested_revisit_messages.map((m: any, i: number) => (
                <div key={i} className="consultation-page__script-card">
                  {typeof m === 'string' ? m : m?.message || m?.text || JSON.stringify(m)}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 업셀링 태그 (commercial_tags) */}
      {sessionTags && (sessionTags.buying_signal || sessionTags.commercial_tags?.length) && (
        <div className="consultation-page__section">
          <h3>구매 신호</h3>
          <div className="consultation-page__tag-group">
            {sessionTags.buying_signal && (
              <span>
                <strong>구매신호:</strong>{' '}
                <span className="consultation-page__tag consultation-page__tag--signal" data-level={sessionTags.buying_signal}>
                  {BUYING_LABELS[sessionTags.buying_signal] || sessionTags.buying_signal}
                </span>
              </span>
            )}
            {sessionTags.commercial_tags && sessionTags.commercial_tags.length > 0 && (
              <span style={{ marginLeft: sessionTags.buying_signal ? 12 : 0 }}>
                <strong>업셀링:</strong>{' '}
                {sessionTags.commercial_tags.map((t: any, i: number) => (
                  <span key={i} className="consultation-page__tag consultation-page__tag--commercial">
                    {typeof t === 'string' ? t : t?.category || t?.product_hint || JSON.stringify(t)}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 의료/생활 태그 */}
      {sessionTags && (sessionTags.risk_tags?.length || sessionTags.medical_tags?.length || sessionTags.lifestyle_tags?.length || sessionTags.nutrition_tags?.length) && (
        <SessionMedicalSection sessionTags={sessionTags} />
      )}

      {/* 상태 변경 */}
      <div className="consultation-page__section">
        <h3>상담 상태</h3>
        <div className="consultation-page__status-actions">
          {currentStatus === 'pending' && (
            <button
              className="consultation-page__status-btn consultation-page__status-btn--primary"
              disabled={statusUpdating}
              onClick={() => onStatusChange('contacted')}
            >
              진행중으로 변경
            </button>
          )}
          {currentStatus === 'contacted' && (
            <button
              className="consultation-page__status-btn consultation-page__status-btn--primary"
              disabled={statusUpdating}
              onClick={() => onStatusChange('completed')}
            >
              완료 처리
            </button>
          )}
          {currentStatus === 'completed' && (
            <span style={{ fontSize: 14, color: '#059669', fontWeight: 600 }}>
              상담 완료
            </span>
          )}
        </div>
      </div>
    </>
  );
};

/* ── 프로파일 섹션 ── */
const ProfileSection: React.FC<{ sessionTags: SessionTags }> = ({ sessionTags }) => (
  <div className="consultation-page__section">
    <h3>고객 프로파일</h3>
    <div className="consultation-page__profile-grid">
      <div className="consultation-page__profile-item">
        <dt>페르소나</dt>
        <dd>
          {sessionTags.prospect_type && (
            <span className="consultation-page__tag consultation-page__tag--blue">
              {PROSPECT_LABELS[sessionTags.prospect_type] || sessionTags.prospect_type}
            </span>
          )}
          {sessionTags.sentiment && (
            <span className="consultation-page__tag">
              {SENTIMENT_LABELS[sessionTags.sentiment] || sessionTags.sentiment}
            </span>
          )}
          {sessionTags.anxiety_level && (
            <span className="consultation-page__tag consultation-page__tag--warn">
              불안: {ANXIETY_LABELS[sessionTags.anxiety_level] || sessionTags.anxiety_level}
            </span>
          )}
        </dd>
      </div>
      <div className="consultation-page__profile-item">
        <dt>위험도</dt>
        <dd>
          {sessionTags.risk_level ? (
            <span className="consultation-page__risk-badge" style={{ background: RISK_COLORS[sessionTags.risk_level] || '#6b7280' }}>
              {RISK_LABELS[sessionTags.risk_level] || sessionTags.risk_level}
            </span>
          ) : '-'}
          {sessionTags.medical_urgency && (
            <span className="consultation-page__tag consultation-page__tag--warn" style={{ marginLeft: 4 }}>
              {URGENCY_LABELS[sessionTags.medical_urgency] || sessionTags.medical_urgency}
            </span>
          )}
        </dd>
      </div>
      <div className="consultation-page__profile-item">
        <dt>참여도</dt>
        <dd>
          {sessionTags.engagement_score != null ? (
            <div className="consultation-page__gauge">
              <div className="consultation-page__gauge-fill" style={{ width: `${Math.min(sessionTags.engagement_score, 100)}%` }} />
              <span className="consultation-page__gauge-value">{sessionTags.engagement_score}점</span>
            </div>
          ) : '-'}
        </dd>
      </div>
    </div>
  </div>
);

/* ── 상담 가이드 서브 컴포넌트 ── */
const SessionGuideSection: React.FC<{ sessionTags: SessionTags }> = ({ sessionTags }) => (
  <div className="consultation-page__section">
    <h3>상담 가이드</h3>
    {sessionTags.counselor_recommendations && sessionTags.counselor_recommendations.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 13, color: '#4a5568' }}>AI 상담 추천:</strong>
        <ul className="consultation-page__guide-list">
          {sessionTags.counselor_recommendations.map((r: any, i: number) => (
            <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>
          ))}
        </ul>
      </div>
    )}
    {sessionTags.suggested_revisit_messages && sessionTags.suggested_revisit_messages.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 13, color: '#4a5568' }}>재방문 스크립트:</strong>
        <div className="consultation-page__script-cards">
          {sessionTags.suggested_revisit_messages.map((m: any, i: number) => (
            <div key={i} className="consultation-page__script-card">
              {typeof m === 'string' ? m : m?.message || m?.text || JSON.stringify(m)}
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="consultation-page__tag-group">
      {sessionTags.buying_signal && (
        <span>
          <strong>구매신호:</strong>{' '}
          <span className="consultation-page__tag consultation-page__tag--signal" data-level={sessionTags.buying_signal}>
            {BUYING_LABELS[sessionTags.buying_signal] || sessionTags.buying_signal}
          </span>
        </span>
      )}
      {sessionTags.commercial_tags && sessionTags.commercial_tags.length > 0 && (
        <span style={{ marginLeft: sessionTags.buying_signal ? 12 : 0 }}>
          <strong>업셀링:</strong>{' '}
          {sessionTags.commercial_tags.map((t: any, i: number) => (
            <span key={i} className="consultation-page__tag consultation-page__tag--commercial">
              {typeof t === 'string' ? t : t?.category || t?.product_hint || JSON.stringify(t)}
            </span>
          ))}
        </span>
      )}
    </div>
  </div>
);

/* ── 의료/생활 태그 서브 컴포넌트 ── */
const SessionMedicalSection: React.FC<{ sessionTags: SessionTags }> = ({ sessionTags }) => (
  <div className="consultation-page__section">
    <h3>의료 / 생활 태그</h3>
    {sessionTags.risk_tags && sessionTags.risk_tags.length > 0 && (
      <div className="consultation-page__tag-group">
        <strong>위험 태그:</strong>{' '}
        {sessionTags.risk_tags.map((t: any, i: number) => (
          <span key={i} className="consultation-page__tag consultation-page__tag--danger">
            {typeof t === 'string' ? t : t?.tag || t?.name || JSON.stringify(t)}
          </span>
        ))}
      </div>
    )}
    {sessionTags.medical_tags && sessionTags.medical_tags.length > 0 && (
      <div className="consultation-page__tag-group">
        <strong>의료:</strong>{' '}
        {sessionTags.medical_tags.map((t: any, i: number) => (
          <span key={i} className="consultation-page__tag consultation-page__tag--warn">
            {typeof t === 'string' ? t : JSON.stringify(t)}
          </span>
        ))}
      </div>
    )}
    {sessionTags.lifestyle_tags && sessionTags.lifestyle_tags.length > 0 && (
      <div className="consultation-page__tag-group">
        <strong>생활습관:</strong>{' '}
        {sessionTags.lifestyle_tags.map((t: any, i: number) => (
          <span key={i} className="consultation-page__tag">
            {typeof t === 'string' ? t : JSON.stringify(t)}
          </span>
        ))}
      </div>
    )}
    {sessionTags.nutrition_tags && sessionTags.nutrition_tags.length > 0 && (
      <div className="consultation-page__tag-group">
        <strong>영양:</strong>{' '}
        {sessionTags.nutrition_tags.map((t: any, i: number) => (
          <span key={i} className="consultation-page__tag consultation-page__tag--green">
            {typeof t === 'string' ? t : JSON.stringify(t)}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default ConsultationPage;
