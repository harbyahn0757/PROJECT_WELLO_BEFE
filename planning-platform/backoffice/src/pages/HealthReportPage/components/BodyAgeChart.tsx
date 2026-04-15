import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';

interface BodyAgeChartProps {
  ages: Record<string, number>;
}

const ORGAN_LABEL_MAP: Record<string, string> = {
  CKD: '콩팥',
  고혈압: '고혈압',
  뇌혈관: '뇌혈관',
  당뇨: '당뇨',
  대사: '대사',
  심혈관: '심혈관',
  알츠: '알츠하이머',
};

function resolveLabel(key: string): string {
  return ORGAN_LABEL_MAP[key] ?? key;
}

export default function BodyAgeChart({ ages }: BodyAgeChartProps) {
  if (!ages || Object.keys(ages).length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>데이터가 없습니다.</p>
    );
  }

  const data = Object.entries(ages)
    .map(([key, value]) => ({ name: resolveLabel(key), value }))
    .sort((a, b) => b.value - a.value);

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div data-testid="body-age-chart">
      <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 32, bottom: 4, left: 60 }}
        >
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxVal * 1.1)]}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={56}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}세`, '추정 건강나이']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.value > 50 ? '#dc2626' : '#4299e1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
