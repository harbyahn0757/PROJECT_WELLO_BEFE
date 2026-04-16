/**
 * HeroBlock — Step 1 Shock: 환자 메타 + 건강나이/delta/등수 KPI + AI 요약 stub
 */
import type { ReportData } from '../hooks/useMediarcApi';
import KpiGrid from '../../../components/kpi/KpiGrid';
import KpiCard from '../../../components/kpi/KpiCard';
import AiSummaryButton from './AiSummaryButton';

interface HeroBlockProps {
  data: ReportData;
  uuid: string;
  hospitalId?: string;
}

export default function HeroBlock({ data, uuid, hospitalId }: HeroBlockProps) {
  const bodyAge = data.bodyage?.bodyage;
  const delta = data.bodyage?.delta;

  const deltaLabel =
    delta != null
      ? delta > 0
        ? `+${delta.toFixed(1)}세`
        : `${delta.toFixed(1)}세`
      : '-';

  const deltaVariant: 'default' | 'danger' | 'warning' =
    delta == null ? 'default' : delta > 3 ? 'danger' : delta > 0 ? 'warning' : 'default';

  const rankVariant: 'default' | 'warning' | 'danger' =
    data.rank == null
      ? 'default'
      : data.rank > 60
      ? 'danger'
      : data.rank > 30
      ? 'warning'
      : 'default';

  return (
    <div className="report-view__hero-block">
      <div className="report-view__hero-meta">
        <span className="report-view__hero-name" data-test="report-name">{data.name ?? '-'}</span>
        <span className="report-view__hero-meta-sub">
          <span data-test="report-age">{data.age != null ? `${data.age}세` : '-'}</span>
          {' / '}
          <span data-test="report-sex">{data.sex === 'M' ? '남' : data.sex === 'F' ? '여' : data.sex ?? '-'}</span>
        </span>
      </div>

      {data.group != null && (
        <span className="report-view__hero-group" data-test="report-group">{data.group}</span>
      )}

      <KpiGrid cols={4}>
        <KpiCard
          label="건강나이"
          value={bodyAge != null ? `${bodyAge.toFixed(1)}세` : '-'}
          testId="hero-bodyage"
        />
        <KpiCard
          label="실제나이 대비"
          value={deltaLabel}
          variant={deltaVariant}
          testId="hero-delta"
        />
        <KpiCard
          label="건강등수"
          value={
            <span data-test="rank-pill">
              {data.rank != null ? `${data.rank}등` : '-'}
            </span>
          }
          variant={rankVariant}
          testId="hero-rank"
        />
        <KpiCard
          label="AI 요약"
          value={<AiSummaryButton uuid={uuid} hospitalId={hospitalId} />}
          testId="hero-ai-summary"
        />
      </KpiGrid>

      {bodyAge != null && (
        <span data-test="bodyage-value" style={{ display: 'none' }}>{bodyAge.toFixed(1)}</span>
      )}
    </div>
  );
}
