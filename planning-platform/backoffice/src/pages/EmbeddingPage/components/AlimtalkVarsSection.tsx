/**
 * 병원별 알림톡 템플릿 변수 편집 섹션
 *
 * EmbeddingPage 내부에 렌더되며, config.alimtalk_vars 를 직접 편집한다.
 * 저장은 부모(EmbeddingPage)의 handleSaveConfig 가 담당 (PUT /hospitals/{id}/config).
 *
 * 구조:
 *   config.alimtalk_vars = { [template_code]: { [var_name]: var_value, ... } }
 *
 * 특수 키:
 *   - sub_button_{idx}: button[idx].url_mobile 정적 URL
 *   - _title: AT 타입 강조 타이틀 (카카오 검수 등록값 일치 필수)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';

const TEMPLATES_API = (() => {
  if (typeof window === 'undefined') return '/api/v1/partner-office';
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/welno-api/v1/partner-office';
  }
  return '/api/v1/partner-office';
})();

interface KakaoTemplate {
  template_code: string;
  template_name: string;
  message_type: string;
  template_content: string;
  button_config: { button?: any[]; buttons?: any[] } | null;
}

interface Props {
  /** EmbeddingPage 의 HospitalConfig (alimtalk_vars 포함) */
  config: any;
  /** EmbeddingPage 의 setConfig (immutable update) */
  setConfig: (updater: (prev: any) => any) => void;
}

const AlimtalkVarsSection: React.FC<Props> = ({ config, setConfig }) => {
  const [templates, setTemplates] = useState<KakaoTemplate[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 템플릿 목록 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${TEMPLATES_API}/alimtalk/templates`);
        const data = await res.json();
        if (!cancelled && data?.success && Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '템플릿 로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 선택된 템플릿
  const selectedTpl = useMemo(
    () => templates.find(t => t.template_code === selectedCode) || null,
    [templates, selectedCode],
  );

  // 본문 변수 추출 (#{var} 정규식, 중복 제거)
  const bodyVars = useMemo(() => {
    if (!selectedTpl?.template_content) return [] as string[];
    const matches = selectedTpl.template_content.match(/#\{([^}]+)\}/g) || [];
    const unique = Array.from(new Set(matches.map(m => m.slice(2, -1))));
    return unique;
  }, [selectedTpl]);

  // 버튼 목록 (button_config)
  const buttons = useMemo(() => {
    if (!selectedTpl?.button_config) return [] as any[];
    const bc = selectedTpl.button_config;
    return (bc.button || bc.buttons || []) as any[];
  }, [selectedTpl]);

  // 현재 저장된 변수값 (config.alimtalk_vars[selectedCode])
  const currentVars = useMemo<Record<string, string>>(() => {
    const all = config?.alimtalk_vars || {};
    const v = (all && typeof all === 'object' ? all[selectedCode] : null) || {};
    return v as Record<string, string>;
  }, [config, selectedCode]);

  // 변수 1개 갱신 (immutable)
  const updateVar = useCallback((varName: string, value: string) => {
    if (!selectedCode) return;
    setConfig(prev => {
      if (!prev) return prev;
      const all = { ...(prev.alimtalk_vars || {}) };
      const current = { ...(all[selectedCode] || {}) };
      if (value === '') {
        delete current[varName];
      } else {
        current[varName] = value;
      }
      all[selectedCode] = current;
      return { ...prev, alimtalk_vars: all };
    });
  }, [selectedCode, setConfig]);

  // 자동 매핑된 컬럼 (#{병원명} → hospital_name 컬럼, #{병원연락처} → contact_phone 컬럼)
  const autoMappedHint = (varName: string): string | null => {
    if (varName === '병원명') return `→ hospital_name 컬럼 (${config?.hospital_name || '미설정'})`;
    if (varName === '병원연락처') return `→ contact_phone 컬럼 (${config?.contact_phone || '미설정'})`;
    return null;
  };

  // 미리보기 (#{var} 치환)
  const preview = useMemo(() => {
    if (!selectedTpl?.template_content) return '';
    let text = selectedTpl.template_content;
    bodyVars.forEach(v => {
      const value = currentVars[v]
        || (v === '병원명' ? (config?.hospital_name || '') : '')
        || (v === '병원연락처' ? (config?.contact_phone || '') : '')
        || `[${v}]`;
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp('#\\{' + escaped + '\\}', 'g'), value);
    });
    return text;
  }, [selectedTpl, bodyVars, currentVars, config]);

  return (
    <div className="admin-embedding-page__form-section">
      <div className="admin-embedding-page__form-section-title">알림톡 변수 (병원별)</div>

      {error && (
        <div className="admin-embedding-page__alert admin-embedding-page__alert--error">
          {error}
        </div>
      )}

      {/* 템플릿 선택 */}
      <div className="admin-embedding-page__form-group">
        <label>템플릿 선택</label>
        <select
          value={selectedCode}
          onChange={e => setSelectedCode(e.target.value)}
          disabled={loading || templates.length === 0}
        >
          <option value="">— 템플릿을 선택하세요 —</option>
          {templates.map(t => {
            const all = config?.alimtalk_vars || {};
            const filled = all[t.template_code] && Object.keys(all[t.template_code]).length > 0;
            return (
              <option key={t.template_code} value={t.template_code}>
                {filled ? '● ' : '○ '}{t.template_name} ({t.message_type})
              </option>
            );
          })}
        </select>
        <span className="admin-embedding-page__form-hint">
          ● 변수 저장됨 / ○ 미설정. 9개 활성 템플릿 중 선택.
        </span>
      </div>

      {!selectedTpl && (
        <div className="admin-embedding-page__form-hint" style={{ padding: '12px 0' }}>
          템플릿을 선택하면 본문 + 변수 + 버튼 URL 입력 폼이 표시됩니다.
        </div>
      )}

      {selectedTpl && (
        <>
          {/* 카카오 검수 본문 (read-only) */}
          <div className="admin-embedding-page__form-group">
            <label>카카오 검수 본문 (읽기전용)</label>
            <textarea
              rows={Math.min(15, (selectedTpl.template_content.match(/\n/g) || []).length + 2)}
              value={selectedTpl.template_content}
              readOnly
              style={{ background: '#f8f9fa', fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <span className="admin-embedding-page__form-hint">
              ⚠ 본문 구조는 카카오 비즈센터에서만 변경 가능 (변수값은 아래에서 수정).
            </span>
          </div>

          {/* 본문 변수 입력 */}
          {bodyVars.length > 0 && (
            <div className="admin-embedding-page__form-section-title" style={{ marginTop: 16 }}>
              본문 변수 ({bodyVars.length}개)
            </div>
          )}
          {bodyVars.map(varName => {
            const hint = autoMappedHint(varName);
            const value = currentVars[varName] || '';
            const isLong = varName.includes('안내') || varName.includes('일정') || varName.includes('주소');
            return (
              <div key={varName} className="admin-embedding-page__form-group">
                <label>
                  #&#123;{varName}&#125;
                  {hint && <span style={{ marginLeft: 8, color: '#0a7', fontSize: '0.8rem' }}>{hint}</span>}
                </label>
                {hint ? (
                  <input
                    type="text"
                    value={value}
                    placeholder={`자동 매핑됨 (덮어쓰려면 입력)`}
                    onChange={e => updateVar(varName, e.target.value)}
                  />
                ) : isLong ? (
                  <textarea
                    rows={4}
                    value={value}
                    placeholder={`예: ${varName}의 값`}
                    onChange={e => updateVar(varName, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    placeholder={`예: ${varName}의 값`}
                    onChange={e => updateVar(varName, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          {/* 버튼 URL 입력 */}
          {buttons.length > 0 && (
            <div className="admin-embedding-page__form-section-title" style={{ marginTop: 16 }}>
              버튼 URL ({buttons.length}개)
            </div>
          )}
          {buttons.map((btn: any, idx: number) => {
            if (btn.type !== 'WL' && btn.type !== 'MD') return null;
            const key = `sub_button_${idx}`;
            const value = currentVars[key] || '';
            const checkedTemplateUrl = btn.url_mobile || btn.url_pc || '';
            return (
              <div key={key} className="admin-embedding-page__form-group">
                <label>
                  버튼 [{idx + 1}] {btn.name} ({btn.type})
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#888' }}>
                    검수 URL: {checkedTemplateUrl}
                  </span>
                </label>
                <input
                  type="url"
                  value={value}
                  placeholder="https://example.com/path  (검수 URL의 #{sub} 자리에 들어갈 정적 URL)"
                  onChange={e => updateVar(key, e.target.value)}
                />
              </div>
            );
          })}

          {/* 강조 타이틀 (선택) */}
          {selectedTpl.message_type !== 'button' && (
            <div className="admin-embedding-page__form-group">
              <label>강조 타이틀 (선택)</label>
              <input
                type="text"
                value={currentVars['_title'] || ''}
                placeholder="카카오 검수 시 강조표기 등록한 경우만 입력 (없으면 비움)"
                onChange={e => updateVar('_title', e.target.value)}
              />
              <span className="admin-embedding-page__form-hint">
                ⚠ 카카오 검수 등록값과 정확히 일치 필수. 미등록이면 비워둘 것 (NoMatchedTemplateTitle 회피).
              </span>
            </div>
          )}

          {/* 미리보기 */}
          <div className="admin-embedding-page__form-group">
            <label>치환 미리보기 (#&#123;이름&#125; 등 발송 변수는 [이름] 으로 표시)</label>
            <pre style={{
              background: '#fffef7', border: '1px solid #f0e8c8', borderRadius: 4,
              padding: 12, fontSize: '0.9rem', whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto',
            }}>
              {preview}
            </pre>
          </div>
        </>
      )}
    </div>
  );
};

export default AlimtalkVarsSection;
