/**
 * 날짜 포맷 유틸리티 — 4개 페이지에서 반복되는 포맷 로직 공통화.
 */

/** YYYY-MM-DD */
export const formatDateOnly = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

/** YYYY-MM-DD HH:mm */
export const formatDateTime = (d: string): string => {
  return d.slice(0, 16).replace('T', ' ');
};

/** YY.MM.DD HH:mm — EmbeddingPage 상담 목록용 */
export const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
};
