/**
 * 아코디언 템플릿 — 2컬럼 + 변수 인라인 편집
 * 변수 뱃지 클릭 → 드롭다운(DB필드) 또는 인라인 input(고정값)
 * 버튼 URL 변수도 필수 변수에 포함
 */
import React, { useState } from 'react';
import { VarMapping } from './VariableMapping';

interface Props {
  template: any;
  variables: string[];        // 본문 + 버튼 URL 통합 변수
  mappings: Record<string, VarMapping>;
  onMappingChange: (varName: string, mapping: VarMapping) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

const BTN_TYPE: Record<string, string> = {
  WL: '웹링크', MD: '모바일', AC: '앱연결', TN: '전화',
};
const SYS_VARS = ['wello_uuid', 'sub', 'URL', 'client_id'];

// DB 필드 드롭다운 옵션
const DB_FIELDS = [
  { value: 'name', label: '이름' },
  { value: 'hosnm', label: '병원명' },
  { value: 'hosaddr', label: '병원주소' },
  { value: 'birthday', label: '생년월일' },
  { value: 'gender', label: '성별' },
  { value: 'phoneno', label: '전화번호' },
  { value: 'regdate', label: '등록일' },
  { value: 'visitdate', label: '방문일' },
  { value: 'bmi', label: 'BMI' },
  { value: 'bphigh', label: '수축기혈압' },
  { value: 'bplwst', label: '이완기혈압' },
  { value: 'blds', label: '혈당' },
];

const TemplateAccordion: React.FC<Props> = ({
  template, variables, mappings, onMappingChange,
  isOpen = false, onToggle,
}) => {
  const [open, setOpen] = useState(isOpen);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const toggle = () => { setOpen(!open); onToggle?.(); };
  if (!template) return null;

  const buttons = template.button_config?.buttons || [];

  // 버튼 URL에서 추가 변수 추출 (본문 변수에 없는 것만)
  const btnVars: string[] = [];
  buttons.forEach((btn: any) => {
    const url = btn.url_mobile || '';
    const matches = url.match(/#\{([^}]+)\}/g) || [];
    matches.forEach((m: string) => {
      const v = m.replace(/^#\{|\}$/g, '');
      if (!variables.includes(v) && !btnVars.includes(v)) btnVars.push(v);
    });
  });
  const allVars = [...variables, ...btnVars];

  const filledCount = allVars.filter(v => {
    if (SYS_VARS.includes(v)) return true;
    const m = mappings[v];
    return m && ((m.source === 'field' && m.field) || (m.source === 'fixed' && m.value));
  }).length;

  // 미리보기 렌더링 — 각 변수 위치별 개별 매핑 지원
  const renderPreview = () => {
    const parts = (template.template_content || '').split(/(#\{[^}]+\})/g);
    const counter: Record<string, number> = {};

    return parts.map((part: string, i: number) => {
      const match = part.match(/^#\{([^}]+)\}$/);
      if (!match) return <span key={i}>{part}</span>;
      const v = match[1];
      const idx = counter[v] || 0;
      counter[v] = idx + 1;
      const posKey = `${v}_${idx}`;

      if (SYS_VARS.includes(v)) return <span key={i} className="tmpl-var tmpl-var--system">[{v}]</span>;

      // 위치별 매핑 우선, 없으면 일반 매핑
      const m = mappings[posKey] || mappings[v];
      const isEditing = editingVar === posKey;

      return (
        <span key={i} className="tmpl-var-inline-wrap">
          <span
            className={`tmpl-var ${m?.source === 'fixed' && m.value ? 'tmpl-var--filled' : m?.source === 'field' && m.field ? 'tmpl-var--field' : 'tmpl-var--empty'}`}
            onClick={() => { if (!SYS_VARS.includes(v)) setEditingVar(isEditing ? null : posKey); }}
            style={{ cursor: 'pointer' }}
          >
            {m?.source === 'fixed' && m.value ? m.value : m?.source === 'field' && m.field ? `[${m.field}]` : `#{${v}}`}
          </span>
          {isEditing && (
            <span className="tmpl-var-edit" onClick={e => e.stopPropagation()}>
              <select
                value={(m?.source) || 'field'}
                onChange={e => {
                  const src = e.target.value as 'field' | 'fixed';
                  onMappingChange(posKey, src === 'field' ? { source: 'field', field: '' } : { source: 'fixed', value: '' });
                }}
              >
                <option value="field">DB 필드</option>
                <option value="fixed">고정값</option>
              </select>
              {(!m || m.source === 'field') && (
                <select
                  value={m?.field || ''}
                  onChange={e => onMappingChange(posKey, { source: 'field', field: e.target.value })}
                >
                  <option value="">필드 선택...</option>
                  {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              )}
              {m?.source === 'fixed' && (
                <input
                  type="text"
                  placeholder="값 입력"
                  value={m.value || ''}
                  onChange={e => onMappingChange(posKey, { source: 'fixed', value: e.target.value })}
                  autoFocus
                />
              )}
            </span>
          )}
        </span>
      );
    });
  };

  // 우측 뱃지용 — 위치 정보 포함
  const handleBadgeClick = (posKey: string) => {
    if (SYS_VARS.includes(posKey.replace(/_\d+$/, ''))) return;
    setEditingVar(editingVar === posKey ? null : posKey);
  };

  const getVarLabel = (v: string) => {
    const m = mappings[v];
    if (!m) return '미설정';
    if (m.source === 'field' && m.field) {
      const f = DB_FIELDS.find(f => f.value === m.field);
      return f ? f.label : m.field;
    }
    if (m.source === 'fixed' && m.value) return m.value;
    return '미설정';
  };

  return (
    <div className={`tmpl-accordion ${open ? 'tmpl-accordion--open' : ''}`}>
      <div className="tmpl-accordion__header" onClick={toggle}>
        <div className="tmpl-accordion__info">
          <span className="tmpl-accordion__badge">{template.message_type || '알림톡'}</span>
          <span className="tmpl-accordion__name">{template.template_name}</span>
          <span className="tmpl-accordion__var-count">변수 {filledCount}/{allVars.length}</span>
        </div>
        <span className="tmpl-accordion__arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="tmpl-accordion__body">
          <div className="tmpl-accordion__columns">
            {/* 왼쪽: 미리보기 */}
            <div className="tmpl-accordion__col-left">
              <span className="tmpl-accordion__section-label">메시지 미리보기</span>
              <div className="tmpl-accordion__preview-content">{renderPreview()}</div>
            </div>

            {/* 오른쪽: 변수 뱃지 (클릭→인라인 편집) */}
            <div className="tmpl-accordion__col-right">
              <span className="tmpl-accordion__section-label">필수 변수 ({allVars.length}개)</span>
              <div className="tmpl-accordion__var-badges">
                {allVars.map(v => {
                  const isSystem = SYS_VARS.includes(v);
                  const isEditing = editingVar === v;
                  const m = mappings[v] || { source: 'fixed' as const };
                  const isFilled = isSystem || (m.source === 'field' && m.field) || (m.source === 'fixed' && m.value);

                  return (
                    <div key={v} className="tmpl-var-badge-wrap">
                      <div
                        className={`tmpl-var-badge tmpl-var-badge--${isSystem ? 'system' : isFilled ? 'filled' : 'empty'}`}
                        onClick={() => handleBadgeClick(v)}
                        style={{ cursor: isSystem ? 'default' : 'pointer' }}
                      >
                        <span className="tmpl-var-badge__name">{'#{'}{v}{'}'}</span>
                        {isSystem && <span className="tmpl-var-badge__tag">시스템</span>}
                        {!isSystem && isFilled && <span className="tmpl-var-badge__val">= {getVarLabel(v)}</span>}
                        {!isSystem && !isFilled && <span className="tmpl-var-badge__tag tmpl-var-badge__tag--warn">클릭하여 설정</span>}
                        {btnVars.includes(v) && <span className="tmpl-var-badge__tag tmpl-var-badge__tag--btn">버튼</span>}
                      </div>

                      {/* 인라인 편집 드롭다운 */}
                      {isEditing && (
                        <div className="tmpl-var-edit" onClick={e => e.stopPropagation()}>
                          <select
                            value={m.source || 'fixed'}
                            onChange={e => {
                              const src = e.target.value as 'field' | 'fixed';
                              onMappingChange(v, src === 'field' ? { source: 'field', field: '' } : { source: 'fixed', value: '' });
                            }}
                          >
                            <option value="field">DB 필드</option>
                            <option value="fixed">고정값</option>
                          </select>
                          {m.source === 'field' && (
                            <select
                              value={m.field || ''}
                              onChange={e => onMappingChange(v, { source: 'field', field: e.target.value })}
                            >
                              <option value="">필드 선택...</option>
                              {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          )}
                          {m.source === 'fixed' && (
                            <input
                              type="text"
                              placeholder={`${v} 값 입력`}
                              value={m.value || ''}
                              onChange={e => onMappingChange(v, { source: 'fixed', value: e.target.value })}
                              autoFocus
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 버튼 URL 미리보기 */}
          {buttons.length > 0 && (
            <div className="tmpl-accordion__buttons">
              <span className="tmpl-accordion__section-label">버튼 ({buttons.length}개)</span>
              <div className="tmpl-accordion__btn-list">
                {buttons.map((btn: any, i: number) => {
                  let url = btn.url_mobile || '';
                  if (url) {
                    Object.entries(mappings).forEach(([k, m]) => {
                      if (m.source === 'fixed' && m.value) url = url.replace(`#{${k}}`, m.value);
                      if (m.source === 'field' && m.field) url = url.replace(`#{${k}}`, `[${m.field}]`);
                    });
                    SYS_VARS.forEach(sv => { url = url.replace(`#{${sv}}`, `[${sv}]`); });
                  }
                  return (
                    <div key={i} className="tmpl-accordion__btn-item">
                      <span className="tmpl-accordion__btn-type">{BTN_TYPE[btn.type] || btn.type}</span>
                      <span className="tmpl-accordion__btn-name">{btn.name}</span>
                      {url && <span className="tmpl-accordion__btn-url">{url}</span>}
                      {btn.type === 'TN' && <span className="tmpl-accordion__btn-url">{btn.tel_number || '[자동]'}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateAccordion;
