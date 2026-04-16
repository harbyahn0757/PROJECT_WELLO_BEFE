/**
 * NutritionSection — 추천 / 주의 탭 + 카드 목록
 *
 * 스펙: nutrition-rag-phase1-spec.md §5-4
 * - 추천/주의 탭 전환
 * - 각 항목을 NutritionCard 로 렌더
 * - 하단 Disclosure: 추천 방법론 설명
 * - 하위 호환: recommend/caution 없으면 빈 상태 표시
 */
import React, { useState } from 'react';
import { NutrientItem } from '../hooks/useMediarcApi';
import NutritionCard, { NutritionCardItem } from './NutritionCard';
import Disclosure from './Disclosure';

// NutrientItem -> NutritionCardItem 변환 (하위 호환)
function toCardItem(item: NutrientItem): NutritionCardItem {
  return {
    name: item.name,
    tag: item.tag,
    desc: item.desc,
    // 확장 필드: BE가 보내면 사용, 없으면 undefined
    evidence: (item as any).evidence,
    dosage: (item as any).dosage,
    caution_text: (item as any).caution_text,
    priority: (item as any).priority,
  };
}

interface NutritionSectionProps {
  recommend: NutrientItem[];
  caution: NutrientItem[];
}

type TabType = 'recommend' | 'caution';

const TAB_LABELS: Record<TabType, string> = {
  recommend: '추천',
  caution: '주의',
};

export default function NutritionSection({ recommend, caution }: NutritionSectionProps) {
  const hasCaution = caution.length > 0;
  const [activeTab, setActiveTab] = useState<TabType>('recommend');

  const tabBtnStyle = (tab: TabType): React.CSSProperties => ({
    padding: '4px 14px',
    fontSize: '13px',
    fontWeight: activeTab === tab ? 700 : 400,
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    background: activeTab === tab
      ? (tab === 'caution' ? '#dc2626' : '#059669')
      : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#4a5568',
    transition: 'background 0.15s, color 0.15s',
  });

  const currentItems =
    activeTab === 'recommend'
      ? recommend.map(toCardItem)
      : caution.map(toCardItem);

  const isEmpty = currentItems.length === 0;

  return (
    <div
      className="report-view__nutrition-section"
      data-testid="nutrition-section"
    >
      {/* 제목 + 탭 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#7c746a',
          }}
        >
          맞춤 영양제 추천
        </h4>

        {/* 탭 — 주의 탭은 항목이 있을 때만 표시 */}
        {hasCaution && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['recommend', 'caution'] as TabType[]).map((tab) => (
              <button
                key={tab}
                style={tabBtnStyle(tab)}
                onClick={() => setActiveTab(tab)}
                aria-pressed={activeTab === tab}
                data-testid={`nutrition-tab-${tab}`}
              >
                {TAB_LABELS[tab]}
                {tab === 'recommend' && recommend.length > 0 && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      padding: '0 5px',
                    }}
                  >
                    {recommend.length}
                  </span>
                )}
                {tab === 'caution' && caution.length > 0 && (
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      padding: '0 5px',
                    }}
                  >
                    {caution.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 카드 목록 */}
      {isEmpty ? (
        <p style={{ fontSize: '13px', color: '#a0aec0', textAlign: 'center', padding: '20px 0' }}>
          {activeTab === 'recommend' ? '추천 영양소가 없습니다.' : '주의 영양소가 없습니다.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '10px',
          }}
        >
          {currentItems.map((card, i) => (
            <NutritionCard
              key={card.name || i}
              item={card}
              idx={i}
              variant={activeTab}
            />
          ))}
        </div>
      )}

      {/* 하단 Disclosure — 방법론 */}
      <div style={{ marginTop: '12px' }}>
        <Disclosure title="이 추천은 어떻게 만들어졌나요?" defaultOpen={false}>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096', lineHeight: '1.7' }}>
            검진 수치와 질환 위험도를 분석하고, 식약처 인정 기능성 원료 데이터베이스와
            학회 가이드라인을 기반으로 에비던스를 확인했습니다.
            의학적 판단을 대체하지 않으며, 전문의 상담을 권장합니다.
          </p>
        </Disclosure>
      </div>
    </div>
  );
}
