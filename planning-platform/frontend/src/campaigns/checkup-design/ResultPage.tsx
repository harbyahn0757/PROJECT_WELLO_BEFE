/**
 * 검진설계 캠페인 결과 페이지
 * 기존 CheckupRecommendationsPage 재사용 불가 시 독립 표시.
 * BE에서 최신 설계 결과를 조회하여 표시.
 */

import React, { useState, useEffect } from 'react';

interface Props {
  uuid: string;
  hospitalId: string;
  partnerId: string;
}

const getApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1';
  if (window.location.hostname === 'welno.kindhabit.com') return '/welno-api/v1';
  return '/api/v1';
};

const API_BASE = getApiBase();

const ResultPage: React.FC<Props> = ({ uuid, hospitalId, partnerId }) => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultRequested, setConsultRequested] = useState(false);
  const [consultLoading, setConsultLoading] = useState(false);

  useEffect(() => {
    const loadResult = async () => {
      try {
        const hid = hospitalId || 'PEERNINE';
        const resp = await fetch(`${API_BASE}/checkup-design/latest/${uuid}?hospital_id=${hid}`);
        const data = await resp.json();

        if (data.success !== false && data) {
          setResult(data);
          if (data.data?.request_status === 'consultation_requested') {
            setConsultRequested(true);
          }
        } else {
          setError('결과를 찾지 못했어요');
        }
      } catch (e) {
        setError('결과를 불러오지 못했어요');
      } finally {
        setLoading(false);
      }
    };
    loadResult();
  }, [uuid, hospitalId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#6b7280' }}>결과를 가져오고 있어요</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '12px' }}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  // 결과 데이터 파싱
  const designResult = result?.design_result || result?.data?.design_result || result;
  const patientSummary = designResult?.patient_summary || '';
  const analysis = designResult?.analysis || '';
  const recommendedItems = designResult?.recommended_items || [];
  const riskProfile = designResult?.risk_profile || [];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 20px' }}>
      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e3a5f' }}>
          AI 검진설계 결과
        </h1>
      </div>

      {/* 환자 요약 */}
      {patientSummary && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px',
          marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>요약</h3>
          <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {patientSummary}
          </p>
        </div>
      )}

      {/* 위험도 프로필 */}
      {riskProfile.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px',
          marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>위험도 프로필</h3>
          {riskProfile.map((item: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < riskProfile.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}>
              <span style={{ fontSize: '13px', color: '#4b5563' }}>{item.organ_system || item.factor}</span>
              <span style={{
                fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '10px',
                background: item.risk_level === 'High' ? '#fee2e2' : item.risk_level === 'Moderate' ? '#fef3c7' : '#d1fae5',
                color: item.risk_level === 'High' ? '#991b1b' : item.risk_level === 'Moderate' ? '#92400e' : '#065f46',
              }}>
                {item.risk_level || item.level}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 추천 검진 항목 */}
      {recommendedItems.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px',
          marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>추천 검진 항목</h3>
          {recommendedItems.map((cat: any, i: number) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', marginBottom: '4px' }}>
                {cat.category}
              </p>
              {(cat.items || []).map((item: any, j: number) => (
                <div key={j} style={{ padding: '6px 0 6px 12px', borderLeft: '2px solid #e5e7eb' }}>
                  <p style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{item.name}</p>
                  {item.reason && (
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{item.reason}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 종합 분석 */}
      {analysis && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px',
          marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>종합 분석</h3>
          <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {analysis}
          </p>
        </div>
      )}

      {/* 하단 CTA */}
      <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <button
          disabled={consultRequested || consultLoading}
          onClick={async () => {
            setConsultLoading(true);
            try {
              const hid = hospitalId || 'PEERNINE';
              const resp = await fetch(`${API_BASE}/checkup-design/consultation-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid, hospital_id: hid }),
              });
              await resp.json();
              if (resp.ok) {
                setConsultRequested(true);
              }
            } catch (e) {
              // 실패 시 무시 — 재시도 가능
            } finally {
              setConsultLoading(false);
            }
          }}
          style={{
            padding: '14px 32px', width: '100%', maxWidth: '320px',
            background: consultRequested ? '#d1d5db' : '#2563eb',
            color: consultRequested ? '#6b7280' : 'white',
            border: 'none', borderRadius: '12px',
            cursor: consultRequested || consultLoading ? 'default' : 'pointer',
            fontSize: '15px', fontWeight: 600,
            opacity: consultLoading ? 0.7 : 1,
          }}
        >
          {consultLoading ? '요청 중...' : consultRequested ? '상담 요청 완료' : '전문 상담사와 상담하기'}
        </button>
        {consultRequested && (
          <p style={{ fontSize: '13px', color: '#059669', margin: 0 }}>
            상담 요청이 접수되었어요. 곧 연락드릴게요!
          </p>
        )}
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '12px 32px', background: '#f3f4f6', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: '10px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 500,
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default ResultPage;
