/**
 * 건강 카테고리 데이터 처리 유틸리티
 * Tilko 건강검진 데이터를 카테고리별로 그룹핑하고 상태를 판정합니다.
 */

import { TilkoHealthCheckupRaw, TilkoTestItem } from '../types/health';
import { 
  CategoryData, 
  CategoryItem, 
  CategoryDefinition,
  CategoryStatus,
  ItemStatus 
} from '../types/category';
import { HEALTH_CATEGORIES, CATEGORY_ICONS } from './healthItemsConfig';
import { isInRange, determineBloodPressureStatus, matchesStringValue } from './rangeUtils';

// 하위 호환성을 위해 HEALTH_CATEGORIES를 다시 export
export { HEALTH_CATEGORIES, CATEGORY_ICONS };

// ============================================================================
// 메인 처리 함수
// ============================================================================

/**
 * Tilko 건강검진 데이터를 카테고리별로 처리
 * @param healthData - Tilko 건강검진 원본 데이터 배열
 * @param year - 필터링할 연도 (선택사항)
 * @returns 카테고리별 데이터 배열
 */
export function processHealthDataToCategories(
  healthData: TilkoHealthCheckupRaw[],
  year?: string,
  gender: string = 'M'
): CategoryData[] {
  // 1. 연도 필터링
  const filteredData = year 
    ? healthData.filter(d => d.Year === year || d.Year === `${year}년`)
    : healthData;
  
  // 2. 최신 데이터 선택 (첫 번째 항목)
  const latestData = filteredData[0];
  if (!latestData) {
    console.warn('[CategoryDataProcessor] 처리할 건강검진 데이터가 없습니다.');
    return [];
  }
  
  // 3. 카테고리별 그룹핑
  const categories = Object.values(HEALTH_CATEGORIES).map(catDef => {
    const items: CategoryItem[] = [];
    let cautionCount = 0;
    
    // Inspections 순회
    if (latestData.Inspections && Array.isArray(latestData.Inspections)) {
      latestData.Inspections.forEach(inspection => {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          inspection.Illnesses.forEach(illness => {
            // 이 Illness가 현재 카테고리에 속하는지 확인
            if (catDef.illnesses.includes(illness.Name)) {
              if (illness.Items && Array.isArray(illness.Items)) {
                illness.Items.forEach(item => {
                  const itemStatus = determineItemStatus(item, gender);
                  
                  // 주의 항목 카운트
                  if (itemStatus === 'abnormal' || itemStatus === 'borderline') {
                    cautionCount++;
                  }
                  
                  items.push({
                    name: item.Name,
                    value: item.Value,
                    unit: item.Unit,
                    status: itemStatus,
                    refName: getReferenceName(item)
                  });
                });
              }
            }
          });
        }
      });
    }
    
    // 상태 결정
    const status: CategoryStatus = items.length === 0 
      ? 'no_data' 
      : cautionCount > 0 
        ? 'caution' 
        : 'normal';
    
    return {
      id: catDef.id,
      name: catDef.name,
      status,
      itemsCount: items.length,
      cautionCount,
      items,
      judgment: latestData.Code,        // 정상, 질환의심 등
      description: latestData.Description
    };
  });
  
  return categories;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 항목 상태 판정 (검진추이 TrendsSection과 100% 동일)
 * @param item - 검사 항목 데이터
 * @param gender - 성별 ('M' | 'F')
 * @returns 상태 ('normal' | 'borderline' | 'abnormal')
 * 
 * 판정 우선순위:
 * 1. 질환의심 범위 체크 → abnormal
 * 2. 경계 범위 체크 (정상(B), 정상(경계)) → borderline
 * 3. 정상 범위 체크 (정상, 정상(A)) → normal
 * 4. 정상 범위가 없으면 → normal (역방향 판정)
 */
function determineItemStatus(item: TilkoTestItem, gender: string = 'M'): ItemStatus {
  if (!item.ItemReferences || !Array.isArray(item.ItemReferences) || item.ItemReferences.length === 0) {
    return 'normal';
  }
  
  // 특수 케이스 1: 혈압(최고/최저) 복합값 처리
  if (item.Name === '혈압(최고/최저)' || item.Name.includes('혈압')) {
    if (item.Value && item.Value.includes('/')) {
      return determineBloodPressureStatus(item.Value, item.ItemReferences, gender);
    }
  }
  
  // 특수 케이스 2: 빈 값
  if (!item.Value || item.Value.trim() === '') {
    return 'normal';
  }
  
  const itemValue = parseFloat(item.Value);
  
  // 특수 케이스 3: 문자열 값 (숫자가 아닌 경우)
  if (isNaN(itemValue)) {
    // 문자열 값 매칭 (요단백 "음성", 폐결핵 "정상" 등)
    for (const ref of item.ItemReferences) {
      if (ref.Value && matchesStringValue(item.Value, ref.Value)) {
        if (ref.Name === '질환의심' || ref.Name?.includes('질환의심') || ref.Name?.includes('이상')) {
          return 'abnormal';
        }
        if (ref.Name === '정상' || ref.Name === '정상(A)') {
          return 'normal';
        }
        if (ref.Name === '정상(B)' || ref.Name === '정상(경계)') {
          return 'borderline';
        }
      }
    }
    return 'normal';
  }
  
  // 일반 케이스: 숫자 값 (검진추이와 100% 동일)
  // 판정 우선순위: 질환의심 > 경계 > 정상(명시) > 정상(기본)
  
  // 1. 질환의심 범위 체크 (최우선)
  const abnormalRef = item.ItemReferences.find(r => r.Name === '질환의심');
  if (abnormalRef && abnormalRef.Value && isInRange(itemValue, abnormalRef.Value, gender)) {
    return 'abnormal';
  }
  
  // 2. 경계 범위 체크
  const borderlineRef = item.ItemReferences.find(r => 
    r.Name === '정상(B)' || r.Name === '정상(경계)'
  );
  if (borderlineRef && borderlineRef.Value && isInRange(itemValue, borderlineRef.Value, gender)) {
    return 'borderline';
  }
  
  // 3. 정상 범위 체크 (명시된 경우)
  const normalRef = item.ItemReferences.find(r => 
    r.Name === '정상' || r.Name === '정상(A)'
  );
  if (normalRef && normalRef.Value && isInRange(itemValue, normalRef.Value, gender)) {
    return 'normal';
  }
  
  // 4. 정상 범위가 명시되지 않은 경우
  // 질환의심/경계 범위에 해당하지 않으면 정상으로 판정
  // (예: 크레아티닌, AST, ALT 등은 정상 범위가 없고 비정상 범위만 명시)
  return 'normal';
}

/**
 * ItemReferences에서 대표 Name 추출
 * @param item - 검사 항목 데이터
 * @returns 대표 상태 이름 (예: "정상", "질환의심")
 */
function getReferenceName(item: TilkoTestItem): string | undefined {
  if (!item.ItemReferences || !Array.isArray(item.ItemReferences)) {
    return undefined;
  }
  
  // 우선순위: 질환의심 > 경계 > 정상
  const abnormalRef = item.ItemReferences.find(r => 
    r.Name?.includes('질환의심') || r.Name?.includes('이상')
  );
  if (abnormalRef) return abnormalRef.Name;
  
  const borderlineRef = item.ItemReferences.find(r => 
    r.Name?.includes('정상(B)') || r.Name?.includes('경계')
  );
  if (borderlineRef) return borderlineRef.Name;
  
  const normalRef = item.ItemReferences.find(r => 
    r.Name?.includes('정상')
  );
  if (normalRef) return normalRef.Name;
  
  return undefined;
}

/**
 * 카테고리 상태 결정
 * @param items - 카테고리 항목 배열
 * @returns 카테고리 상태
 */
export function getCategoryStatus(items: CategoryItem[]): CategoryStatus {
  const cautionCount = items.filter(
    item => item.status === 'abnormal' || item.status === 'borderline'
  ).length;
  
  if (items.length === 0) return 'no_data';
  if (cautionCount > 0) return 'caution';
  return 'normal';
}

/**
 * 카테고리 이름으로 정의 찾기
 * @param categoryId - 카테고리 ID
 * @returns 카테고리 정의 또는 undefined
 */
export function getCategoryDefinition(categoryId: string): CategoryDefinition | undefined {
  return Object.values(HEALTH_CATEGORIES).find(cat => cat.id === categoryId);
}

/**
 * 모든 카테고리 ID 목록 반환
 * @returns 카테고리 ID 배열
 */
export function getAllCategoryIds(): string[] {
  return Object.values(HEALTH_CATEGORIES).map(cat => cat.id);
}

/**
 * 카테고리 개수 반환
 * @returns 카테고리 개수
 */
export function getCategoryCount(): number {
  return Object.keys(HEALTH_CATEGORIES).length;
}
