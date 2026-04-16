/**
 * BeforeAfterBlock — Step 3 Motivate: 현재 vs 개선 시나리오 비교 테이블
 * 3-A: 헤더 th 8개(근거 열 추가), 하단 공통 Disclosure, WillRogersCaption will_rogers prop 전달
 */
import type { ReportData } from '../hooks/useMediarcApi';
import BeforeAfterRow from './BeforeAfterRow';
import WillRogersCaption from './WillRogersCaption';
import Disclosure from './Disclosure';
import Term from './Term';

interface BeforeAfterBlockProps {
  data: ReportData;
}

export default function BeforeAfterBlock({ data }: BeforeAfterBlockProps) {
  const improved = data.improved;

  if (!improved || improved.has_improvement === false) {
    return (
      <div className="report-view__before-after report-view__before-after--empty">
        <p>개선 시나리오 없음</p>
      </div>
    );
  }

  const labels = improved.labels;
  const labelParts: string[] = [];
  if (labels?.bmi) labelParts.push(`BMI: ${labels.bmi}`);
  if (labels?.smoking) labelParts.push(`흡연: ${labels.smoking}`);
  if (labels?.drinking) labelParts.push(`음주: ${labels.drinking}`);

  const diseaseEntries = Object.entries(data.diseases || {});
  const willRogersMap = improved.will_rogers as Record<string, any> | undefined;
  const willRogersArray = willRogersMap
    ? (Object.values(willRogersMap) as any[])
    : undefined;

  return (
    <div
      className="report-view__before-after"
      data-test="before-after-block"
      role="region"
      aria-label="개선 시나리오 비교"
    >
      <h3 className="report-view__section-title"><Term keyword="개선 시나리오">개선 시나리오</Term> 비교</h3>

      {labelParts.length > 0 && (
        <p className="report-view__scenario-labels" data-test="improved-labels">
          개선 조건: {labelParts.join(' / ')}
        </p>
      )}

      {/* improved-sbp / improved-dbp / improved-fbg: hidden spans for E2E (spec 10.3) */}
      {improved.improved_sbp != null && (
        <span data-test="improved-sbp" style={{ display: 'none' }}>{improved.improved_sbp}</span>
      )}
      {improved.improved_dbp != null && (
        <span data-test="improved-dbp" style={{ display: 'none' }}>{improved.improved_dbp}</span>
      )}
      {improved.improved_fbg != null && (
        <span data-test="improved-fbg" style={{ display: 'none' }}>{improved.improved_fbg}</span>
      )}

      <div className="report-view__before-after-table-wrap">
        <table className="report-view__before-after-table">
          <thead>
            <tr>
              <th>질환</th>
              <th>현재 위험률</th>
              <th>현재 <Term keyword="등수">등수</Term></th>
              <th>개선 위험률</th>
              <th>개선 <Term keyword="등수">등수</Term></th>
              <th>등수 변화</th>
              <th><Term keyword="ARR">ARR</Term></th>
              <th>근거</th>
            </tr>
          </thead>
          <tbody>
            {diseaseEntries.map(([name, detail]) => (
              <BeforeAfterRow
                key={name}
                diseaseName={name}
                current={detail}
                willRogers={willRogersMap?.[name]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <WillRogersCaption willRogers={willRogersArray} />

      <div className="report-view__before-after-block__formula">
        <Disclosure title="이 표의 계산 방법 요약">
          <ul>
            <li>개인 RR: 문진·수치로 판정한 위험인자 각각의 RR 를 곱한 값 (Hippisley-Cox 2024 QRISK4)</li>
            <li>코호트 평균 RR: 해당 연령·성별 집단의 기댓값 — piecewise log 정규화 (Rothman 2008, PMID 18212285)</li>
            <li>질환별 건강나이 &Delta;: 10·ln(개인 RR / 코호트 평균) (D&apos;Agostino Framingham, PMID 34151374)</li>
            <li>윌 로저스 방지: 개선 후에도 코호트 평균 고정 (Feinstein 1985, PMID 4000199)</li>
            <li>5년 예측: Gompertz 기반 누적 발생률 (국립암센터 &alpha; fitting, 코호트 내부 검증)</li>
          </ul>
        </Disclosure>
      </div>
    </div>
  );
}
