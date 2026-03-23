/**
 * 백오피스 — 검진설계 관리 페이지
 * 3탭: 페르소나 분석 | 트리거 관리 | 캠페인 관리
 * 레이아웃: revisit-page 패턴 (공통 tabs, data-table, kpi-card)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import './styles.scss';

type TabKey = 'persona' | 'trigger' | 'campaign';

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

  // ── 트리거 ──
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [triggerLogs, setTriggerLogs] = useState<any[]>([]);
  const [manualUuid, setManualUuid] = useState('');

  // ── 캠페인 ──
  const [targets, setTargets] = useState<any[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

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
      } else if (tab === 'trigger') {
        const [cfg, hist] = await Promise.all([
          api(`/trigger/config/${partnerId || 'welno'}`),
          api('/trigger/history', { ...filters, limit: 50 }),
        ]);
        if (cfg.success) setTriggerEnabled(cfg.config?.auto_planning?.enabled || false);
        if (hist.success) setTriggerLogs(hist.logs || []);
      } else {
        const data = await api('/checkup-design/campaign/targets', {
          ...filters, has_health_data: true, no_existing_design: true, limit: 100,
        });
        if (data.success) setTargets(data.targets || []);
      }
    } catch (e) { console.error(`[${tab}] 로드 실패:`, e); }
    finally { setLoading(false); }
  }, [api, hospitalId, partnerId, personaFilter, page]);

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // ── 트리거 토글 ──
  const toggleTrigger = async () => {
    await fetch(`${API}/partner-office/trigger/config/${partnerId || 'welno'}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !triggerEnabled }),
    });
    setTriggerEnabled(!triggerEnabled);
  };

  // ── 수동 트리거 ──
  const fireTrigger = async () => {
    if (!manualUuid.trim()) return;
    await api('/trigger/manual', { patient_uuid: manualUuid.trim(), hospital_id: hospitalId || 'PEERNINE', partner_id: partnerId || 'welno' });
    alert(`${manualUuid} 트리거 실행 예약됨`);
    setManualUuid('');
    load('trigger');
  };

  // ── 캠페인 발송 ──
  const sendCampaign = async () => {
    if (!selectedTargets.length) return alert('발송 대상을 선택해주세요');
    const r = await api('/checkup-design/campaign/send', {
      target_uuids: selectedTargets, channel: 'email',
      partner_id: partnerId || 'welno', hospital_id: hospitalId || undefined,
    });
    if (r.success) alert(`발송 완료: 성공 ${r.sent}건, 실패 ${r.failed}건`);
    setSelectedTargets([]);
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
        {([['campaign', '캠페인 관리'], ['persona', '페르소나 분석'], ['trigger', '트리거 관리']] as [TabKey, string][]).map(([key, label]) => (
          <button key={key} className={`tabs__item ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state"><p>로딩 중...</p></div>}

      {/* ── 캠페인 관리 ── */}
      {activeTab === 'campaign' && !loading && (
        <div className="cdm-section">
          <div className="cdm-page__kpi">
            <div className="cdm-page__kpi-card">
              <span className="cdm-page__kpi-label">발송 가능 대상</span>
              <span className="cdm-page__kpi-value">{targets.length}<small>명</small></span>
            </div>
            <div className="cdm-page__kpi-card">
              <span className="cdm-page__kpi-label">선택됨</span>
              <span className="cdm-page__kpi-value">{selectedTargets.length}<small>명</small></span>
            </div>
          </div>

          <p className="cdm-desc">건강 데이터가 있지만 검진설계를 아직 받지 않은 환자 목록입니다.</p>

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
                <tr><th style={{width:40}}></th><th>이름</th><th>병원</th><th>데이터 소스</th><th>성별</th><th>생년월일</th><th>최근 업데이트</th></tr>
              </thead>
              <tbody>
                {targets.map(t => (
                  <tr key={t.uuid}>
                    <td><input type="checkbox" checked={selectedTargets.includes(t.uuid)} onChange={() => setSelectedTargets(p => p.includes(t.uuid) ? p.filter(u => u !== t.uuid) : [...p, t.uuid])} /></td>
                    <td>{t.name || t.uuid?.slice(0, 8)}</td>
                    <td>{t.hospital_id}</td>
                    <td>{t.data_source}</td>
                    <td>{t.gender === 'M' ? '남' : t.gender === 'F' ? '여' : '-'}</td>
                    <td>{t.birth_date || '-'}</td>
                    <td>{t.last_data_update ? new Date(t.last_data_update).toLocaleDateString('ko-KR') : '-'}</td>
                  </tr>
                ))}
                {targets.length === 0 && <tr><td colSpan={7} className="empty-state__text">발송 가능한 대상이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
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

      {/* ── 트리거 관리 ── */}
      {activeTab === 'trigger' && !loading && (
        <div className="cdm-section">
          <div className="cdm-trigger-toggle">
            <label><input type="checkbox" checked={triggerEnabled} onChange={toggleTrigger} /> 데이터 수신 시 자동 Step1 실행</label>
            <span className={`badge ${triggerEnabled ? 'badge--success' : 'badge--muted'}`}>{triggerEnabled ? 'ON' : 'OFF'}</span>
          </div>

          <h3 className="cdm-subtitle">수동 트리거</h3>
          <div className="cdm-manual-trigger">
            <input type="text" placeholder="환자 UUID 입력" value={manualUuid} onChange={e => setManualUuid(e.target.value)} className="input" />
            <button className="btn-primary" onClick={fireTrigger}>실행</button>
          </div>

          <h3 className="cdm-subtitle">실행 이력</h3>
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead><tr><th>UUID</th><th>소스</th><th>상태</th><th>시각</th></tr></thead>
              <tbody>
                {triggerLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td>{log.patient_uuid?.slice(0, 16)}...</td>
                    <td>{log.trigger_source}</td>
                    <td><span className={`badge badge--${log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'muted'}`}>{log.status}</span></td>
                    <td>{log.created_at ? new Date(log.created_at).toLocaleString('ko-KR') : '-'}</td>
                  </tr>
                ))}
                {triggerLogs.length === 0 && <tr><td colSpan={4} className="empty-state__text">실행 이력이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckupDesignManagementPage;
