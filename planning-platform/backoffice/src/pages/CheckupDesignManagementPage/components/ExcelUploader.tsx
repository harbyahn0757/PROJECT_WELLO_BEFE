/**
 * 엑셀 업로드 + 헤더 매핑 + 데이터 미리보기
 * - 파일 선택 (드래그앤드롭 or 클릭)
 * - 헤더 자동 추출 → 전화번호 열 자동 감지
 * - 데이터 테이블 (체크박스 + 페이지당 50행)
 * - 대상자 엑셀 내보내기
 */
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface Props {
  onDataLoaded: (headers: string[], rows: any[]) => void;
  onExport?: () => void;
  maxRows?: number;
}

const MAX_ROWS = 1000;

const ExcelUploader: React.FC<Props> = ({ onDataLoaded, onExport, maxRows = MAX_ROWS }) => {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

        // 헤더 추출
        const hdrs: string[] = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
          hdrs.push(cell?.v?.toString().trim() || `Column${col + 1}`);
        }

        // 데이터 추출 (최대 maxRows)
        const allRows = XLSX.utils.sheet_to_json(sheet, {
          header: hdrs, defval: '', raw: false,
          range: { s: { r: 1, c: 0 }, e: { r: Math.min(range.e.r, maxRows), c: range.e.c } },
        }) as any[];

        if (allRows.length > maxRows) {
          setError(`최대 ${maxRows}행까지 지원합니다. (현재 ${range.e.r}행)`);
        }

        setHeaders(hdrs);
        setRows(allRows);
        setPreviewRows(allRows.slice(0, 5));
        onDataLoaded(hdrs, allRows);
      } catch (err: any) {
        setError(`파일 읽기 실패: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // 전화번호 열 자동 감지
  const phoneCol = headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('phone') || lower.includes('전화') || lower === '휴대폰' || lower === '연락처';
  });

  return (
    <div className="excel-uploader">
      {/* 파일 선택 영역 */}
      <div
        className="excel-uploader__dropzone"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} />
        {fileName ? (
          <div className="excel-uploader__file-info">
            <span className="excel-uploader__file-name">{fileName}</span>
            <span className="excel-uploader__file-count">{rows.length}행 로드됨</span>
            {phoneCol && <span className="excel-uploader__phone-col">전화번호 열: {phoneCol}</span>}
          </div>
        ) : (
          <div className="excel-uploader__placeholder">
            <span>엑셀 파일을 드래그하거나 클릭하여 선택</span>
            <small>.xlsx / .xls (최대 {maxRows}행)</small>
          </div>
        )}
      </div>

      {error && <p className="excel-uploader__error">{error}</p>}

      {/* 미리보기 (첫 5행) */}
      {previewRows.length > 0 && (
        <div className="excel-uploader__preview">
          <h4>미리보기 (첫 {previewRows.length}행 / 전체 {rows.length}행)</h4>
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h} className={h === phoneCol ? 'excel-uploader__phone-header' : ''}>
                      {h}{h === phoneCol ? ' 📱' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => <td key={h}>{row[h] || '-'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 엑셀 내보내기 */}
      {onExport && (
        <button className="btn-outline excel-uploader__export" onClick={onExport}>
          대상자 엑셀 내보내기
        </button>
      )}
    </div>
  );
};

export default ExcelUploader;
