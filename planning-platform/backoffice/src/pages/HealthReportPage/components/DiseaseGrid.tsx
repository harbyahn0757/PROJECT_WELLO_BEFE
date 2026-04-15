/**
 * DiseaseGrid — Step 2 Understand: 16 질환 요약 그리드 (4x4)
 * grade 별 색상: 정상=default, 경계=warning, 이상=danger
 * 클릭 시 DiseaseDetailModal (Sub-task B) 호출 — 현재는 noop
 */
import { useState } from 'react';
import type { DiseaseDetail } from '../hooks/useMediarcApi';
import KpiCard from '../../../components/kpi/KpiCard';
import KpiGrid from '../../../components/kpi/KpiGrid';

interface DiseaseGridProps {
  diseases: Record<string, DiseaseDetail>;
}

function gradeVariant(grade?: string, rank?: number): 'default' | 'warning' | 'danger' {
  if (grade) {
    const g = grade.toLowerCase();
    if (g.includes('정상') || g === 'normal' || g === 'low') return 'default';
    if (g.includes('경계') || g === 'borderline' || g === 'medium') return 'warning';
    if (g.includes('이상') || g === 'high' || g === 'danger') return 'danger';
  }
  if (rank != null) {
    if (rank <= 30) return 'default';
    if (rank <= 60) return 'warning';
    return 'danger';
  }
  return 'default';
}

export default function DiseaseGrid({ diseases }: DiseaseGridProps) {
  const [_selected, setSelected] = useState<string | null>(null);

  const entries = Object.entries(diseases || {});

  if (entries.length === 0) return null;

  // KpiGrid cols=4 는 최대 4열. 질환 수에 따라 조정
  const cols: 2 | 3 | 4 = entries.length <= 6 ? 3 : 4;

  return (
    <div className="report-view__disease-grid-wrap">
      <h3 className="report-view__section-title">질환별 위험도</h3>
      <KpiGrid cols={cols}>
        {entries.map(([name, detail]) => {
          const variant = gradeVariant(detail.grade, detail.rank);
          const gradeLabel =
            variant === 'danger' ? '이상' : variant === 'warning' ? '경계' : '정상';
          return (
            <KpiCard
              key={name}
              label={name}
              value={detail.rank != null ? `${detail.rank}등` : '-'}
              hint={gradeLabel}
              variant={variant}
              onClick={() => setSelected(name)}
              testId={`disease-card-${name}`}
            />
          );
        })}
      </KpiGrid>
      {/* DiseaseDetailModal: Sub-task B 담당. selected 상태만 준비 */}
    </div>
  );
}
