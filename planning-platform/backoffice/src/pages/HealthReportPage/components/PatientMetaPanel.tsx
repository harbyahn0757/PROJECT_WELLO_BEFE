/**
 * PatientMetaPanel — BMI / 흡연 / 음주 메타 배지 패널
 * W1 블로커 신규 파일 (data-test 속성 사용, data-testid 혼용 금지)
 */
import type { PatientInfo } from '../hooks/useMediarcApi';

interface PatientMetaPanelProps {
  patientInfo: PatientInfo;
}

export default function PatientMetaPanel({ patientInfo }: PatientMetaPanelProps) {
  const bmiDisplay = patientInfo.bmi !== undefined
    ? patientInfo.bmi.toFixed(1)
    : '—';

  // PatientInfo 타입에 smoking/drinking 미포함 — 확장형 캐스팅으로 안전 접근
  const extra = patientInfo as Record<string, any>;
  const smokingValue: string = extra['smoking'] !== undefined ? String(extra['smoking']) : '미입력';
  const drinkingValue: string = extra['drinking'] !== undefined ? String(extra['drinking']) : '미입력';

  return (
    <div
      className="report-view__meta-panel report-view__meta-row"
      data-test="patient-meta"
    >
      <div
        className="report-view__meta-badge"
        data-test="patient-bmi"
        aria-label={`BMI ${bmiDisplay}`}
      >
        <span className="report-view__meta-badge-label">BMI</span>
        <span className="report-view__meta-badge-value">{bmiDisplay}</span>
      </div>

      <div
        className="report-view__meta-badge"
        data-test="patient-smoking"
        aria-label={`흡연: ${smokingValue}`}
      >
        <span className="report-view__meta-badge-label">흡연</span>
        <span className="report-view__meta-badge-value">{smokingValue}</span>
      </div>

      <div
        className="report-view__meta-badge"
        data-test="patient-drinking"
        aria-label={`음주: ${drinkingValue}`}
      >
        <span className="report-view__meta-badge-label">음주</span>
        <span className="report-view__meta-badge-value">{drinkingValue}</span>
      </div>
    </div>
  );
}
