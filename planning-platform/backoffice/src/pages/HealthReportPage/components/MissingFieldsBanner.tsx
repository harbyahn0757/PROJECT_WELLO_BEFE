/**
 * MissingFieldsBanner — 누락 필드 경고 배너
 * W1 블로커 신규 파일 (data-test 속성 사용, data-testid 혼용 금지)
 * missingFields.length === 0 이면 null 반환
 */

interface MissingFieldsBannerProps {
  missingFields: string[];
  imputedFields?: string[];
}

export default function MissingFieldsBanner({
  missingFields,
  imputedFields,
}: MissingFieldsBannerProps) {
  if (missingFields.length === 0) return null;

  const fieldList = missingFields.join(', ');
  const count = missingFields.length;

  return (
    <div
      className="report-view__missing-fields-banner"
      data-test="missing-fields"
      role="alert"
      aria-live="polite"
    >
      <span className="report-view__missing-fields-banner-icon" aria-hidden="true">
        ⚠
      </span>
      <span className="report-view__missing-fields-banner-text">
        시뮬레이션 결과 신뢰도 저하: {count}개 필드 누락 [{fieldList}]
      </span>
      {imputedFields && imputedFields.length > 0 && (
        <span className="report-view__missing-fields-banner-imputed">
          (대체 적용: {imputedFields.join(', ')})
        </span>
      )}
    </div>
  );
}
