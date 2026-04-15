/**
 * BeforeAfterBlock — Step 3 Motivate: 현재 vs 개선 시나리오 비교 테이블
 */
import type { ReportData } from '../hooks/useMediarcApi';
import BeforeAfterRow from './BeforeAfterRow';
import WillRogersCaption from './WillRogersCaption';

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

  return (
    <div className="report-view__before-after">
      <h3 className="report-view__section-title">개선 시나리오 비교</h3>

      {labelParts.length > 0 && (
        <p className="report-view__scenario-labels">
          개선 조건: {labelParts.join(' / ')}
        </p>
      )}

      <div className="report-view__before-after-table-wrap">
        <table className="report-view__before-after-table">
          <thead>
            <tr>
              <th>질환</th>
              <th>현재 위험률</th>
              <th>현재 등수</th>
              <th>개선 위험률</th>
              <th>개선 등수</th>
              <th>등수 변화</th>
              <th>ARR</th>
            </tr>
          </thead>
          <tbody>
            {diseaseEntries.map(([name, detail]) => (
              <BeforeAfterRow
                key={name}
                diseaseName={name}
                current={detail}
                willRogers={improved.will_rogers?.[name]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <WillRogersCaption />
    </div>
  );
}
