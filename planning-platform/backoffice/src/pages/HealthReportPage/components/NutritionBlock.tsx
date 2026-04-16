/**
 * NutritionBlock — NutritionSection 래퍼
 *
 * AppendixBlock에서 기존과 동일한 인터페이스로 호출.
 * 내부 렌더링은 NutritionSection / NutritionCard에 위임.
 * 기존 data-test 셀렉터(nutrition-{key}-label, nutrition-{key}-advice) 유지.
 */
import React from 'react';
import { NutrientItem } from '../hooks/useMediarcApi';
import NutritionSection from './NutritionSection';

interface NutritionBlockProps {
  nutrition: {
    recommend?: NutrientItem[] | null;
    caution?: NutrientItem[] | null;
  } | null;
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
    <div data-testid="nutrition-block">
      <NutritionSection recommend={recommend} caution={caution} />
    </div>
  );
}
