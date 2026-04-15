import React from 'react';
import { ReportData } from '../hooks/useMediarcApi';
import Disclosure from './Disclosure';
import BodyAgeChart from './BodyAgeChart';
import NutritionBlock from './NutritionBlock';
import GaugeBlock from './GaugeBlock';
import ReferencePmidList from './ReferencePmidList';

interface AppendixBlockProps {
  data: ReportData;
}

export default function AppendixBlock({ data }: AppendixBlockProps) {
  const hasDiseaseAges =
    data.disease_ages != null && Object.keys(data.disease_ages).length > 0;

  const hasNutrition =
    data.nutrition != null &&
    ((data.nutrition.recommend?.length ?? 0) > 0 ||
      (data.nutrition.caution?.length ?? 0) > 0);

  const hasGauges =
    data.gauges?.all != null && Object.keys(data.gauges.all).length > 0;

  const hasDiseases =
    data.diseases != null && Object.keys(data.diseases).length > 0;

  return (
    <div className="report-view__appendix" data-testid="appendix-block">
      {hasDiseaseAges && (
        <Disclosure
          title="신체 부위별 건강나이"
          defaultOpen={false}
        >
          <BodyAgeChart ages={data.disease_ages as Record<string, number>} />
        </Disclosure>
      )}

      {hasNutrition && (
        <Disclosure title="맞춤 영양 추천">
          <NutritionBlock nutrition={data.nutrition} />
        </Disclosure>
      )}

      {hasGauges && (
        <Disclosure title="검진 수치 게이지">
          <GaugeBlock gauges={(data.gauges as NonNullable<ReportData['gauges']>).all} />
        </Disclosure>
      )}

      {hasDiseases && (
        <Disclosure title="참고문헌 (PMID)">
          <ReferencePmidList diseases={data.diseases} />
        </Disclosure>
      )}
    </div>
  );
}
