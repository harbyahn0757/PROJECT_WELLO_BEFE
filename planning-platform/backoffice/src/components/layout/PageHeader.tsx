import React from 'react';
import type { ReactNode } from 'react';
import { useEmbedParams } from '../../hooks/useEmbedParams';

export interface PageHeaderProps {
  /** 페이지 제목 (h2 로 렌더) */
  title: ReactNode;

  /** 부제 (옵션, title 아래 회색 텍스트) */
  subtitle?: ReactNode;

  /** 오른쪽 액션 영역 (버튼, 드롭다운 등) */
  actions?: ReactNode;

  /**
   * embed 모드에서 헤더를 숨길지 여부.
   * 기본 false (embed 에서도 표시).
   * Layout 의 pageHeader 는 이미 PartnerOfficeLayout 헤더가 있어 중복 시 true 권장.
   */
  hideOnEmbed?: boolean;
}

/**
 * 페이지 상단 제목 + 오른쪽 액션 영역.
 * - `revisit-page__header`, `health-report__header` 등 중복 제거용 공용 컴포넌트.
 * - embed 모드에서 hideOnEmbed=true 지정 시 자동으로 숨겨짐.
 *
 * @example
 * <PageHeader title="재환가망고객" actions={<ExportButtons onExcel={handleExcel} />} />
 * <PageHeader title="mediArc 리포트" subtitle="전체 환자 질환 예측 현황" />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  hideOnEmbed = false,
}) => {
  const { isEmbedMode } = useEmbedParams();

  if (hideOnEmbed && isEmbedMode) return null;

  return (
    <header className="page__header">
      <div className="page__header-title-group">
        <h2 className="page__header-title">{title}</h2>
        {subtitle && <p className="page__header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page__header-actions">{actions}</div>}
    </header>
  );
};

export default PageHeader;
