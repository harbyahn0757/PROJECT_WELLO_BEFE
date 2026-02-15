/**
 * 백오피스 - 병원별 RAG 임베딩 관리 (독립 앱)
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWithAuth } from '../../utils/api';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import { useHierarchy } from '../../hooks/useHierarchy';
import { downloadWorkbook, dateSuffix } from '../../utils/excelExport';
import DemoBanner from '../../components/DemoBanner';
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
const MIN_EXPORT_BLOB_BYTES = 5000;

interface HospitalItem {
  partner_id: string;
  partner_name: string;
  hospital_id: string;
  hospital_name: string;
  has_embedding: boolean;
  has_uploads: boolean;
  document_count: number;
  chat_count_today: number;
  survey_count_today: number;
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
  user_gender: string | null;
  checkup_date: string | null;
  hospital_name: string | null;
  partner_id?: string;
  hospital_id?: string;
  interest_tags?: string[];
  risk_tags?: string[];
  keyword_tags?: string[];
  sentiment?: string;
  conversation_summary?: string;
  data_quality_score?: number;
}

interface ChatDetail {
  session_id: string;
  partner_id?: string;
  conversation: any[];
  initial_data: any;
  created_at: string;
  interest_tags?: string[];
  risk_tags?: string[];
  keyword_tags?: string[];
  sentiment?: string;
  conversation_summary?: string;
  data_quality_score?: number;
  has_discrepancy?: boolean;
  risk_level?: string;
  key_concerns?: string[];
  follow_up_needed?: boolean;
  tagging_model?: string;
  tagging_version?: number;
  counselor_recommendations?: string[];
  conversation_depth?: string;
  engagement_score?: number;
  action_intent?: string;
  nutrition_tags?: string[];
}

const EmbeddingPage: React.FC = () => {
  const auth = useAuth();

  // embed 모드 감지 (iframe에서 쿼리 파라미터로 접속)
  const { isEmbedMode, embedParams } = useEmbedParams();

  // 파트너/병원 계층 구조
  const {
    hierarchy,
    selectedPartnerId, setSelectedPartnerId,
    selectedHospitalId, setSelectedHospitalId,
    collapsedPartners, togglePartner,
    loading: hierarchyLoading,
    fetchHierarchy, sortedHierarchy,
  } = useHierarchy(API_BASE, isEmbedMode ? embedParams : undefined);

  const [pendingHospitals, setPendingHospitals] = useState<PendingHospital[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<HospitalConfig | null>(null);
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalId, setNewHospitalId] = useState('');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'chats' | 'docs'>('chats');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // settingsTab removed - now using split panel layout
  const [viewAllChats, setViewAllChats] = useState(false);
  const [allChatSessions, setAllChatSessions] = useState<ChatSession[]>([]);
  const [chatDetailTab, setChatDetailTab] = useState<'conversation' | 'health' | 'tags'>('conversation');
  const [excelExporting, setExcelExporting] = useState(false);
  const [summaryCounts, setSummaryCounts] = useState<{new_chats: number; new_surveys: number}>({new_chats: 0, new_surveys: 0});

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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      // 폴링 시작 (ref에 저장하여 언마운트 시 정리 가능)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`${API_BASE}/hospitals/${selectedHospitalId}/rebuild/status`);
          const st = await sr.json();
          setRebuildProgress({ status: st.status, progress: st.progress || st.message || '' });
          if (st.status === 'completed' || st.status === 'failed') {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
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
    // 이전 요청 취소 (레이스 컨디션 방지)
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const signal = controller.signal;
      const [docRes, configRes, chatRes] = await Promise.all([
        fetch(`${API_BASE}/hospitals/${hospitalId}/documents`, { signal }),
        fetch(`${API_BASE}/hospitals/${hospitalId}/config?partner_id=${partnerId}`, { signal }),
        fetch(`${API_BASE}/hospitals/${hospitalId}/chats?partner_id=${partnerId}`, { signal })
      ]);
      if (docRes.ok) setDocuments(await docRes.json());
      if (configRes.ok) setConfig(await configRes.json());
      if (chatRes.ok) setChatSessions(await chatRes.json());
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
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
        setChatDetailTab('conversation');
      }
    } catch (err) {
      console.error('대화 상세 조회 실패:', err);
    }
  };

  const fetchAllChats = useCallback(async (partnerId?: string) => {
    try {
      const url = partnerId
        ? `${API_BASE}/chats/all?partner_id=${partnerId}&limit=200`
        : `${API_BASE}/chats/all?limit=200`;
      const res = await fetch(url);
      if (res.ok) setAllChatSessions(await res.json());
    } catch (err) {
      console.error('통합 대화 목록 조회 실패:', err);
    }
  }, []);

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
            } catch (parseErr) {
              console.warn('SSE JSON parse error:', parseErr);
            }
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

  // 언마운트 시 폴링 + 비동기 요청 정리
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (isEmbedMode && embedParams.partnerId && embedParams.hospitalId) {
      // embed 모드: URL 파라미터로 자동 선택, hierarchy 생략
      setSelectedPartnerId(embedParams.partnerId);
      setSelectedHospitalId(embedParams.hospitalId);
    } else {
      fetchHierarchy();
      fetchPendingHospitals();
      fetch(`${API_BASE}/summary-counts`).then(r => r.json()).then(setSummaryCounts).catch(() => {});
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

  // "전체 상담 통합 보기" 활성화 시 자동 데이터 로드
  useEffect(() => {
    if (viewAllChats) {
      fetchAllChats();
    }
  }, [viewAllChats, fetchAllChats]);

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


  const selectedHospital = hierarchy
    .find(p => p.partner_id === selectedPartnerId)
    ?.hospitals.find(h => h.hospital_id === selectedHospitalId)
    || (isEmbedMode && selectedHospitalId ? {
      partner_id: embedParams.partnerId!,
      partner_name: embedParams.partnerId!,
      hospital_id: selectedHospitalId,
      hospital_name: embedParams.hospitalName || selectedHospitalId,
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

  const handleExcelExport = async () => {
    setExcelExporting(true);
    try {
      // 화면에 로드된 데이터를 직접 내보내기 (서버 재쿼리 X)
      const sessions = viewAllChats ? allChatSessions : chatSessions;
      if (sessions.length === 0) {
        setError('내보낼 데이터가 없습니다.');
        setExcelExporting(false);
        return;
      }

      // 1) 상담 목록 + 태그 시트
      const listSheet = sessions.map(s => ({
        날짜: s.created_at,
        이름: s.user_name || '',
        성별: s.user_gender === 'F' ? '여' : s.user_gender === 'M' ? '남' : '',
        병원: s.hospital_name || '',
        검진일: s.checkup_date || '',
        연락처: s.user_phone || '',
        메시지수: s.message_count,
        관심사: normalizeTagsToStrings(s.interest_tags).join(', '),
        위험태그: normalizeTagsToStrings(s.risk_tags).join(', '),
        키워드: normalizeTagsToStrings(s.keyword_tags).join(', '),
        감정: s.sentiment || '',
        대화요약: s.conversation_summary || '',
        데이터품질: s.data_quality_score ?? '',
      }));

      // 2) 선택된 대화 상세 (태그 분석 전체)
      const sheets: { name: string; data: Record<string, any>[] }[] = [
        { name: '상담목록', data: listSheet },
      ];

      // 3) 서버에서 전체 데이터(대화내역+검진+태그) 가져와 별도 시트 추가
      try {
        const url = selectedPartnerId
          ? `${API_BASE}/chats/export?partner_id=${selectedPartnerId}`
          : `${API_BASE}/chats/export`;
        const res = await fetch(url);
        if (res.ok) {
          // 서버 엑셀이 정상이면 blob으로 직접 다운로드
          const blob = await res.blob();
          // blob 크기가 헤더만인지 확인 (대략 5KB 이하면 데이터 없음)
          if (blob.size > MIN_EXPORT_BLOB_BYTES) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `상담데이터_전체_${dateSuffix()}.xlsx`;
            a.click();
            URL.revokeObjectURL(a.href);
          }
        }
      } catch { /* 서버 export 실패 시 무시 — 클라이언트 export로 대체 */ }

      // 클라이언트 사이드 export (화면 데이터 기반)
      downloadWorkbook(sheets, `상담목록_${dateSuffix()}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '엑셀 내보내기 실패');
    } finally {
      setExcelExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yy}.${mm}.${dd} ${hh}:${mi}`;
  };

  const HEALTH_METRIC_LABELS: Record<string, string> = {
    height: '신장(cm)', weight: '체중(kg)', bmi: 'BMI',
    waist: '허리둘레(cm)', bp_systolic: '수축기혈압', bp_diastolic: '이완기혈압',
    fasting_glucose: '공복혈당', total_cholesterol: '총콜레스테롤',
    hdl_cholesterol: 'HDL', ldl_cholesterol: 'LDL', triglyceride: '중성지방',
    hemoglobin: '혈색소', ast: 'AST(GOT)', alt: 'ALT(GPT)', ggt: 'γ-GTP',
    creatinine: '크레아티닌', gfr: '사구체여과율(GFR)',
    checkup_date: '검진일', checkup_place: '검진기관',
  };

  const renderHealthMetrics = (metrics: Record<string, any>) => {
    const entries = Object.entries(metrics).filter(([k]) => !k.endsWith('_abnormal') && !k.endsWith('_range'));
    return (
      <table className="health-metrics-table">
        <thead>
          <tr><th>항목</th><th>수치</th><th>판정</th><th>참고범위</th></tr>
        </thead>
        <tbody>
          {entries.map(([key, val]) => {
            const abnormal = metrics[`${key}_abnormal`];
            const range = metrics[`${key}_range`];
            const isAbnormal = abnormal && abnormal !== '정상' && abnormal !== '';
            return (
              <tr key={key} className={isAbnormal ? 'is-abnormal' : ''}>
                <td className="td-label">{HEALTH_METRIC_LABELS[key] || key}</td>
                <td className="td-value">{val || '-'}</td>
                <td className={`td-status ${isAbnormal ? 'td-status--warn' : ''}`}>{abnormal || '-'}</td>
                <td className="td-range">{range || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const normalizeTagsToStrings = (tags: any[] | undefined): string[] => {
    if (!tags) return [];
    return tags.map(t => typeof t === 'string' ? t : (t?.topic || ''));
  };

  const renderTagChips = (tags: any[] | undefined, variant: 'interest' | 'risk' | 'keyword') => {
    const strTags = normalizeTagsToStrings(tags);
    if (strTags.length === 0) return <span className="admin-embedding-page__muted">-</span>;
    return (
      <div className="tag-chips">
        {strTags.map((t, i) => <span key={i} className={`tag-chip tag-chip--${variant}`}>{t}</span>)}
      </div>
    );
  };

  const renderChatDetailContent = (chat: ChatDetail) => {
    if (chatDetailTab === 'conversation') {
      return (
        <div className="admin-embedding-page__chat-window">
          {chat.initial_data && (
            <div className="admin-embedding-page__chat-patient-info">
              <strong>{chat.initial_data?.patient_info?.name || '환자 정보'}</strong>
              <span>{chat.initial_data?.patient_info?.gender === 'F' ? '여성' : chat.initial_data?.patient_info?.gender === 'M' ? '남성' : ''}</span>
              {chat.initial_data?.patient_info?.birth_date && <span>{chat.initial_data.patient_info.birth_date}</span>}
              {chat.initial_data?.patient_info?.contact && <span>{chat.initial_data.patient_info.contact}</span>}
              {chat.initial_data?.health_metrics?.checkup_date && <span>검진: {chat.initial_data.health_metrics.checkup_date}</span>}
            </div>
          )}
          <div className="admin-embedding-page__chat-messages">
            {chat.conversation.map((msg: any, idx: number) => (
              <div key={idx} className={`admin-embedding-page__chat-msg ${msg.role}`}>
                <div className="admin-embedding-page__chat-bubble">
                  {msg.content}
                  <div className="admin-embedding-page__chat-time">{new Date(msg.timestamp || chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (chatDetailTab === 'health') {
      const metrics = chat.initial_data?.health_metrics;
      if (!metrics || Object.keys(metrics).length === 0) {
        return <div className="admin-embedding-page__empty-chat">검진 데이터가 없습니다.</div>;
      }
      return (
        <div className="chat-detail-health">
          <div className="chat-detail-health__header">
            {metrics.checkup_date && <span>검진일: {metrics.checkup_date}</span>}
            {metrics.checkup_place && <span>검진기관: {metrics.checkup_place}</span>}
          </div>
          {renderHealthMetrics(metrics)}
        </div>
      );
    }
    // tags tab
    const sentimentLabel: Record<string, string> = {
      positive: '긍정', negative: '부정', neutral: '중립',
      confused: '혼란', worried: '걱정', grateful: '감사',
    };
    return (
      <div className="chat-detail-tags">
        {chat.conversation_summary && (
          <div className="chat-detail-tags__summary">
            <h4>대화 요약</h4>
            <p>{chat.conversation_summary}</p>
          </div>
        )}
        <div className="chat-detail-tags__grid">
          <div className="chat-detail-tags__item chat-detail-tags__item--wide">
            <h4>환자 관심사</h4>
            {chat.interest_tags && chat.interest_tags.length > 0 ? (
              <div className="tag-chips">
                {(chat.interest_tags as any[]).map((t: any, i: number) => {
                  const topic = typeof t === 'string' ? t : t?.topic || '';
                  const intensity = typeof t === 'string' ? 'medium' : (t?.intensity || 'medium');
                  return <span key={i} className={`tag-chip tag-chip--interest tag-chip--intensity-${intensity}`} title={`관심 강도: ${intensity === 'high' ? '높음' : intensity === 'medium' ? '보통' : '낮음'}`}>{topic}</span>;
                })}
              </div>
            ) : <span className="admin-embedding-page__muted">-</span>}
          </div>
          <div className="chat-detail-tags__item">
            <h4>위험 태그</h4>
            {renderTagChips(chat.risk_tags, 'risk')}
          </div>
          <div className="chat-detail-tags__item">
            <h4>위험도</h4>
            <span className={`risk-level-badge risk-level-badge--${chat.risk_level || 'low'}`}>
              {chat.risk_level === 'high' ? '높음' : chat.risk_level === 'medium' ? '보통' : '낮음'}
            </span>
          </div>
          <div className="chat-detail-tags__item">
            <h4>감정 분석</h4>
            <span className={`sentiment-badge sentiment-badge--${chat.sentiment || 'unknown'}`}>
              {sentimentLabel[chat.sentiment || ''] || '-'}
            </span>
          </div>
          <div className="chat-detail-tags__item">
            <h4>대화 깊이</h4>
            <span className={`depth-badge depth-badge--${chat.conversation_depth || 'shallow'}`}>
              {chat.conversation_depth === 'deep' ? '깊음' : chat.conversation_depth === 'moderate' ? '보통' : '얕음'}
            </span>
          </div>
          <div className="chat-detail-tags__item">
            <h4>참여도</h4>
            <div className="data-quality">
              <div className="data-quality__bar">
                <div className="data-quality__fill data-quality__fill--engagement" style={{ width: `${chat.engagement_score || 0}%` }} />
              </div>
              <span className="data-quality__score">{chat.engagement_score || 0}점</span>
            </div>
          </div>
          <div className="chat-detail-tags__item">
            <h4>행동 의향</h4>
            <span className={`action-badge action-badge--${chat.action_intent || 'passive'}`}>
              {chat.action_intent === 'active' ? '적극적' : chat.action_intent === 'considering' ? '고려중' : '소극적'}
            </span>
          </div>
          <div className="chat-detail-tags__item">
            <h4>후속 조치</h4>
            <span className={`follow-up-badge follow-up-badge--${chat.follow_up_needed ? 'yes' : 'no'}`}>
              {chat.follow_up_needed ? '필요' : '불필요'}
            </span>
          </div>
          {chat.nutrition_tags && chat.nutrition_tags.length > 0 && (
            <div className="chat-detail-tags__item chat-detail-tags__item--wide">
              <h4>식단·영양 관심</h4>
              <div className="tag-chips">
                {(chat.nutrition_tags as string[]).map((t: string, i: number) => (
                  <span key={i} className="tag-chip tag-chip--nutrition">{t}</span>
                ))}
              </div>
            </div>
          )}
          {chat.key_concerns && chat.key_concerns.length > 0 && (
            <div className="chat-detail-tags__item chat-detail-tags__item--wide">
              <h4>주요 우려사항</h4>
              <ul className="key-concerns-list">
                {chat.key_concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {chat.counselor_recommendations && chat.counselor_recommendations.length > 0 && (
            <div className="chat-detail-tags__item chat-detail-tags__item--wide">
              <h4>상담사 핵심 조언</h4>
              <ul className="key-concerns-list">
                {chat.counselor_recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <div className="chat-detail-tags__item">
            <h4>데이터 품질</h4>
            <div className="data-quality">
              <div className="data-quality__bar">
                <div className="data-quality__fill" style={{ width: `${chat.data_quality_score || 0}%` }} />
              </div>
              <span className="data-quality__score">{chat.data_quality_score || 0}점</span>
            </div>
          </div>
          {chat.has_discrepancy && (
            <div className="chat-detail-tags__item chat-detail-tags__item--warn">
              <h4>RAG 불일치</h4>
              <span className="tag-chip tag-chip--risk">불일치 감지됨</span>
            </div>
          )}
        </div>
        <div className="chat-detail-tags__footer">
          <span className="chat-detail-tags__model">
            {chat.tagging_model ? `분석: ${chat.tagging_model}` : ''}
            {chat.tagging_version ? ` (v${chat.tagging_version})` : ''}
          </span>
          <button
            className="retag-btn"
            onClick={async () => {
              try {
                const res = await fetch(`${API_BASE}/chats/${chat.session_id}/retag`, { method: 'POST' });
                if (res.ok) {
                  fetchChatDetail(chat.session_id);
                } else {
                  setError('재분석 실패');
                }
              } catch { setError('재분석 실패'); }
            }}
          >재분석</button>
        </div>
      </div>
    );
  };

  return (
    <div className={`admin-embedding-page${isEmbedMode ? ' admin-embedding-page--embed' : ''}`}>
      <DemoBanner />
      {error && (
        <div className="admin-embedding-page__error" role="alert">{error}</div>
      )}
      <div className="admin-embedding-page__layout">
        {/* 인라인 병원 선택 (파트너오피스 모드) */}
        {!isEmbedMode && (
          <div className="admin-embedding-page__inline-selector">
            <select
              className="admin-embedding-page__hospital-select"
              aria-label="병원 선택"
              value={selectedHospitalId || ''}
              onChange={(e) => {
                const hid = e.target.value;
                if (hid === '__all__') {
                  setViewAllChats(true);
                  setActiveTab('chats');
                  setSelectedChat(null);
                } else if (hid) {
                  setViewAllChats(false);
                  // 해당 병원의 파트너 찾기
                  for (const p of hierarchy) {
                    const found = p.hospitals.find(h => h.hospital_id === hid);
                    if (found) { setSelectedPartnerId(p.partner_id); break; }
                  }
                  setSelectedHospitalId(hid);
                }
              }}
            >
              <option value="">병원 선택</option>
              <option value="__all__">전체 상담 통합 보기</option>
              {hierarchy.flatMap(p => p.hospitals).map(h => (
                <option key={h.hospital_id} value={h.hospital_id}>{h.hospital_name}</option>
              ))}
            </select>
          </div>
        )}
        <main className="admin-embedding-page__main">
          {/* 통합 보기 모드 */}
          {viewAllChats ? (
            <>
              <div className="admin-embedding-page__card">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <h2 className="admin-embedding-page__card-title">전체 상담 통합 보기</h2>
                    <p className="admin-embedding-page__muted" style={{marginTop: 4}}>모든 병원의 상담 내역을 한 곳에서 확인합니다. ({allChatSessions.length}건)</p>
                  </div>
                  <button
                    className="btn-excel"
                    onClick={() => handleExcelExport()}
                    disabled={excelExporting}
                  >
                    {excelExporting ? '내보내는 중...' : '엑셀'}
                  </button>
                </div>
              </div>
              <div className="admin-embedding-page__chat-container">
                <div className="admin-embedding-page__chat-list-card">
                  <h3 className="admin-embedding-page__card-title">상담 목록</h3>
                  {allChatSessions.length === 0 ? (
                    <p className="admin-embedding-page__muted">대화 내역이 없습니다.</p>
                  ) : (
                    <div className="admin-embedding-page__table-wrapper">
                      <table className="admin-embedding-page__table admin-embedding-page__table--detailed">
                        <thead>
                          <tr>
                            <th>날짜</th>
                            <th>이름</th>
                            <th>성별</th>
                            <th>병원</th>
                            <th>검진일</th>
                            <th>연락처</th>
                            <th>메시지</th>
                            <th>관심사</th>
                            <th>위험</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allChatSessions.map(s => (
                            <tr key={s.session_id} className={selectedChat?.session_id === s.session_id ? 'is-selected' : ''} onClick={() => fetchChatDetail(s.session_id)}>
                              <td className="td-date">{formatDate(s.created_at)}</td>
                              <td className="td-name">{s.user_name || '-'}</td>
                              <td className="td-gender">{s.user_gender === 'F' ? '여' : s.user_gender === 'M' ? '남' : '-'}</td>
                              <td className="td-hospital">{s.hospital_name || '-'}</td>
                              <td className="td-date">{s.checkup_date || '-'}</td>
                              <td className="td-phone">{s.user_phone || '-'}</td>
                              <td className="td-count">{s.message_count}회</td>
                              <td className="td-tags">{renderTagChips(s.interest_tags, 'interest')}</td>
                              <td className="td-tags">{renderTagChips(s.risk_tags, 'risk')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="admin-embedding-page__chat-detail-card">
                  <div className="chat-detail-header">
                    <h3 className="admin-embedding-page__card-title">대화 상세</h3>
                    {selectedChat && (
                      <div className="chat-detail-tabs">
                        <button className={chatDetailTab === 'conversation' ? 'active' : ''} onClick={() => setChatDetailTab('conversation')}>대화 내역</button>
                        <button className={chatDetailTab === 'health' ? 'active' : ''} onClick={() => setChatDetailTab('health')}>검진 데이터</button>
                        <button className={chatDetailTab === 'tags' ? 'active' : ''} onClick={() => setChatDetailTab('tags')}>태그/분석</button>
                      </div>
                    )}
                  </div>
                  {selectedChat ? renderChatDetailContent(selectedChat) : (
                    <div className="admin-embedding-page__empty-chat">왼쪽 목록에서 대화를 선택하세요.</div>
                  )}
                </div>
              </div>
            </>
          ) : selectedHospitalId && selectedHospital ? (
            <>
              <div className="admin-embedding-page__card">
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <h2 className="admin-embedding-page__card-title">{selectedHospital.hospital_name}</h2>
                    <p className="admin-embedding-page__muted" style={{marginTop: 4}}>상담 내역 {chatSessions.length}건</p>
                  </div>
                  <div style={{display: 'flex', gap: 8}}>
                    <button
                      className="btn-excel"
                      onClick={() => handleExcelExport()}
                      disabled={excelExporting}
                    >
                      {excelExporting ? '...' : '엑셀'}
                    </button>
                    <button
                      className="admin-embedding-page__settings-btn"
                      onClick={() => setShowSettingsModal(true)}
                    >
                      설정
                    </button>
                  </div>
                </div>
              </div>
              {/* 상담 내역 (메인 영역) */}
              <div className="admin-embedding-page__chat-container">
                <div className="admin-embedding-page__chat-list-card">
                  <h3 className="admin-embedding-page__card-title" style={{margin: 0, marginBottom: 8}}>대화 목록</h3>
                  {chatSessions.length === 0 ? (
                    <p className="admin-embedding-page__muted">대화 내역이 없습니다.</p>
                  ) : (
                    <div className="admin-embedding-page__table-wrapper">
                      <table className="admin-embedding-page__table admin-embedding-page__table--detailed">
                        <thead>
                          <tr>
                            <th>날짜</th>
                            <th>이름</th>
                            <th>성별</th>
                            <th>검진일</th>
                            <th>연락처</th>
                            <th>메시지</th>
                            <th>태그</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chatSessions.map(s => (
                            <tr key={s.session_id} className={selectedChat?.session_id === s.session_id ? 'is-selected' : ''} onClick={() => fetchChatDetail(s.session_id)}>
                              <td className="td-date">{formatDate(s.created_at)}</td>
                              <td className="td-name">{s.user_name || '-'}</td>
                              <td className="td-gender">{s.user_gender === 'F' ? '여' : s.user_gender === 'M' ? '남' : '-'}</td>
                              <td className="td-date">{s.checkup_date || '-'}</td>
                              <td className="td-phone">{s.user_phone || '-'}</td>
                              <td className="td-count">{s.message_count}회</td>
                              <td className="td-tags">{renderTagChips([...(s.interest_tags || []), ...(s.risk_tags || [])].slice(0, 3), s.risk_tags?.length ? 'risk' : 'interest')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="admin-embedding-page__chat-detail-card">
                  <div className="chat-detail-header">
                    <h3 className="admin-embedding-page__card-title" style={{margin: 0}}>대화 상세</h3>
                    {selectedChat && (
                      <div className="chat-detail-tabs">
                        <button className={chatDetailTab === 'conversation' ? 'active' : ''} onClick={() => setChatDetailTab('conversation')}>대화 내역</button>
                        <button className={chatDetailTab === 'health' ? 'active' : ''} onClick={() => setChatDetailTab('health')}>검진 데이터</button>
                        <button className={chatDetailTab === 'tags' ? 'active' : ''} onClick={() => setChatDetailTab('tags')}>태그/분석</button>
                      </div>
                    )}
                  </div>
                  {selectedChat ? renderChatDetailContent(selectedChat) : (
                    <div className="admin-embedding-page__empty-chat">왼쪽 목록에서 대화를 선택하세요.</div>
                  )}
                </div>
              </div>
              {/* 설정 모달 (좌: 지침문서, 우: 환경설정 + RAG 테스트) */}
              {showSettingsModal && (
                <div className="admin-embedding-page__modal admin-embedding-page__modal--settings">
                  <div className="admin-embedding-page__modal-content admin-embedding-page__modal-content--wide">
                    <div className="admin-embedding-page__modal-header">
                      <h3>{selectedHospital.hospital_name} - 설정</h3>
                      <button className="admin-embedding-page__modal-close" onClick={() => setShowSettingsModal(false)}>×</button>
                    </div>
                    <div className="admin-embedding-page__modal-body admin-embedding-page__modal-body--split">
                      {/* 왼쪽 패널: 지침 문서 */}
                      <div className="admin-embedding-page__settings-left">
                        <div className="admin-embedding-page__panel-title">지침 문서</div>
                <div className="docs-redesign">
                  <div className="docs-stats">
                    <div className="docs-stats__item">
                      <span className="docs-stats__value">{docStats.totalDocs}</span>
                      <span className="docs-stats__label">전체 문서</span>
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

                  <div
                    className={`docs-scroll-area${isDragging ? ' docs-scroll-area--dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, 'hospital')}
                  >
                    {isDragging && (
                      <div className="docs-drop-overlay">
                        <div className="docs-drop-overlay__content">
                          <span className="docs-drop-overlay__icon">+</span>
                          <span>파일을 놓으면 업로드됩니다</span>
                        </div>
                      </div>
                    )}

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
                      </div>

                      {/* 가운데 패널: 환경설정 */}
                      <div className="admin-embedding-page__settings-center">
                        <div className="admin-embedding-page__panel-title">환경 설정</div>
                        <div className="admin-embedding-page__config-form">
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

                      {/* 오른쪽 패널: RAG 테스트 */}
                      <div className="admin-embedding-page__settings-right">
                        <div className="admin-embedding-page__panel-title">
                          RAG 테스트
                          <button className="admin-embedding-page__rag-reset-btn" onClick={() => { setChatMessages([]); setChatSessionId(null); }}>초기화</button>
                        </div>
                        <div className="admin-embedding-page__rag-chat-area">
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
                        <div className="admin-embedding-page__rag-input-row">
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
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="admin-embedding-page__empty-state">
              <h3>병원을 선택하세요</h3>
              <p className="admin-embedding-page__muted">왼쪽 사이드바에서 병원을 선택하거나 "전체 상담 통합 보기"를 클릭하세요.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default EmbeddingPage;
