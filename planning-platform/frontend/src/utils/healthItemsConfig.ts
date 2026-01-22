/**
 * 건강 항목 통합 매트릭스
 * 검진추이와 카테고리가 공통으로 사용하는 항목 정의
 */

export interface HealthItemConfig {
  tilkoName: string;           // Tilko Item 이름 (예: "체질량지수")
  displayName: string;         // 표시 이름 (예: "BMI")
  category: string;            // 카테고리 ID (예: "body")
  unit: string;                // 단위 (예: "kg/m²")
  fieldName: string;           // 필드명 (예: "bmi")
  showInTrends: boolean;       // 검진추이 표시 여부
  valueType?: 'number' | 'string' | 'blood_pressure';  // 값 타입
  extract?: 'systolic' | 'diastolic';  // 혈압 분리 정보
}

export interface CategoryConfig {
  id: string;
  name: string;
  illnesses: string[];  // Tilko Illness 이름
  icon: string;
}

/**
 * 건강 항목 매트릭스 (21개)
 * 검진추이 12개 + 신규 9개
 */
export const HEALTH_ITEMS_CONFIG: HealthItemConfig[] = [
  // ============================================================================
  // BODY (신체) - 4개
  // ============================================================================
  {
    tilkoName: '신장',
    displayName: '신장',
    category: 'body',
    unit: 'cm',
    fieldName: 'height',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '체중',
    displayName: '체중',
    category: 'body',
    unit: 'kg',
    fieldName: 'weight',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '체질량지수',
    displayName: 'BMI',
    category: 'body',
    unit: 'kg/m²',
    fieldName: 'bmi',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '허리둘레',
    displayName: '허리둘레',
    category: 'body',
    unit: 'cm',
    fieldName: 'waist_circumference',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // BLOOD_PRESSURE (혈압) - 2개 (1개 tilkoName → 2개 displayName)
  // ============================================================================
  {
    tilkoName: '혈압(최고/최저)',
    displayName: '혈압 (수축기)',
    category: 'blood_pressure',
    unit: 'mmHg',
    fieldName: 'blood_pressure_high',
    showInTrends: true,
    valueType: 'blood_pressure',
    extract: 'systolic'
  },
  {
    tilkoName: '혈압(최고/최저)',
    displayName: '혈압 (이완기)',
    category: 'blood_pressure',
    unit: 'mmHg',
    fieldName: 'blood_pressure_low',
    showInTrends: true,
    valueType: 'blood_pressure',
    extract: 'diastolic'
  },

  // ============================================================================
  // KIDNEY (신장) - 3개 (신규 추가)
  // ============================================================================
  {
    tilkoName: '요단백',
    displayName: '요단백',
    category: 'kidney',
    unit: '',
    fieldName: 'urine_protein',
    showInTrends: true,
    valueType: 'string'
  },
  {
    tilkoName: '혈청크레아티닌',
    displayName: '크레아티닌',
    category: 'kidney',
    unit: 'mg/dL',
    fieldName: 'creatinine',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '신사구체여과율(GFR)',
    displayName: 'GFR',
    category: 'kidney',
    unit: 'mL/min',
    fieldName: 'gfr',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // ANEMIA (빈혈) - 1개
  // ============================================================================
  {
    tilkoName: '혈색소',
    displayName: '헤모글로빈',
    category: 'anemia',
    unit: 'g/dL',
    fieldName: 'hemoglobin',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // DIABETES (혈당) - 1개
  // ============================================================================
  {
    tilkoName: '공복혈당',
    displayName: '혈당',
    category: 'diabetes',
    unit: 'mg/dL',
    fieldName: 'blood_sugar',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // CHOLESTEROL (콜레스테롤) - 4개
  // ============================================================================
  {
    tilkoName: '총콜레스테롤',
    displayName: '총콜레스테롤',
    category: 'cholesterol',
    unit: 'mg/dL',
    fieldName: 'cholesterol',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '고밀도(HDL) 콜레스테롤',
    displayName: 'HDL 콜레스테롤',
    category: 'cholesterol',
    unit: 'mg/dL',
    fieldName: 'hdl_cholesterol',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '저밀도(LDL) 콜레스테롤',
    displayName: 'LDL 콜레스테롤',
    category: 'cholesterol',
    unit: 'mg/dL',
    fieldName: 'ldl_cholesterol',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '중성지방',
    displayName: '중성지방',
    category: 'cholesterol',
    unit: 'mg/dL',
    fieldName: 'triglyceride',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // LIVER (간) - 3개 (신규 추가)
  // ============================================================================
  {
    tilkoName: '에이에스티(AST, SGOT)',
    displayName: 'AST',
    category: 'liver',
    unit: 'U/L',
    fieldName: 'ast',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '에이엘티(ALT, SGPT)',
    displayName: 'ALT',
    category: 'liver',
    unit: 'U/L',
    fieldName: 'alt',
    showInTrends: true,
    valueType: 'number'
  },
  {
    tilkoName: '감마지티피(y-GTP)',
    displayName: 'γ-GTP',
    category: 'liver',
    unit: 'U/L',
    fieldName: 'gtp',
    showInTrends: true,
    valueType: 'number'
  },

  // ============================================================================
  // LUNG (폐) - 1개 (신규 추가)
  // ============================================================================
  {
    tilkoName: '폐결핵 흉부질환',
    displayName: '폐결핵',
    category: 'lung',
    unit: '',
    fieldName: 'lung_tuberculosis',
    showInTrends: true,
    valueType: 'string'
  }
];

/**
 * 카테고리 정의
 * illnesses: Tilko Illness 이름과 매핑
 */
export const HEALTH_CATEGORIES: Record<string, CategoryConfig> = {
  BODY: {
    id: 'body',
    name: '신체',
    illnesses: ['비만'],
    icon: '🏃'
  },
  BLOOD_PRESSURE: {
    id: 'blood_pressure',
    name: '혈압',
    illnesses: ['고혈압'],
    icon: '🩺'
  },
  KIDNEY: {
    id: 'kidney',
    name: '신장',
    illnesses: ['신장질환', '만성신장질환'],
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
    illnesses: ['이상지질혈증'],
    icon: '🧪'
  },
  LIVER: {
    id: 'liver',
    name: '간',
    illnesses: ['간장질환'],
    icon: '🫀'
  },
  LUNG: {
    id: 'lung',
    name: '폐',
    illnesses: ['폐결핵 흉부질환', '만성폐쇄성폐질환'],
    icon: '🫁'
  },
  BONE: {
    id: 'bone',
    name: '골다공증',
    illnesses: ['골다공증'],
    icon: '🦴'
  }
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 검진추이에 표시할 항목 목록 반환
 * @returns showInTrends가 true인 항목들 (21개)
 */
export function getTrendsItems(): HealthItemConfig[] {
  return HEALTH_ITEMS_CONFIG.filter(item => item.showInTrends);
}

/**
 * displayName으로 항목 설정 찾기
 * @param displayName - 표시 이름 (예: "BMI", "AST")
 * @returns 항목 설정 또는 undefined
 */
export function getItemConfig(displayName: string): HealthItemConfig | undefined {
  const config = HEALTH_ITEMS_CONFIG.find(item => item.displayName === displayName);
  
  if (!config && process.env.NODE_ENV === 'development') {
    console.error(`[매트릭스 누락] ${displayName} - HEALTH_ITEMS_CONFIG에 추가 필요`);
  }
  
  return config;
}

/**
 * tilkoName으로 항목 설정 찾기 (혈압은 2개 반환)
 * @param tilkoName - Tilko Item 이름 (예: "체질량지수", "혈압(최고/최저)")
 * @returns 항목 설정 배열
 */
export function getItemConfigsByTilkoName(tilkoName: string): HealthItemConfig[] {
  return HEALTH_ITEMS_CONFIG.filter(item => item.tilkoName === tilkoName);
}

/**
 * 카테고리에 속한 항목 목록 반환
 * @param categoryId - 카테고리 ID (예: "liver")
 * @returns 해당 카테고리의 항목들
 */
export function getCategoryItems(categoryId: string): HealthItemConfig[] {
  return HEALTH_ITEMS_CONFIG.filter(item => item.category === categoryId);
}

/**
 * 카테고리 아이콘 매핑 (하위 호환성)
 */
export const CATEGORY_ICONS: Record<string, string> = Object.values(HEALTH_CATEGORIES).reduce(
  (acc, cat) => ({ ...acc, [cat.id]: cat.icon || '' }),
  {}
);
