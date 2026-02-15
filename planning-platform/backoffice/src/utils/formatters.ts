/**
 * 뱃지/태그 유틸리티 — PatientPage, EmbeddingPage 공통.
 */

/** 위험도 레벨 → 뱃지 CSS 클래스 접미사 */
export const riskBadgeClass = (level: string | null, prefix: string = 'patient-page__badge'): string => {
  if (!level) return '';
  if (level === 'high') return `${prefix}--danger`;
  if (level === 'medium') return `${prefix}--warn`;
  return `${prefix}--safe`;
};

/** 감정 코드 → 한국어 라벨 */
export const sentimentLabel = (sentiment: string): string => {
  const map: Record<string, string> = {
    positive: '긍정',
    negative: '부정',
    neutral: '중립',
    mixed: '혼합',
  };
  return map[sentiment] || sentiment;
};
