/**
 * 발송 이력 테이블
 * - 고객명 포함 (phone 기반 mdx_agr_list 조회 or 변수에서)
 * - 발송일시, 수신번호, 템플릿, 결과, 상세
 */
import React from 'react';

interface HistoryItem {
  SN: string;
  phone: string;
  template_code: string;
  message_content?: string;
  request_datetime: string;
  subject?: string;
  result_code?: string;
  result_message?: string;
  is_success: boolean;
  source?: string;
}

interface Props {
  history: HistoryItem[];
  loading: boolean;
}

const formatDateTime = (dtm: string) => {
  if (!dtm || dtm.length !== 14) return dtm || '-';
  return `${dtm.slice(0, 4)}-${dtm.slice(4, 6)}-${dtm.slice(6, 8)} ${dtm.slice(8, 10)}:${dtm.slice(10, 12)}`;
};

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 8) return phone || '-';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
};

const HistoryTable: React.FC<Props> = ({ history, loading }) => {
  const successCount = history.filter(h => h.is_success).length;
  const failCount = history.filter(h => !h.is_success).length;

  return (
    <div className="history-table">
      <div className="cdm-page__kpi">
        <div className="cdm-page__kpi-card">
          <span className="cdm-page__kpi-label">전체 발송</span>
          <span className="cdm-page__kpi-value">{history.length}<small>건</small></span>
        </div>
        <div className="cdm-page__kpi-card">
          <span className="cdm-page__kpi-label">성공</span>
          <span className="cdm-page__kpi-value" style={{ color: '#059669' }}>{successCount}<small>건</small></span>
        </div>
        <div className="cdm-page__kpi-card">
          <span className="cdm-page__kpi-label">실패</span>
          <span className="cdm-page__kpi-value" style={{ color: '#dc2626' }}>{failCount}<small>건</small></span>
        </div>
      </div>

      {loading && <p className="empty-state__text">로딩 중...</p>}

      <div className="table-scroll-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>발송일시</th>
              <th>수신번호</th>
              <th>템플릿</th>
              <th>결과</th>
              <th>상세</th>
              <th>출처</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={h.SN || i}>
                <td>{formatDateTime(h.request_datetime)}</td>
                <td>{maskPhone(h.phone)}</td>
                <td><span className="badge">{h.template_code || '-'}</span></td>
                <td>
                  {h.is_success
                    ? <span className="badge badge--success">성공</span>
                    : <span className="badge badge--danger">{h.result_code || '실패'}</span>
                  }
                </td>
                <td className="history-table__detail">{h.result_message || '-'}</td>
                <td><span className="badge badge--muted">{h.source || '-'}</span></td>
              </tr>
            ))}
            {history.length === 0 && !loading && (
              <tr><td colSpan={6} className="empty-state__text">발송 이력이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;
