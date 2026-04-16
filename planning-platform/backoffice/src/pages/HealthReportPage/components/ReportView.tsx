/**
 * ReportView — Phase 1 메인 리포트 뷰
 * 5단계 여정: Shock / Understand / Motivate / Action / Celebrate
 * Phase 3-B/3-C: MilestoneSlot 필수 props 연결, TimeDim 상태 관리
 */
import { useState } from 'react';
import type { ReportData } from '../hooks/useMediarcApi';
import HeroBlock from './HeroBlock';
import RiskFactorsBlock from './RiskFactorsBlock';
import DiseaseGrid from './DiseaseGrid';
import BeforeAfterBlock from './BeforeAfterBlock';
import MilestoneSlot from './MilestoneSlot';
import TimeDimToggle from './TimeDimToggle';
import TrendSlot from './TrendSlot';
import AppendixBlock from './AppendixBlock';
import PatientMetaPanel from './PatientMetaPanel';
import MissingFieldsBanner from './MissingFieldsBanner';
import DebugDrawer from './DebugDrawer';

interface ReportViewProps {
  data: ReportData;
  uuid: string;
  hospitalId?: string;
}

export default function ReportView({ data, uuid, hospitalId }: ReportViewProps) {
  // 3-C 시간 차원 상태 (BeforeAfterBlock + MilestoneSlot 공유)
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<0 | 6 | 12 | 60>(0);
  // W1: DebugDrawer 열림 상태
  const [debugOpen, setDebugOpen] = useState(false);

  const patientInfo = data.patient_info;
  const baseBmi: number = patientInfo?.bmi ?? 22.0;
  const hospitalIdNum: number | null = hospitalId ? parseInt(hospitalId, 10) : null;

  return (
    <div className="report-view" data-testid="report-view">
      {/* W1: 누락 필드 경고 배너 — HeroBlock 바로 앞 */}
      <MissingFieldsBanner
        missingFields={patientInfo?.missing_fields ?? []}
        imputedFields={patientInfo?.imputed_fields ?? []}
      />

      {/* Step 1: Shock */}
      <section className="report-view__section report-view__section--shock">
        <HeroBlock data={data} uuid={uuid} hospitalId={hospitalId} />
        {/* W1: BMI/흡연/음주 메타 배지 */}
        {patientInfo && <PatientMetaPanel patientInfo={patientInfo} />}

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

      {/* Step 4: Action — Phase 3-B 마일스톤 슬롯 */}
      <section className="report-view__section report-view__section--action">
        <TimeDimToggle value={timeHorizonMonths} onChange={setTimeHorizonMonths} />
        <MilestoneSlot
          patientUuid={uuid}
          hospitalId={hospitalIdNum}
          baseBmi={baseBmi}
          baseWeight={patientInfo?.weight ?? null}
          baseHeight={patientInfo?.height ?? null}
          timeHorizonMonths={timeHorizonMonths}
        />
      </section>

      {/* Step 5: Celebrate */}
      <section className="report-view__section report-view__section--celebrate">
        <TrendSlot />
      </section>

      {/* Appendix (접이식 상세) */}
      <AppendixBlock data={data} />

      {/* W1: DebugDrawer — report-view 최하단 */}
      {patientInfo && (
        <DebugDrawer
          patientInfo={patientInfo}
          open={debugOpen}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}
