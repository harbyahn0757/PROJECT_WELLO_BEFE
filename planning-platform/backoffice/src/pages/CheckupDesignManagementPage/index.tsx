import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBase } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import './styles.scss';

type TabKey = 'persona' | 'trigger' | 'campaign';

interface PersonaDistribution {
  type: string;
  count: number;
  ratio: number;
}

interface PatientRow {
  id: number;
  uuid: string;
  hospital_id: string;
  persona_type: string;
  patient_name: string;
  patient_summary: string;
  trigger_source: string;
  created_at: string;
}

interface TriggerLog {
  id: number;
  patient_uuid: string;
  partner_id: string;
  trigger_type: string;
  trigger_source: string;
  status: string;
  created_at: string;
}

interface CampaignTarget {
  uuid: string;
  name: string;
  hospital_id: string;
  last_data_update: string;
  data_source: string;
}

const API = getApiBase();

const CheckupDesignManagementPage: React.FC = () => {
  const { isEmbedMode, embedParams } = useEmbedParams();
  const [searchParams] = useSearchParams();
  const hospitalId = embedParams.hospitalId || searchParams.get('hospital_id') || '';
  const partnerId = embedParams.partnerId || searchParams.get('partner_id') || 'welno';

  const [activeTab, setActiveTab] = useState<TabKey>('persona');

  // ── 페르소나 분석 상태 ──
  const [distribution, setDistribution] = useState<PersonaDistribution[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [personaFilter, setPersonaFilter] = useState('');
  const [page, setPage] = useState(1);

  // ── 트리거 관리 상태 ──
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [triggerLogs, setTriggerLogs] = useState<TriggerLog[]>([]);
  const [manualUuid, setManualUuid] = useState('');

  // ── 캠페인 관리 상태 ──
  const [targets, setTargets] = useState<CampaignTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // ── API 헬퍼 ──
  const apiFetch = useCallback(async (path: string, body?: any) => {
    const opts: RequestInit = { headers: { 'Content-Type': 'application/json' } };
    if (body) {
      opts.method = 'POST';
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(`${API}/partner-office${path}`, opts);
    return resp.json();
  }, []);

  // ── 페르소나 데이터 로드 ──
  const loadPersona = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await apiFetch('/persona-analytics/summary', {
        hospital_id: hospitalId || undefined,
        partner_id: partnerId,
      });
      if (summary.success) setDistribution(summary.distribution || []);

      const list = await apiFetch('/persona-analytics/patients', {
        hospital_id: hospitalId || undefined,
        partner_id: partnerId,
        persona_type: personaFilter || undefined,
        page,
        limit: 20,
      });
      if (list.success) {
        setPatients(list.patients || []);
        setTotalPatients(list.total || 0);
      }
    } catch (e) {
      console.error('[페르소나] 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, hospitalId, partnerId, personaFilter, page]);

  // ── 트리거 데이터 로드 ──
  const loadTrigger = useCallback(async () => {
    setLoading(true);
    try {
      const config = await apiFetch(`/trigger/config/${partnerId}`);
      if (config.success) {
        setTriggerEnabled(config.config?.auto_planning?.enabled || false);
      }

      const history = await apiFetch('/trigger/history', {
        partner_id: partnerId,
        limit: 50,
      });
      if (history.success) setTriggerLogs(history.logs || []);
    } catch (e) {
      console.error('[트리거] 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, partnerId]);

  // ── 캠페인 대상 로드 ──
  const loadCampaignTargets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/checkup-design/campaign/targets', {
        hospital_id: hospitalId || undefined,
        partner_id: partnerId,
        has_health_data: true,
        no_existing_design: true,
        limit: 100,
      });
      if (data.success) setTargets(data.targets || []);
    } catch (e) {
      console.error('[캠페인] 대상 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, hospitalId, partnerId]);

  // ── 탭 변경 시 데이터 로드 ──
  useEffect(() => {
    if (activeTab === 'persona') loadPersona();
    else if (activeTab === 'trigger') loadTrigger();
    else if (activeTab === 'campaign') loadCampaignTargets();
  }, [activeTab, loadPersona, loadTrigger, loadCampaignTargets]);

  // ── 트리거 토글 ──
  const handleTriggerToggle = async () => {
    const newVal = !triggerEnabled;
    await apiFetch(`/trigger/config/${partnerId}`, {
      // PUT을 POST로 우회 (fetch 편의)
    });
    // PUT 호출
    await fetch(`${API}/partner-office/trigger/config/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newVal }),
    });
    setTriggerEnabled(newVal);
  };

  // ── 수동 트리거 ──
  const handleManualTrigger = async () => {
    if (!manualUuid.trim()) return;
    await apiFetch('/trigger/manual', {
      patient_uuid: manualUuid.trim(),
      hospital_id: hospitalId || 'PEERNINE',
      partner_id: partnerId,
    });
    alert(`${manualUuid} 트리거 실행 예약됨`);
    setManualUuid('');
    loadTrigger();
  };

  // ── 캠페인 발송 ──
  const handleCampaignSend = async () => {
    if (selectedTargets.length === 0) {
      alert('발송 대상을 선택해주세요');
      return;
    }
    const result = await apiFetch('/checkup-design/campaign/send', {
      target_uuids: selectedTargets,
      channel: 'email',
      partner_id: partnerId,
      hospital_id: hospitalId || undefined,
    });
    if (result.success) {
      alert(`발송 완료: 성공 ${result.sent}건, 실패 ${result.failed}건`);
      setSelectedTargets([]);
    }
  };

  // ── 대상 전체 선택/해제 ──
  const toggleAllTargets = () => {
    if (selectedTargets.length === targets.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(targets.map(t => t.uuid));
    }
  };

  return (
    <div className="cdm-page">
      <h2 className="cdm-page__title">검진설계 관리</h2>

      {/* 탭 네비게이션 */}
      <div className="cdm-tabs">
        {(['persona', 'trigger', 'campaign'] as TabKey[]).map(tab => (
          <button
            key={tab}
            className={`cdm-tabs__btn ${activeTab === tab ? 'cdm-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'persona' ? '페르소나 분석' : tab === 'trigger' ? '트리거 관리' : '캠페인 관리'}
          </button>
        ))}
      </div>

      {loading && <div className="cdm-loading">로딩 중...</div>}

      {/* ── 페르소나 분석 탭 ── */}
      {activeTab === 'persona' && !loading && (
        <div className="cdm-section">
          <h3>페르소나 분포</h3>
          <div className="cdm-dist">
            {distribution.map(d => (
              <div key={d.type} className="cdm-dist__item" onClick={() => { setPersonaFilter(d.type); setPage(1); }}>
                <div className="cdm-dist__bar" style={{ width: `${d.ratio}%` }} />
                <span className="cdm-dist__label">{d.type}</span>
                <span className="cdm-dist__count">{d.count}명 ({d.ratio}%)</span>
              </div>
            ))}
          </div>

          <h3>환자 목록 {personaFilter && <span className="cdm-filter-badge">{personaFilter} <button onClick={() => setPersonaFilter('')}>x</button></span>} ({totalPatients}명)</h3>
          <table className="cdm-table">
            <thead>
              <tr>
                <th>이름</th><th>페르소나</th><th>병원</th><th>소스</th><th>날짜</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id}>
                  <td>{p.patient_name || p.uuid.slice(0, 8)}</td>
                  <td><span className={`cdm-badge cdm-badge--${(p.persona_type || '').toLowerCase()}`}>{p.persona_type || '-'}</span></td>
                  <td>{p.hospital_id}</td>
                  <td>{p.trigger_source}</td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan={5} className="cdm-empty">데이터 없음</td></tr>}
            </tbody>
          </table>
          <div className="cdm-pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</button>
            <span>{page} / {Math.ceil(totalPatients / 20) || 1}</span>
            <button disabled={page * 20 >= totalPatients} onClick={() => setPage(p => p + 1)}>다음</button>
          </div>
        </div>
      )}

      {/* ── 트리거 관리 탭 ── */}
      {activeTab === 'trigger' && !loading && (
        <div className="cdm-section">
          <h3>자동 트리거 설정</h3>
          <div className="cdm-trigger-toggle">
            <label>
              <input type="checkbox" checked={triggerEnabled} onChange={handleTriggerToggle} />
              데이터 수신 시 자동 Step1 실행
            </label>
            <span className={`cdm-status ${triggerEnabled ? 'cdm-status--on' : 'cdm-status--off'}`}>
              {triggerEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <h3>수동 트리거</h3>
          <div className="cdm-manual-trigger">
            <input
              type="text"
              placeholder="환자 UUID 입력"
              value={manualUuid}
              onChange={e => setManualUuid(e.target.value)}
            />
            <button onClick={handleManualTrigger}>실행</button>
          </div>

          <h3>실행 이력</h3>
          <table className="cdm-table">
            <thead>
              <tr><th>UUID</th><th>소스</th><th>상태</th><th>시각</th></tr>
            </thead>
            <tbody>
              {triggerLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.patient_uuid?.slice(0, 12)}...</td>
                  <td>{log.trigger_source}</td>
                  <td><span className={`cdm-badge cdm-badge--${log.status}`}>{log.status}</span></td>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))}
              {triggerLogs.length === 0 && <tr><td colSpan={4} className="cdm-empty">이력 없음</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 캠페인 관리 탭 ── */}
      {activeTab === 'campaign' && !loading && (
        <div className="cdm-section">
          <h3>캠페인 대상 ({targets.length}명)</h3>
          <p className="cdm-desc">건강 데이터가 있지만 검진설계를 아직 받지 않은 환자 목록</p>

          <div className="cdm-campaign-actions">
            <button onClick={toggleAllTargets}>
              {selectedTargets.length === targets.length ? '전체 해제' : '전체 선택'}
            </button>
            <button onClick={handleCampaignSend} disabled={selectedTargets.length === 0}>
              선택 대상 발송 ({selectedTargets.length}명)
            </button>
          </div>

          <table className="cdm-table">
            <thead>
              <tr><th></th><th>이름</th><th>병원</th><th>데이터 소스</th><th>최근 업데이트</th></tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.uuid}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(t.uuid)}
                      onChange={() => {
                        setSelectedTargets(prev =>
                          prev.includes(t.uuid) ? prev.filter(u => u !== t.uuid) : [...prev, t.uuid]
                        );
                      }}
                    />
                  </td>
                  <td>{t.name || t.uuid.slice(0, 8)}</td>
                  <td>{t.hospital_id}</td>
                  <td>{t.data_source}</td>
                  <td>{t.last_data_update ? new Date(t.last_data_update).toLocaleDateString('ko-KR') : '-'}</td>
                </tr>
              ))}
              {targets.length === 0 && <tr><td colSpan={5} className="cdm-empty">대상 없음</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CheckupDesignManagementPage;
