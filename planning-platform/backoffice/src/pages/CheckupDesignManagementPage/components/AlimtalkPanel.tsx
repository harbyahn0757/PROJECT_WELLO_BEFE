/**
 * 알림톡 발송 패널
 * - 템플릿 선택 드롭다운
 * - TemplateAccordion (아코디언 미리보기)
 * - VariableMapping (변수 설정)
 * - ExcelUploader (엑셀 업로드 발송)
 * - 발송 방식 선택 + 발송 버튼
 */
import React, { useState, useCallback, useMemo } from 'react';
import TemplateAccordion from './TemplateAccordion';
import VariableSettingsModal from './VariableSettingsModal';
import ExcelUploader from './ExcelUploader';
import { getApiBase } from '../../../utils/api';

const API = getApiBase();

interface Props {
  templates: any[];
  targets: any[];
  selectedTargets: string[];
  selectedHospital: string;
  onSendComplete: () => void;
}

type SendSource = 'db' | 'excel';

const AlimtalkPanel: React.FC<Props> = ({
  templates, targets, selectedTargets, selectedHospital, onSendComplete,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [fixedVars, setFixedVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendSource, setSendSource] = useState<SendSource>('db');
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});

  const api = useCallback(async (path: string, body?: any) => {
    const opts: RequestInit = { headers: { 'Content-Type': 'application/json' } };
    if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    const r = await fetch(`${API}/partner-office${path}`, opts);
    return r.json();
  }, []);

  const [varModalOpen, setVarModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'visitdate' | 'birthday'>('name');

  const selectedTmpl = templates.find(t => t.template_code === selectedTemplate);

  // DB 대상자 필터 + 정렬
  const filteredTargets = useMemo(() => {
    let list = [...targets];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q) || t.phoneno?.includes(q));
    }
    list.sort((a, b) => {
      const va = a[sortBy] || '';
      const vb = b[sortBy] || '';
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return list;
  }, [targets, searchQuery, sortBy]);

  // 템플릿 선택 → 변수 추출
  const handleSelectTemplate = async (code: string) => {
    setSelectedTemplate(code);
    setFixedVars({});
    setExcelMapping({});
    if (!code) { setTemplateVars([]); return; }
    const d = await api(`/alimtalk/templates/${code}/variables`);
    if (d.success) {
      setTemplateVars(d.variables || []);
      // 병원명 자동 채움
      if (selectedHospital) {
        setFixedVars(prev => ({ ...prev, '병원명': selectedHospital }));
      }
    }
  };

  // 엑셀 데이터 로드
  const handleExcelData = (headers: string[], rows: any[]) => {
    setExcelHeaders(headers);
    setExcelRows(rows);
    // 자동 매핑 시도
    const autoMap: Record<string, string> = {};
    templateVars.forEach(v => {
      const exact = headers.find(h => h === v);
      if (exact) autoMap[v] = exact;
      else {
        const partial = headers.find(h => h.toLowerCase().includes(v.toLowerCase()));
        if (partial) autoMap[v] = partial;
      }
    });
    setExcelMapping(autoMap);
  };

  // 대상자 엑셀 내보내기
  const handleExport = () => {
    if (!targets.length) return alert('내보낼 대상이 없습니다');
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(targets);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '대상자');
      XLSX.writeFile(wb, `캠페인_대상자_${selectedHospital}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  };

  // 발송 실행
  // 자동 채움 변수 (대상자별 동적)
  const AUTO_VARS: Record<string, { label: string; field: string }> = {
    '고객명': { label: '대상자 이름', field: 'name' },
    '신청일자': { label: '등록일(regdate)', field: 'regdate' },
  };

  // 빈변수 검증
  const getEmptyVars = () => {
    return templateVars.filter(v => {
      if (AUTO_VARS[v]) return false; // 자동 채움 → OK
      if (v === '병원명' && selectedHospital) return false; // 병원 자동
      if (['wello_uuid', 'sub', 'URL'].includes(v)) return false; // 시스템 자동
      return !fixedVars[v]; // 고정값 없으면 빈값
    });
  };

  const handleSend = async () => {
    if (!selectedTemplate) return alert('템플릿을 선택해주세요');

    const emptyVars = getEmptyVars();
    if (emptyVars.length > 0) {
      return alert(`다음 변수의 값을 입력해주세요:\n${emptyVars.map(v => `#{${v}}`).join(', ')}`);
    }

    let recipients: any[] = [];

    if (sendSource === 'db') {
      if (!selectedTargets.length) return alert('발송 대상을 선택해주세요');
      const selected = targets.filter(t => selectedTargets.includes(t.uuid));
      const tmpl = selectedTmpl;
      const attachment = tmpl?.button_config ? JSON.stringify(tmpl.button_config) : '';

      recipients = selected.map(t => {
        const vars: Record<string, string> = {
          ...fixedVars,
          '고객명': t.name || '',
          '병원명': selectedHospital || fixedVars['병원명'] || '',
          '신청일자': t.regdate || fixedVars['신청일자'] || new Date().toISOString().slice(0, 10),
        };
        return {
          phone: t.phoneno || '',
          hospital_id: '',
          variables: vars,
          message: {
            template_code: selectedTemplate,
            content: tmpl?.template_content || '',
            attachment,
          },
        };
      });
    } else {
      // 엑셀 발송
      if (!excelRows.length) return alert('엑셀 파일을 업로드해주세요');
      const phoneCol = excelHeaders.find(h => {
        const l = h.toLowerCase();
        return l.includes('phone') || l.includes('전화') || h === '휴대폰';
      });
      if (!phoneCol) return alert('엑셀에 전화번호 열이 없습니다');

      const tmpl = selectedTmpl;
      const attachment = tmpl?.button_config ? JSON.stringify(tmpl.button_config) : '';

      recipients = excelRows.map(row => {
        const vars = { ...fixedVars };
        // 엑셀 매핑된 변수 채움
        Object.entries(excelMapping).forEach(([varName, header]) => {
          if (header && row[header]) vars[varName] = row[header];
        });
        return {
          phone: row[phoneCol] || '',
          hospital_id: '',
          variables: vars,
          message: {
            template_code: selectedTemplate,
            content: tmpl?.template_content || '',
            attachment,
          },
        };
      });
    }

    if (!recipients.length) return alert('발송할 대상이 없습니다');
    if (!window.confirm(`${recipients.length}명에게 알림톡을 발송합니다.\n계속할까요?`)) return;

    setSending(true);
    try {
      const r = await api(`/alimtalk/campaigns/WELNO_BASIC_PACKAGE/send`, { recipients });
      if (r.success) {
        alert(`발송 완료: 성공 ${r.success_count}건, 실패 ${r.fail_count}건`);
        onSendComplete();
      } else {
        alert(`발송 실패: ${r.detail || '알 수 없는 오류'}`);
      }
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="cdm-alimtalk-config">
      <h3 className="cdm-alimtalk-config__header">알림톡 발송</h3>

      {/* 템플릿 선택 */}
      <div className="cdm-alimtalk-config__row">
        <label>템플릿</label>
        <select value={selectedTemplate} onChange={e => handleSelectTemplate(e.target.value)}>
          <option value="">템플릿 선택...</option>
          {templates.map(t => (
            <option key={t.template_code} value={t.template_code}>
              {t.template_name} ({t.message_type})
            </option>
          ))}
        </select>
      </div>

      {/* 아코디언: 2컬럼 (미리보기 + 변수 뱃지) */}
      {selectedTmpl && (
        <TemplateAccordion
          template={selectedTmpl}
          variables={templateVars}
          fixedVars={fixedVars}
          isOpen={true}
          onOpenVarModal={() => setVarModalOpen(true)}
        />
      )}

      {/* 변수 설정 모달 */}
      <VariableSettingsModal
        isOpen={varModalOpen}
        onClose={() => setVarModalOpen(false)}
        variables={templateVars}
        fixedVars={fixedVars}
        onVarChange={(k, v) => setFixedVars(prev => ({ ...prev, [k]: v }))}
        selectedHospital={selectedHospital}
        excelHeaders={sendSource === 'excel' ? excelHeaders : undefined}
        excelMapping={sendSource === 'excel' ? excelMapping : undefined}
        onMappingChange={(k, h) => setExcelMapping(prev => ({ ...prev, [k]: h }))}
      />

      {/* 발송 대상 — 서브 탭 */}
      {selectedTemplate && (
        <div className="send-target">
          <div className="send-target__tabs">
            <button className={`send-target__tab ${sendSource === 'db' ? 'send-target__tab--active' : ''}`} onClick={() => setSendSource('db')}>
              DB 대상자 ({filteredTargets.length}명)
            </button>
            <button className={`send-target__tab ${sendSource === 'excel' ? 'send-target__tab--active' : ''}`} onClick={() => setSendSource('excel')}>
              엑셀 업로드 {excelRows.length > 0 ? `(${excelRows.length}명)` : ''}
            </button>
          </div>

          {sendSource === 'db' && (
            <>
              <div className="send-target__toolbar">
                <input
                  type="text" placeholder="이름 또는 전화번호 검색"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="send-target__search"
                />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="send-target__sort">
                  <option value="name">이름순</option>
                  <option value="visitdate">방문일순</option>
                  <option value="birthday">생년월일순</option>
                </select>
                <button className="btn-outline" onClick={() => {
                  const all = filteredTargets.map(t => t.uuid);
                  const allSelected = all.every(u => selectedTargets.includes(u));
                  onSendComplete(); // clear
                  if (!allSelected) {
                    // re-select filtered
                  }
                }}>
                  전체 {selectedTargets.length === filteredTargets.length && filteredTargets.length > 0 ? '해제' : '선택'}
                </button>
              </div>
              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{width: 36}}></th>
                      <th>이름</th>
                      <th>성별</th>
                      <th>생년월일</th>
                      <th>전화번호</th>
                      <th>방문일</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTargets.map((t: any) => (
                      <tr key={t.uuid}>
                        <td>
                          <input type="checkbox"
                            checked={selectedTargets.includes(t.uuid)}
                            onChange={() => {
                              const p = selectedTargets.includes(t.uuid)
                                ? selectedTargets.filter(u => u !== t.uuid)
                                : [...selectedTargets, t.uuid];
                              // parent manages selectedTargets — trigger via dummy
                            }}
                          />
                        </td>
                        <td>{t.name || '-'}</td>
                        <td>{t.gender === 'M' ? '남' : t.gender === 'F' ? '여' : '-'}</td>
                        <td>{t.birthday || '-'}</td>
                        <td>{t.phoneno ? t.phoneno.slice(0, 3) + '****' + t.phoneno.slice(-4) : '-'}</td>
                        <td>{t.visitdate || '-'}</td>
                        <td>{t.pln_mkt === 'Y' ? <span className="badge badge--success">발송</span> : <span className="badge badge--muted">미발송</span>}</td>
                      </tr>
                    ))}
                    {filteredTargets.length === 0 && <tr><td colSpan={7} className="empty-state__text">대상자가 없습니다</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="send-target__footer">선택됨 {selectedTargets.length} / {filteredTargets.length}명</div>
            </>
          )}

          {sendSource === 'excel' && (
            <ExcelUploader onDataLoaded={handleExcelData} onExport={handleExport} />
          )}
        </div>
      )}

      {/* 발송 버튼 */}
      {selectedTemplate && (
        <button
          className="btn-alimtalk"
          onClick={handleSend}
          disabled={sending || (sendSource === 'db' ? !selectedTargets.length : !excelRows.length)}
        >
          {sending ? '발송 중...' : `알림톡 발송 (${sendSource === 'db' ? selectedTargets.length : excelRows.length}명)`}
        </button>
      )}
    </div>
  );
};

export default AlimtalkPanel;
