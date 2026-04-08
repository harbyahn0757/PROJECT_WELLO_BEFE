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
  hospital_id?: string | null;
  hospital_name?: string | null;
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

interface HospitalCheckupItem {
  item_name: string;
  category: string | null;
  target_trigger: string | null;
  gap_description: string | null;
  solution_narrative: string | null;
}

interface ParsedCheckupItem {
  inspection: string;
  illness: string;
  item_name: string;
  value: string | null;
  unit: string;
  judgment: string | null;
}

interface HealthRecordV2 extends HealthRecord {
  summary?: any;
  inspections?: any[];
  parsed_items?: ParsedCheckupItem[];
}

interface DetailData {
  patient: PatientInfo | null;
  healthData: HealthRecordV2[];
  designResult: DesignResult[];
  sessionTags: SessionTags | null;
  timing: TimingData | null;
  prescriptionData: PrescriptionRecord[];
  hospitalCheckupItems?: HospitalCheckupItem[];
  mlRecommendations?: any;
  dataLabels?: any;
}

/* ── 상수 ── */
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', contacted: '진행중', completed: '완료',
};
const STATUS_BADGE_CLS: Record<string, string> = {
  pending: 'pending', contacted: 'contacted', completed: 'completed',
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

const PERSONA_COLORS: Record<string, string> = {
  Worrier: '#9ca3af', Manager: '#6b7280', Optimizer: '#78716c',
  'Symptom Solver': '#a1a1aa', Minimalist: '#d4d4d8',
};
const PERSONA_LABELS: Record<string, string> = {
  Worrier: '걱정형', Manager: '관리형', Optimizer: '최적화형',
  'Symptom Solver': '증상해결형', Minimalist: '미니멀형',
};
const RISK_LEVEL_COLORS: Record<string, string> = {
  Low: '#10b981', Moderate: '#f59e0b', High: '#ef4444', 'Very High': '#991b1b',
};
const RISK_LEVEL_WIDTH: Record<string, number> = {
  Low: 25, Moderate: 50, High: 75, 'Very High': 100,
};
const JUDGMENT_CLS: Record<string, string> = {
  '정상': 'normal', '경계': 'borderline', '질환의심': 'abnormal', '이상': 'abnormal',
};

function getAge(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

/* ── 추이 이상 판정 ── */
/* WELNO 문진 키→한글 매핑 */
const SURVEY_LABELS: Record<string, string> = {
  weight_change: '체중 변화', daily_routine: '일과 패턴', exercise_frequency: '운동 빈도',
  smoking: '흡연', drinking: '음주', sleep_hours: '수면 시간',
  family_history: '가족력', colonoscopy_experience: '대장내시경 경험', additional_concerns: '추가 걱정',
};
const SURVEY_VALUES: Record<string, Record<string, string>> = {
  weight_change: { maintain: '변화없음', decrease_bad: '의도치 않게 빠짐(3kg+)', decrease_good: '다이어트로 뺌', increase_some: '조금 쪘음(1~3kg)', increase_more: '많이 쪘음(3kg+)' },
  exercise_frequency: { regular: '주 3회+', sometimes: '주 1-2회', rarely: '거의 안 함', never: '전혀 안 함' },
  smoking: { never: '비흡연', quit: '금연', half_pack: '반 갑/일', one_pack: '한 갑+/일' },
  drinking: { never: '안 함', rarely: '월 1-2회', sometimes: '주 1-2회', often: '주 3회+', daily: '매일' },
  sleep_hours: { less_5: '5시간 미만', five_to_six: '5-6시간', seven_to_eight: '7-8시간', over_8: '8시간 이상' },
};
const DAILY_ROUTINE_LABELS: Record<string, string> = {
  desk_job: '앉아서 근무', mental_stress: '정신적 압박', service_job: '감정 소모',
  physical_job: '서서/몸쓰는 일', irregular: '밤낮 불규칙', home_maker: '가사/휴식',
};
const FAMILY_HISTORY_LABELS: Record<string, string> = {
  diabetes: '당뇨', hypertension: '고혈압', cancer: '암', heart: '심장질환',
  stroke: '뇌졸중', thyroid: '갑상선', none: '없음',
};

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

  /* 목록 조회 — 전체 상태 한 번에 */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        status: 'all',
        page: '1',
        limit: '100',  // 백엔드 최대 100 제한 (ge=1, le=100)
      });
      if (hospitalId) qs.set('hospital_id', hospitalId);
      const res = await fetchWithAuth(`${API}/consultation/list?${qs}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { console.error('[ConsultationPage] list 조회 실패:', e); }
    setLoading(false);
  }, [API, hospitalId]);

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
      {/* 타이틀 제거 (2026-04-08): CheckupDesignManagementPage 탭으로 흡수돼서 중복 */}
      <div className="consultation-page__body">
        {/* ── 테이블 (검진결과 상담 스타일) ── */}
        <div className="consultation-page__list-panel">
          {items.length === 0 ? (
            <div className="consultation-page__empty">상담 요청이 없습니다</div>
          ) : (
            <div className="admin-embedding-page__table-wrapper">
              <table className="admin-embedding-page__table admin-embedding-page__table--detailed">
                <thead>
                  <tr>
                    <th>요청일</th>
                    <th>이름</th>
                    <th>병원</th>
                    <th>추천 항목</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.session_id}
                      className={selectedUuid === item.uuid ? 'is-selected' : ''}
                      onClick={() => handleSelect(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="td-date">{item.requested_at?.replace('T', ' ').slice(0, 16) || '-'}</td>
                      <td className="td-name">{item.name || '이름 없음'}</td>
                      <td className="td-hospital">{item.hospital_name || '-'}</td>
                      <td className="td-count">
                        {item.design_summary ? `${item.design_summary.recommended_count}항목` : '-'}
                      </td>
                      <td>
                        <span className={`consultation-page__badge consultation-page__badge--${STATUS_BADGE_CLS[item.status] || 'pending'}`}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 드로워 오버레이 + 패널 ── */}
      {drawerOpen && (
        <div className="consultation-page__overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <div className={`consultation-page__drawer${drawerOpen ? ' consultation-page__drawer--open' : ''}`}>
        <DrawerHeader
          detail={detail}
          selectedItem={selectedItem || null}
          onClose={() => setDrawerOpen(false)}
          currentStatus={selectedItem?.status || 'pending'}
          statusUpdating={statusUpdating}
          onStatusChange={handleStatusChange}
        />
        <div className="consultation-page__drawer-body">
          {detailLoading && <Spinner />}
          {!detailLoading && detail && (
            <DetailPanel
              detail={detail}
              selectedItem={selectedItem || null}
              statusUpdating={statusUpdating}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   드로워 헤더
   ══════════════════════════════════════════════════ */
interface DrawerHeaderProps {
  detail: DetailData | null;
  selectedItem: ConsultationItem | null;
  onClose: () => void;
  currentStatus: string;
  statusUpdating: boolean;
  onStatusChange: (s: string) => void;
}

const DrawerHeader: React.FC<DrawerHeaderProps> = ({
  detail, selectedItem, onClose, currentStatus, statusUpdating, onStatusChange,
}) => {
  const p = detail?.patient;
  const s1h = detail?.designResult?.[0]?.step1_result?.persona
    || (detail?.designResult?.[0] as any)?.step1_highlights?.persona;
  const age = getAge(p?.birth_date || null);
  const genderStr = p?.gender === 'M' ? '남' : p?.gender === 'F' ? '여' : '';
  const nameStr = p?.name || selectedItem?.name || '고객 상세';
  const personaType = s1h?.type || s1h?.primary_persona || '';
  const anxLevel = detail?.sessionTags?.anxiety_level;

  return (
    <div className="consultation-page__drawer-header">
      <div className="consultation-page__drawer-header-left">
        <h3>
          {nameStr}
          {(genderStr || age) && (
            <span style={{ fontSize: 13, fontWeight: 400, color: '#718096', marginLeft: 6 }}>
              ({genderStr}{age != null ? `, ${age}세` : ''})
            </span>
          )}
        </h3>
        {detail?.timing && (
          <div className="consultation-page__timing">
            {detail.timing.entry_at && <span className="consultation-page__timing-item"><span className="label">유입</span><span className="value">{formatTime(detail.timing.entry_at)}</span></span>}
            <span style={{ color: '#a0aec0' }}>→</span>
            {detail.timing.design_start_at && <span className="consultation-page__timing-item"><span className="label">시작</span><span className="value">{formatTime(detail.timing.design_start_at)}</span></span>}
            <span style={{ color: '#a0aec0' }}>→</span>
            {detail.timing.design_complete_at && <span className="consultation-page__timing-item"><span className="label">완료</span><span className="value">{formatTime(detail.timing.design_complete_at)}</span></span>}
          </div>
        )}
        <select
          className="consultation-page__status-select"
          value={currentStatus}
          disabled={statusUpdating}
          onChange={e => onStatusChange(e.target.value)}
        >
          <option value="pending">대기</option>
          <option value="contacted">진행중</option>
          <option value="completed">완료</option>
        </select>
      </div>
      <button className="consultation-page__drawer-close" onClick={onClose}>&times;</button>
      {/* 2행: 페르소나 뱃지 */}
      {personaType && (
        <div className="consultation-page__persona-badge-row">
          <span className="consultation-page__persona-badge" style={{ borderLeftColor: PERSONA_COLORS[personaType] || '#6b7280' }}>
            {PERSONA_LABELS[personaType] || personaType}
          </span>
          {anxLevel && <span className="consultation-page__tag consultation-page__tag--warn">불안 {ANXIETY_LABELS[anxLevel] || anxLevel}</span>}
          {detail?.sessionTags?.risk_level && (
            <span className="consultation-page__risk-badge" style={{ background: RISK_COLORS[detail.sessionTags.risk_level] || '#6b7280' }}>
              {RISK_LABELS[detail.sessionTags.risk_level] || detail.sessionTags.risk_level}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   상세 패널 (2-column)
   ══════════════════════════════════════════════════ */
interface DetailPanelProps {
  detail: DetailData;
  selectedItem: ConsultationItem | null;
  statusUpdating: boolean;
  onStatusChange: (s: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ detail, selectedItem, statusUpdating, onStatusChange }) => {
  const dr0 = detail.designResult?.[0];
  const s1 = dr0?.step1_result || (dr0 as any)?.step1_highlights || null;
  const s2 = (dr0 as any)?.step2_result || (dr0 as any)?.step2_highlights || null;

  return (
    <div className="consultation-page__split-grid">
      <div className="consultation-page__split-col consultation-page__split-col--left">
        <LeftColProfile detail={detail} step1={s1} step2={s2} />
      </div>
      <div className="consultation-page__split-col consultation-page__split-col--right">
        <RightColData detail={detail} step1={s1} step2={s2} />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   좌측 컬럼: 고객 프로파일 + 상담 전략 [A]~[E-4]
   ══════════════════════════════════════════════════ */
const LeftColProfile: React.FC<{ detail: DetailData; step1: any; step2: any }> = ({ detail, step1, step2 }) => {
  const sessionTags = detail.sessionTags;
  return (
    <>
      <SectionPersona persona={step1?.persona} />
      <SectionConcernGap data={step1?.concern_vs_reality} />
      <SectionRiskProfile data={step1?.risk_profile} />
      <SectionChronic data={step1?.chronic_analysis} />
      <SectionBridgeStrategy strategies={step2?.strategies} />
      <SectionDoctorComment data={step2?.doctor_comment} />
      <SectionConversation sessionTags={sessionTags} />
      <SectionCounselorScript sessionTags={sessionTags} />
    </>
  );
};

/* [A] 페르소나 카드 */
const SectionPersona: React.FC<{ persona: any }> = ({ persona }) => {
  if (!persona) return null;
  const pType = persona.type || persona.primary_persona || '';
  const color = PERSONA_COLORS[pType] || '#6b7280';
  return (
    <div className="consultation-page__section consultation-page__persona-card" style={{ borderLeftColor: color }}>
      <h3>페르소나</h3>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
        {pType}{PERSONA_LABELS[pType] ? ` (${PERSONA_LABELS[pType]})` : ''}
      </div>
      {persona.description && <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, margin: '4px 0 8px' }}>{persona.description}</p>}
      {persona.strategy_key && (
        <div style={{ fontSize: 12, color: '#374151', background: '#fafafa', padding: '4px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>
          전략: {persona.strategy_key}
        </div>
      )}
      {persona.risk_flags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {persona.risk_flags.map((f: string, i: number) => (
            <span key={i} className="consultation-page__tag consultation-page__tag--danger">{f}</span>
          ))}
        </div>
      )}
    </div>
  );
};

/* [B] 걱정 vs 현실 Gap */
const SectionConcernGap: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  const typeLabel: Record<string, string> = { Match: '일치', Over_Concern: '과잉걱정', Hidden_Risk: '숨겨진 위험' };
  const typeCls: Record<string, string> = { Match: 'green', Over_Concern: 'warn', Hidden_Risk: 'danger' };
  return (
    <div className="consultation-page__section">
      <h3>걱정 vs 현실 Gap</h3>
      {data.match_type && (
        <span className={`consultation-page__tag consultation-page__tag--${typeCls[data.match_type] || ''}`} style={{ marginBottom: 6, display: 'inline-block' }}>
          {typeLabel[data.match_type] || data.match_type}
        </span>
      )}
      {data.message && <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, margin: '4px 0 0' }}>{data.message}</p>}
    </div>
  );
};

/* [C] 위험 프로파일 (장기별 게이지) */
const SectionRiskProfile: React.FC<{ data: any[] | null | undefined }> = ({ data }) => {
  if (!data?.length) return null;
  return (
    <div className="consultation-page__section">
      <h3>위험 프로파일</h3>
      {data.map((r: any, i: number) => (
        <div key={i} className="consultation-page__risk-row">
          <span className="consultation-page__risk-organ">{r.organ_system}</span>
          <div className="consultation-page__gauge" style={{ flex: 1 }}>
            <div className="consultation-page__gauge-fill" style={{ width: `${RISK_LEVEL_WIDTH[r.risk_level] || 25}%`, background: RISK_LEVEL_COLORS[r.risk_level] || '#6b7280' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: RISK_LEVEL_COLORS[r.risk_level] || '#6b7280', minWidth: 60 }}>{r.risk_level}</span>
          {r.reason && <div style={{ fontSize: 11, color: '#718096', width: '100%', marginTop: 2, paddingLeft: 80 }}>{r.reason}</div>}
        </div>
      ))}
    </div>
  );
};

/* [D] 만성질환 분석 */
const SectionChronic: React.FC<{ data: any }> = ({ data }) => {
  if (!data || !data.has_chronic_disease) return null;
  return (
    <div className="consultation-page__section">
      <h3>만성질환 분석</h3>
      {data.disease_list?.map((d: string, i: number) => (
        <span key={i} className="consultation-page__tag consultation-page__tag--warn" style={{ marginRight: 4, marginBottom: 4, display: 'inline-block' }}>{d}</span>
      ))}
      {data.complication_risk && <p style={{ fontSize: 13, color: '#b91c1c', marginTop: 8 }}>합병증 위험: {data.complication_risk}</p>}
    </div>
  );
};

/* [E] Bridge Strategy */
const SectionBridgeStrategy: React.FC<{ strategies: any[] | null | undefined }> = ({ strategies }) => {
  const [openIdx, setOpenIdx] = useState<number>(0);
  if (!strategies?.length) return null;
  return (
    <div className="consultation-page__section">
      <h3>설득 전략 (Bridge Strategy)</h3>
      {strategies.map((s: any, i: number) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} className={`consultation-page__bridge-card${isOpen ? ' consultation-page__bridge-card--open' : ''}`}>
            <button className="consultation-page__bridge-header" onClick={() => setOpenIdx(isOpen ? -1 : i)}>
              <span style={{ fontWeight: 600 }}>{i + 1}. {s.target}</span>
              <span style={{ fontSize: 12, color: '#718096' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="consultation-page__bridge-body">
                {s.step1_anchor && <div className="consultation-page__bridge-step"><span>Step1 공감</span>{s.step1_anchor}</div>}
                {s.step2_gap && <div className="consultation-page__bridge-step"><span>Step2 Gap</span>{s.step2_gap}</div>}
                {s.step3_offer && <div className="consultation-page__bridge-step"><span>Step3 제안</span>{s.step3_offer}</div>}
                {s.doctor_recommendation && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
                    {s.doctor_recommendation.reason && <div style={{ marginBottom: 4 }}><strong>근거:</strong> {s.doctor_recommendation.reason}</div>}
                    {s.doctor_recommendation.evidence && <div style={{ marginBottom: 4, color: '#6b7280' }}>{s.doctor_recommendation.evidence}</div>}
                    {s.doctor_recommendation.message && <div style={{ color: '#374151' }}>{s.doctor_recommendation.message}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* [E-2] 의사 종합 코멘트 */
const SectionDoctorComment: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="consultation-page__section">
      <h3>의사 종합 코멘트</h3>
      {data.overall_assessment && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{data.overall_assessment}</p>}
      {data.key_recommendations?.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4a5568' }}>
          {data.key_recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
        </ol>
      )}
    </div>
  );
};

/* [E-3] 대화 요약 + 관심사 */
const SectionConversation: React.FC<{ sessionTags: SessionTags | null }> = ({ sessionTags }) => {
  if (!sessionTags) return null;
  const hasSummary = sessionTags.conversation_summary || sessionTags.key_concerns?.length || sessionTags.interest_tags?.length;
  if (!hasSummary) return null;
  return (
    <div className="consultation-page__section">
      <h3>대화 요약 + 관심사</h3>
      {sessionTags.conversation_summary && <p className="consultation-page__summary-text">{sessionTags.conversation_summary}</p>}
      {sessionTags.key_concerns?.length ? (
        <div className="consultation-page__tag-group"><strong>주요 고민:</strong>{' '}
          {sessionTags.key_concerns.map((c: any, i: number) => (
            <span key={i} className="consultation-page__tag consultation-page__tag--warn">{typeof c === 'string' ? c : c?.topic || JSON.stringify(c)}</span>
          ))}
        </div>
      ) : null}
      {sessionTags.interest_tags?.length ? (
        <div className="consultation-page__tag-group"><strong>관심사:</strong>{' '}
          {sessionTags.interest_tags.map((t: any, i: number) => (
            <span key={i} className="consultation-page__tag consultation-page__tag--blue">{typeof t === 'string' ? t : t?.topic || JSON.stringify(t)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* [E-4] 상담 추천 스크립트 */
const SectionCounselorScript: React.FC<{ sessionTags: SessionTags | null }> = ({ sessionTags }) => {
  if (!sessionTags) return null;
  const hasScript = sessionTags.counselor_recommendations?.length || sessionTags.suggested_revisit_messages?.length;
  if (!hasScript) return null;
  return (
    <div className="consultation-page__section">
      <h3>AI 추천 상담 멘트</h3>
      {sessionTags.counselor_recommendations?.map((r: any, i: number) => (
        <div key={i} className="consultation-page__script-suggestion">{typeof r === 'string' ? r : JSON.stringify(r)}</div>
      ))}
      {sessionTags.suggested_revisit_messages?.length ? (
        <>
          <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 4px' }}>재방문 안내 문구</div>
          {sessionTags.suggested_revisit_messages.map((m: any, i: number) => (
            <div key={i} className="consultation-page__script-card">{typeof m === 'string' ? m : m?.message || m?.text || JSON.stringify(m)}</div>
          ))}
        </>
      ) : null}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   우측 컬럼: 건강 데이터 + 추천 항목 [F]~[J]
   ══════════════════════════════════════════════════ */
const RightColData: React.FC<{ detail: DetailData; step1: any; step2: any }> = ({ detail, step1, step2 }) => {
  const dr0 = detail.designResult?.[0];
  const survey = dr0?.survey_responses;
  const rx = detail.prescriptionData || [];
  const hci = detail.hospitalCheckupItems || [];
  const sessionTags = detail.sessionTags;
  const recommendations = dr0?.design_result?.recommended_items || [];
  return (
    <>
      <SectionHealthDetail healthData={detail.healthData} />
      <SectionAIRecommend step1={step1} step2={step2} recommendations={recommendations} />
      <SectionPrescription rx={rx} />
      <SectionSurvey survey={survey} />
      <SectionUpselling sessionTags={sessionTags} strategies={step2?.strategies} hci={hci} />
    </>
  );
};

/* [F] 건강검진 상세 (항목별 값+판정, 접이식 연도별) */
const SectionHealthDetail: React.FC<{ healthData: HealthRecordV2[] }> = ({ healthData }) => {
  const sorted = useMemo(() => [...(healthData || [])].sort((a, b) => (b.year || 0) - (a.year || 0)), [healthData]);
  const [openYear, setOpenYear] = useState<number | null>(sorted[0]?.year || null);

  if (!sorted.length) return null;

  return (
    <div className="consultation-page__section">
      <h3>건강검진 상세</h3>
      {sorted.map((h, idx) => {
        const isOpen = openYear === h.year;
        const items: ParsedCheckupItem[] = h.parsed_items || [];
        const inspections = h.inspections || [];
        // group parsed items by inspection
        const grouped: Record<string, ParsedCheckupItem[]> = {};
        items.forEach(it => { (grouped[it.inspection] = grouped[it.inspection] || []).push(it); });
        const hasItems = items.length > 0 || inspections.length > 0;
        return (
          <div key={idx} className="consultation-page__accordion">
            <button className="consultation-page__accordion-header" onClick={() => setOpenYear(isOpen ? null : h.year)}>
              <span>{h.year || '-'}년{idx === 0 ? ' (최신)' : ''}</span>
              <span>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && hasItems && (
              <div className="consultation-page__accordion-body">
                {Object.keys(grouped).length > 0 ? Object.entries(grouped).map(([insp, gitems]) => (
                  <div key={insp} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>[{insp}]</div>
                    <table className="consultation-page__health-table">
                      <thead><tr><th>항목</th><th>값</th><th>단위</th><th>판정</th></tr></thead>
                      <tbody>
                        {gitems.map((it, j) => (
                          <tr key={j}>
                            <td>{it.item_name}</td>
                            <td style={{ fontWeight: 500 }}>{it.value ?? '-'}</td>
                            <td>{it.unit}</td>
                            <td><span className={`consultation-page__trend consultation-page__trend--${JUDGMENT_CLS[it.judgment || ''] || 'normal'}`}>{it.judgment || '-'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )) : (
                  <HealthSummaryFallback h={h} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* 요약 폴백 (parsed_items 없을 때) */
const HealthSummaryFallback: React.FC<{ h: HealthRecordV2 }> = ({ h }) => (
  <table className="consultation-page__health-table">
    <thead><tr><th>항목</th><th>값</th></tr></thead>
    <tbody>
      {h.height != null && <tr><td>신장</td><td>{h.height} cm</td></tr>}
      {h.weight != null && <tr><td>체중</td><td>{h.weight} kg</td></tr>}
      {h.blood_pressure_high != null && <tr><td>혈압</td><td>{h.blood_pressure_high}/{h.blood_pressure_low}</td></tr>}
      {h.blood_sugar != null && <tr><td>공복혈당</td><td>{h.blood_sugar}</td></tr>}
      {h.cholesterol != null && <tr><td>총콜레스테롤</td><td>{h.cholesterol}</td></tr>}
    </tbody>
  </table>
);

/* [G] AI 추천 검진 (Priority 1/2/3) */
const SectionAIRecommend: React.FC<{ step1: any; step2: any; recommendations: any[] }> = ({ step1, step2, recommendations }) => {
  const focusItems = step1?.basic_checkup_guide?.focus_items || [];
  const p2 = step2?.priority_2 || step2?.priority_2;
  const p3 = step2?.priority_3 || step2?.priority_3;
  const hasContent = focusItems.length > 0 || p2 || p3 || recommendations.length > 0;
  if (!hasContent) return null;
  return (
    <div className="consultation-page__section">
      <h3>AI 추천 검진 항목</h3>
      {focusItems.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Priority 1: 일반검진 주의항목</div>
          {focusItems.map((f: any, i: number) => (
            <div key={i} className="consultation-page__rec-card" style={{ background: '#fafafa', borderColor: '#e5e7eb' }}>
              <div className="rec-name">{f.item_name}</div>
              {f.why_important && <div className="rec-reason">{f.why_important}</div>}
              {f.check_point && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{f.check_point}</div>}
            </div>
          ))}
        </div>
      )}
      {p2 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 6 }}>Priority 2: {p2.title || '병원 추천 정밀검진'}</div>
          {p2.health_context && <p style={{ fontSize: 12, color: '#92400e', marginBottom: 6 }}>{p2.health_context}</p>}
          {(p2.items || []).map((it: any, i: number) => (
            <div key={i} className="consultation-page__rec-card" style={{ background: '#fafafa', borderColor: '#e5e7eb' }}>
              <div className="rec-name">{it.item_name || it.name || it}</div>
              {it.reason && <div className="rec-reason">{it.reason}</div>}
            </div>
          ))}
        </div>
      )}
      {p3 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Priority 3: {p3.title || '선택 정밀검진'}</div>
          {(p3.items || []).map((it: any, i: number) => (
            <div key={i} className="consultation-page__rec-card">
              <div className="rec-name">{it.item_name || it.name || it}</div>
              {it.reason && <div className="rec-reason">{it.reason}</div>}
            </div>
          ))}
        </div>
      )}
      {!focusItems.length && !p2 && !p3 && recommendations.length > 0 && (
        <>
          {recommendations.map((rec: any, i: number) => (
            <div key={i} className="consultation-page__rec-card">
              <div className="rec-name">{rec.item_name || rec.name || `항목 ${i + 1}`}</div>
              {rec.reason && <div className="rec-reason">{rec.reason}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

/* [H] 투약 내역 */
const SectionPrescription: React.FC<{ rx: PrescriptionRecord[] }> = ({ rx }) => {
  if (!rx?.length) return null;
  return (
    <div className="consultation-page__section">
      <h3>투약 내역 ({rx.length}건)</h3>
      {rx.slice(0, 10).map((r, i) => (
        <div key={i} className="consultation-page__rx-card">
          <div className="rx-header">
            <span className="rx-hospital">{r.hospital_name || '-'}</span>
            <span className="rx-date">{r.treatment_date || '-'}</span>
          </div>
          {r.medications.length > 0 && (
            <ul className="rx-meds">
              {r.medications.slice(0, 5).map((m, j) => (
                <li key={j}>{m.name}{m.effect ? ` (${m.effect})` : ''}{m.days ? ` ${m.days}일` : ''}</li>
              ))}
              {r.medications.length > 5 && <li>... 외 {r.medications.length - 5}건</li>}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

/* [I] 문진 응답 요약 — WELNO 키→한글 변환 */
const SectionSurvey: React.FC<{ survey: any }> = ({ survey }) => {
  if (!survey || typeof survey !== 'object') return null;
  const renderValue = (key: string, val: any): string => {
    if (Array.isArray(val)) {
      if (key === 'daily_routine') return val.map(v => DAILY_ROUTINE_LABELS[v] || v).join(', ');
      if (key === 'family_history') return val.map(v => FAMILY_HISTORY_LABELS[v] || v).join(', ');
      return val.join(', ');
    }
    if (typeof val === 'string' && SURVEY_VALUES[key]?.[val]) return SURVEY_VALUES[key][val];
    return typeof val === 'string' ? val : JSON.stringify(val);
  };
  return (
    <div className="consultation-page__section">
      <h3>문진 응답</h3>
      <dl className="consultation-page__patient-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {Object.entries(survey).slice(0, 12).map(([k, v]) => (
          <div key={k}>
            <dt>{SURVEY_LABELS[k] || k}</dt>
            <dd>{renderValue(k, v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/* [J] 업셀링 + 병원 검사 항목 */
const SectionUpselling: React.FC<{ sessionTags: SessionTags | null; strategies: any[] | null | undefined; hci: HospitalCheckupItem[] }> = ({ sessionTags, strategies, hci }) => {
  const hasBuying = sessionTags?.buying_signal || sessionTags?.commercial_tags?.length;
  const hasEvidence = strategies?.some((s: any) => s.doctor_recommendation?.evidence);
  const hasHci = hci?.length > 0;
  if (!hasBuying && !hasEvidence && !hasHci) return null;
  return (
    <div className="consultation-page__section">
      <h3>업셀링 포인트</h3>
      {sessionTags?.buying_signal && (
        <div className="consultation-page__tag-group" style={{ marginBottom: 8 }}>
          <strong>구매신호:</strong>{' '}
          <span className="consultation-page__tag consultation-page__tag--signal" data-level={sessionTags.buying_signal}>
            {BUYING_LABELS[sessionTags.buying_signal] || sessionTags.buying_signal}
          </span>
          {sessionTags.commercial_tags?.map((t: any, i: number) => (
            <span key={i} className="consultation-page__tag consultation-page__tag--commercial" style={{ marginLeft: 4 }}>
              {typeof t === 'string' ? t : t?.category || JSON.stringify(t)}
            </span>
          ))}
        </div>
      )}
      {hasEvidence && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>전략별 에비던스</div>
          {strategies?.filter((s: any) => s.doctor_recommendation?.evidence).map((s: any, i: number) => (
            <div key={i} style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              <strong>{s.target}:</strong> {s.doctor_recommendation.evidence}
            </div>
          ))}
        </div>
      )}
      {hasHci && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>병원 검사 항목</div>
          {hci.map((item, i) => (
            <div key={i} className="consultation-page__upsell-card">
              <div className="upsell-name">{item.item_name}</div>
              {item.gap_description && <div className="upsell-reason">{item.gap_description}</div>}
              {item.solution_narrative && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.solution_narrative}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsultationPage;
