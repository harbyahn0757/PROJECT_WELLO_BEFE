/**
 * 백오피스 - 병원별 RAG 임베딩 관리 (독립 앱)
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import './styles.scss';

const getEmbeddingApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1/admin/embedding';
  
  // 프로덕션 환경
  if (window.location.hostname === 'welno.kindhabit.com') {
    return '/welno-api/v1/admin/embedding';
  }
  
  // 개발 환경 - package.json의 proxy 설정을 통해 8082로 프록시
  return '/api/v1/admin/embedding';
};
const API_BASE = getEmbeddingApiBase();

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
  id?: number;
  name: string;
  title: string;
  category?: string;
  doc_type: string;        // 'global' | 'common' | 'hospital'
  size_bytes: number;
  chunk_count?: number;
  uploaded_at: string | null;
  is_active?: boolean;
}

interface HospitalConfig {
  partner_id: string;
  hospital_id: string;
  hospital_name: string;
  persona_prompt: string;
  welcome_message: string;
  llm_config: { model: string; temperature: number; max_tokens: number };
  embedding_config: { model: string; index_name: string };
  theme_config: { theme: string; primary_color: string; logo_url?: string };
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

const EmbeddingPage: React.FC = () => {
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
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'chats' | 'docs'>('config');

  // 공통 문서 상태
  const [commonDocuments, setCommonDocuments] = useState<DocumentItem[]>([]);
  // RAG 테스트 채팅 상태
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant'; content: string; sources?: {text: string; score: number | null; title: string; page: string}[]}[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 문서 탭 UI 상태
  const [docSearchText, setDocSearchText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  // 병원 문서 선택/학습 상태
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [rebuildProgress, setRebuildProgress] = useState<{status: string; progress: string} | null>(null);
  // 제목 편집
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // URL 쿼리 파라미터 파싱 (마리아 iframe embed 모드)
  const urlParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      api_key: params.get('api_key'),
      partner_id: params.get('partner_id'),
      hospital_id: params.get('hospital_id'),
      hospital_name: params.get('hospital_name'),
    };
  }, []);

  const isEmbedMode = !!(urlParams.api_key && urlParams.partner_id);

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
      if (res.ok) setPendingHospitals(await res.json());
    } catch (err) {
      console.error('대기 병원 목록 조회 실패:', err);
    }
  }, []);

  const fetchCommonDocuments = useCallback(async (partnerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/partners/${partnerId}/common-documents`);
      if (res.ok) {
        setCommonDocuments(await res.json());
      }
    } catch (e) { console.error('Failed to fetch common documents:', e); }
  }, []);

  const handleCommonDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPartnerId || !e.target.files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', e.target.files[0]);
      const res = await fetch(`${API_BASE}/partners/${selectedPartnerId}/common-documents`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchCommonDocuments(selectedPartnerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '공통 문서 업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCommonDocDelete = async (filename: string) => {
    if (!selectedPartnerId || !window.confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`${API_BASE}/partners/${selectedPartnerId}/common-documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchCommonDocuments(selectedPartnerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '공통 문서 삭제 실패');
    }
  };

  const toggleDocSelect = (docId: number) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const activeDocs = documents.filter(d => d.is_active !== false && d.id);
    if (selectedDocIds.size === activeDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(activeDocs.map(d => d.id!)));
    }
  };

  const handleStartLearning = async () => {
    if (!selectedHospitalId) return;
    setRebuildProgress({ status: 'starting', progress: '학습 시작...' });
    try {
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/rebuild?partner_id=${selectedPartnerId}`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      // 폴링 시작
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/rebuild/status`);
          const st = await sr.json();
          setRebuildProgress({ status: st.status, progress: st.progress || st.message || '' });
          if (st.status === 'completed' || st.status === 'failed') {
            clearInterval(poll);
            if (st.status === 'completed') {
              setTimeout(() => setRebuildProgress(null), 3000);
              if (selectedHospitalId && selectedPartnerId) {
                fetchHospitalDetails(selectedHospitalId, selectedPartnerId);
              }
            }
          }
        } catch { /* ignore */ }
      }, 1500);
    } catch (err) {
      setRebuildProgress({ status: 'failed', progress: err instanceof Error ? err.message : '실패' });
      setTimeout(() => setRebuildProgress(null), 3000);
    }
  };

  const handleSaveTitle = async (docId: number) => {
    if (!editingTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (!res.ok) throw new Error('저장 실패');
      setEditingDocId(null);
      if (selectedHospitalId && selectedPartnerId) {
        fetchHospitalDetails(selectedHospitalId, selectedPartnerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '제목 저장 실패');
    }
  };

  const handleToggleActive = async (docId: number | undefined) => {
    if (!docId) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}/toggle-active`, { method: 'PUT' });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      // 목록 새로고침
      if (selectedHospitalId && selectedPartnerId) {
        await fetchHospitalDetails(selectedHospitalId, selectedPartnerId);
        await fetchCommonDocuments(selectedPartnerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경 실패');
    }
  };

  const handleDocPreview = (docId: number | undefined) => {
    if (!docId) return;
    window.open(`${API_BASE}/documents/${docId}/download`, '_blank');
  };

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
      if (res.ok) setSelectedChat(await res.json());
    } catch (err) {
      console.error('대화 상세 조회 실패:', err);
    }
  };

  const sendTestChat = useCallback(async () => {
    if (!chatInput.trim() || !selectedHospitalId || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const partnerId = selectedPartnerId;
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/test-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          partner_id: partnerId,
          session_id: chatSessionId,
        }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.answer && !data.done) {
                assistantContent += data.answer;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
              // done 이벤트에서 sources 저장
              if (data.done && data.sources && data.sources.length > 0) {
                setChatMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = { ...updated[lastIdx], sources: data.sources };
                  }
                  return updated;
                });
              }
              if (data.session_id) {
                setChatSessionId(data.session_id);
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다.' }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, selectedHospitalId, chatLoading, chatSessionId, selectedPartnerId]);

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
      alert('새 병원이 추가되었습니다.');
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

  useEffect(() => {
    if (isEmbedMode && urlParams.partner_id && urlParams.hospital_id) {
      // embed 모드: URL 파라미터로 자동 선택, hierarchy 생략
      setSelectedPartnerId(urlParams.partner_id);
      setSelectedHospitalId(urlParams.hospital_id);
    } else {
      fetchHierarchy();
      fetchPendingHospitals();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedHospitalId && selectedPartnerId) {
      fetchHospitalDetails(selectedHospitalId, selectedPartnerId);
      fetchCommonDocuments(selectedPartnerId);
      setSelectedChat(null);
    }
  }, [selectedHospitalId, selectedPartnerId, fetchHospitalDetails, fetchCommonDocuments]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedHospitalId || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/documents`, { method: 'POST', body: form });
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
      const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/rebuild?partner_id=${selectedPartnerId}`, { method: 'POST' });
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
    ?.hospitals.find(h => h.hospital_id === selectedHospitalId)
    || (isEmbedMode && selectedHospitalId ? {
      partner_id: urlParams.partner_id!,
      partner_name: urlParams.partner_id!,
      hospital_id: selectedHospitalId,
      hospital_name: urlParams.hospital_name || selectedHospitalId,
      has_embedding: false,
      has_uploads: false,
      document_count: 0,
    } as HospitalItem : undefined);

  // 문서 카테고리 목록 + 통계
  const docStats = useMemo(() => {
    let commonFiltered = commonDocuments;
    if (isEmbedMode) {
      commonFiltered = commonFiltered.filter(d => d.category !== '건강기능식품');
    }
    const totalDocs = commonFiltered.length + documents.length;
    const totalChunks = [...commonFiltered, ...documents].reduce((sum, d) => sum + (d.chunk_count || 0), 0);
    const categories = Array.from(new Set(commonFiltered.filter(d => d.category).map(d => d.category!)));
    const totalSize = [...commonFiltered, ...documents].reduce((sum, d) => sum + d.size_bytes, 0);
    return { totalDocs, totalChunks, categories, totalSize };
  }, [commonDocuments, documents, isEmbedMode]);

  const filteredCommonDocs = useMemo(() => {
    let filtered = commonDocuments;
    // embed 모드에서는 건강기능식품 카테고리 숨김
    if (isEmbedMode) {
      filtered = filtered.filter(d => d.category !== '건강기능식품');
    }
    if (docSearchText) {
      const q = docSearchText.toLowerCase();
      filtered = filtered.filter(d =>
        (d.title || d.name).toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q)
      );
    }
    if (docCategoryFilter !== 'all') {
      filtered = filtered.filter(d => d.category === docCategoryFilter);
    }
    return filtered;
  }, [commonDocuments, docSearchText, docCategoryFilter, isEmbedMode]);

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocumentItem[]> = {};
    filteredCommonDocs.forEach(d => {
      const cat = d.category || '미분류';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredCommonDocs]);

  // 기본문서 카테고리는 기본적으로 접힌 상태
  const [categoriesInitialized, setCategoriesInitialized] = useState(false);
  useEffect(() => {
    if (groupedDocs.length > 0 && !categoriesInitialized) {
      setCollapsedCategories(new Set(groupedDocs.map(([cat]) => cat)));
      setCategoriesInitialized(true);
    }
  }, [groupedDocs, categoriesInitialized]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // 드래그앤드랍 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, target: 'hospital' | 'common') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length || !selectedHospitalId) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md'].includes(ext || '')) {
      setError('지원되지 않는 파일 형식입니다. (PDF, TXT, MD)');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (target === 'hospital') {
        const res = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/documents`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
        await fetchHospitalDetails(selectedHospitalId, selectedPartnerId!);
      } else {
        const res = await fetch(`${API_BASE}/partners/${selectedPartnerId}/common-documents`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
        await fetchCommonDocuments(selectedPartnerId!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  }, [selectedHospitalId, selectedPartnerId, fetchHospitalDetails, fetchCommonDocuments]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);

  return (
    <div className={`admin-embedding-page${isEmbedMode ? ' admin-embedding-page--embed' : ''}`}>
      {!isEmbedMode && (
        <header className="admin-embedding-page__header">
          <h1 className="admin-embedding-page__title">병원별 RAG 임베딩 관리</h1>
        </header>
      )}
      {error && (
        <div className="admin-embedding-page__error" role="alert">{error}</div>
      )}
      <div className="admin-embedding-page__layout">
        {!isEmbedMode && (
        <aside className="admin-embedding-page__sidebar">
          {pendingHospitals.length > 0 && (
            <div className="admin-embedding-page__pending-section">
              <h2 className="admin-embedding-page__sidebar-title admin-embedding-page__sidebar-title--pending">🚨 등록 대기 중</h2>
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
        )}
        <main className="admin-embedding-page__main">
          {selectedHospitalId && selectedHospital ? (
            <>
              <div className="admin-embedding-page__card">
                <h2 className="admin-embedding-page__card-title">{selectedHospital.hospital_name}</h2>
                <div className="admin-embedding-page__tabs">
                  <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>환경 설정</button>
                  <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => setActiveTab('chats')}>상담 내역 ({chatSessions.length})</button>
                  <button className={activeTab === 'docs' ? 'active' : ''} onClick={() => setActiveTab('docs')}>지침 문서</button>
                </div>
              </div>
              {activeTab === 'config' && (
                <div className="admin-embedding-page__card">
                  <div className="admin-embedding-page__config-form">
                    <div className="admin-embedding-page__form-row">
                      <div className="admin-embedding-page__form-group">
                        <label>병원 표시명</label>
                        <input type="text" value={config?.hospital_name || ''} onChange={(e) => setConfig(prev => prev ? { ...prev, hospital_name: e.target.value } : null)} />
                      </div>
                      <div className="admin-embedding-page__form-group">
                        <label>활성 상태</label>
                        <select value={config?.is_active ? 'true' : 'false'} onChange={(e) => setConfig(prev => prev ? { ...prev, is_active: e.target.value === 'true' } : null)}>
                          <option value="true">활성</option>
                          <option value="false">비활성</option>
                        </select>
                      </div>
                    </div>
                    <div className="admin-embedding-page__form-group">
                      <label>LLM 페르소나 (System Prompt)</label>
                      <textarea rows={6} value={config?.persona_prompt || ''} onChange={(e) => setConfig(prev => prev ? { ...prev, persona_prompt: e.target.value } : null)} />
                    </div>
                    <div className="admin-embedding-page__form-group">
                      <label>초기 인사말</label>
                      <input type="text" value={config?.welcome_message || ''} onChange={(e) => setConfig(prev => prev ? { ...prev, welcome_message: e.target.value } : null)} />
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
                                <td><button type="button" className="admin-embedding-page__view-btn">보기</button></td>
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
                          {selectedChat.conversation.map((msg: any, idx: number) => (
                            <div key={idx} className={`admin-embedding-page__chat-msg ${msg.role}`}>
                              <div className="admin-embedding-page__chat-bubble">
                                {msg.content}
                                <div className="admin-embedding-page__chat-time">{new Date(msg.timestamp || selectedChat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
                <div className="docs-redesign">
                  {/* 통계 요약 */}
                  <div className="docs-stats">
                    <div className="docs-stats__item">
                      <span className="docs-stats__value">{docStats.totalDocs}</span>
                      <span className="docs-stats__label">전체 문서</span>
                    </div>
                    <div className="docs-stats__item">
                      <span className="docs-stats__value">{docStats.totalChunks.toLocaleString()}</span>
                      <span className="docs-stats__label">인덱스 청크</span>
                    </div>
                    <div className="docs-stats__item">
                      <span className="docs-stats__value">{docStats.categories.length}</span>
                      <span className="docs-stats__label">카테고리</span>
                    </div>
                    <div className="docs-stats__item">
                      <span className="docs-stats__value">{formatFileSize(docStats.totalSize)}</span>
                      <span className="docs-stats__label">총 용량</span>
                    </div>
                  </div>

                  {/* 검색 + 필터 + 액션 */}
                  <div className="docs-toolbar">
                    <input
                      className="docs-toolbar__search"
                      type="text"
                      placeholder="문서 검색..."
                      value={docSearchText}
                      onChange={e => setDocSearchText(e.target.value)}
                    />
                    <div className="docs-toolbar__chips">
                      <button
                        className={`docs-chip ${docCategoryFilter === 'all' ? 'docs-chip--active' : ''}`}
                        onClick={() => setDocCategoryFilter('all')}
                      >전체</button>
                      {docStats.categories.map(cat => (
                        <button
                          key={cat}
                          className={`docs-chip ${docCategoryFilter === cat ? 'docs-chip--active' : ''}`}
                          onClick={() => setDocCategoryFilter(docCategoryFilter === cat ? 'all' : cat)}
                        >{cat}</button>
                      ))}
                    </div>
                    <div className="docs-toolbar__actions">
                      {!isEmbedMode && (
                        <label className="docs-toolbar__btn">
                          <input type="file" accept=".pdf,.txt,.md" onChange={handleCommonDocUpload} disabled={uploading} />
                          {uploading ? '...' : '+ 공통'}
                        </label>
                      )}

                    </div>
                  </div>

                  {/* 스크롤 가능한 문서 목록 영역 */}
                  <div
                    className={`docs-scroll-area${isDragging ? ' docs-scroll-area--dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, 'hospital')}
                  >
                    {/* 드래그앤드랍 오버레이 */}
                    {isDragging && (
                      <div className="docs-drop-overlay">
                        <div className="docs-drop-overlay__content">
                          <span className="docs-drop-overlay__icon">+</span>
                          <span>파일을 놓으면 업로드됩니다</span>
                        </div>
                      </div>
                    )}

                    {/* 병원 전용 문서 (최상단) */}
                    <div
                      className={`docs-group docs-group--hospital${isDragging ? ' docs-group--drag-target' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, 'hospital')}
                    >
                      <div className="docs-group__header docs-group__header--hospital">
                        <span className="docs-group__title">병원 전용 문서</span>
                        <span className="docs-group__count">{documents.length}</span>
                        <label className="docs-group__upload-btn">
                          <input type="file" accept=".pdf,.txt,.md,.csv" onChange={handleUpload} disabled={uploading} />
                          {uploading ? '업로드 중...' : '+ 문서 업로드'}
                        </label>
                      </div>

                      {/* 학습 진행 상태 바 */}
                      {rebuildProgress && (
                        <div className={`docs-progress ${rebuildProgress.status === 'completed' ? 'docs-progress--done' : rebuildProgress.status === 'failed' ? 'docs-progress--fail' : ''}`}>
                          <div className="docs-progress__bar">
                            <div className={`docs-progress__fill ${rebuildProgress.status === 'completed' ? 'docs-progress__fill--done' : ''}`} />
                          </div>
                          <span className="docs-progress__text">{rebuildProgress.progress}</span>
                        </div>
                      )}

                      {documents.length > 0 ? (
                        <div className="docs-group__body">
                          {/* 전체선택 + 학습 버튼 */}
                          <div className="docs-select-bar">
                            <label className="docs-select-bar__check">
                              <input
                                type="checkbox"
                                checked={selectedDocIds.size > 0 && selectedDocIds.size === documents.filter(d => d.is_active !== false && d.id).length}
                                onChange={toggleSelectAll}
                              />
                              <span>전체 선택</span>
                            </label>
                            <span className="docs-select-bar__info">
                              {selectedDocIds.size > 0 ? `${selectedDocIds.size}개 선택됨` : ''}
                            </span>
                            <button
                              className="docs-select-bar__learn-btn"
                              onClick={handleStartLearning}
                              disabled={!!rebuildProgress || documents.filter(d => d.is_active !== false).length === 0}
                            >
                              {rebuildProgress ? '학습 중...' : '학습'}
                            </button>
                          </div>

                          {documents.map(d => (
                            <div key={d.id || d.name} className={`docs-row${d.is_active === false ? ' docs-row--inactive' : ''}`}>
                              {d.id && d.is_active !== false && (
                                <input
                                  type="checkbox"
                                  className="docs-row__check"
                                  checked={selectedDocIds.has(d.id)}
                                  onChange={() => toggleDocSelect(d.id!)}
                                />
                              )}
                              {editingDocId === d.id ? (
                                <span className="docs-row__title-edit">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={e => setEditingTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(d.id!); if (e.key === 'Escape') setEditingDocId(null); }}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveTitle(d.id!)}>저장</button>
                                  <button onClick={() => setEditingDocId(null)}>취소</button>
                                </span>
                              ) : (
                                <span
                                  className="docs-row__title"
                                  onDoubleClick={() => { if (d.id) { setEditingDocId(d.id); setEditingTitle(d.title || d.name); } }}
                                  onClick={() => handleDocPreview(d.id)}
                                  title="클릭: 미리보기 / 더블클릭: 제목 편집"
                                >{d.title || d.name}</span>
                              )}
                              <span className="docs-row__meta">
                                {d.is_active === false && <span className="docs-badge docs-badge--disabled">비활성</span>}
                                {d.chunk_count ? <span className="docs-row__chunks">{d.chunk_count}</span> : null}
                                <span className="docs-row__size">{formatFileSize(d.size_bytes)}</span>
                                <button
                                  className={`docs-row__toggle ${d.is_active === false ? 'docs-row__toggle--off' : ''}`}
                                  onClick={() => handleToggleActive(d.id)}
                                  title={d.is_active === false ? '활성화 (학습에 포함)' : '비활성화 (학습에서 제외)'}
                                >{d.is_active === false ? '복원' : '삭제'}</button>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="docs-group__empty">
                          {isDragging
                            ? '여기에 파일을 놓으세요'
                            : '파일을 드래그하거나 위의 업로드 버튼을 사용하세요 (PDF, TXT, MD)'}
                        </div>
                      )}
                    </div>

                    {/* 카테고리별 기본/공통 문서 목록 */}
                    {groupedDocs.map(([category, docs]) => (
                      <div key={category} className="docs-group">
                        <button className="docs-group__header" onClick={() => toggleCategory(category)}>
                          <span className="docs-group__arrow">{collapsedCategories.has(category) ? '\u25B6' : '\u25BC'}</span>
                          <span className="docs-group__title">{category}</span>
                          <span className="docs-group__count">{docs.length}</span>
                        </button>
                        {!collapsedCategories.has(category) && (
                          <div className="docs-group__body">
                            {docs.map(d => (
                              <div key={d.id || d.name} className="docs-row">
                                <span className="docs-row__title" onClick={() => handleDocPreview(d.id)} style={{cursor: d.id ? 'pointer' : 'default'}}>{d.title || d.name}</span>
                                <span className="docs-row__meta">
                                  {d.doc_type === 'global' && <span className="docs-badge docs-badge--global">기본</span>}
                                  {d.doc_type === 'common' && <span className="docs-badge docs-badge--common">공통</span>}
                                  {d.chunk_count ? <span className="docs-row__chunks">{d.chunk_count}</span> : null}
                                  <span className="docs-row__size">{formatFileSize(d.size_bytes)}</span>
                                  {!isEmbedMode && d.doc_type !== 'global' && (
                                    <button className="docs-row__delete" onClick={() => handleCommonDocDelete(d.name)}>삭제</button>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {groupedDocs.length === 0 && docSearchText && (
                      <div className="docs-empty">&lsquo;{docSearchText}&rsquo; 검색 결과가 없습니다.</div>
                    )}
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
        {isEmbedMode && (
          <aside className="admin-embedding-page__rag-panel">
            <div className="admin-embedding-page__rag-panel-header">
              <h3>RAG 테스트</h3>
              <button onClick={() => { setChatMessages([]); setChatSessionId(null); }}>초기화</button>
            </div>
            <div className="admin-embedding-page__rag-panel-body">
              {chatMessages.length === 0 ? (
                <div className="admin-embedding-page__rag-panel-empty">
                  질문을 입력하여 RAG 응답을 테스트하세요
                </div>
              ) : (
                <div className="admin-embedding-page__rag-chat-messages" ref={chatContainerRef}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`admin-embedding-page__chat-bubble admin-embedding-page__chat-bubble--${msg.role}`}>
                      <div className="admin-embedding-page__chat-content">
                        {msg.content || (chatLoading && i === chatMessages.length - 1 ? '...' : '')}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="admin-embedding-page__chat-sources">
                          <button
                            className={`admin-embedding-page__chat-sources-toggle ${expandedSources.has(i) ? 'admin-embedding-page__chat-sources-toggle--open' : ''}`}
                            onClick={() => setExpandedSources(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                          >
                            참고문헌 ({msg.sources.length}건)
                          </button>
                          {expandedSources.has(i) && (
                            <ul className="admin-embedding-page__chat-sources-list">
                              {msg.sources.map((src, si) => (
                                <li key={si} className="admin-embedding-page__chat-source-item">
                                  <strong>{src.title}</strong>
                                  {src.page && <span className="admin-embedding-page__chat-source-page">p.{src.page}</span>}
                                  {src.score != null && <span className="admin-embedding-page__chat-source-score">{(src.score * 100).toFixed(0)}%</span>}
                                  <p className="admin-embedding-page__chat-source-text">{src.text.substring(0, 200)}{src.text.length > 200 ? '...' : ''}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
            <div className="admin-embedding-page__rag-panel-input">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendTestChat()}
                placeholder="질문을 입력하세요..."
                disabled={chatLoading || !selectedHospitalId}
              />
              <button onClick={sendTestChat} disabled={chatLoading || !chatInput.trim() || !selectedHospitalId}>
                전송
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default EmbeddingPage;
