/**
 * 아코디언 템플릿 — 2컬럼 레이아웃
 * 왼쪽: 메시지 미리보기 | 오른쪽: 변수 뱃지 + "변수 설정" 버튼
 * 하단: 버튼 URL 미리보기
 */
import React, { useState } from 'react';

interface Props {
  template: any;
  variables: string[];
  fixedVars: Record<string, string>;
  isOpen?: boolean;
  onToggle?: () => void;
  onOpenVarModal?: () => void;
}

const BTN_TYPE: Record<string, string> = {
  WL: '웹링크', MD: '모바일', AC: '앱연결', TN: '전화',
};
const SYS_VARS = ['wello_uuid', 'sub', 'URL', 'client_id'];
const AUTO_VARS = ['고객명', '신청일자'];

const TemplateAccordion: React.FC<Props> = ({
  template, variables, fixedVars, isOpen = false, onToggle, onOpenVarModal,
}) => {
  const [open, setOpen] = useState(isOpen);
  const toggle = () => { setOpen(!open); onToggle?.(); };
  if (!template) return null;

  const buttons = template.button_config?.buttons || [];
  const filledCount = variables.filter(v =>
    SYS_VARS.includes(v) || AUTO_VARS.includes(v) || fixedVars[v]
  ).length;

  const renderPreview = () => {
    const parts = (template.template_content || '').split(/(#\{[^}]+\})/g);
    return parts.map((part: string, i: number) => {
      const m = part.match(/^#\{([^}]+)\}$/);
      if (!m) return <span key={i}>{part}</span>;
      const v = m[1];
      if (SYS_VARS.includes(v)) return <span key={i} className="tmpl-var tmpl-var--system">[{v}]</span>;
      const val = fixedVars[v];
      if (val) return <span key={i} className="tmpl-var tmpl-var--filled">{val}</span>;
      return <span key={i} className="tmpl-var tmpl-var--empty">{'#{'}{v}{'}'}</span>;
    });
  };

  const getVarStatus = (v: string) => {
    if (SYS_VARS.includes(v)) return 'system';
    if (AUTO_VARS.includes(v)) return 'auto';
    if (fixedVars[v]) return 'filled';
    return 'empty';
  };

  return (
    <div className={`tmpl-accordion ${open ? 'tmpl-accordion--open' : ''}`}>
      <div className="tmpl-accordion__header" onClick={toggle}>
        <div className="tmpl-accordion__info">
          <span className="tmpl-accordion__badge">{template.message_type || '알림톡'}</span>
          <span className="tmpl-accordion__name">{template.template_name}</span>
          <span className="tmpl-accordion__var-count">변수 {filledCount}/{variables.length}</span>
        </div>
        <span className="tmpl-accordion__arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="tmpl-accordion__body">
          {/* 2컬럼: 미리보기 + 변수 */}
          <div className="tmpl-accordion__columns">
            <div className="tmpl-accordion__col-left">
              <span className="tmpl-accordion__section-label">메시지 미리보기</span>
              <div className="tmpl-accordion__preview-content">{renderPreview()}</div>
            </div>
            <div className="tmpl-accordion__col-right">
              <span className="tmpl-accordion__section-label">필수 변수 ({variables.length}개)</span>
              <div className="tmpl-accordion__var-badges">
                {variables.map(v => {
                  const status = getVarStatus(v);
                  return (
                    <div key={v} className={`tmpl-var-badge tmpl-var-badge--${status}`}>
                      <span className="tmpl-var-badge__name">{'#{'}{v}{'}'}</span>
                      {status === 'filled' && <span className="tmpl-var-badge__val">= {fixedVars[v]}</span>}
                      {status === 'auto' && <span className="tmpl-var-badge__tag">자동</span>}
                      {status === 'system' && <span className="tmpl-var-badge__tag">시스템</span>}
                      {status === 'empty' && <span className="tmpl-var-badge__tag tmpl-var-badge__tag--warn">미설정</span>}
                    </div>
                  );
                })}
              </div>
              {onOpenVarModal && (
                <button className="tmpl-accordion__var-btn" onClick={e => { e.stopPropagation(); onOpenVarModal(); }}>
                  변수 설정
                </button>
              )}
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
                    Object.entries(fixedVars).forEach(([k, val]) => { if (val) url = url.replace(`#{${k}}`, val); });
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
