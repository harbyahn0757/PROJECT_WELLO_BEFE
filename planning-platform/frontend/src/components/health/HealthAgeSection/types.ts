/**
 * HealthAgeSection 타입 정의
 */

export interface HealthAgeSectionProps {
  /** 건강 나이 (bodyage) */
  healthAge: number;
  
  /** 실제 나이 (검진 나이) */
  actualAge: number | null;
  
  /** 레이아웃 variant
   * - default: CategoryView용 (밝은 배경, 작은 margin)
   * - card: DiseaseReportPage용 (어두운 배경, border, 큰 margin)
   */
  variant?: 'default' | 'card';
  
  /** 추가 CSS 클래스 */
  className?: string;
  
  /** 반짝임 효과 표시 여부 (DiseaseReportPage에서 WebSocket 알림 후 사용) */
  showGlowEffect?: boolean;
  
  /** 나이 박스 클릭 핸들러 (디버그 모드용) */
  onAgeClick?: () => void;
  
  /** 컴팩트 모드 (채팅용) */
  compact?: boolean;
  
  /** 테두리 표시 여부 (variant="default"일 때 사용) */
  showBorder?: boolean;
}

export interface AgeComparison {
  /** 나이 차이 (절댓값) */
  ageDifference: number;
  
  /** 건강나이가 실제나이보다 낮은지 (더 건강한지) */
  isHealthier: boolean;
}
