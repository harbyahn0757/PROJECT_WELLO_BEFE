/**
 * 백오피스 — B2B 산업군별 CRM 환자 관리 (신규)
 *
 * SoT: docs/spec/B2B_TAGGING_SYSTEM_v2.md
 * API: POST /partner-office/patients/by-industry + /dashboard/industry-distribution
 *
 * 5 산업군: hospital / supplement / fitness / insurance / mental_care
 * 5 stage: awareness / interest / consider / decision / action
 *
 * 기존 RevisitPage 와 별도 페이지 (영향 0). 운영 검증 후 통합 검토.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { PageLayout } from '../../components/layout/PageLayout';
import { PageHeader } from '../../components/layout/PageHeader';
import { Spinner } from '../../components/Spinner';

const API = getApiBase();

const INDUSTRIES: Array<{ id: string; label: string; emoji: string; color: string }> = [
  { id: 'hospital',    label: '병원',     emoji: '🏥', color: '#2563eb' },
  { id: 'supplement',  label: '건기식',   emoji: '💊', color: '#10b981' },
  { id: 'fitness',     label: '헬스장',   emoji: '🏃', color: '#f59e0b' },
  { id: 'insurance',   label: '보험',     emoji: '📋', color: '#8b5cf6' },
  { id: 'mental_care', label: '심리',     emoji: '🧠', color: '#ec4899' },
];

const STAGES: Array<{ id: string; label: string; minScore: number; color: string }> = [
  { id: 'none',      label: '신호 없음', minScore: 0,  color: '#9ca3af' },
  { id: 'awareness', label: '인지',      minScore: 10, color: '#94a3b8' },
  { id: 'interest',  label: '흥미',      minScore: 30, color: '#0ea5e9' },
  { id: 'consider',  label: '고민',      minScore: 50, color: '#f59e0b' },
  { id: 'decision',  label: '결정',      minScore: 70, color: '#dc2626' },
  { id: 'action',    label: '행동',      minScore: 85, color: '#9333ea' },
];

interface Patient {
  session_id: string;
  user_uuid: string;
  hospital_id: string;
  hospital_name?: string;
  industry: string;
  industry_score: number;
  industry_stage: string;
  sub_categories?: string[];
  health_concerns?: Array<{ topic: string; intensity: string; evidence?: string }>;
  signals?: { urgency?: string; readiness?: string; buying_intent?: string; anxiety_level?: string };
  evidence_quotes?: string[];
  risk_level?: string;
  sentiment?: string;
  summary?: string;
  consultation_requested?: boolean;
  consultation_status?: string;
  updated_at?: string;
}

interface IndustryDist {
  industry: string;
  stages: Record<string, number>;
  total_with_signal: number;
  avg_score: number;
}

export default function IndustryPage() {
  const [industry, setIndustry] = useState('hospital');
  const [stage, setStage] = useState<string>('');  // 빈 문자열 = 전체
  const [minScore, setMinScore] = useState(50);
  const [hospitalId, setHospitalId] = useState<string>('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dist, setDist] = useState<IndustryDist[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchDistribution = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API}/partner-office/dashboard/industry-distribution`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospital_id: hospitalId || null }),
      });
      const data = await res.json();
      if (data.success) setDist(data.industries || []);
    } catch (e) {
      console.warn('[IndustryPage] dist fetch failed', e);
    }
  }, [hospitalId]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchWithAuth(`${API}/partner-office/patients/by-industry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_id: hospitalId || null,
          industry,
          min_score: minScore,
          stage: stage || null,
          limit: 50,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
      } else {
        setErr(data.detail || '조회 실패');
      }
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [hospitalId, industry, minScore, stage]);

  useEffect(() => { fetchDistribution(); }, [fetchDistribution]);
  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const distMap = useMemo(() => {
    const m: Record<string, IndustryDist> = {};
    dist.forEach((d) => { m[d.industry] = d; });
    return m;
  }, [dist]);

  return (
    <PageLayout pageName="industry">
      <PageHeader title="B2B 산업군별 환자" subtitle="5 산업군 × stage × score — 산업군별 CRM 우선순위" />

      {/* 산업군 selector + 분포 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {INDUSTRIES.map((ind) => {
          const d = distMap[ind.id];
          const active = industry === ind.id;
          return (
            <button
              key={ind.id}
              onClick={() => setIndustry(ind.id)}
              style={{
                padding: '12px 16px', borderRadius: 8, border: `2px solid ${active ? ind.color : '#e5e7eb'}`,
                background: active ? ind.color : 'white', color: active ? 'white' : '#374151',
                cursor: 'pointer', minWidth: 160, textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 24 }}>{ind.emoji}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{ind.label}</div>
              {d && (
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
                  활성 {d.total_with_signal} / 평균 {d.avg_score}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, marginRight: 8, color: '#6b7280' }}>Stage:</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ padding: 6 }}>
            <option value="">전체</option>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label} (score≥{s.minScore})</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, marginRight: 8, color: '#6b7280' }}>Min score:</label>
          <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          <span style={{ marginLeft: 8, fontWeight: 600 }}>{minScore}</span>
        </div>
        <button onClick={fetchPatients} style={{ padding: '6px 16px', background: '#2563eb', color: 'white', border: 0, borderRadius: 4, cursor: 'pointer' }}>
          새로고침
        </button>
      </div>

      {/* Stage 분포 (현재 산업군) */}
      {distMap[industry] && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
            {INDUSTRIES.find((i) => i.id === industry)?.label} stage 분포 (전체 v2 태깅)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STAGES.map((s) => (
              <span key={s.id} style={{ background: 'white', border: `1px solid ${s.color}`, color: s.color, padding: '4px 10px', borderRadius: 4, fontSize: 12 }}>
                {s.label}: <strong>{distMap[industry]?.stages[s.id] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 환자 list */}
      {loading && <Spinner />}
      {err && <div style={{ color: '#dc2626', padding: 12 }}>오류: {err}</div>}
      {!loading && !err && (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>병원</th>
                <th style={{ padding: 8 }}>session</th>
                <th style={{ padding: 8 }}>score</th>
                <th style={{ padding: 8 }}>stage</th>
                <th style={{ padding: 8 }}>sub_category</th>
                <th style={{ padding: 8 }}>risk</th>
                <th style={{ padding: 8 }}>signals</th>
                <th style={{ padding: 8 }}>health_concerns</th>
                <th style={{ padding: 8 }}>요약</th>
                <th style={{ padding: 8 }}>상담</th>
                <th style={{ padding: 8 }}>updated</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>해당 조건 환자 없음</td></tr>
              ) : patients.map((p) => {
                const stageColor = STAGES.find((s) => s.id === p.industry_stage)?.color || '#9ca3af';
                return (
                  <tr key={p.session_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 8, fontSize: 12 }}>{p.hospital_name?.slice(0, 12) || '-'}</td>
                    <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11 }}>{p.session_id.slice(-12)}</td>
                    <td style={{ padding: 8, fontWeight: 700 }}>{p.industry_score}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ background: stageColor, color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                        {STAGES.find((s) => s.id === p.industry_stage)?.label || p.industry_stage}
                      </span>
                    </td>
                    <td style={{ padding: 8, fontSize: 11 }}>{(p.sub_categories || []).join(', ')}</td>
                    <td style={{ padding: 8, fontSize: 11 }}>{p.risk_level}</td>
                    <td style={{ padding: 8, fontSize: 11 }}>
                      {p.signals && [
                        p.signals.urgency, p.signals.readiness, p.signals.buying_intent
                      ].filter(Boolean).join('/')}
                    </td>
                    <td style={{ padding: 8, fontSize: 11 }}>
                      {(p.health_concerns || []).map((h) => `${h.topic}(${h.intensity})`).join(', ')}
                    </td>
                    <td style={{ padding: 8, fontSize: 11, maxWidth: 280 }}>{p.summary?.slice(0, 50)}</td>
                    <td style={{ padding: 8 }}>{p.consultation_requested ? <span style={{ color: '#dc2626', fontWeight: 600 }}>요청됨</span> : '-'}</td>
                    <td style={{ padding: 8, fontSize: 11 }}>{p.updated_at?.slice(5, 16)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            총 {patients.length} 명 — score ≥ {minScore} {stage && `+ ${STAGES.find((s) => s.id === stage)?.label}`}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
