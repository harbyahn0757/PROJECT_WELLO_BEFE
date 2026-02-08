/**
 * 백오피스 - 병원별 RAG 임베딩 관리 (PC)
 * 디자인: frontend/src/styles/_variables.scss 토큰 사용
 */
import React, { useEffect, useState, useCallback } from 'react';
import './styles.scss';

// welno.kindhabit.com은 /welno-api/ 로만 API가 열려 있음
const getEmbeddingApiBase = (): string => {
  if (typeof window === 'undefined') return '/api/v1/admin/embedding';
  return window.location.hostname === 'welno.kindhabit.com'
    ? '/welno-api/v1/admin/embedding'
    : '/api/v1/admin/embedding';
};
const API_BASE = getEmbeddingApiBase();

interface HospitalItem {
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

const AdminEmbeddingPage: React.FC = () => {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hospitals`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setHospitals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '병원 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async (hospitalId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/documents`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '문서 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  useEffect(() => {
    if (selectedId) fetchDocuments(selectedId);
    else setDocuments([]);
  }, [selectedId, fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedId || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/hospitals/${selectedId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchDocuments(selectedId);
      await fetchHospitals();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRebuild = async () => {
    if (!selectedId) return;
    setRebuilding(selectedId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hospitals/${selectedId}/rebuild`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      await fetchHospitals();
    } catch (err) {
      setError(err instanceof Error ? err.message : '재구축 트리거 실패');
    } finally {
      setRebuilding(null);
    }
  };

  const selected = hospitals.find((h) => h.hospital_id === selectedId);

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
          <h2 className="admin-embedding-page__sidebar-title">병원 목록</h2>
          {loading && !documents.length ? (
            <p className="admin-embedding-page__muted">로딩 중...</p>
          ) : (
            <ul className="admin-embedding-page__hospital-list">
              {hospitals.map((h) => (
                <li key={h.hospital_id}>
                  <button
                    type="button"
                    className={`admin-embedding-page__hospital-btn ${selectedId === h.hospital_id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(h.hospital_id)}
                  >
                    <span className="admin-embedding-page__hospital-name">{h.hospital_name}</span>
                    <span className="admin-embedding-page__hospital-meta">
                      {h.has_embedding ? '✓ 인덱스' : ''} {h.document_count ? `문서 ${h.document_count}개` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="admin-embedding-page__main">
          {selectedId && selected && (
            <>
              <div className="admin-embedding-page__card">
                <h2 className="admin-embedding-page__card-title">{selected.hospital_name}</h2>
                <p className="admin-embedding-page__muted">hospital_id: {selected.hospital_id}</p>
                <div className="admin-embedding-page__actions">
                  <label className="admin-embedding-page__upload-btn">
                    <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} disabled={uploading} />
                    {uploading ? '업로드 중...' : '문서 업로드'}
                  </label>
                  <button
                    type="button"
                    className="admin-embedding-page__rebuild-btn"
                    onClick={handleRebuild}
                    disabled={!!rebuilding}
                  >
                    {rebuilding === selectedId ? '재구축 요청 중...' : '인덱스 재구축'}
                  </button>
                </div>
              </div>
              <div className="admin-embedding-page__card">
                <h3 className="admin-embedding-page__card-title">업로드된 문서</h3>
                {documents.length === 0 ? (
                  <p className="admin-embedding-page__muted">문서가 없습니다. 위에서 업로드하세요.</p>
                ) : (
                  <ul className="admin-embedding-page__doc-list">
                    {documents.map((d) => (
                      <li key={d.name}>
                        <span>{d.name}</span>
                        <span className="admin-embedding-page__muted">
                          {(d.size_bytes / 1024).toFixed(1)} KB {d.uploaded_at ? `· ${d.uploaded_at.slice(0, 10)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          {!selectedId && (
            <p className="admin-embedding-page__muted">왼쪽에서 병원을 선택하세요.</p>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminEmbeddingPage;
