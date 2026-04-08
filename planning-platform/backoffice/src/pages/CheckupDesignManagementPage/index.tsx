/**
 * 백오피스 — 검진설계 통합 페이지
 * iframe 모드 (api_key 쿼리 있음): 3탭 (캠페인 관리 | 페르소나 분석 | 발송 이력) — 파트너사 호환
 * 로그인 모드: 4탭 (상담 요청 | 캠페인 발송 | 페르소나 분석 | 발송 이력) — ConsultationPage 흡수
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import AlimtalkPanel from './components/AlimtalkPanel';
import HistoryTable from './components/HistoryTable';
import ConsultationPage from '../ConsultationPage';
import './styles.scss';
import './styles/alimtalk.scss';

type TabKey = 'consultation' | 'campaign' | 'persona' | 'history';

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

  // ── 페르소나 ──
  const [distribution, setDistribution] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [personaFilter, setPersonaFilter] = useState('');
  const [page, setPage] = useState(1);

  // ── 캠페인 ──
  const [targets, setTargets] = useState<any[]>([]);
  const [totalTargets, setTotalTargets] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false);
  const hospitalRef = useRef<HTMLDivElement>(null);

  // ── 알림톡 ──
  const [templates, setTemplates] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 병원 검색 필터
  const filteredHospitals = useMemo(() => {
    if (!hospitalSearch.trim()) return hospitals;
    const q = hospitalSearch.trim().toLowerCase();
    return hospitals.filter((h: any) => h.hosnm?.toLowerCase().includes(q));
  }, [hospitals, hospitalSearch]);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (hospitalRef.current && !hospitalRef.current.contains(e.target as Node)) {
        setShowHospitalDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

      if (tab === 'persona') {
        const [summary, list] = await Promise.all([
          api('/persona-analytics/summary', filters),
          api('/persona-analytics/patients', { ...filters, persona_type: personaFilter || undefined, page, limit: 20 }),
        ]);
        if (summary.success) setDistribution(summary.distribution || []);
        if (list.success) { setPatients(list.patients || []); setTotalPatients(list.total || 0); }
      } else if (tab === 'history') {
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
    } catch (e) { console.error(`[${tab}] 로드 실패:`, e); }
    finally { setLoading(false); }
  }, [api, hospitalId, partnerId, personaFilter, page, selectedHospital, hospitals.length, templates.length]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // ── 병원 선택 ──
  const selectHospital = (hosnm: string) => {
    setSelectedHospital(hosnm);
    setHospitalSearch(hosnm);
    setShowHospitalDropdown(false);
    setSelectedTargets([]);
  };

  // ── 캠페인 발송 ──
  const sendCampaign = async () => {
    if (!selectedTargets.length) return alert('발송 대상을 선택해주세요');
    if (!window.confirm(`${selectedTargets.length}명에게 검진설계 캠페인을 발송합니다.\n계속할까요?`)) return;
    const r = await api('/checkup-design/campaign/send', {
      target_uuids: selectedTargets, hosnm: selectedHospital,
      partner_id: partnerId || 'welno',
    });
    if (r.success) {
      alert(`발송 처리 완료: ${r.updated}명`);
      setSelectedTargets([]);
      load('campaign');
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

  const totalDesigns = distribution.reduce((s, d) => s + d.count, 0);

  // iframe 모드: 3탭 (기존 호환), 로그인 모드: 4탭 (상담 요청 포함)
  const TAB_ITEMS: [TabKey, string][] = isEmbed
    ? [['campaign', '캠페인 관리'], ['persona', '페르소나 분석'], ['history', '발송 이력']]
    : [['consultation', '상담 요청'], ['campaign', '캠페인 발송'], ['persona', '페르소나 분석'], ['history', '발송 이력']];

  return (
    <div className="cdm-page">
      {/* 탭 + 병원 검색 (한 줄) */}
      <div className="cdm-page__toolbar">
        <div className="tabs">
          {TAB_ITEMS.map(([key, label]) => (
            <button key={key} className={`tabs__item ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </div>
        {/* 병원 검색: 상담 탭에서는 숨김 (ConsultationPage가 자체 필터 관리) */}
        {activeTab !== 'consultation' && (
        <div className="cdm-hospital-select" ref={hospitalRef} style={{position:'relative'}}>
          <div className="cdm-hospital-search" style={{minWidth:'240px'}}>
            <input
              type="text"
              placeholder={`병원 검색 (${hospitals.length}개)`}
              value={hospitalSearch}
              onChange={e => { setHospitalSearch(e.target.value); setShowHospitalDropdown(true); }}
              onFocus={() => setShowHospitalDropdown(true)}
              style={{fontSize:'13px',padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:'6px',width:'100%'}}
            />
            {selectedHospital && (
              <button className="cdm-hospital-search__clear" onClick={() => { setSelectedHospital(''); setHospitalSearch(''); setSelectedTargets([]); }}>✕</button>
            )}
            {showHospitalDropdown && (
              <div className="cdm-hospital-dropdown">
                {filteredHospitals.length === 0 && <div className="cdm-hospital-dropdown__empty">검색 결과 없음</div>}
                {filteredHospitals.slice(0, 50).map((h: any) => (
                  <div
                    key={h.hosnm}
                    className={`cdm-hospital-dropdown__item ${selectedHospital === h.hosnm ? 'cdm-hospital-dropdown__item--active' : ''}`}
                    onClick={() => selectHospital(h.hosnm)}
                  >
                    <span className="cdm-hospital-dropdown__name">{h.hosnm}</span>
                    <span className="cdm-hospital-dropdown__count">{h.mkt_consent}명 / {h.pln_sent}명 발송</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {loading && activeTab !== 'consultation' && <div className="empty-state"><p>로딩 중...</p></div>}

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

          {!selectedHospital && hospitals.length > 0 && !showHospitalDropdown && (
            <p className="empty-state__text" style={{textAlign:'center', padding:'40px 0'}}>병원을 검색하여 선택하면 캠페인 대상이 표시됩니다</p>
          )}
        </div>
      )}

      {/* ── 페르소나 분석 ── */}
      {activeTab === 'persona' && !loading && (
        <div className="cdm-section">
          <div className="cdm-page__kpi">
            <div className="cdm-page__kpi-card">
              <span className="cdm-page__kpi-label">설계 완료</span>
              <span className="cdm-page__kpi-value">{totalDesigns}<small>건</small></span>
            </div>
            {distribution.slice(0, 3).map(d => (
              <div key={d.type} className="cdm-page__kpi-card">
                <span className="cdm-page__kpi-label">{d.type}</span>
                <span className="cdm-page__kpi-value">{d.count}<small>명 ({d.ratio}%)</small></span>
              </div>
            ))}
          </div>

          <div className="cdm-dist">
            {distribution.map(d => (
              <div key={d.type} className="cdm-dist__item" onClick={() => { setPersonaFilter(d.type === personaFilter ? '' : d.type); setPage(1); }}>
                <div className="cdm-dist__bar" style={{ width: `${Math.max(d.ratio, 3)}%`, opacity: !personaFilter || personaFilter === d.type ? 1 : 0.3 }} />
                <span className="cdm-dist__label">{d.type}</span>
                <span className="cdm-dist__count">{d.count}명 ({d.ratio}%)</span>
              </div>
            ))}
            {distribution.length === 0 && <p className="empty-state__text">검진설계 완료 건이 없습니다</p>}
          </div>

          {patients.length > 0 && (
            <>
              <h3 className="cdm-subtitle">
                환자 목록 ({totalPatients}명)
                {personaFilter && <span className="badge badge--info" onClick={() => setPersonaFilter('')}>{personaFilter} ✕</span>}
              </h3>
              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead><tr><th>이름</th><th>페르소나</th><th>병원</th><th>소스</th><th>날짜</th></tr></thead>
                  <tbody>
                    {patients.map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.patient_name || p.uuid?.slice(0, 8)}</td>
                        <td><span className="badge">{p.persona_type || '-'}</span></td>
                        <td>{p.hospital_id}</td>
                        <td>{p.trigger_source}</td>
                        <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cdm-pagination">
                <button className="btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</button>
                <span>{page} / {Math.ceil(totalPatients / 20) || 1}</span>
                <button className="btn-outline" disabled={page * 20 >= totalPatients} onClick={() => setPage(p => p + 1)}>다음</button>
              </div>
            </>
          )}
        </div>
      )}
      {/* ── 발송 이력 ── */}
      {activeTab === 'history' && !loading && (
        <div className="cdm-section">
          <HistoryTable history={historyList} loading={historyLoading} />
        </div>
      )}
    </div>
  );
};

export default CheckupDesignManagementPage;
