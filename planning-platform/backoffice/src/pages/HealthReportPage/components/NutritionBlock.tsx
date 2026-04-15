import React from 'react';
import { NutrientItem } from '../hooks/useMediarcApi';

interface NutritionBlockProps {
  nutrition: {
    recommend?: NutrientItem[] | null;
    caution?: NutrientItem[] | null;
  } | null;
}

function NutrientCard({ item }: { item: NutrientItem }) {
  return (
    <div className="report-view__nutrition-card" data-testid="nutrient-card">
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          padding: '1px 6px',
          borderRadius: '4px',
          background: '#e5e7eb',
          color: '#374151',
          marginBottom: '4px',
        }}
      >
        {item.tag}
      </span>
      <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '14px' }}>
        {item.name}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
        {item.desc}
      </p>
    </div>
  );
}

export default function NutritionBlock({ nutrition }: NutritionBlockProps) {
  if (!nutrition) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        영양 데이터가 없습니다.
      </p>
    );
  }

  const recommend = nutrition.recommend ?? [];
  const caution = nutrition.caution ?? [];

  if (recommend.length === 0 && caution.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        영양 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="report-view__nutrition-grid" data-testid="nutrition-block">
      {recommend.length > 0 && (
        <div>
          <h4
            style={{
              fontSize: '13px',
              color: '#059669',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            추천 영양소
          </h4>
          {recommend.map((item, i) => (
            <NutrientCard key={i} item={item} />
          ))}
        </div>
      )}
      {caution.length > 0 && (
        <div>
          <h4
            style={{
              fontSize: '13px',
              color: '#d97706',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            주의 영양소
          </h4>
          {caution.map((item, i) => (
            <NutrientCard key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
