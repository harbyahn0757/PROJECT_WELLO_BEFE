import React, { useEffect, useCallback } from 'react';
import { DiseaseDetail } from '../hooks/useMediarcApi';

interface DiseaseDetailModalProps {
  disease: string;
  detail: DiseaseDetail;
  open: boolean;
  onClose: () => void;
}

export default function DiseaseDetailModal({
  disease,
  detail,
  open,
  onClose,
}: DiseaseDetailModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const chips = detail.chips ?? [];
  const factors = detail.applied_factors ?? [];
  const fiveYear = detail.five_year ?? [];

  return (
    <>
      <div
        className="report-view__modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
        }}
        onClick={onClose}
        data-testid="modal-overlay"
      />
      <div
        className="report-view__modal"
        role="dialog"
        aria-modal="true"
        aria-label={disease}
        data-testid="disease-detail-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: 'min(560px, 90vw)',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 1001,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            {disease}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}
        >
          <tbody>
            {detail.individual_rr !== undefined && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6b7280', width: '40%' }}>개인 상대 위험도 (RR)</td>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>{detail.individual_rr.toFixed(2)}</td>
              </tr>
            )}
            {detail.cohort_mean_rr !== undefined && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>코호트 평균 RR</td>
                <td style={{ padding: '4px 8px' }}>{detail.cohort_mean_rr.toFixed(2)}</td>
              </tr>
            )}
            {detail.ratio !== undefined && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>비율 (ratio)</td>
                <td style={{ padding: '4px 8px' }}>{detail.ratio.toFixed(3)}</td>
              </tr>
            )}
            {detail.grade && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>등급</td>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>{detail.grade}</td>
              </tr>
            )}
          </tbody>
        </table>

        {chips.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              위험 인자 ({detail.chips_present ?? 0}/{detail.chips_total ?? chips.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {chips.map((chip, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: chip.present ? 'rgba(217,119,6,0.15)' : '#f3f4f6',
                    color: chip.present ? '#d97706' : '#6b7280',
                    fontWeight: chip.present ? 600 : 400,
                  }}
                >
                  {chip.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {factors.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              적용 인자
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'left' }}>인자명</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>RR</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left' }}>PMID</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((f, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 6px' }}>{f.name ?? f.factor ?? '-'}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                      {f.rr !== undefined ? f.rr.toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {f.pmid ? (
                        <a
                          className="report-view__pmid-link"
                          href={`https://pubmed.ncbi.nlm.nih.gov/${f.pmid}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#4299e1', textDecoration: 'underline' }}
                        >
                          {f.pmid}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fiveYear.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              5년 위험도 추이
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {fiveYear.map((val, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    color: '#374151',
                  }}
                >
                  {i + 1}년차: {typeof val === 'number' ? val.toFixed(3) : val}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
