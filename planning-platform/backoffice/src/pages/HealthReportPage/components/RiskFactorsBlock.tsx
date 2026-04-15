/**
 * RiskFactorsBlock — Step 2 Understand: 상위 5 위험인자 표시
 * diseases 전체에서 applied_factors 를 수집, 중복 제거 후 RR 기준 상위 5개
 */
import type { DiseaseDetail, AppliedFactor } from '../hooks/useMediarcApi';

interface RiskFactorsBlockProps {
  diseases: Record<string, DiseaseDetail>;
}

export default function RiskFactorsBlock({ diseases }: RiskFactorsBlockProps) {
  // 모든 질환의 applied_factors 수집 + 중복 제거 (factor/name 기준)
  const factorMap = new Map<string, AppliedFactor>();

  Object.values(diseases || {}).forEach(detail => {
    (detail.applied_factors || []).forEach(f => {
      const key = f.factor ?? f.name ?? '';
      if (!key) return;
      const existing = factorMap.get(key);
      // 더 높은 RR 값 유지
      if (!existing || (f.rr ?? 0) > (existing.rr ?? 0)) {
        factorMap.set(key, f);
      }
    });
  });

  const top5 = Array.from(factorMap.values())
    .sort((a, b) => (b.rr ?? 0) - (a.rr ?? 0))
    .slice(0, 5);

  if (top5.length === 0) {
    return null;
  }

  return (
    <div className="report-view__risk-factors">
      <h3 className="report-view__section-title">주요 위험 인자</h3>
      <div className="report-view__risk-factor-list">
        {top5.map((f, i) => {
          const factorName = f.factor ?? f.name ?? '-';
          const pmidLabel = f.pmid ? `PMID ${f.pmid}` : null;
          const sourceLabel = f.source ?? null;

          return (
            <div key={i} className="report-view__risk-factor-card">
              <span className="report-view__risk-factor-name">{factorName}</span>
              <span className="report-view__risk-factor-rr">
                RR {f.rr != null ? f.rr.toFixed(2) : '-'}
              </span>
              {pmidLabel && (
                <span
                  className="report-view__pmid-link"
                  title={sourceLabel ?? pmidLabel}
                >
                  {pmidLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
