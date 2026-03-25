/**
 * 변수 매핑 테이블
 * - 변수명 | 소스 | 값/필드 | 미리보기
 * - 소스: fixed(고정값 직접입력) / table(엑셀 열 선택)
 * - 고정값 입력 시 실시간 미리보기 반영
 */
import React from 'react';

interface Props {
  variables: string[];
  fixedVars: Record<string, string>;
  onVarChange: (varName: string, value: string) => void;
  excelHeaders?: string[];
  excelMapping?: Record<string, string>;
  onMappingChange?: (varName: string, header: string) => void;
}

const VariableMapping: React.FC<Props> = ({
  variables, fixedVars, onVarChange,
  excelHeaders, excelMapping, onMappingChange,
}) => {
  if (!variables.length) return null;

  const hasExcel = excelHeaders && excelHeaders.length > 0;

  return (
    <div className="var-mapping">
      <h4 className="var-mapping__title">변수 설정 ({variables.length}개)</h4>
      <table className="var-mapping__table">
        <thead>
          <tr>
            <th>변수명</th>
            <th>소스</th>
            <th>값</th>
          </tr>
        </thead>
        <tbody>
          {variables.map(v => {
            const isExcelMapped = hasExcel && excelMapping?.[v];
            return (
              <tr key={v}>
                <td className="var-mapping__name">{'#{'}{v}{'}'}</td>
                <td className="var-mapping__source">
                  {hasExcel ? (
                    <select
                      value={isExcelMapped ? 'table' : 'fixed'}
                      onChange={e => {
                        if (e.target.value === 'fixed') {
                          onMappingChange?.(v, '');
                        }
                      }}
                    >
                      <option value="fixed">고정값</option>
                      <option value="table">엑셀 열</option>
                    </select>
                  ) : (
                    <span className="var-mapping__source-badge">고정값</span>
                  )}
                </td>
                <td className="var-mapping__value">
                  {isExcelMapped ? (
                    <select
                      value={excelMapping?.[v] || ''}
                      onChange={e => onMappingChange?.(v, e.target.value)}
                    >
                      <option value="">열 선택...</option>
                      {excelHeaders?.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={`${v} 값 입력`}
                      value={fixedVars[v] || ''}
                      onChange={e => onVarChange(v, e.target.value)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default VariableMapping;
