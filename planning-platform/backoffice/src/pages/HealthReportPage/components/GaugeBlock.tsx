import React from 'react';
import { GaugeItem } from '../hooks/useMediarcApi';

interface GaugeBlockProps {
  gauges: Record<string, GaugeItem>;
}

type StatusLevel = 'normal' | 'warning' | 'danger';

function classifyStatus(range: string, value: number): StatusLevel {
  const lower = range.toLowerCase();
  if (lower.includes('이상') || lower.includes('abnormal')) return 'danger';
  if (lower.includes('경계') || lower.includes('border')) return 'warning';
  return 'normal';
}

const STATUS_STYLE: Record<StatusLevel, React.CSSProperties> = {
  normal: { color: '#059669', fontWeight: 600 },
  warning: { color: '#d97706', fontWeight: 600 },
  danger: { color: '#dc2626', fontWeight: 600 },
};

const STATUS_LABEL: Record<StatusLevel, string> = {
  normal: '정상',
  warning: '경계',
  danger: '이상',
};

export default function GaugeBlock({ gauges }: GaugeBlockProps) {
  if (!gauges || Object.keys(gauges).length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        수치 데이터가 없습니다.
      </p>
    );
  }

  const entries = Object.entries(gauges);

  return (
    <table
      className="report-view__gauge-table"
      style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
      data-testid="gauge-block"
    >
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          <th
            style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}
          >
            항목
          </th>
          <th
            style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}
          >
            수치
          </th>
          <th
            style={{
              padding: '6px 8px',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            판정
          </th>
          <th
            style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}
          >
            정상 범위
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, item]) => {
          const status = classifyStatus(item.range, item.value);
          return (
            <tr
              key={key}
              style={{ borderTop: '1px solid #f3f4f6' }}
            >
              <td style={{ padding: '6px 8px' }}>{item.label || key}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                {item.value}
              </td>
              <td
                style={{ padding: '6px 8px', textAlign: 'center', ...STATUS_STYLE[status] }}
              >
                {STATUS_LABEL[status]}
              </td>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>
                {item.range}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
