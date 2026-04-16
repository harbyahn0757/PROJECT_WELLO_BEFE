/**
 * HealthReportPage — Phase 2 재작성
 * PageLayout / PageHeader / KpiGrid / KpiCard / TabBar / FilterBar / Drawer / HospitalSearch 표준 적용
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchPatients,
  fetchReport,
  fetchEngineStats,
  fetchVerifyAll,
  PatientListItem,
  ReportData,
  EngineStats,
  VerificationData,
} from './hooks/useMediarcApi';
import { Spinner } from '../../components/Spinner';
import { ExportButtons } from '../../components/ExportButtons';
import { downloadWorkbook, dateSuffix } from '../../utils/excelExport';
import PageLayout from '../../components/layout/PageLayout';
import PageHeader from '../../components/layout/PageHeader';
import KpiGrid from '../../components/kpi/KpiGrid';
import KpiCard from '../../components/kpi/KpiCard';
import { TabBar } from '../../components/tabs/TabBar';
import type { TabItem } from '../../components/tabs/TabBar';
import FilterBar from '../../components/filters/FilterBar';
import { Drawer } from '../../components/Drawer/Drawer';
import { HospitalSearch } from '../../components/HospitalSearch/HospitalSearch';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ReportView from './components/ReportView';
import './styles.scss';

type TabKey = 'patients' | 'verify';

const MAIN_TABS: TabItem<TabKey>[] = [
  { key: 'patients', label: '환자 리포트' },
  { key: 'verify', label: '전수검증' },
];

const HealthReportPage: React.FC = () => {
  const { isEmbedMode, embedParams } = useEmbedParams();

  // 공통
  const [activeTab, setActiveTab] = useState<TabKey>('patients');
  const [loading, setLoading] = useState(true);

  // 환자 탭
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [search, setSearch] = useState('');
  const [hospitalId, setHospitalId] = useState<string>(embedParams.hospitalId ?? '');

  // Drawer
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // 검증 탭
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // 초기 로드
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPatients(), fetchEngineStats()])
      .then(([pRes, sRes]) => { setPatients(pRes.patients || []); setStats(sRes); })
      .catch(e => console.error('로드 실패:', e))
      .finally(() => setLoading(false));
  }, []);

  // 필터 (이름 검색 + 병원 — 클라이언트 사이드)
  const filtered = useMemo(() => {
    let list = patients;
    if (hospitalId) list = list.filter(p => (p as any).hospital_id === hospitalId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [patients, search, hospitalId]);

  // 병원 목록 (환자 목록에서 추출)
  const hospitalOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { hospital_id: string; hospital_name: string }[] = [];
    patients.forEach(p => {
      const hid = (p as any).hospital_id;
      if (hid && !seen.has(hid)) {
        seen.add(hid);
        opts.push({ hospital_id: hid, hospital_name: hid });
      }
    });
    return opts;
  }, [patients]);

  // 행 클릭 → Drawer
  const openDrawer = useCallback((uuid: string) => {
    setExpandedUuid(uuid);
    setDetailLoading(true);
    setReport(null);

    setReportError(null);
    fetchReport(uuid)
      .then(rData => {
        if (!rData || (rData as any).detail) {
          setReportError((rData as any)?.detail || '리포트 데이터를 불러올 수 없습니다.');
        } else {
          setReport(rData);
        }
      })
      .catch(e => {
        const msg = e?.message?.includes('404') || e?.message?.includes('환자')
          ? '이 환자의 검진 데이터가 부족하여 리포트를 생성할 수 없습니다.'
          : '리포트 로드 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        setReportError(msg);
      })
      .finally(() => setDetailLoading(false));
  }, []);

  const closeDrawer = useCallback(() => {
    setExpandedUuid(null);
    setReport(null);
  }, []);

  // 검증 탭
  const handleTabChange = useCallback((key: TabKey) => {
    setActiveTab(key);
    if (key === 'verify' && !verification) {
      setVerifyLoading(true);
      fetchVerifyAll()
        .then(setVerification)
        .catch(e => console.error('검증 로드:', e))
        .finally(() => setVerifyLoading(false));
    }
  }, [verification]);

  // 엑셀 다운로드
  const handleExport = () => {
    downloadWorkbook([{
      name: 'mediArc_환자',
      data: filtered.map((p, i) => ({
        '#': i + 1, 이름: p.name, 성별: p.gender === 'M' ? '남' : '여',
        나이: p.age, 검진일: p.checkup_date, 투비콘: p.has_twobecon ? 'O' : '-',
      })),
    }], `mediArc_${dateSuffix()}.xlsx`);
  };

  const selectedPatient = patients.find(p => p.uuid === expandedUuid);

  return (
    <PageLayout pageName="health-report" embedMode={isEmbedMode}>
      <PageHeader
        title="mediArc 리포트"
        actions={<ExportButtons onExcel={handleExport} disabled={loading} />}
        hideOnEmbed
      />

      {stats && (
        <KpiGrid cols={4}>
          <KpiCard label="RR 규칙" value={stats.total_rr} />
          <KpiCard label="PMID 커버리지" value={stats.pmid_coverage} />
          <KpiCard label="검증" value={stats.validation} />
          <KpiCard label="대상 질환" value={stats.diseases} />
        </KpiGrid>
      )}

      <TabBar<TabKey>
        items={MAIN_TABS}
        value={activeTab}
        onChange={handleTabChange}
        trailing={
          activeTab === 'patients' ? (
            <HospitalSearch
              hospitals={hospitalOptions}
              value={hospitalId}
              onChange={setHospitalId}
              getValue={h => h.hospital_id ?? ''}
              getLabel={h => h.hospital_name ?? ''}
              width="200px"
            />
          ) : undefined
        }
      />

      {activeTab === 'patients' && (
        <>
          <FilterBar trailing={<span style={{ fontSize: 12, color: '#888' }}>{filtered.length}명</span>}>
            <input
              type="text"
              placeholder="이름 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="filter-input"
            />
          </FilterBar>

          {loading ? (
            <div className="empty-state"><Spinner message="데이터 로딩 중..." /></div>
          ) : (
            <table className="data-table data-table--sticky-header">
              <thead>
                <tr><th>#</th><th>이름</th><th>성별</th><th>나이</th><th>검진일</th><th>투비콘</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#999' }}>데이터 없음</td></tr>
                )}
                {filtered.map((p, i) => (
                  <tr
                    key={p.uuid}
                    className={`hr-table__row${expandedUuid === p.uuid ? ' hr-table__row--expanded' : ''}`}
                    onClick={() => openDrawer(p.uuid)}
                  >
                    <td>{i + 1}</td>
                    <td><strong>{p.name || '-'}</strong></td>
                    <td>{p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : '-'}</td>
                    <td>{p.age ?? '-'}</td>
                    <td>{p.checkup_date || '-'}</td>
                    <td>{p.has_twobecon ? <span className="hr-badge badge--info">O</span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {activeTab === 'verify' && <DrawerVerifyContent verification={verification} verifyLoading={verifyLoading} />}

      {/* 환자 상세 Drawer */}
      <Drawer
        open={!!expandedUuid}
        onClose={closeDrawer}
        title={selectedPatient?.name ?? '환자 상세'}
        width="xl"
        testId="mediarc-report-drawer"
      >
        {/* 에러 상태 */}
        {reportError ? (
          <div className="hr-expanded__empty" role="alert" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>⚠️ {reportError}</p>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>다른 환자를 선택하거나, 검진 데이터가 등록된 후 다시 시도해주세요.</p>
          </div>
        ) : expandedUuid && !detailLoading && !report ? (
          <div className="hr-expanded__empty">리포트를 불러올 수 없습니다</div>
        ) : expandedUuid ? (
          <ReportView
            data={report}
            loading={detailLoading}
            uuid={expandedUuid}
            hospitalId={hospitalId}
          />
        ) : null}
      </Drawer>
    </PageLayout>
  );
};

// ── 서브 컴포넌트: 전수검증 탭 ──
const DrawerVerifyContent: React.FC<{
  verification: VerificationData | null;
  verifyLoading: boolean;
}> = ({ verification, verifyLoading }) => {
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

export default HealthReportPage;
