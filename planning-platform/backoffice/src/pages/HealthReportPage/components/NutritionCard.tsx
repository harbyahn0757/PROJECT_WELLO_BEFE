/**
 * NutritionCard — 단일 영양소 카드 (recommend / caution 공용)
 *
 * 스펙: nutrition-rag-phase1-spec.md §5-3, §5-5, §5-6
 * - EvidenceBadge (식약처/학회권고/연구근거/없음)
 * - Disclosure 펼침 (에비던스 + 용량 + 약물 주의)
 * - caution 카드: 왼쪽 빨간 보더 + 연분홍 배경
 * - 하위 호환: evidence/dosage/caution_text 없으면 desc만 표시
 */
import React from 'react';
import Disclosure from './Disclosure';

// ── 타입 ──

export interface EvidenceInfo {
  source: string;
  type: 'official' | 'research' | 'guideline';
}

export interface NutritionCardItem {
  name: string;
  tag: string;
  desc: string;
  evidence?: EvidenceInfo;
  dosage?: string;
  caution_text?: string;
  priority?: number;
}

interface NutritionCardProps {
  item: NutritionCardItem;
  idx: number;
  variant?: 'recommend' | 'caution';
}

// ── 에비던스 배지 ──

const BADGE_MAP: Record<
  string,
  { text: string; bg: string; color: string }
> = {
  official:   { text: '식약처 인정', bg: '#2563EB', color: '#fff' },
  guideline:  { text: '학회 권고',   bg: '#059669', color: '#fff' },
  research:   { text: '연구 근거',   bg: '#7C3AED', color: '#fff' },
};

function EvidenceBadge({ evidence }: { evidence?: EvidenceInfo }) {
  const style = evidence ? BADGE_MAP[evidence.type] : null;
  if (!style) {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '10px',
          padding: '1px 6px',
          borderRadius: '4px',
          background: '#e2e8f0',
          color: '#4a5568',
        }}
      >
        참고 정보
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        background: style.bg,
        color: style.color,
      }}
    >
      {style.text}
    </span>
  );
}

// ── 용량/타이밍 텍스트 ──

function DosageChip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '12px',
        background: '#f7fafc',
        border: '1px solid #e2e8f0',
        color: '#4a5568',
      }}
    >
      {text}
    </span>
  );
}

// ── 메인 카드 ──

export default function NutritionCard({ item, idx, variant = 'recommend' }: NutritionCardProps) {
  const key = item.name ? item.name.replace(/\s+/g, '-') : `item-${idx}`;
  const isCaution = variant === 'caution';

  const cardStyle: React.CSSProperties = isCaution
    ? {
        borderLeft: '4px solid #dc2626',
        background: 'rgba(220, 38, 38, 0.05)',
        borderRadius: '8px',
        padding: '12px 14px',
        border: '1px solid #fca5a5',
        borderLeftWidth: '4px',
      }
    : {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 14px',
      };

  const hasDetail = !!(item.evidence?.source || item.dosage || item.caution_text);

  return (
    <div
      style={{ ...cardStyle, marginBottom: '8px' }}
      data-testid="nutrient-card"
    >
      {/* 상단: 배지 + 주의 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        {isCaution ? (
          <span
            style={{
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#dc2626',
              color: '#fff',
            }}
          >
            !&nbsp;주의
          </span>
        ) : (
          <EvidenceBadge evidence={item.evidence} />
        )}
      </div>

      {/* 영양소 이름 */}
      <p
        style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '15px', color: '#4a5568' }}
        data-test={`nutrition-${key}-label`}
      >
        {item.name}
      </p>

      {/* 태그 */}
      {item.tag && (
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '10px',
            background: isCaution ? '#fca5a5' : '#e2e8f0',
            color: isCaution ? '#7f1d1d' : '#4a5568',
            marginBottom: '6px',
          }}
        >
          {item.tag}
        </span>
      )}

      {/* GPT 스토리텔링 or 기존 desc */}
      <p
        style={{ margin: '4px 0 8px', fontSize: '13px', color: '#718096', lineHeight: '1.6' }}
        data-test={`nutrition-${key}-advice`}
      >
        {item.desc}
      </p>

      {/* 용량 칩 */}
      {item.dosage && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <DosageChip text={item.dosage} />
        </div>
      )}

      {/* Disclosure — 에비던스 상세 */}
      {hasDetail && (
        <Disclosure title="상세 보기" defaultOpen={false}>
          <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: '1.7', paddingTop: '4px' }}>
            {item.evidence?.source && (
              <p style={{ margin: '0 0 4px' }}>
                <span style={{ fontWeight: 600 }}>출처:</span> {item.evidence.source}
              </p>
            )}
            {item.dosage && (
              <p style={{ margin: '0 0 4px' }}>
                <span style={{ fontWeight: 600 }}>권장 용량:</span> {item.dosage}
              </p>
            )}
            {item.caution_text && (
              <p style={{ margin: '0', color: '#dc2626' }}>
                <span style={{ fontWeight: 600 }}>주의:</span> {item.caution_text}
              </p>
            )}
          </div>
        </Disclosure>
      )}
    </div>
  );
}
