/**
 * 백오피스 — 검진설계 통합 페이지
 * iframe 모드 (api_key 쿼리 있음): 3탭 (캠페인 관리 | 페르소나 분석 | 발송 이력) — 파트너사 호환
 * 로그인 모드: 4탭 (상담 요청 | 캠페인 발송 | 페르소나 분석 | 발송 이력) — ConsultationPage 흡수
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import AlimtalkPanel from './components/AlimtalkPanel';
import HistoryTable from './components/HistoryTable';
import ConsultationPage from '../ConsultationPage';
import PageLayout from '../../components/layout/PageLayout';
import { TabBar, TabItem } from '../../components/tabs/TabBar';
import { HospitalSearch } from '../../components/HospitalSearch/HospitalSearch';
import { KpiGrid } from '../../components/kpi/KpiGrid';
import { KpiCard } from '../../components/kpi/KpiCard';
import { Spinner } from '../../components/Spinner';
import { FilterBar } from '../../components/filters/FilterBar';
import { ProcessingModal } from '../../components/ProcessingModal';
import './styles.scss';
import './styles/alimtalk.scss';

// 2026-04-08: persona 탭 제거 (ConsultationPage 상담 상세에 페르소나 분석 포함됨)
type TabKey = 'consultation' | 'campaign' | 'history';

const API = getApiBase();

const CheckupDesignManagementPage: React.FC = () => {
  const { embedParams } = useEmbedParams();
  const [searchParams] = useSearchParams();
  const hospitalId = embedParams.hospitalId || searchParams.get('hospital_id') || '';
  const partnerId = embedParams.partnerId || searchParams.get('partner_id') || '';
  // iframe 모드: api_key 쿼리 존재 → 상담 탭 숨김 (파트너사 기존 UI 유지)
  const isEmbed = searchParams.has('api_key');

  // default tab: iframe은 campaign (기존 유지), 로그인 모드는 consultation (ConsultationPage가 메인)
  const [activeTab, setActiveTab] = useState<TabKey>(isEmbed ? 'campaign' : 'consultation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 캠페인 ──
  const [targets, setTargets] = useState<any[]>([]);
  const [totalTargets, setTotalTargets] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');

  // ── 알림톡 ──
  const [templates, setTemplates] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── W3: 발송 처리 중 모달 ──
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);

  // ── W3: FilterBar 상태 ──
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── API ──
  const api = useCallback(async (path: string, body?: any) => {
    const opts: RequestInit = { headers: { 'Content-Type': 'application/json' } };
    if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    const r = await fetchWithAuth(`${API}/partner-office${path}`, opts);
    return r.json();
  }, []);

  // ── 데이터 로드 ──
  const load = useCallback(async (tab: TabKey) => {
    // consultation 탭은 ConsultationPage가 자체 로드 관리 → skip
    if (tab === 'consultation') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const filters: any = {};
      if (hospitalId) filters.hospital_id = hospitalId;
      if (partnerId) filters.partner_id = partnerId;

      if (tab === 'history') {
        setHistoryLoading(true);
        try {
          const historyUrl = selectedHospital
            ? `${API}/partner-office/alimtalk/history?limit=50&hosnm=${encodeURIComponent(selectedHospital)}`
            : `${API}/partner-office/alimtalk/history?limit=50`;
          const h = await fetch(historyUrl).then(r => r.json());
          if (h.success) setHistoryList(h.history || []);
        } finally { setHistoryLoading(false); }
      }
      // 병원 목록 + 템플릿: 모든 탭에서 공통 로드 (최초 1회)
      if (hospitals.length === 0) {
        const h = await fetchWithAuth(`${API}/partner-office/checkup-design/campaign/hospitals`).then(r => r.json());
        if (h.success) setHospitals(h.hospitals || []);
      }
      if (tab === 'campaign') {
        if (templates.length === 0) {
          const t = await fetchWithAuth(`${API}/partner-office/alimtalk/templates`).then(r => r.json());
          if (t.success) setTemplates(t.templates || []);
        }
        // 대상 조회
        if (selectedHospital) {
          const data = await api('/checkup-design/campaign/targets', {
            hosnm: selectedHospital, limit: 100,
          });
          if (data.success) { setTargets(data.targets || []); setTotalTargets(data.total || 0); }
        } else {
          setTargets([]); setTotalTargets(0);
        }
      }
    } catch (e) {
      console.error(`[${tab}] 로드 실패:`, e);
      setError(`데이터를 불러오는 중 오류가 발생했습니다. (${tab})`);
    } finally { setLoading(false); }
  }, [api, hospitalId, partnerId, selectedHospital, hospitals.length, templates.length]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // ── 병원 선택 ──
  const selectHospital = (hosnm: string) => {
    setSelectedHospital(hosnm);
    setSelectedTargets([]);
  };

  // ── W3: KPI 파생값 ──
  const mktConsentTotal = useMemo(
    () => hospitals.reduce((sum, h) => sum + (h.mkt_consent ?? 0), 0),
    [hospitals]
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const sentToday = useMemo(
    () => historyList.filter(h => (h.sent_at || '').startsWith(todayStr)).length,
    [historyList, todayStr]
  );

  // ── W3: PROCESSING STEPS ──
  const SEND_STEPS = [
    { label: '대상자 확인 중', done: processStep >= 1 },
    { label: '알림톡 발송 중', done: processStep >= 2 },
    { label: '완료', done: processStep >= 3 },
  ];

  // ── 캠페인 발송 ──
  const sendCampaign = async () => {
    if (!selectedTargets.length) return alert('발송 대상을 선택해주세요');
    if (!window.confirm(`${selectedTargets.length}명에게 검진설계 캠페인을 발송합니다.\n계속할까요?`)) return;
    setProcessStep(1);
    setProcessing(true);
    try {
      setProcessStep(2);
      const r = await api('/checkup-design/campaign/send', {
        target_uuids: selectedTargets, hosnm: selectedHospital,
        partner_id: partnerId || 'welno',
      });
      setProcessStep(3);
      if (r.success) {
        setTimeout(() => {
          setProcessing(false);
          setProcessStep(0);
          alert(`발송 처리 완료: ${r.updated}명`);
          setSelectedTargets([]);
          load('campaign');
        }, 600);
      } else {
        setProcessing(false);
        setProcessStep(0);
      }
    } catch (e) {
      console.error('[sendCampaign] 오류:', e);
      setError('캠페인 발송 중 오류가 발생했습니다.');
      setProcessing(false);
      setProcessStep(0);
    }
  };

  const toggleAll = () => {
    setSelectedTargets(prev => prev.length === targets.length ? [] : targets.map(t => t.uuid));
  };

  // 알림톡 발송 완료 콜백
  const handleAlimtalkSendComplete = () => {
    setSelectedTargets([]);
    load('campaign');
  };

  // iframe 모드: 2탭 (기존 호환, persona 제거), 로그인 모드: 3탭 (상담/캠페인/이력)
  const TAB_ITEMS: TabItem<TabKey>[] = isEmbed
    ? [{ key: 'campaign', label: '캠페인 관리' }, { key: 'history', label: '발송 이력' }]
    : [{ key: 'consultation', label: '상담 요청' }, { key: 'campaign', label: '캠페인 발송' }, { key: 'history', label: '발송 이력' }];

  return (
    <PageLayout pageName="checkup-design" embedMode={isEmbed} scroll="none">
      {/* W3: 발송 처리 중 모달 */}
      <ProcessingModal
        isOpen={processing}
        title="알림톡 발송 중"
        steps={SEND_STEPS}
      />

      {/* 탭 + 병원 검색 (한 줄) */}
      <div role="tablist" aria-label="검진설계 관리 탭">
        <TabBar
          size="md"
          items={TAB_ITEMS}
          value={activeTab}
          onChange={setActiveTab}
          trailing={
            activeTab !== 'consultation' ? (
              <HospitalSearch
                hospitals={hospitals}
                value={selectedHospital}
                onChange={selectHospital}
                getValue={h => h.hosnm ?? ''}
                getLabel={h => h.hosnm ?? ''}
                getSubtitle={h => h.mkt_consent != null ? `${h.mkt_consent}명 / ${h.pln_sent ?? 0}명 발송` : null}
                showAllOption={false}
              />
            ) : undefined
          }
        />
      </div>

      {/* W3: Error 배너 */}
      {error && (
        <div role="alert" className="empty-state--error">
          {error}
          <button
            style={{ marginLeft: 12, fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
            onClick={() => setError(null)}
          >
            닫기
          </button>
        </div>
      )}

      {/* W3: KPI 그리드 (캠페인/이력 탭에서만 표시) */}
      {activeTab !== 'consultation' && (
        <KpiGrid cols={4}>
          <KpiCard label="총 대상자" value={targets.length} unit="명" />
          <KpiCard label="마케팅 동의" value={mktConsentTotal} unit="명" variant="success" />
          <KpiCard label="금일 발송" value={sentToday} unit="건" />
          <KpiCard label="발송 대기" value={templates.length} unit="건" />
        </KpiGrid>
      )}

      {/* W3: FilterBar (캠페인/이력 탭에서만, consultation 제외) */}
      {activeTab !== 'consultation' && (
        <FilterBar
          trailing={
            <input
              className="cdm-filter-search"
              placeholder="환자명 / 병원명 검색"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
            />
          }
        >
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="">전체 기간</option>
            <option value="today">오늘</option>
            <option value="week">이번주</option>
            <option value="month">이번달</option>
          </select>
          {activeTab === 'history' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">전체 상태</option>
              <option value="sent">발송완료</option>
              <option value="pending">대기</option>
              <option value="failed">실패</option>
            </select>
          )}
        </FilterBar>
      )}

      {/* W3: 로딩 스피너 (기존 p 태그 → Spinner 교체) */}
      {loading && activeTab !== 'consultation' && (
        <div className="empty-state">
          <Spinner message="데이터를 불러오는 중..." />
        </div>
      )}

      {/* ── 상담 요청 (ConsultationPage 흡수) ── */}
      {activeTab === 'consultation' && (
        <div className="cdm-section" style={{padding: 0, border: 'none'}}>
          <ConsultationPage />
        </div>
      )}

      {/* ── 캠페인 관리 ── */}
      {activeTab === 'campaign' && !loading && (
        <div className="cdm-section">
          {selectedHospital && (
            <AlimtalkPanel
              templates={templates}
              targets={targets}
              selectedTargets={selectedTargets}
              onSelectTargets={setSelectedTargets}
              selectedHospital={selectedHospital}
              onSendComplete={handleAlimtalkSendComplete}
            />
          )}

          {!selectedHospital && hospitals.length > 0 && (
            <p className="empty-state__text" style={{textAlign:'center', padding:'40px 0'}}>병원을 검색하여 선택하면 캠페인 대상이 표시됩니다</p>
          )}
        </div>
      )}

      {/* 페르소나 분석 탭 제거 (2026-04-08) — 상담 요청 탭의 환자 상세에 이미 페르소나 분석 포함 */}
      {/* ── 발송 이력 ── */}
      {activeTab === 'history' && !loading && (
        <div className="cdm-section">
          <HistoryTable history={historyList} loading={historyLoading} />
        </div>
      )}
    </PageLayout>
  );
};

export default CheckupDesignManagementPage;
