/**
 * 건강 카테고리 뷰 타입 정의
 */

import { TilkoHealthCheckupRaw, TilkoTestItem } from './health';

// 카테고리 상태
export type CategoryStatus = 'caution' | 'normal' | 'no_data';

// 항목 상태
export type ItemStatus = 'normal' | 'borderline' | 'abnormal';

// 카테고리 항목 데이터
export interface CategoryItem {
  name: string;       // 신장, 체중, BMI 등
  value: string;
  unit: string;
  status: ItemStatus;
  refName?: string;   // ItemReferences의 Name (정상, 질환의심 등)
  trend?: 'up' | 'down' | 'stable';
}

// 카테고리 데이터
export interface CategoryData {
  id: string;
  name: string;
  status: CategoryStatus;
  itemsCount: number;      // 항목 개수
  cautionCount: number;    // 주의 항목 개수
  items: CategoryItem[];
  judgment?: string;       // 판정 결과 (정상, 질환의심 등)
  description?: string;    // 설명
}

// 카테고리 정의
export interface CategoryDefinition {
  id: string;
  name: string;
  illnesses: string[];     // 연결된 Illness Name 목록
  icon?: string;           // 카테고리 아이콘
}

// 건강 나이 데이터
export interface HealthAgeData {
  healthAge: number;
  actualAge: number;
}

// 카테고리 뷰 Props
export interface CategoryViewProps {
  healthData: TilkoHealthCheckupRaw[];
  year?: string;
  onCategoryClick?: (categoryId: string) => void;
  onItemClick?: (itemName: string) => void;
  compact?: boolean;
}
