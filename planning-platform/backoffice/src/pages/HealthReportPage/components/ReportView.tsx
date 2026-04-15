/**
 * ReportView — Phase 1 메인 리포트 뷰
 * 5단계 여정: Shock / Understand / Motivate / Action / Celebrate
 * AppendixBlock (Sub-task B) 은 병합 후 채움
 */
import type { ReportData } from '../hooks/useMediarcApi';
import HeroBlock from './HeroBlock';
import RiskFactorsBlock from './RiskFactorsBlock';
import DiseaseGrid from './DiseaseGrid';
import BeforeAfterBlock from './BeforeAfterBlock';
import MilestoneSlot from './MilestoneSlot';
import TrendSlot from './TrendSlot';
import AppendixBlock from './AppendixBlock';

interface ReportViewProps {
  data: ReportData;
  uuid: string;
  hospitalId?: string;
}

export default function ReportView({ data, uuid, hospitalId }: ReportViewProps) {
  return (
    <div className="report-view" data-testid="report-view">
      {/* Step 1: Shock */}
      <section className="report-view__section report-view__section--shock">
        <HeroBlock data={data} uuid={uuid} hospitalId={hospitalId} />
      </section>

      {/* Step 2: Understand */}
      <section className="report-view__section report-view__section--understand">
        <RiskFactorsBlock diseases={data.diseases} />
        <DiseaseGrid diseases={data.diseases} />
      </section>

      {/* Step 3: Motivate */}
      <section className="report-view__section report-view__section--motivate">
        <BeforeAfterBlock data={data} />
      </section>

      {/* Step 4: Action */}
      <section className="report-view__section report-view__section--action">
        <MilestoneSlot />
      </section>

      {/* Step 5: Celebrate */}
      <section className="report-view__section report-view__section--celebrate">
        <TrendSlot />
      </section>

      {/* Appendix (접이식 상세) */}
      <AppendixBlock data={data} />
    </div>
  );
}
