/**
 * 변수 매핑 테이블 — XOG VariableMappingSection 포팅
 * - 3소스: auto(대상자 자동) / fixed(고정값) / table(엑셀 열)
 * - 시스템 변수: wello_uuid, sub, URL → "시스템 자동" 뱃지
 * - 빈값 경고: 빨간 테두리 + "필수" 표시
 * - 버튼 URL 미리보기
 */
import React from 'react';

interface Props {
  variables: string[];
  fixedVars: Record<string, string>;
  onVarChange: (varName: string, value: string) => void;
  selectedHospital?: string;
  excelHeaders?: string[];
  excelMapping?: Record<string, string>;
  onMappingChange?: (varName: string, header: string) => void;
  buttonUrls?: string[]; // 버튼 URL 목록 (미리보기용)
}

// 시스템 자동 변수 (BE에서 처리)
const SYSTEM_VARS = ['wello_uuid', 'sub', 'URL', 'client_id'];

// 대상자별 자동 채움 변수
const AUTO_VARS: Record<string, string> = {
  '고객명': '대상자 이름 (자동)',
  '신청일자': '등록일 regdate (자동)',
};

const VariableMapping: React.FC<Props> = ({
  variables, fixedVars, onVarChange, selectedHospital,
  excelHeaders, excelMapping, onMappingChange, buttonUrls,
}) => {
  if (!variables.length) return null;

  const hasExcel = excelHeaders && excelHeaders.length > 0;

  const getVarType = (v: string): 'system' | 'auto' | 'fixed' | 'table' => {
    if (SYSTEM_VARS.includes(v)) return 'system';
    if (AUTO_VARS[v]) return 'auto';
    if (hasExcel && excelMapping?.[v]) return 'table';
    return 'fixed';
  };

  const isEmpty = (v: string): boolean => {
    const type = getVarType(v);
    if (type === 'system' || type === 'auto') return false;
    if (v === '병원명' && selectedHospital) return false;
    return !fixedVars[v];
  };

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
            const type = getVarType(v);
            const empty = isEmpty(v);

            return (
              <tr key={v} className={empty ? 'var-mapping__row--empty' : ''}>
                <td className="var-mapping__name">
                  {'#{'}{v}{'}'}
                  {empty && <span className="var-mapping__required">필수</span>}
                </td>
                <td className="var-mapping__source">
                  {type === 'system' && (
                    <span className="var-mapping__badge var-mapping__badge--system">시스템 자동</span>
                  )}
                  {type === 'auto' && (
                    <span className="var-mapping__badge var-mapping__badge--auto">자동</span>
                  )}
                  {type === 'table' && (
                    <span className="var-mapping__badge var-mapping__badge--table">엑셀</span>
                  )}
                  {type === 'fixed' && (
                    <span className="var-mapping__badge var-mapping__badge--fixed">고정값</span>
                  )}
                </td>
                <td className="var-mapping__value">
                  {type === 'system' && (
                    <span className="var-mapping__system-desc">
                      BE에서 자동 생성 (welno_patients UUID)
                    </span>
                  )}
                  {type === 'auto' && (
                    <span className="var-mapping__auto-desc">
                      {AUTO_VARS[v]}
                    </span>
                  )}
                  {type === 'table' && hasExcel && (
                    <select
                      value={excelMapping?.[v] || ''}
                      onChange={e => onMappingChange?.(v, e.target.value)}
                    >
                      <option value="">열 선택...</option>
                      {excelHeaders?.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  )}
                  {type === 'fixed' && (
                    <input
                      type="text"
                      placeholder={v === '병원명' && selectedHospital ? selectedHospital : `${v} 값 입력`}
                      value={v === '병원명' ? (fixedVars[v] || selectedHospital || '') : (fixedVars[v] || '')}
                      onChange={e => onVarChange(v, e.target.value)}
                      disabled={v === '병원명' && !!selectedHospital && !fixedVars[v]}
                      className={empty ? 'var-mapping__input--empty' : ''}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 버튼 URL 미리보기 */}
      {buttonUrls && buttonUrls.length > 0 && (
        <div className="var-mapping__url-preview">
          <h4>버튼 URL 미리보기</h4>
          {buttonUrls.map((url, i) => (
            <div key={i} className="var-mapping__url-item">
              <code>{url.replace(/#{(\w+)}/g, (_, v) => {
                if (SYSTEM_VARS.includes(v)) return `[${v}: 자동생성]`;
                if (fixedVars[v]) return fixedVars[v];
                if (v === '병원명' && selectedHospital) return selectedHospital;
                return `[${v}: 미설정]`;
              })}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VariableMapping;
