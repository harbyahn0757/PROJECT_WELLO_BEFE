/**
 * 아코디언 템플릿 미리보기
 * - 펼치기/접기 토글
 * - 템플릿 코드 뱃지 + 메시지 타입
 * - 본문 미리보기 (#{변수} 하이라이트, 고정값 실시간 치환)
 * - 버튼 목록 (타입별 뱃지)
 */
import React, { useState } from 'react';

interface Props {
  template: any;
  variables: string[];
  fixedVars: Record<string, string>;
  isOpen?: boolean;
  onToggle?: () => void;
}

const BTN_TYPE_LABEL: Record<string, string> = {
  WL: '웹링크', MD: '모바일', AC: '앱연결', TN: '전화',
};

const TemplateAccordion: React.FC<Props> = ({ template, variables, fixedVars, isOpen = false, onToggle }) => {
  const [open, setOpen] = useState(isOpen);
  const toggle = () => { setOpen(!open); onToggle?.(); };

  if (!template) return null;

  const buttons = template.button_config?.buttons || [];

  // 본문에서 고정값 치환 + 미치환 변수 하이라이트
  const renderPreview = () => {
    const content = template.template_content || '';
    const parts = content.split(/(#\{[^}]+\})/g);
    return parts.map((part: string, i: number) => {
      const match = part.match(/^#\{([^}]+)\}$/);
      if (match) {
        const varName = match[1];
        const value = fixedVars[varName];
        if (value) {
          return <span key={i} className="tmpl-var tmpl-var--filled">{value}</span>;
        }
        return <span key={i} className="tmpl-var tmpl-var--empty">{'#{'}{varName}{'}'}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`tmpl-accordion ${open ? 'tmpl-accordion--open' : ''}`}>
      <div className="tmpl-accordion__header" onClick={toggle}>
        <div className="tmpl-accordion__info">
          <span className="tmpl-accordion__badge">{template.message_type || '알림톡'}</span>
          <span className="tmpl-accordion__name">{template.template_name}</span>
          <span className="tmpl-accordion__code">{template.template_code}</span>
        </div>
        <span className="tmpl-accordion__arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="tmpl-accordion__body">
          <div className="tmpl-accordion__preview">
            <span className="tmpl-accordion__preview-label">메시지 미리보기</span>
            <div className="tmpl-accordion__preview-content">
              {renderPreview()}
            </div>
          </div>

          {variables.length > 0 && (
            <div className="tmpl-accordion__vars">
              <span className="tmpl-accordion__vars-label">
                필수 변수 ({variables.length}개)
              </span>
              <div className="tmpl-accordion__vars-list">
                {variables.map(v => (
                  <span key={v} className={`tmpl-accordion__var-badge ${fixedVars[v] ? 'tmpl-accordion__var-badge--set' : ''}`}>
                    {'#{'}{v}{'}'}
                    {fixedVars[v] && <span className="tmpl-accordion__var-value">= {fixedVars[v]}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {buttons.length > 0 && (
            <div className="tmpl-accordion__buttons">
              <span className="tmpl-accordion__vars-label">버튼 ({buttons.length}개)</span>
              <div className="tmpl-accordion__btn-list">
                {buttons.map((btn: any, i: number) => (
                  <div key={i} className="tmpl-accordion__btn-item">
                    <span className="tmpl-accordion__btn-type">{BTN_TYPE_LABEL[btn.type] || btn.type}</span>
                    <span className="tmpl-accordion__btn-name">{btn.name}</span>
                    {btn.url_mobile && (
                      <span className="tmpl-accordion__btn-url">{btn.url_mobile}</span>
                    )}
                    {btn.type === 'TN' && btn.tel_number && (
                      <span className="tmpl-accordion__btn-url">{btn.tel_number}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateAccordion;
