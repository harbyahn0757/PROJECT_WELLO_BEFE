/**
 * 변수 매핑 — DB 필드 매칭 + 고정값 선택
 *
 * 각 변수에 대해 3가지 소스:
 * - field: mdx_agr_list 컬럼에서 대상자별 값 (드롭다운 선택)
 * - fixed: 모든 대상자에게 동일한 고정값 (직접 입력)
 * - system: BE에서 자동 처리 (wello_uuid, sub, URL)
 */
import React, { useEffect } from 'react';

// mdx_agr_list 필드 목록 (targets API 응답 기준)
const DB_FIELDS: { value: string; label: string }[] = [
  { value: 'name', label: '이름 (name)' },
  { value: 'hosnm', label: '병원명 (hosnm)' },
  { value: 'hosaddr', label: '병원주소 (hosaddr)' },
  { value: 'birthday', label: '생년월일 (birthday)' },
  { value: 'gender', label: '성별 (gender)' },
  { value: 'phoneno', label: '전화번호 (phoneno)' },
  { value: 'regdate', label: '등록일 (regdate)' },
  { value: 'visitdate', label: '방문일 (visitdate)' },
  { value: 'bmi', label: 'BMI' },
  { value: 'bphigh', label: '수축기혈압 (bphigh)' },
  { value: 'bplwst', label: '이완기혈압 (bplwst)' },
  { value: 'blds', label: '혈당 (blds)' },
  { value: 'hdlchole', label: 'HDL콜레스테롤' },
  { value: 'ldlchole', label: 'LDL콜레스테롤' },
  { value: 'triglyceride', label: '중성지방' },
  { value: 'gfr', label: '사구체여과율 (GFR)' },
];

// 변수명 → DB 필드 자동 추천 규칙
const AUTO_MATCH: Record<string, string> = {
  '고객명': 'name', '환자명': 'name', '이름': 'name',
  '병원명': 'hosnm', '병원': 'hosnm',
  '신청일자': 'regdate', '등록일': 'regdate',
  '방문일': 'visitdate', '검사일': 'visitdate', '예약일시': 'visitdate',
  '생년월일': 'birthday',
  '성별': 'gender',
  '전화번호': 'phoneno', '연락처': 'phoneno',
  '병원주소': 'hosaddr',
};

// BE에서 자동 처리하는 시스템 변수
const SYSTEM_VARS = ['wello_uuid', 'sub', 'URL', 'client_id'];

export type VarSource = 'field' | 'fixed' | 'system';
export interface VarMapping {
  source: VarSource;
  field?: string;   // source='field' 일 때 DB 컬럼명
  value?: string;   // source='fixed' 일 때 고정값
}

interface Props {
  variables: string[];
  mappings: Record<string, VarMapping>;
  onMappingChange: (varName: string, mapping: VarMapping) => void;
  selectedHospital?: string;
}

// 초기 매핑 생성 (자동 추천)
export function buildInitialMappings(
  variables: string[], selectedHospital?: string
): Record<string, VarMapping> {
  const result: Record<string, VarMapping> = {};
  for (const v of variables) {
    if (SYSTEM_VARS.includes(v)) {
      result[v] = { source: 'system' };
    } else if (AUTO_MATCH[v]) {
      result[v] = { source: 'field', field: AUTO_MATCH[v] };
    } else if (v === '병원연락처') {
      result[v] = { source: 'fixed', value: '' }; // welno_hospitals에서 별도 조회 필요
    } else if (v === '연도') {
      result[v] = { source: 'fixed', value: String(new Date().getFullYear()) };
    } else {
      result[v] = { source: 'fixed', value: '' };
    }
  }
  // 병원명은 선택된 병원으로 고정값 세팅할 수도 있음
  if (selectedHospital && result['병원명']?.source === 'field') {
    // hosnm 필드 매핑 유지 — 대상자별 hosnm 사용
  }
  return result;
}

const VariableMapping: React.FC<Props> = ({
  variables, mappings, onMappingChange, selectedHospital,
}) => {
  if (!variables.length) return null;

  const handleSourceChange = (v: string, newSource: VarSource) => {
    if (newSource === 'field') {
      const autoField = AUTO_MATCH[v] || '';
      onMappingChange(v, { source: 'field', field: autoField });
    } else if (newSource === 'fixed') {
      onMappingChange(v, { source: 'fixed', value: '' });
    }
  };

  const handleFieldChange = (v: string, field: string) => {
    onMappingChange(v, { source: 'field', field });
  };

  const handleValueChange = (v: string, value: string) => {
    onMappingChange(v, { source: 'fixed', value });
  };

  return (
    <div className="var-mapping">
      <h4 className="var-mapping__title">변수 매핑 ({variables.length}개)</h4>
      <table className="var-mapping__table">
        <thead>
          <tr>
            <th>변수명</th>
            <th>소스</th>
            <th>값 / 필드</th>
          </tr>
        </thead>
        <tbody>
          {variables.map(v => {
            const m = mappings[v] || { source: 'fixed', value: '' };
            const isSystem = m.source === 'system';

            return (
              <tr key={v} className={
                m.source === 'fixed' && !m.value && !isSystem ? 'var-mapping__row--empty' : ''
              }>
                <td className="var-mapping__name">
                  {'#{'}{v}{'}'}
                  {m.source === 'fixed' && !m.value && !isSystem && (
                    <span className="var-mapping__required">필수</span>
                  )}
                </td>
                <td className="var-mapping__source">
                  {isSystem ? (
                    <span className="var-mapping__badge var-mapping__badge--system">시스템</span>
                  ) : (
                    <select
                      className="var-mapping__source-select"
                      value={m.source}
                      onChange={e => handleSourceChange(v, e.target.value as VarSource)}
                    >
                      <option value="field">DB 필드</option>
                      <option value="fixed">고정값</option>
                    </select>
                  )}
                </td>
                <td className="var-mapping__value">
                  {isSystem && (
                    <span className="var-mapping__system-desc">BE 자동 생성</span>
                  )}
                  {m.source === 'field' && (
                    <select
                      className="var-mapping__field-select"
                      value={m.field || ''}
                      onChange={e => handleFieldChange(v, e.target.value)}
                    >
                      <option value="">필드 선택...</option>
                      {DB_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  )}
                  {m.source === 'fixed' && (
                    <input
                      type="text"
                      placeholder={`${v} 값 입력`}
                      value={m.value || ''}
                      onChange={e => handleValueChange(v, e.target.value)}
                      className={!m.value ? 'var-mapping__input--empty' : ''}
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
