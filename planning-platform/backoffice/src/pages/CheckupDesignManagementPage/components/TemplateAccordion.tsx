/**
 * 아코디언 템플릿 미리보기
 * 펼치면: 본문 미리보기 → children(변수 설정) → 버튼 목록 + URL 미리보기
 */
import React, { useState } from 'react';

interface Props {
  template: any;
  variables: string[];
  fixedVars: Record<string, string>;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode; // 변수 매핑 등 내부 삽입
}

const BTN_TYPE_LABEL: Record<string, string> = {
  WL: '웹링크', MD: '모바일', AC: '앱연결', TN: '전화',
};

const SYSTEM_VARS = ['wello_uuid', 'sub', 'URL', 'client_id'];

const TemplateAccordion: React.FC<Props> = ({
  template, variables, fixedVars, isOpen = false, onToggle, children,
}) => {
  const [open, setOpen] = useState(isOpen);
  const toggle = () => { setOpen(!open); onToggle?.(); };

  if (!template) return null;

  const buttons = template.button_config?.buttons || [];

  // 본문 변수 하이라이트
  const renderPreview = () => {
    const content = template.template_content || '';
    const parts = content.split(/(#\{[^}]+\})/g);
    return parts.map((part: string, i: number) => {
      const match = part.match(/^#\{([^}]+)\}$/);
      if (match) {
        const varName = match[1];
        if (SYSTEM_VARS.includes(varName)) {
          return <span key={i} className="tmpl-var tmpl-var--system">[{varName}]</span>;
        }
        const value = fixedVars[varName];
        if (value) {
          return <span key={i} className="tmpl-var tmpl-var--filled">{value}</span>;
        }
        return <span key={i} className="tmpl-var tmpl-var--empty">{'#{'}{varName}{'}'}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // 변수 채움 상태 카운트
  const filledCount = variables.filter(v =>
    SYSTEM_VARS.includes(v) || fixedVars[v]
  ).length;

  return (
    <div className={`tmpl-accordion ${open ? 'tmpl-accordion--open' : ''}`}>
      <div className="tmpl-accordion__header" onClick={toggle}>
        <div className="tmpl-accordion__info">
          <span className="tmpl-accordion__badge">{template.message_type || '알림톡'}</span>
          <span className="tmpl-accordion__name">{template.template_name}</span>
          {variables.length > 0 && (
            <span className="tmpl-accordion__var-count">
              변수 {filledCount}/{variables.length}
            </span>
          )}
        </div>
        <span className="tmpl-accordion__arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="tmpl-accordion__body">
          {/* 메시지 미리보기 */}
          <div className="tmpl-accordion__preview">
            <span className="tmpl-accordion__preview-label">메시지 미리보기</span>
            <div className="tmpl-accordion__preview-content">
              {renderPreview()}
            </div>
          </div>

          {/* 변수 설정 (children으로 받은 VariableMapping) */}
          {children}

          {/* 버튼 목록 + URL 미리보기 */}
          {buttons.length > 0 && (
            <div className="tmpl-accordion__buttons">
              <span className="tmpl-accordion__vars-label">버튼 ({buttons.length}개)</span>
              <div className="tmpl-accordion__btn-list">
                {buttons.map((btn: any, i: number) => {
                  // URL 변수 치환 미리보기
                  let urlPreview = btn.url_mobile || '';
                  if (urlPreview) {
                    Object.entries(fixedVars).forEach(([k, v]) => {
                      if (v) urlPreview = urlPreview.replace(`#{${k}}`, v);
                    });
                    SYSTEM_VARS.forEach(sv => {
                      urlPreview = urlPreview.replace(`#{${sv}}`, `[${sv}:자동]`);
                    });
                  }

                  return (
                    <div key={i} className="tmpl-accordion__btn-item">
                      <span className="tmpl-accordion__btn-type">
                        {BTN_TYPE_LABEL[btn.type] || btn.type}
                      </span>
                      <span className="tmpl-accordion__btn-name">{btn.name}</span>
                      {urlPreview && (
                        <span className="tmpl-accordion__btn-url">{urlPreview}</span>
                      )}
                      {btn.type === 'TN' && (
                        <span className="tmpl-accordion__btn-url">
                          {btn.tel_number || '[병원 전화번호 자동]'}
                        </span>
                      )}
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
