/**
 * 백오피스 - 병원별 RAG 임베딩 관리 (PC)
 * 디자인: frontend/src/styles/_variables.scss 토큰 사용
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import './styles.scss';

// welno.kindhabit.com은 /welno-api/ 로만 API가 열려 있음
const getEmbeddingApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1/admin/embedding';
  return window.location.hostname === 'welno.kindhabit.com'
    ? '/welno-api/v1/admin/embedding'
    : '/api/v1/admin/embedding';
};
const getRagChatApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1/welno-rag-chat';
  return window.location.hostname === 'welno.kindhabit.com'
    ? '/welno-api/v1/welno-rag-chat'
    : '/api/v1/welno-rag-chat';
};
const API_BASE = getEmbeddingApiBase();
const RAG_CHAT_API = getRagChatApiBase();

interface HospitalItem {
  partner_id: string;
  partner_name: string;
  hospital_id: string;
  hospital_name: string;
  has_embedding: boolean;
  has_uploads: boolean;
  document_count: number;
}

interface DocumentItem {
  name: string;
  size_bytes: number;
  uploaded_at: string | null;
}

interface HospitalConfig {
  partner_id: string;
  hospital_id: string;
  hospital_name: string;
  persona_prompt: string;
  welcome_message: string;
  llm_config: {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  embedding_config: {
    model: string;
    index_name: string;
  };
  theme_config: {
    theme: string;
    primary_color: string;
    logo_url?: string;
  };
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PartnerHierarchy {
  partner_id: string;
  partner_name: string;
  is_active: boolean;
  hospitals: HospitalItem[];
}

interface PendingHospital {
  id: number;
  partner_id: string;
  hospital_id: string;
  first_seen_at: string;
  last_seen_at: string;
  request_count: number;
  status: string;
}

interface ChatSession {
  session_id: string;
  user_uuid: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_phone: string | null;
}

interface ChatDetail {
  session_id: string;
  conversation: any[];
  initial_data: any;
  created_at: string;
}

interface TestChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{ text: string; score?: number; metadata?: any }>;
}

const AdminEmbeddingPage: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<PartnerHierarchy[]>([]);
  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<HospitalConfig | null>(null);
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalId, setNewHospitalId] = useState('');

  // 대화 내역 관련 상태
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'chats' | 'docs' | 'test'>('config');

  // RAG 테스트 채팅 상태
  const [testMessages, setTestMessages] = useState<TestChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testSessionId, setTestSessionId] = useState('');
  const testMessagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hierarchy`);
      if (!res.ok) throw new Error(res.statusText);
      
      const data = await res.json();
      setHierarchy(data);
      
      if (data.length > 0 && !selectedPartnerId) {
        const firstPartner = data[0];
        setSelectedPartnerId(firstPartner.partner_id);
        if (firstPartner.hospitals.length > 0 && !selectedHospitalId) {
          setSelectedHospitalId(firstPartner.hospitals[0].hospital_id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [selectedPartnerId, selectedHospitalId]);

  const fetchPendingHospitals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pending-hospitals`);
      if (res.ok) {
        const data = await res.json();
        setPendingHospitals(data);
      }
    } catch (err) {
      console.error('대기 병원 목록 조회 실패:', err);
    }
  }, []);

  const fetchHospitalDetails = useCallback(async (hospitalId: string, partnerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [docRes, configRes, chatRes] = await Promise.all([
        fetch(`${API_BASE}/hospitals/${hospitalId}/documents`),
        fetch(`${API_BASE}/hospitals/${hospitalId}/config?partner_id=${partnerId}`),
        fetch(`${API_BASE}/hospitals/${hospitalId}/chats?partner_id=${partnerId}`)
      ]);
      
      if (docRes.ok) setDocuments(await docRes.json());
      if (configRes.ok) setConfig(await configRes.json());
      if (chatRes.ok) setChatSessions(await chatRes.json());
      
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChatDetail = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/chats/${sessionId}`);
      if (res.ok) {
        setSelectedChat(await res.json());
      }
    } catch (err) {
      console.error('대화 상세 조회 실패:', err);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedHospitalId || !config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(res.statusText);
      alert('설정이 저장되었습니다.');
      await fetchHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHospital = async () => {
    if (!selectedPartnerId || !newHospitalName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hospitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: selectedPartnerId,
          hospital_id: newHospitalId.trim() || undefined,
          hospital_name: newHospitalName.trim(),
          persona_prompt: '',
          welcome_message: '',
          is_active: true
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      alert(`새 병원이 추가되었습니다.`);
      setNewHospitalName('');
      setNewHospitalId('');
      setShowAddHospital(false);
      await fetchHierarchy();
      await fetchPendingHospitals();
    } catch (err) {
      setError(err instanceof Error ? err.message : '병원 추가 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterPending = (pending: PendingHospital) => {
    setSelectedPartnerId(pending.partner_id);
    setNewHospitalId(pending.hospital_id);
    setNewHospitalName(pending.hospital_id);
    setShowAddHospital(true);
  };

  // RAG 테스트 채팅: 메시지 전송
  const handleTestSend = async () => {
    if (!testInput.trim() || testLoading || !selectedHospitalId) return;

    const userMsg: TestChatMessage = {
      role: 'user',
      content: testInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setTestMessages(prev => [...prev, userMsg]);
    setTestInput('');
    setTestLoading(true);

    const sid = testSessionId || `admin_test_${selectedHospitalId}_${Date.now()}`;
    if (!testSessionId) setTestSessionId(sid);

    try {
      const response = await fetch(`${RAG_CHAT_API}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: 'admin_test',
          hospital_id: selectedHospitalId,
          message: userMsg.content,
          session_id: sid,
        }),
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('응답 스트림을 읽을 수 없습니다.');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let finalSources: any[] = [];
      let hasCreatedBubble = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.answer) {
              assistantContent += data.answer;

              if (!hasCreatedBubble) {
                hasCreatedBubble = true;
                setTestLoading(false);
                setTestMessages(prev => [...prev, {
                  role: 'assistant',
                  content: assistantContent,
                  timestamp: new Date().toISOString(),
                }]);
              } else {
                setTestMessages(prev => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, content: assistantContent };
                  }
                  return msgs;
                });
              }
            }

            if (data.done) {
              finalSources = data.sources || [];
              setTestMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, sources: finalSources };
                }
                return msgs;
              });
            }
          } catch (e) {
            // JSON 파싱 실패 무시
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setTestMessages(prev => [...prev, {
        role: 'assistant',
        content: `오류: ${errMsg}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestClear = () => {
    setTestMessages([]);
    setTestSessionId('');
  };

  useEffect(() => {
    fetchHierarchy();
    fetchPendingHospitals();
  }, [fetchHierarchy, fetchPendingHospitals]);

  useEffect(() => {
    if (selectedHospitalId && selectedPartnerId) {
      fetchHospitalDetails(selectedHospitalId, selectedPartnerId);
      setSelectedChat(null);
      // 병원 변경 시 테스트 채팅 초기화
      setTestMessages([]);
      setTestSessionId('');
    }
  }, [selectedHospitalId, selectedPartnerId, fetchHospitalDetails]);

  // 테스트 채팅 자동 스크롤
  useEffect(() => {
    if (testMessagesEndRef.current) {
      testMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [testMessages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedHospitalId || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchHospitalDetails(selectedHospitalId, selectedPartnerId!);
      await fetchHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRebuild = async () => {
    if (!selectedHospitalId) return;
    setRebuilding(selectedHospitalId);
    try {
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/rebuild`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchHierarchy();
    } catch (err) {
      setError(err instanceof Error ? err.message : '재구축 트리거 실패');
    } finally {
      setRebuilding(null);
    }
  };

  const selectedHospital = hierarchy
    .find(p => p.partner_id === selectedPartnerId)
    ?.hospitals.find(h => h.hospital_id === selectedHospitalId);

  return (
    <div className="admin-embedding-page">
      <header className="admin-embedding-page__header">
        <h1 className="admin-embedding-page__title">병원별 RAG 임베딩 관리</h1>
      </header>

      {error && (
        <div className="admin-embedding-page__error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-embedding-page__layout">
        <aside className="admin-embedding-page__sidebar">
          {pendingHospitals.length > 0 && (
            <div className="admin-embedding-page__pending-section">
              <h2 className="admin-embedding-page__sidebar-title admin-embedding-page__sidebar-title--pending">
                🚨 등록 대기 중
              </h2>
              <div className="admin-embedding-page__pending-list">
                {pendingHospitals.map(p => (
                  <div key={p.id} className="admin-embedding-page__pending-item">
                    <div className="admin-embedding-page__pending-info">
                      <strong>{p.hospital_id}</strong>
                      <span>파트너: {p.partner_id} | {p.request_count}회</span>
                    </div>
                    <button className="admin-embedding-page__register-btn" onClick={() => handleRegisterPending(p)}>등록</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="admin-embedding-page__sidebar-title">파트너 및 병원 목록</h2>
          <div className="admin-embedding-page__partner-list">
            {hierarchy.map((partner) => (
              <div key={partner.partner_id} className="admin-embedding-page__partner-group">
                <div className="admin-embedding-page__partner-header">
                  <h3 className="admin-embedding-page__partner-name">{partner.partner_name}</h3>
                  {selectedPartnerId === partner.partner_id && (
                    <button type="button" className="admin-embedding-page__add-hospital-btn" onClick={() => { setNewHospitalId(''); setNewHospitalName(''); setShowAddHospital(true); }}>+</button>
                  )}
                </div>
                <ul className="admin-embedding-page__hospital-list">
                  {partner.hospitals.map((h) => (
                    <li key={h.hospital_id}>
                      <button
                        type="button"
                        className={`admin-embedding-page__hospital-btn ${selectedHospitalId === h.hospital_id && selectedPartnerId === partner.partner_id ? 'is-selected' : ''}`}
                        onClick={() => { setSelectedPartnerId(partner.partner_id); setSelectedHospitalId(h.hospital_id); }}
                      >
                        <span className="admin-embedding-page__hospital-name">{h.hospital_name}</span>
                        <span className="admin-embedding-page__hospital-meta">{h.has_embedding ? '✓ 인덱스' : ''} {h.document_count ? `문서 ${h.document_count}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {showAddHospital && selectedPartnerId && (
            <div className="admin-embedding-page__modal">
              <div className="admin-embedding-page__modal-content">
                <h3>새 병원 추가</h3>
                <div className="admin-embedding-page__form-group">
                  <label>파트너 ID</label>
                  <input type="text" value={selectedPartnerId} disabled />
                </div>
                <div className="admin-embedding-page__form-group">
                  <label>병원 ID</label>
                  <input type="text" value={newHospitalId} onChange={(e) => setNewHospitalId(e.target.value)} />
                </div>
                <div className="admin-embedding-page__form-group">
                  <label>병원명</label>
                  <input type="text" value={newHospitalName} onChange={(e) => setNewHospitalName(e.target.value)} />
                </div>
                <div className="admin-embedding-page__modal-actions">
                  <button type="button" onClick={() => setShowAddHospital(false)}>취소</button>
                  <button type="button" onClick={handleAddHospital} disabled={saving}>{saving ? '추가 중...' : '추가'}</button>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="admin-embedding-page__main">
          {selectedHospitalId && selectedHospital ? (
            <>
              <div className="admin-embedding-page__card">
                <h2 className="admin-embedding-page__card-title">{selectedHospital.hospital_name}</h2>
                <div className="admin-embedding-page__tabs">
                  <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>환경 설정</button>
                  <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => setActiveTab('chats')}>상담 내역 ({chatSessions.length})</button>
                  <button className={activeTab === 'docs' ? 'active' : ''} onClick={() => setActiveTab('docs')}>지침 문서</button>
                  <button className={activeTab === 'test' ? 'active' : ''} onClick={() => setActiveTab('test')}>RAG 테스트</button>
                </div>
              </div>

              {activeTab === 'config' && (
                <div className="admin-embedding-page__card">
                  <div className="admin-embedding-page__config-form">
                    <div className="admin-embedding-page__form-row">
                      <div className="admin-embedding-page__form-group">
                        <label>병원 표시명</label>
                        <input type="text" value={config?.hospital_name || ''} onChange={(e) => setConfig(prev => prev ? {...prev, hospital_name: e.target.value} : null)} />
                      </div>
                      <div className="admin-embedding-page__form-group">
                        <label>활성 상태</label>
                        <select value={config?.is_active ? 'true' : 'false'} onChange={(e) => setConfig(prev => prev ? {...prev, is_active: e.target.value === 'true'} : null)}>
                          <option value="true">활성</option>
                          <option value="false">비활성</option>
                        </select>
                      </div>
                    </div>
                    <div className="admin-embedding-page__form-group">
                      <label>LLM 페르소나 (System Prompt)</label>
                      <textarea rows={6} value={config?.persona_prompt || ''} onChange={(e) => setConfig(prev => prev ? {...prev, persona_prompt: e.target.value} : null)} />
                    </div>
                    <div className="admin-embedding-page__form-group">
                      <label>초기 인사말</label>
                      <input type="text" value={config?.welcome_message || ''} onChange={(e) => setConfig(prev => prev ? {...prev, welcome_message: e.target.value} : null)} />
                    </div>
                    <button type="button" className="admin-embedding-page__save-btn" onClick={handleSaveConfig} disabled={saving}>{saving ? '저장 중...' : '설정 저장'}</button>
                  </div>
                </div>
              )}

              {activeTab === 'chats' && (
                <div className="admin-embedding-page__chat-container">
                  <div className="admin-embedding-page__chat-list-card">
                    <h3 className="admin-embedding-page__card-title">대화 목록</h3>
                    {chatSessions.length === 0 ? (
                      <p className="admin-embedding-page__muted">대화 내역이 없습니다.</p>
                    ) : (
                      <div className="admin-embedding-page__table-wrapper">
                        <table className="admin-embedding-page__table">
                          <thead>
                            <tr>
                              <th>날짜</th>
                              <th>이름</th>
                              <th>메시지</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {chatSessions.map(s => (
                              <tr key={s.session_id} className={selectedChat?.session_id === s.session_id ? 'is-selected' : ''} onClick={() => fetchChatDetail(s.session_id)}>
                                <td>{new Date(s.created_at).toLocaleDateString()}</td>
                                <td>{s.user_name || '비회원'}</td>
                                <td>{s.message_count}회</td>
                                <td><button className="admin-embedding-page__view-btn">보기</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  
                  <div className="admin-embedding-page__chat-detail-card">
                    <h3 className="admin-embedding-page__card-title">대화 상세</h3>
                    {selectedChat ? (
                      <div className="admin-embedding-page__chat-window">
                        <div className="admin-embedding-page__chat-messages">
                          {selectedChat.conversation.map((msg, idx) => (
                            <div key={idx} className={`admin-embedding-page__chat-msg ${msg.role}`}>
                              <div className="admin-embedding-page__chat-bubble">
                                {msg.content}
                                <div className="admin-embedding-page__chat-time">{new Date(msg.timestamp || selectedChat.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="admin-embedding-page__empty-chat">왼쪽 목록에서 대화를 선택하세요.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="admin-embedding-page__card">
                  <div className="admin-embedding-page__actions">
                    <label className="admin-embedding-page__upload-btn">
                      <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} disabled={uploading} />
                      {uploading ? '업로드 중...' : '문서 업로드'}
                    </label>
                    <button type="button" className="admin-embedding-page__rebuild-btn" onClick={handleRebuild} disabled={!!rebuilding}>인덱스 재구축</button>
                  </div>
                  <h3 className="admin-embedding-page__card-title" style={{marginTop: '20px'}}>업로드된 문서</h3>
                  <ul className="admin-embedding-page__doc-list">
                    {documents.map((d) => (
                      <li key={d.name}>
                        <span>{d.name}</span>
                        <span className="admin-embedding-page__muted">{(d.size_bytes / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'test' && (
                <div className="admin-embedding-page__card admin-embedding-page__test-chat-card">
                  <div className="admin-embedding-page__test-chat-header">
                    <h3 className="admin-embedding-page__card-title">RAG 테스트 채팅</h3>
                    <button type="button" className="admin-embedding-page__test-clear-btn" onClick={handleTestClear}>대화 초기화</button>
                  </div>
                  <div className="admin-embedding-page__test-chat-window">
                    <div className="admin-embedding-page__chat-messages">
                      {testMessages.length === 0 && (
                        <div className="admin-embedding-page__empty-chat">
                          선택된 병원의 RAG 인덱스로 테스트 질의를 보내보세요.
                        </div>
                      )}
                      {testMessages.map((msg, idx) => (
                        <div key={idx} className={`admin-embedding-page__chat-msg ${msg.role}`}>
                          <div className="admin-embedding-page__chat-bubble">
                            {msg.content}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="admin-embedding-page__test-sources">
                                <strong>참고 문서 ({msg.sources.length})</strong>
                                {msg.sources.map((src, si) => (
                                  <div key={si} className="admin-embedding-page__test-source-item">
                                    {src.score != null && <span className="admin-embedding-page__test-source-score">{(src.score * 100).toFixed(0)}%</span>}
                                    <span className="admin-embedding-page__test-source-text">{src.text.slice(0, 120)}...</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {testLoading && (
                        <div className="admin-embedding-page__chat-msg assistant">
                          <div className="admin-embedding-page__chat-bubble admin-embedding-page__chat-bubble--loading">
                            <span className="admin-embedding-page__typing-dots">
                              <span></span><span></span><span></span>
                            </span>
                          </div>
                        </div>
                      )}
                      <div ref={testMessagesEndRef} />
                    </div>
                  </div>
                  <div className="admin-embedding-page__test-input-area">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestSend(); } }}
                      placeholder="테스트 질문을 입력하세요..."
                      disabled={testLoading}
                    />
                    <button type="button" onClick={handleTestSend} disabled={testLoading || !testInput.trim()}>전송</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="admin-embedding-page__empty-state">
              <h3>병원을 선택하세요</h3>
              <p className="admin-embedding-page__muted">왼쪽 사이드바에서 관리를 시작하세요.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminEmbeddingPage;

