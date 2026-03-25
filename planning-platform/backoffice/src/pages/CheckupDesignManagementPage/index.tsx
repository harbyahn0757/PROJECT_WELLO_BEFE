/**
 * 백오피스 — 검진설계 관리 페이지
 * 2탭: 캠페인 관리 | 페르소나 분석
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import './styles.scss';

type TabKey = 'campaign' | 'persona';

const API = getApiBase();

const CheckupDesignManagementPage: React.FC = () => {
  const { embedParams } = useEmbedParams();
  const [searchParams] = useSearchParams();
  const hospitalId = embedParams.hospitalId || searchParams.get('hospital_id') || '';
  const partnerId = embedParams.partnerId || searchParams.get('partner_id') || '';

  const [activeTab, setActiveTab] = useState<TabKey>('campaign');
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
    const r = await fetch(`${API}/partner-office${path}`, opts);
    return r.json();
  }, []);

  // ── 데이터 로드 ──
  const load = useCallback(async (tab: TabKey) => {
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
      } else {
        // 병원 목록 로드 (최초 1회)
        if (hospitals.length === 0) {
          const h = await fetch(`${API}/partner-office/checkup-design/campaign/hospitals`).then(r => r.json());
          if (h.success) setHospitals(h.hospitals || []);
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
  }, [api, hospitalId, partnerId, personaFilter, page, selectedHospital, hospitals.length]);

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

  const totalDesigns = distribution.reduce((s, d) => s + d.count, 0);

  return (
    <div className="cdm-page">
      <div className="cdm-page__header">
        <h2 className="cdm-page__title">검진설계 관리</h2>
      </div>

      {/* 탭 */}
      <div className="tabs">
        {([['campaign', '캠페인 관리'], ['persona', '페르소나 분석']] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} className={`tabs__item ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state"><p>로딩 중...</p></div>}

      {/* ── 캠페인 관리 ── */}
      {activeTab === 'campaign' && !loading && (
        <div className="cdm-section">
          {/* 병원 검색 드롭다운 */}
          <div className="cdm-hospital-select" ref={hospitalRef}>
            <label>병원</label>
            <div className="cdm-hospital-search">
              <input
                type="text"
                placeholder={`병원명 검색 (${hospitals.length}개)`}
                value={hospitalSearch}
                onChange={e => { setHospitalSearch(e.target.value); setShowHospitalDropdown(true); }}
                onFocus={() => setShowHospitalDropdown(true)}
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
                      <span className="cdm-hospital-dropdown__count">{h.mkt_consent}명 동의 / {h.pln_sent}명 발송</span>
                    </div>
                  ))}
                  {filteredHospitals.length > 50 && <div className="cdm-hospital-dropdown__more">+{filteredHospitals.length - 50}개 더...</div>}
                </div>
              )}
            </div>
          </div>

          {selectedHospital && (
            <>
              <div className="cdm-page__kpi">
                <div className="cdm-page__kpi-card">
                  <span className="cdm-page__kpi-label">미발송 대상</span>
                  <span className="cdm-page__kpi-value">{totalTargets}<small>명</small></span>
                </div>
                <div className="cdm-page__kpi-card">
                  <span className="cdm-page__kpi-label">선택됨</span>
                  <span className="cdm-page__kpi-value">{selectedTargets.length}<small>명</small></span>
                </div>
              </div>

              <div className="cdm-actions">
                <button className="btn-outline" onClick={toggleAll}>
                  {selectedTargets.length === targets.length && targets.length > 0 ? '전체 해제' : '전체 선택'}
                </button>
                <button className="btn-primary" onClick={sendCampaign} disabled={!selectedTargets.length}>
                  선택 대상 발송 ({selectedTargets.length}명)
                </button>
              </div>

              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th style={{width:40}}></th><th>이름</th><th>성별</th><th>생년월일</th><th>방문일</th><th>BMI</th><th>혈압</th><th>혈당</th><th>상태</th></tr>
                  </thead>
                  <tbody>
                    {targets.map((t: any) => {
                      const bmiWarn = t.bmi && parseFloat(t.bmi) >= 25;
                      const bpWarn = t.bphigh && parseFloat(t.bphigh) >= 140;
                      const bsWarn = t.blds && parseFloat(t.blds) >= 100;
                      return (
                        <tr key={t.uuid}>
                          <td><input type="checkbox" checked={selectedTargets.includes(t.uuid)} onChange={() => setSelectedTargets(p => p.includes(t.uuid) ? p.filter(u => u !== t.uuid) : [...p, t.uuid])} /></td>
                          <td>{t.name || '-'}</td>
                          <td>{t.gender === 'M' ? '남' : t.gender === 'F' ? '여' : '-'}</td>
                          <td>{t.birthday || '-'}</td>
                          <td>{t.visitdate || '-'}</td>
                          <td style={{color: bmiWarn ? '#dc2626' : undefined, fontWeight: bmiWarn ? 600 : undefined}}>{t.bmi || '-'}</td>
                          <td style={{color: bpWarn ? '#dc2626' : undefined, fontWeight: bpWarn ? 600 : undefined}}>{t.bphigh ? `${t.bphigh}/${t.bplwst}` : '-'}</td>
                          <td style={{color: bsWarn ? '#dc2626' : undefined, fontWeight: bsWarn ? 600 : undefined}}>{t.blds || '-'}</td>
                          <td>{t.pln_mkt === 'Y' ? <span className="badge badge--success">발송완료</span> : <span className="badge badge--muted">미발송</span>}</td>
                        </tr>
                      );
                    })}
                    {targets.length === 0 && <tr><td colSpan={9} className="empty-state__text">{selectedHospital ? '해당 병원에 발송 가능한 대상이 없습니다' : '병원을 선택해주세요'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
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
    </div>
  );
};

export default CheckupDesignManagementPage;
