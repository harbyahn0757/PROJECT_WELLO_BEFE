import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { downloadWorkbook, downloadJson, dateSuffix } from '../../utils/excelExport';
import { ExportButtons } from '../../components/ExportButtons';
import { formatDateTime } from '../../utils/dateFormat';
import { riskBadgeClass } from '../../utils/formatters';
import { Spinner } from '../../components/Spinner';
import { SearchableSelect } from '../../components/SearchableSelect';
import './styles.scss';

const API = getApiBase();

interface Patient {
  web_app_key: string;
  patient_name: string;
  chat_count: number;
  survey_count: number;
  journey_count: number;
  last_activity: string | null;
  hospital_name: string;
  download_only?: boolean;
}

interface ChatItem {
  session_id: string;
  hospital_name: string;
  created_at: string;
  message_count: number;
  risk_level: string | null;
  sentiment: string | null;
  summary: string | null;
  tagging_model: string | null;
  action_intent: string | null;
  follow_up_needed: boolean | null;
  engagement_score: number | null;
  data_quality_score: number | null;
  interest_tags: { topic: string; intensity: string }[] | null;
  key_concerns: string[] | null;
  counselor_recommendations: string[] | null;
  nutrition_tags: string[] | null;
  commercial_tags: { category: string; product_hint: string; segment: string }[] | null;
  buying_signal: string | null;
  conversion_flag: boolean | null;
}

interface SurveyItem {
  response_id: number;
  hospital_name: string;
  created_at: string;
  overall_score: number | null;
  template_name: string;
  free_comment: string | null;
  answers: string | null;
  reservation_process: number | null;
  facility_cleanliness: number | null;
  staff_kindness: number | null;
  waiting_time: number | null;
  overall_satisfaction: number | null;
}

interface JourneyEvent {
  timestamp: string;
  action: string;
  message: string;
  page_title: string;
  device: string;
  os: string;
  browser: string;
}

interface HealthData {
  patient_name: string;
  gender: string;
  birth_date: string;
  contact: string;
  checkup_date: string;
  hospital_name: string;
  metrics: Record<string, any>;
}

interface PatientDetail {
  web_app_key: string;
  patient_name: string;
  chats: ChatItem[];
  surveys: SurveyItem[];
  journey_events: JourneyEvent[];
  health_data: HealthData | null;
}

type DetailTab = 'chats' | 'surveys' | 'journey' | 'health';

const maskKey = (key: string) => {
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
};

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'chats', label: '상담' },
  { key: 'surveys', label: '서베이' },
  { key: 'journey', label: '여정' },
  { key: 'health', label: '검진데이터' },
];

const PatientPage: React.FC = () => {
  useAuth();
  const [searchParams] = useSearchParams();
  const hospitalId = searchParams.get('hospital_id') || '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // 필터 상태
  const [filterHospital, setFilterHospital] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterActivity, setFilterActivity] = useState<'all' | 'chat' | 'survey' | 'journey'>('all');

  // 상세 패널 상태
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('chats');
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [expandedSurvey, setExpandedSurvey] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWithAuth(`${API}/partner-office/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospital_id: hospitalId || null }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`서버 오류 (${r.status})`);
        return r.json();
      })
      .then(d => {
        setPatients(d.patients || []);
        setTotal(d.total || 0);
      })
      .catch(e => { setError(e instanceof Error ? e.message : '환자 목록 조회 실패'); })
      .finally(() => setLoading(false));
  }, [hospitalId]);

  // 환자 상세 조회
  const loadDetail = useCallback((webAppKey: string) => {
    setSelectedKey(webAppKey);
    setDetailLoading(true);
    setDetail(null);
    setDetailTab('chats');
    setExpandedChat(null);
    setExpandedSurvey(null);
    fetchWithAuth(`${API}/partner-office/patients/${encodeURIComponent(webAppKey)}/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => {
        if (!r.ok) throw new Error(`상세 조회 실패 (${r.status})`);
        return r.json();
      })
      .then(d => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  // 병원 옵션 목록 (환자 데이터에서 추출)
  const hospitalOptions = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach(p => { if (p.hospital_name) map.set(p.hospital_name, p.hospital_name); });
    return Array.from(map.values()).sort().map(name => ({ value: name, label: name }));
  }, [patients]);

  const filtered = useMemo(() => {
    return patients.filter(p => {
      // 텍스트 검색
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.web_app_key.toLowerCase().includes(q) &&
          !p.hospital_name.toLowerCase().includes(q) &&
          !(p.patient_name && p.patient_name.toLowerCase().includes(q))
        ) return false;
      }
      // 병원 필터
      if (filterHospital && p.hospital_name !== filterHospital) return false;
      // 날짜 범위 필터 (last_activity 기준)
      if (filterDateFrom && p.last_activity && p.last_activity < filterDateFrom) return false;
      if (filterDateTo && p.last_activity && p.last_activity > filterDateTo + 'T23:59:59') return false;
      // 활동 유형 필터
      if (filterActivity === 'chat' && p.chat_count === 0) return false;
      if (filterActivity === 'survey' && p.survey_count === 0) return false;
      if (filterActivity === 'journey' && (p.journey_count || 0) === 0) return false;
      return true;
    });
  }, [patients, search, filterHospital, filterDateFrom, filterDateTo, filterActivity]);

  const handleExcelExport = () => {
    const sheets = [{
      name: '환자목록',
      data: filtered.map((p, i) => ({
        '#': i + 1,
        수검자명: p.patient_name || '-',
        web_app_key: p.web_app_key,
        상담: p.chat_count,
        서베이: p.survey_count,
        여정: p.journey_count || 0,
        최근활동: p.last_activity || '-',
        병원: p.hospital_name || '-',
      })),
    }];
    downloadWorkbook(sheets, `환자목록_${dateSuffix()}.xlsx`);
  };

  const renderDetailContent = () => {
    if (!detail) return null;

    switch (detailTab) {
      case 'chats':
        return (
          <div className="patient-page__detail-section">
            {detail.chats.length === 0 ? (
              <div className="patient-page__detail-empty">상담 내역이 없습니다</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>병원</th>
                    <th>메시지</th>
                    <th>위험도</th>
                    <th>감정</th>
                    <th>의향</th>
                    <th>후속</th>
                    <th>구매신호</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.chats.map(c => (
                    <React.Fragment key={c.session_id}>
                      <tr
                        className="patient-page__detail-row"
                        onClick={() => setExpandedChat(expandedChat === c.session_id ? null : c.session_id)}
                      >
                        <td>{c.created_at ? formatDateTime(c.created_at) : '-'}</td>
                        <td>{c.hospital_name || '-'}</td>
                        <td>{c.message_count}건</td>
                        <td>
                          {c.risk_level && (
                            <span className={`patient-page__badge ${riskBadgeClass(c.risk_level)}`}>
                              {c.risk_level}
                            </span>
                          )}
                        </td>
                        <td>{c.sentiment || '-'}</td>
                        <td>{c.action_intent || '-'}</td>
                        <td>{c.follow_up_needed ? '필요' : '-'}</td>
                        <td>
                          {c.buying_signal && c.buying_signal !== 'low' && (
                            <span className={`patient-page__signal-badge patient-page__signal-badge--${c.buying_signal}`}>
                              {c.buying_signal}
                            </span>
                          )}
                          {(!c.buying_signal || c.buying_signal === 'low') && '-'}
                        </td>
                      </tr>
                      {expandedChat === c.session_id && (
                        <tr>
                          <td colSpan={8} className="patient-page__expanded-cell">
                            <div className="patient-page__expanded-info">
                              {/* 요약 */}
                              <div className="patient-page__expand-summary">
                                <strong>요약:</strong> {c.summary || '(요약 없음)'}
                              </div>

                              {/* 게이지 바 */}
                              <div className="patient-page__gauge-row">
                                <div className="patient-page__gauge">
                                  <span className="patient-page__gauge-label">참여도</span>
                                  <div className="patient-page__gauge-bar">
                                    <div className="patient-page__gauge-fill" style={{ width: `${c.engagement_score ?? 0}%` }} />
                                  </div>
                                  <span className="patient-page__gauge-value">{c.engagement_score ?? 0}</span>
                                </div>
                                <div className="patient-page__gauge">
                                  <span className="patient-page__gauge-label">데이터품질</span>
                                  <div className="patient-page__gauge-bar">
                                    <div className="patient-page__gauge-fill patient-page__gauge-fill--quality" style={{ width: `${c.data_quality_score ?? 0}%` }} />
                                  </div>
                                  <span className="patient-page__gauge-value">{c.data_quality_score ?? 0}</span>
                                </div>
                              </div>

                              {/* 우려사항 */}
                              {c.key_concerns && c.key_concerns.length > 0 && (
                                <div className="patient-page__expand-block">
                                  <strong>우려사항:</strong>
                                  <ul className="patient-page__concern-list">
                                    {c.key_concerns.map((concern, i) => <li key={i}>{concern}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* 관심사 태그 */}
                              {c.interest_tags && c.interest_tags.length > 0 && (
                                <div className="patient-page__expand-block">
                                  <strong>관심사:</strong>
                                  <div className="patient-page__tag-chips">
                                    {c.interest_tags.map((tag, i) => (
                                      <span key={i} className={`patient-page__tag-chip patient-page__tag-chip--${tag.intensity}`}>
                                        {tag.topic}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 상업 태그 */}
                              {c.commercial_tags && c.commercial_tags.length > 0 && (
                                <div className="patient-page__expand-block">
                                  <strong>상업 태그:</strong>
                                  <div className="patient-page__tag-chips">
                                    {c.commercial_tags.map((ct, i) => (
                                      <span key={i} className="patient-page__commercial-chip">
                                        {ct.category} <small>{ct.product_hint}</small>
                                        {ct.segment === '고관여' && <span className="patient-page__segment-hot">HOT</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 상담사 권고 */}
                              {c.counselor_recommendations && c.counselor_recommendations.length > 0 && (
                                <div className="patient-page__expand-block">
                                  <strong>상담사 권고:</strong>
                                  <ul className="patient-page__concern-list">
                                    {c.counselor_recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* 메타 */}
                              <div className="patient-page__expand-meta">
                                <span>모델: {c.tagging_model || '-'}</span>
                                <span>세션: <code>{c.session_id}</code></span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );

      case 'surveys':
        return (
          <div className="patient-page__detail-section">
            {detail.surveys.length === 0 ? (
              <div className="patient-page__detail-empty">서베이 응답이 없습니다</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>병원</th>
                    <th>점수</th>
                    <th>유형</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.surveys.map(s => {
                    const isLegacy = s.template_name === 'legacy';
                    const templateLabel = isLegacy ? '고정설문' : '동적설문';
                    return (
                    <React.Fragment key={s.response_id}>
                      <tr
                        className="patient-page__detail-row"
                        onClick={() => setExpandedSurvey(expandedSurvey === s.response_id ? null : s.response_id)}
                      >
                        <td>{s.created_at ? formatDateTime(s.created_at) : '-'}</td>
                        <td>{s.hospital_name || '-'}</td>
                        <td>{s.overall_score != null ? s.overall_score.toFixed(1) : '-'}</td>
                        <td>{templateLabel}</td>
                      </tr>
                      {expandedSurvey === s.response_id && (
                        <tr>
                          <td colSpan={4} className="patient-page__expanded-cell">
                            <div className="patient-page__expanded-info">
                              {!isLegacy && s.template_name && s.template_name !== 'dynamic' && (
                                <div className="patient-page__survey-template-name">{s.template_name}</div>
                              )}
                              {isLegacy ? (
                                <div className="patient-page__survey-scores">
                                  <div>예약 과정: <strong>{s.reservation_process ?? '-'}</strong></div>
                                  <div>시설 청결: <strong>{s.facility_cleanliness ?? '-'}</strong></div>
                                  <div>직원 친절: <strong>{s.staff_kindness ?? '-'}</strong></div>
                                  <div>대기 시간: <strong>{s.waiting_time ?? '-'}</strong></div>
                                  <div>전체 만족: <strong>{s.overall_satisfaction ?? '-'}</strong></div>
                                </div>
                              ) : s.answers ? (
                                <div className="patient-page__survey-scores">{
                                  (() => {
                                    try {
                                      const LABELS: Record<string, string> = {
                                        overall_satisfaction: '전반적 만족도',
                                        reservation_process: '예약 과정',
                                        facility_cleanliness: '시설 청결',
                                        staff_kindness: '직원 친절',
                                        waiting_time: '대기 시간',
                                        result_explanation: '검진 결과 설명',
                                        revisit_intention: '재방문 의향',
                                        recommendation: '추천 의향',
                                        best_experience: '가장 좋았던 점',
                                        improvement_suggestion: '개선이 필요한 점',
                                        free_text: '기타 의견',
                                        free_comment: '기타 의견',
                                      };
                                      const TEXT_KEYS = new Set(['free_text', 'free_comment', 'best_experience', 'improvement_suggestion']);
                                      const parsed = JSON.parse(s.answers);
                                      const entries = Object.entries(parsed);
                                      const numericEntries = entries.filter(([k]) => !TEXT_KEYS.has(k));
                                      const textEntries = entries.filter(([k]) => TEXT_KEYS.has(k));
                                      return (
                                        <>
                                          {numericEntries.map(([k, v]) => (
                                            <div key={k} className="patient-page__survey-score-item">
                                              <span>{LABELS[k] || k}</span>
                                              <strong>{String(v)}</strong>
                                            </div>
                                          ))}
                                          {textEntries.map(([k, v]) => (
                                            v ? <div key={k} className="patient-page__survey-text-item">
                                              <span className="patient-page__survey-text-label">{LABELS[k] || k}:</span> {String(v)}
                                            </div> : null
                                          ))}
                                        </>
                                      );
                                    } catch {
                                      return <pre className="patient-page__answers-json">{s.answers}</pre>;
                                    }
                                  })()
                                }</div>
                              ) : <div className="patient-page__detail-empty">응답 데이터 없음</div>}
                              {s.free_comment && <div className="patient-page__survey-text-item"><span className="patient-page__survey-text-label">코멘트:</span> {s.free_comment}</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );

      case 'journey':
        return (
          <div className="patient-page__detail-section">
            {detail.journey_events.length === 0 ? (
              <div className="patient-page__detail-empty">여정 이벤트가 없습니다</div>
            ) : (
              <div className="patient-page__timeline">
                {detail.journey_events.map((ev, i) => (
                  <div key={i} className="patient-page__timeline-item">
                    <div className="patient-page__timeline-dot" />
                    <div className="patient-page__timeline-content">
                      <div className="patient-page__timeline-time">{ev.timestamp}</div>
                      <div className="patient-page__timeline-action">{ev.action}</div>
                      {ev.message && <div className="patient-page__timeline-message">{ev.message}</div>}
                      {ev.page_title && <div className="patient-page__timeline-page">{ev.page_title}</div>}
                      <div className="patient-page__timeline-meta">
                        {ev.device && <span>{ev.device}</span>}
                        {ev.os && <span>{ev.os}</span>}
                        {ev.browser && <span>{ev.browser}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'health':
        return (
          <div className="patient-page__detail-section">
            {!detail.health_data ? (
              <div className="patient-page__detail-empty">검진 데이터가 없습니다</div>
            ) : (
              <>
                <div className="patient-page__health-info">
                  <div><strong>이름:</strong> {detail.health_data.patient_name || '-'}</div>
                  <div><strong>성별:</strong> {detail.health_data.gender === 'M' ? '남' : detail.health_data.gender === 'F' ? '여' : detail.health_data.gender || '-'}</div>
                  <div><strong>생년월일:</strong> {detail.health_data.birth_date || '-'}</div>
                  <div><strong>연락처:</strong> {detail.health_data.contact || '-'}</div>
                  <div><strong>검진일:</strong> {detail.health_data.checkup_date || '-'}</div>
                  <div><strong>병원:</strong> {detail.health_data.hospital_name || '-'}</div>
                </div>
                {detail.health_data.metrics && Object.keys(detail.health_data.metrics).length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>항목</th>
                        <th>결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detail.health_data.metrics).map(([key, val]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="patient-page">
      {error && <div className="patient-page__error" role="alert">{error}</div>}

      {/* 필터 섹션 */}
      <div className="filter-section">
        <div className="filter-section__row">
          <input
            className="filter-section__input"
            type="text"
            placeholder="이름 / web_app_key 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <SearchableSelect
            placeholder="전체 병원"
            value={filterHospital}
            options={hospitalOptions}
            onChange={setFilterHospital}
          />
          <span className="filter-section__label">기간</span>
          <input
            className="filter-section__input"
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
          />
          <span className="filter-section__sep">~</span>
          <input
            className="filter-section__input"
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
          />
          <span className="filter-section__label">활동</span>
          {(['all', 'chat', 'survey', 'journey'] as const).map(key => (
            <button
              key={key}
              className={`filter-section__chip${filterActivity === key ? ' filter-section__chip--active' : ''}`}
              onClick={() => setFilterActivity(key)}
            >
              {{ all: '전체', chat: '상담', survey: '서베이', journey: '여정' }[key]}
            </button>
          ))}
          {(search || filterHospital || filterDateFrom || filterDateTo || filterActivity !== 'all') && (
            <button
              className="filter-section__reset"
              onClick={() => { setSearch(''); setFilterHospital(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterActivity('all'); }}
            >초기화</button>
          )}
          <span className="patient-page__count">
            {filtered.length.toLocaleString()}명{(search || filterHospital || filterDateFrom || filterDateTo || filterActivity !== 'all') ? ` / ${total.toLocaleString()}` : ''}
          </span>
          <ExportButtons
            onExcel={handleExcelExport}
            onJson={() => downloadJson({ exported_at: new Date().toISOString(), patients: filtered }, `환자목록_${dateSuffix()}.json`)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="patient-page__layout">
        {/* 왼쪽: 목록 */}
        <div className="patient-page__list-panel">
          <div className="patient-page__table-wrap">
            <table className="data-table data-table--sticky-header">
              <thead>
                <tr>
                  <th>#</th>
                  <th>수검자명</th>
                  <th>web_app_key</th>
                  <th>상담</th>
                  <th>서베이</th>
                  <th>여정</th>
                  <th>최근 활동</th>
                  <th>병원</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="patient-page__empty">
                    <Spinner message="환자 데이터를 불러오는 중..." />
                  </td></tr>
                )}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={8} className="patient-page__empty">데이터가 없습니다</td></tr>
                )}
                {filtered.map((p, i) => (
                  <tr
                    key={p.web_app_key}
                    className={`patient-page__row${selectedKey === p.web_app_key ? ' patient-page__row--selected' : ''}`}
                    onClick={() => loadDetail(p.web_app_key)}
                  >
                    <td>{i + 1}</td>
                    <td>{p.patient_name || '-'}</td>
                    <td className="patient-page__key">{maskKey(p.web_app_key)}</td>
                    <td>{p.chat_count.toLocaleString()}</td>
                    <td>{p.survey_count.toLocaleString()}</td>
                    <td>{(p.journey_count || 0).toLocaleString()}</td>
                    <td>{p.last_activity ? formatDateTime(p.last_activity) : '-'}</td>
                    <td>
                      {p.hospital_name || '-'}
                      {p.download_only && <span className="patient-page__badge--caution">주의</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div className={`patient-page__detail-panel${selectedKey ? ' patient-page__detail-panel--open' : ''}`}>
          {!selectedKey ? (
            <div className="patient-page__detail-placeholder">
              환자를 선택하면 상세 정보가 표시됩니다
            </div>
          ) : detailLoading ? (
            <div className="patient-page__detail-placeholder"><Spinner message="상세 정보 로딩 중..." /></div>
          ) : detail ? (
            <>
              <div className="patient-page__detail-header">
                <h3 className="patient-page__detail-title">
                  {detail.patient_name || maskKey(detail.web_app_key)}
                  {detail.patient_name && <span className="patient-page__detail-key">{maskKey(detail.web_app_key)}</span>}
                </h3>
                <button
                  className="patient-page__detail-close"
                  onClick={() => { setSelectedKey(null); setDetail(null); }}
                >닫기</button>
              </div>
              <div className="patient-page__detail-tabs">
                {DETAIL_TABS.map(tab => (
                  <button
                    key={tab.key}
                    className={`patient-page__detail-tab${detailTab === tab.key ? ' patient-page__detail-tab--active' : ''}`}
                    onClick={() => setDetailTab(tab.key)}
                  >
                    {tab.label}
                    {tab.key === 'chats' && detail.chats.length > 0 && (
                      <span className="patient-page__tab-count">{detail.chats.length}</span>
                    )}
                    {tab.key === 'surveys' && detail.surveys.length > 0 && (
                      <span className="patient-page__tab-count">{detail.surveys.length}</span>
                    )}
                    {tab.key === 'journey' && detail.journey_events.length > 0 && (
                      <span className="patient-page__tab-count">{detail.journey_events.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {renderDetailContent()}
            </>
          ) : (
            <div className="patient-page__detail-placeholder">데이터를 불러올 수 없습니다</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientPage;
