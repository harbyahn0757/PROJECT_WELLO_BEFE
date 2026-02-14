/**
 * 엑셀 내보내기 유틸 — 각 페이지 데이터를 멀티시트 xlsx로 다운로드
 */
import * as XLSX from 'xlsx';

/** 워크북 생성 → 다운로드 */
export function downloadWorkbook(sheets: { name: string; data: Record<string, any>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    if (data.length === 0) {
      data = [{ '(데이터 없음)': '' }];
    }
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // sheet name max 31 chars
  });
  XLSX.writeFile(wb, filename);
}

/** 날짜 포맷 (파일명용) */
export function dateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}
