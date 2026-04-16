/**
 * ReportView — Phase 1 메인 리포트 뷰
 * 5단계 여정: Shock / Understand / Motivate / Action / Celebrate
 * Phase 3-B/3-C: MilestoneSlot 필수 props 연결, TimeDim 상태 관리
 * Progressive skeleton + staggered reveal (loading prop)
 */
import { useState, useEffect } from 'react';
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
  data: ReportData | null;
  loading?: boolean;
  uuid: string;
  hospitalId?: string;
}

// Skeleton placeholder — 각 섹션 높이에 맞게
function SectionSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div className="report-view__skeleton" style={{ height }} aria-hidden="true" />
  );
}

// 전체 skeleton (로딩 초기 상태)
function FullSkeleton() {
  return (
    <div className="report-view" data-testid="report-view">
      <SectionSkeleton height={180} />
      <SectionSkeleton height={240} />
      <SectionSkeleton height={200} />
      <SectionSkeleton height={160} />
      <SectionSkeleton height={120} />
    </div>
  );
}

const STAGGER_STEPS = 5;
const STAGGER_INTERVAL_MS = 200;

export default function ReportView({ data, loading = false, uuid, hospitalId }: ReportViewProps) {
  // 3-C 시간 차원 상태 (BeforeAfterBlock + MilestoneSlot 공유)
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<0 | 6 | 12 | 60>(0);
  // W1: DebugDrawer 열림 상태
  const [debugOpen, setDebugOpen] = useState(false);
  // staggered reveal 단계 (0 = 전체 skeleton, 5 = 전체 노출)
  const [revealStep, setRevealStep] = useState(0);

  useEffect(() => {
    if (!data) {
      setRevealStep(0);
      return;
    }
    // 캐시 hit 시 즉시 전체 표시
    if ((data as any).cached === true) {
      setRevealStep(STAGGER_STEPS);
      return;
    }
    // 데이터 도착 → 200ms 간격 순차 노출
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setRevealStep(step);
      if (step >= STAGGER_STEPS) clearInterval(timer);
    }, STAGGER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [data]);

  // loading=true 또는 data 미도달 시 skeleton
  if (loading || !data) {
    return <FullSkeleton />;
  }

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
        {revealStep >= 1 ? (
          <>
            <HeroBlock data={data} uuid={uuid} hospitalId={hospitalId} />
            {patientInfo && <PatientMetaPanel patientInfo={patientInfo} />}
          </>
        ) : (
          <SectionSkeleton height={180} />
        )}
      </section>

      {/* Step 2: Understand */}
      <section className="report-view__section report-view__section--understand">
        {revealStep >= 2 ? (
          <>
            <RiskFactorsBlock diseases={data.diseases} />
            <DiseaseGrid diseases={data.diseases} />
          </>
        ) : (
          <SectionSkeleton height={240} />
        )}
      </section>

      {/* Step 3: Motivate */}
      <section className="report-view__section report-view__section--motivate">
        {revealStep >= 3 ? (
          <BeforeAfterBlock data={data} />
        ) : (
          <SectionSkeleton height={200} />
        )}
      </section>

      {/* Step 4: Action — Phase 3-B 마일스톤 슬롯 */}
      <section className="report-view__section report-view__section--action">
        {revealStep >= 4 ? (
          <>
            <TimeDimToggle value={timeHorizonMonths} onChange={setTimeHorizonMonths} />
            <MilestoneSlot
              patientUuid={uuid}
              hospitalId={hospitalIdNum}
              baseBmi={baseBmi}
              baseWeight={patientInfo?.weight ?? null}
              baseHeight={patientInfo?.height ?? null}
              timeHorizonMonths={timeHorizonMonths}
            />
          </>
        ) : (
          <SectionSkeleton height={160} />
        )}
      </section>

      {/* Step 5: Celebrate */}
      <section className="report-view__section report-view__section--celebrate">
        {revealStep >= 5 ? (
          <>
            <TrendSlot />
            <AppendixBlock data={data} />
          </>
        ) : (
          <SectionSkeleton height={120} />
        )}
      </section>

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
