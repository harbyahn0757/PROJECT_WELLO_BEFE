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

// ============================================================================
// 카테고리 정의
// ============================================================================

export const HEALTH_CATEGORIES: Record<string, CategoryDefinition> = {
  BODY: { 
    id: 'body', 
    name: '신체', 
    illnesses: ['비만', '저체중'],
    icon: '🏃'
  },
  BLOOD_PRESSURE: { 
    id: 'blood_pressure', 
    name: '혈압', 
    illnesses: ['고혈압', '저혈압'],
    icon: '🩺'
  },
  KIDNEY: { 
    id: 'kidney', 
    name: '신장', 
    illnesses: ['신장질환', '신기능이상'],
    icon: '🫘'
  },
  ANEMIA: { 
    id: 'anemia', 
    name: '빈혈', 
    illnesses: ['빈혈'],
    icon: '🩸'
  },
  DIABETES: { 
    id: 'diabetes', 
    name: '혈당', 
    illnesses: ['당뇨병', '공복혈당장애'],
    icon: '🍬'
  },
  CHOLESTEROL: { 
    id: 'cholesterol', 
    name: '콜레스테롤', 
    illnesses: ['이상지질혈증', '고지혈증'],
    icon: '🧪'
  },
  LIVER: { 
    id: 'liver', 
    name: '간', 
    illnesses: ['간장질환', '간기능이상'],
    icon: '🫀'
  },
  LUNG: { 
    id: 'lung', 
    name: '폐', 
    illnesses: ['폐결핵', '흉부질환', '폐질환'],
    icon: '🫁'
  },
  BONE: { 
    id: 'bone', 
    name: '골다공증', 
    illnesses: ['골다공증'],
    icon: '🦴'
  }
};

// 카테고리 아이콘 매핑 (재사용)
export const CATEGORY_ICONS: Record<string, string> = Object.values(HEALTH_CATEGORIES).reduce(
  (acc, cat) => ({ ...acc, [cat.id]: cat.icon || '' }),
  {}
);

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
  year?: string
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
                  const itemStatus = determineItemStatus(item);
                  
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
 * 항목 상태 판정
 * @param item - 검사 항목 데이터
 * @returns 상태 ('normal' | 'borderline' | 'abnormal')
 * 
 * 판정 우선순위 (검진추이 TrendsSection과 동일):
 * 1. 질환의심 범위 체크 → abnormal
 * 2. 정상 범위 체크 → normal
 * 3. 경계 범위 체크 → borderline
 * 4. 범위 외 → normal (기본값)
 */
function determineItemStatus(item: TilkoTestItem): ItemStatus {
  if (!item.ItemReferences || !Array.isArray(item.ItemReferences)) {
    return 'normal'; // ItemReferences 없으면 기본 정상
  }
  
  const itemValue = parseFloat(item.Value);
  if (isNaN(itemValue)) {
    return 'normal'; // 숫자가 아닌 값은 기본 정상 처리
  }
  
  // 1. 질환의심 범위 체크 (최우선)
  const abnormalRef = item.ItemReferences.find(r => 
    r.Name === '질환의심' || 
    r.Name?.includes('질환의심') || 
    r.Name?.includes('이상')
  );
  if (abnormalRef && abnormalRef.Value) {
    const range = parseRange(abnormalRef.Value);
    if (range && isInRange(itemValue, range)) {
      return 'abnormal';
    }
  }
  
  // 2. 정상 범위 체크 (두 번째 우선순위)
  // 정상, 정상(A), 정상(B) 모두 포함 (검진추이와 동일)
  const normalRef = item.ItemReferences.find(r => 
    r.Name === '정상' || 
    r.Name === '정상(A)' || 
    r.Name === '정상(B)' || 
    r.Name?.includes('정상')
  );
  if (normalRef && normalRef.Value) {
    const range = parseRange(normalRef.Value);
    if (range && isInRange(itemValue, range)) {
      return 'normal'; // 정상 범위 내면 정상
    }
  }
  
  // 3. 경계 범위 체크 (세 번째 우선순위)
  const borderlineRef = item.ItemReferences.find(r => 
    r.Name === '정상(B)' || 
    r.Name?.includes('정상(B)') || 
    r.Name?.includes('경계')
  );
  if (borderlineRef && borderlineRef.Value) {
    const range = parseRange(borderlineRef.Value);
    if (range && isInRange(itemValue, range)) {
      return 'borderline';
    }
  }
  
  // 4. 범위에 해당 없으면 기본 정상 (검진추이와 동일)
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
 * 범위 문자열 파싱
 * @param rangeStr - 범위 문자열 (예: "13-16.5", "120미만", "남: 13-16.5 / 여: 12-15.5")
 * @param gender - 성별 ('M' | 'F')
 * @returns { min, max } 또는 null
 */
function parseRange(
  rangeStr: string, 
  gender: string = 'M'
): { min: number; max: number } | null {
  if (!rangeStr) return null;
  
  try {
    // 성별 구분 처리
    if (rangeStr.includes('남') && rangeStr.includes('여')) {
      const parts = rangeStr.split('/');
      const targetPart = gender === 'M' 
        ? parts.find(p => p.includes('남'))?.trim()
        : parts.find(p => p.includes('여'))?.trim();
      
      if (targetPart) {
        const cleanRange = targetPart.replace(/남:|여:/, '').trim();
        return parseSimpleRange(cleanRange);
      }
    }
    
    // 단순 범위 파싱
    return parseSimpleRange(rangeStr);
  } catch (error) {
    console.warn('[parseRange] 범위 파싱 실패:', rangeStr, error);
    return null;
  }
}

/**
 * 단순 범위 문자열 파싱
 * @param rangeStr - 범위 문자열 (예: "13-16.5", "120미만")
 * @returns { min, max } 또는 null
 */
function parseSimpleRange(rangeStr: string): { min: number; max: number } | null {
  const cleaned = rangeStr.trim();
  
  // "120미만" 형태
  if (cleaned.includes('미만')) {
    const value = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
    if (!isNaN(value)) {
      return { min: -Infinity, max: value };
    }
  }
  
  // "120이상" 형태
  if (cleaned.includes('이상')) {
    const value = parseFloat(cleaned.replace(/[^0-9.]/g, ''));
    if (!isNaN(value)) {
      return { min: value, max: Infinity };
    }
  }
  
  // "13-16.5" 형태
  if (cleaned.includes('-') || cleaned.includes('~')) {
    const parts = cleaned.split(/[-~]/).map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { min: parts[0], max: parts[1] };
    }
  }
  
  // 단일 값 (정확히 일치해야 함)
  const singleValue = parseFloat(cleaned);
  if (!isNaN(singleValue)) {
    return { min: singleValue, max: singleValue };
  }
  
  return null;
}

/**
 * 값이 범위 내에 있는지 확인
 * @param value - 확인할 값
 * @param range - 범위 { min, max }
 * @returns 범위 내 여부
 */
function isInRange(
  value: number, 
  range: { min: number; max: number }
): boolean {
  return value >= range.min && value <= range.max;
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
