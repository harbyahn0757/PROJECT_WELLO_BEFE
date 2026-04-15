import React from 'react';
import { DiseaseDetail } from '../hooks/useMediarcApi';

interface ReferencePmidListProps {
  diseases?: Record<string, DiseaseDetail>;
}

interface PmidEntry {
  pmid: string;
  source?: string;
}

function collectPmids(diseases: Record<string, DiseaseDetail>): PmidEntry[] {
  const seen = new Set<string>();
  const result: PmidEntry[] = [];

  for (const detail of Object.values(diseases)) {
    const factors = detail.applied_factors ?? [];
    for (const factor of factors) {
      const raw = factor.pmid;
      if (!raw) continue;
      const pmid = String(raw).trim();
      if (!pmid || seen.has(pmid)) continue;
      seen.add(pmid);
      result.push({ pmid, source: factor.source });
    }
  }

  return result;
}

export default function ReferencePmidList({ diseases }: ReferencePmidListProps) {
  if (!diseases || Object.keys(diseases).length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        참고문헌 정보가 없습니다.
      </p>
    );
  }

  const entries = collectPmids(diseases);

  if (entries.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        PMID 정보가 없습니다.
      </p>
    );
  }

  return (
    <ol
      style={{ margin: 0, padding: '0 0 0 1.2rem', fontSize: '12px' }}
      data-testid="reference-pmid-list"
    >
      {entries.map(({ pmid, source }, idx) => (
        <li
          key={pmid}
          className="report-view__reference-item"
          style={{ marginBottom: '4px', lineHeight: 1.5 }}
        >
          {source && (
            <span style={{ color: '#6b7280', marginRight: '6px' }}>
              {source}
            </span>
          )}
          <a
            className="report-view__pmid-link"
            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            PMID: {pmid}
          </a>
        </li>
      ))}
    </ol>
  );
}
