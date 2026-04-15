import React from 'react';
import type { ReactNode } from 'react';
import { useEmbedParams } from '../../hooks/useEmbedParams';

export interface PageLayoutProps {
  /**
   * 페이지 식별자. CSS override 용 `.page--<pageName>` 클래스를 자동 부여.
   * 예: "revisit" | "health-report" | "checkup-design"
   */
  pageName: string;

  /**
   * iframe embed 모드 강제값. 미지정 시 `useEmbedParams()` 결과 사용.
   * 테스트/스토리북 용도 override.
   */
  embedMode?: boolean;

  /**
   * 본문 스크롤 정책.
   * - "page" (기본): 페이지 전체가 스크롤 (현재 RevisitPage 패턴)
   * - "none": 외부는 고정, 내부 컴포넌트가 스크롤 관리 (테이블 sticky 헤더 시)
   */
  scroll?: 'page' | 'none';

  /** 테스트 편의용 data-testid */
  testId?: string;

  children: ReactNode;
}

/**
 * 페이지 표준 외부 래퍼.
 * - 기존 `.revisit-page`, `.cdm-page`, `.health-report` 등 각자 래퍼 통일.
 * - embed 모드 분기를 Layout 이 흡수 → 각 페이지는 `isEmbedMode` 변수 관리 불필요.
 * - Phase 1 에서는 페이지에서 호출하지 않아도 됨 (기존 페이지 유지). Phase 2~6 에서 점진 교체.
 *
 * @example
 * <PageLayout pageName="revisit">
 *   <PageHeader title="재환가망고객" actions={...} />
 *   <KpiGrid>...</KpiGrid>
 * </PageLayout>
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  pageName,
  embedMode,
  scroll = 'page',
  testId,
  children,
}) => {
  const { isEmbedMode } = useEmbedParams();
  const isEmbed = embedMode ?? isEmbedMode;

  const className = [
    'page',
    `page--${pageName}`,
    isEmbed && 'page--embed',
    `page--scroll-${scroll}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} data-testid={testId ?? `page-${pageName}`}>
      {children}
    </div>
  );
};

export default PageLayout;
