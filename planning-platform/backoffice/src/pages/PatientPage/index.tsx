import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getApiBase, fetchWithAuth } from '../../utils/api';
import { downloadJson, dateSuffix } from '../../utils/excelExport';
import './styles.scss';

const API = getApiBase();

interface Patient {
  web_app_key: string;
  chat_count: number;
  survey_count: number;
  last_activity: string | null;
  hospital_name: string;
}

/** web_app_key 마스킹: 앞 4자리 + ****  + 뒤 4자리 */
const maskKey = (key: string) => {
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
};

const PatientPage: React.FC = () => {
  useAuth();
  const [searchParams] = useSearchParams();
  const hospitalId = searchParams.get('hospital_id') || '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`${API}/partner-office/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospital_id: hospitalId || null }),
    })
      .then(r => r.json())
      .then(d => {
        setPatients(d.patients || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const filtered = search
    ? patients.filter(p =>
        p.web_app_key.toLowerCase().includes(search.toLowerCase()) ||
        p.hospital_name.toLowerCase().includes(search.toLowerCase())
      )
    : patients;

  return (
    <div className="patient-page">
      <div className="patient-page__toolbar">
        <input
          className="patient-page__search"
          type="text"
          placeholder="web_app_key 또는 병원명 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="patient-page__count">
          총 {filtered.length.toLocaleString()}명{search && ` / ${total.toLocaleString()}`}
        </span>
        <button
          className="btn-excel"
          onClick={() => downloadJson({ exported_at: new Date().toISOString(), patients: filtered }, `환자목록_${dateSuffix()}.json`)}
          disabled={loading}
        >JSON</button>
        {loading && <span className="patient-page__loading">로딩...</span>}
      </div>

      <div className="patient-page__table-wrap">
        <table className="data-table data-table--sticky-header">
          <thead>
            <tr>
              <th>#</th>
              <th>web_app_key</th>
              <th>상담 건수</th>
              <th>서베이 건수</th>
              <th>최근 활동</th>
              <th>병원</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#718096' }}>데이터가 없습니다</td></tr>
            )}
            {filtered.map((p, i) => (
              <tr key={p.web_app_key}>
                <td>{i + 1}</td>
                <td className="patient-page__key">{maskKey(p.web_app_key)}</td>
                <td>{p.chat_count.toLocaleString()}</td>
                <td>{p.survey_count.toLocaleString()}</td>
                <td>{p.last_activity ? p.last_activity.slice(0, 16).replace('T', ' ') : '-'}</td>
                <td>{p.hospital_name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatientPage;
