/**
 * 백오피스 — mediArc 건강 리포트 페이지
 * 검진설계 페이지(CheckupDesignManagementPage) UX 패턴 준용
 * - 상단 tabs (글로벌 클래스) + 전체 폭 테이블
 * - 행 클릭 → 아래에 상세 accordion 펼침
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchPatients,
  fetchReport,
  fetchComparison,
  fetchEngineStats,
  fetchVerifyAll,
  PatientListItem,
  ReportData,
  ComparisonData,
  EngineStats,
  VerificationData,
} from './hooks/useMediarcApi';
import { Spinner } from '../../components/Spinner';
import { ExportButtons } from '../../components/ExportButtons';
import { downloadWorkbook, dateSuffix } from '../../utils/excelExport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import './styles.scss';

// ── 탭 ──
type TabKey = 'patients' | 'verify';

// ── 등급 판정 ──
const gradeInfo = (rank: number) => {
  if (rank <= 30) return { label: '정상', cls: 'badge--success' };
  if (rank <= 60) return { label: '경계', cls: 'badge--warning' };
  return { label: '이상', cls: 'badge--danger' };
};

const HealthReportPage: React.FC = () => {
  // ── 공통 상태 ──
  const [activeTab, setActiveTab] = useState<TabKey>('patients');
  const [loading, setLoading] = useState(true);

  // ── 환자 탭 ──
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [search, setSearch] = useState('');
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'diseases' | 'gauges' | 'nutrition' | 'comparison'>('diseases');

  // ── 검증 탭 ──
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // ── 초기 로드 ──
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPatients(), fetchEngineStats()])
      .then(([pRes, sRes]) => { setPatients(pRes.patients || []); setStats(sRes); })
      .catch(e => console.error('로드 실패:', e))
      .finally(() => setLoading(false));
  }, []);

  // ── 필터 ──
  const filtered = useMemo(() => {
    if (!search) return patients;
    const q = search.toLowerCase();
    return patients.filter(p => p.name?.toLowerCase().includes(q));
  }, [patients, search]);

  // ── 행 클릭 → 아코디언 ──
  const toggleRow = useCallback((uuid: string) => {
    if (expandedUuid === uuid) {
      setExpandedUuid(null);
      setReport(null);
      setComparison(null);
      return;
    }
    setExpandedUuid(uuid);
    setDetailLoading(true);
    setDetailTab('diseases');

    const patient = patients.find(p => p.uuid === uuid);
    const promises: Promise<any>[] = [fetchReport(uuid)];
    if (patient?.has_twobecon) promises.push(fetchComparison(uuid));

    Promise.all(promises)
      .then(([rData, cData]) => { setReport(rData); setComparison(cData || null); })
      .catch(e => console.error('리포트 로드:', e))
      .finally(() => setDetailLoading(false));
  }, [expandedUuid, patients]);

  // ── 검증 탭 ──
  const loadVerify = useCallback(() => {
    setActiveTab('verify');
    if (!verification) {
      setVerifyLoading(true);
      fetchVerifyAll()
        .then(setVerification)
        .catch(e => console.error('검증 로드:', e))
        .finally(() => setVerifyLoading(false));
    }
  }, [verification]);

  // ── 엑셀 ──
  const handleExport = () => {
    downloadWorkbook([{
      name: 'mediArc_환자',
      data: filtered.map((p, i) => ({
        '#': i + 1, 이름: p.name, 성별: p.gender === 'M' ? '남' : '여',
        나이: p.age, 검진일: p.checkup_date, 투비콘: p.has_twobecon ? 'O' : '-',
      })),
    }], `mediArc_${dateSuffix()}.xlsx`);
  };

  // ── 상세 아코디언 내부 렌더링 ──
  const renderExpanded = () => {
    if (detailLoading) return <div className="hr-expanded__loading"><Spinner message="리포트 로딩 중..." /></div>;
    if (!report) return <div className="hr-expanded__empty">리포트를 불러올 수 없습니다</div>;

    return (
      <div className="hr-expanded">
        {/* 건강나이/등수 요약 */}
        <div className="hr-expanded__summary">
          <span>건강나이 <strong>{report.bodyage?.bodyage?.toFixed(1) ?? '-'}세</strong>
            {report.bodyage?.delta != null && (
              <span className={report.bodyage.delta > 0 ? 'text--danger' : 'text--success'}>
                ({report.bodyage.delta > 0 ? '+' : ''}{report.bodyage.delta.toFixed(1)})
              </span>
            )}
          </span>
          <span>건강등수 <strong>{report.rank ?? '-'}등</strong></span>
        </div>

        {/* 서브 탭 */}
        <div className="tabs hr-expanded__tabs">
          {[
            { key: 'diseases' as const, label: '질환예측' },
            { key: 'gauges' as const, label: '검진수치' },
            { key: 'nutrition' as const, label: '영양추천' },
            ...(comparison ? [{ key: 'comparison' as const, label: '투비콘 비교' }] : []),
          ].map(t => (
            <button key={t.key} className={`tabs__item${detailTab === t.key ? ' active' : ''}`}
              onClick={() => setDetailTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* 서브 탭 내용 */}
        <div className="hr-expanded__body">
          {detailTab === 'diseases' && (() => {
            const entries = Object.entries(report.diseases || {});
            const chartData = entries.map(([name, d]) => ({ name, rank: d.rank }));
            return (
              <>
                <table className="data-table">
                  <thead><tr><th>질환</th><th>등수</th><th>등급</th></tr></thead>
                  <tbody>
                    {entries.map(([name, d]) => {
                      const g = gradeInfo(d.rank);
                      return (<tr key={name}><td>{name}</td><td>{d.rank}등</td>
                        <td><span className={`hr-badge ${g.cls}`}>{g.label}</span></td></tr>);
                    })}
                  </tbody>
                </table>
                {chartData.length > 0 && (
                  <div className="hr-expanded__chart">
                    <ResponsiveContainer width="100%" height={Math.max(250, entries.length * 26)}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => `${v}등`} />
                        <Bar dataKey="rank" radius={[0, 3, 3, 0]}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={d.rank > 60 ? '#c62828' : d.rank > 30 ? '#ed8936' : '#22804a'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            );
          })()}

          {detailTab === 'gauges' && (() => {
            const entries = Object.entries(report.gauges?.all || {});
            return entries.length === 0 ? <p className="hr-expanded__empty">수치 데이터 없음</p> : (
              <table className="data-table">
                <thead><tr><th>항목</th><th>수치</th><th>판정</th><th>범위</th></tr></thead>
                <tbody>{entries.map(([k, g]) => (
                  <tr key={k}><td>{k}</td><td><strong>{g.value}</strong></td><td>{g.label}</td>
                    <td style={{ color: '#999', fontSize: 12 }}>{g.range}</td></tr>
                ))}</tbody>
              </table>
            );
          })()}

          {detailTab === 'nutrition' && (() => {
            const items = report.nutrition?.recommend || [];
            return items.length === 0 ? <p className="hr-expanded__empty">추천 데이터 없음</p> : (
              <div className="hr-expanded__nutrition-grid">
                {items.map((n, i) => (
                  <div key={i} className="hr-expanded__nutrition-card">
                    <div className="hr-expanded__nutrition-name">{n.name}
                      <span className="hr-expanded__nutrition-tag">{n.tag}</span></div>
                    <div className="hr-expanded__nutrition-desc">{n.desc}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {detailTab === 'comparison' && comparison && (
            <>
              <div className="hr-expanded__compare-row">
                <div className="hr-expanded__compare-box">
                  <div className="hr-expanded__compare-label">투비콘</div>
                  <div className="hr-expanded__compare-val">{comparison.twobecon.bodyage}세</div>
                  <div className="hr-expanded__compare-sub">등수: {comparison.twobecon.rank}등</div>
                </div>
                <div className="hr-expanded__compare-box">
                  <div className="hr-expanded__compare-label">mediArc</div>
                  <div className="hr-expanded__compare-val">{comparison.mediarc.bodyage.bodyage}세</div>
                  <div className="hr-expanded__compare-sub">등수: {comparison.mediarc.rank}등</div>
                </div>
              </div>
              <div className="hr-expanded__match-rate">적중률: {comparison.match_rate}</div>
              <table className="data-table">
                <thead><tr><th>질환</th><th>투비콘</th><th>mediArc</th><th>차이</th><th>일치</th></tr></thead>
                <tbody>
                  {comparison.comparison.map((c, i) => (
                    <tr key={i} className={c.grade_match ? 'hr-row--match' : 'hr-row--mismatch'}>
                      <td>{c.disease}</td><td>{c.twobecon_rate?.toFixed(1)}</td>
                      <td>{c.mediarc_ratio?.toFixed(1)}</td>
                      <td>{c.diff >= 0 ? '+' : ''}{c.diff?.toFixed(1)}</td>
                      <td>{c.grade_match ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── 검증 탭 렌더링 ──
  const renderVerify = () => {
    if (verifyLoading) return <div className="empty-state"><Spinner message="전수검증 로딩 중..." /></div>;
    if (!verification) return <div className="empty-state"><p>검증 데이터 없음</p></div>;

    const ds = verification.disease_summary || {};
    const chartData = Object.entries(ds).map(([name, d]) => {
      const m = d.match_rate.match(/(\d+)\/(\d+)/);
      return { name, pct: m ? Math.round(+m[1] / +m[2] * 100) : 0, raw: d.match_rate };
    }).sort((a, b) => b.pct - a.pct);

    return (
      <div className="hr-verify">
        <div className="hr-verify__hero">
          <div className="hr-verify__hero-label">전체 적중률</div>
          <div className="hr-verify__hero-value">{verification.match_rate}</div>
          <div className="hr-verify__hero-sub">{verification.total_patients}명 대상</div>
        </div>
        <div className="hr-verify__chart-wrap">
          <div className="hr-verify__chart-title">질환별 적중률</div>
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 90, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" fill="#7c746a" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {verification.anomalies.length > 0 && (
          <div className="hr-verify__section">
            <h4>이상치 ({verification.anomalies.length}건)</h4>
            <table className="data-table">
              <thead><tr><th>이름</th><th>적중</th><th>사유</th></tr></thead>
              <tbody>{verification.anomalies.map((a, i) => (
                <tr key={i}><td>{a.name}</td><td>{a.match}</td><td>{a.reason}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="health-report">
      {/* 엔진 통계 카드 */}
      {stats && (
        <div className="health-report__stats-grid">
          {[
            { label: 'RR 규칙', value: stats.total_rr },
            { label: 'PMID 커버리지', value: stats.pmid_coverage },
            { label: '검증', value: stats.validation },
            { label: '대상 질환', value: stats.diseases },
          ].map((s, i) => (
            <div key={i} className="health-report__stat-card">
              <div className="health-report__stat-label">{s.label}</div>
              <div className="health-report__stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 — 검진설계 글로벌 tabs 클래스 */}
      <div className="cdm-page__toolbar">
        <div className="tabs">
          <button className={`tabs__item${activeTab === 'patients' ? ' active' : ''}`}
            onClick={() => setActiveTab('patients')}>환자 리포트</button>
          <button className={`tabs__item${activeTab === 'verify' ? ' active' : ''}`}
            onClick={loadVerify}>전수검증</button>
        </div>
        {activeTab === 'patients' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="text" placeholder="이름 검색..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: 160 }} />
            <span style={{ fontSize: 12, color: '#888' }}>{filtered.length}명</span>
            <ExportButtons onExcel={handleExport} disabled={loading} />
          </div>
        )}
      </div>

      {/* 환자 리포트 탭 */}
      {activeTab === 'patients' && (
        loading ? <div className="empty-state"><Spinner message="데이터 로딩 중..." /></div> : (
          <div className="cdm-section">
            <table className="data-table data-table--sticky-header">
              <thead>
                <tr>
                  <th>#</th><th>이름</th><th>성별</th><th>나이</th><th>검진일</th><th>투비콘</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#999' }}>데이터 없음</td></tr>
                )}
                {filtered.map((p, i) => (
                  <React.Fragment key={p.uuid}>
                    <tr className={`hr-table__row${expandedUuid === p.uuid ? ' hr-table__row--expanded' : ''}`}
                      onClick={() => toggleRow(p.uuid)}>
                      <td>{i + 1}</td>
                      <td><strong>{p.name || '-'}</strong></td>
                      <td>{p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : '-'}</td>
                      <td>{p.age ?? '-'}</td>
                      <td>{p.checkup_date || '-'}</td>
                      <td>{p.has_twobecon ? <span className="hr-badge badge--info">O</span> : '-'}</td>
                    </tr>
                    {expandedUuid === p.uuid && (
                      <tr className="hr-table__expanded-row">
                        <td colSpan={6} style={{ padding: 0 }}>
                          {renderExpanded()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 전수검증 탭 */}
      {activeTab === 'verify' && renderVerify()}
    </div>
  );
};

export default HealthReportPage;
