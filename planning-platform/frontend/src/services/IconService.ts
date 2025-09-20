import React from 'react';

/**
 * 아이콘 서비스 인터페이스
 */
export interface IIconService {
  getIcon(iconName: string): React.ReactElement | null;
  registerIcon(iconName: string, iconComponent: React.ReactElement): void;
  getAllIcons(): Record<string, React.ReactElement>;
}

/**
 * SVG 아이콘 프로퍼티
 */
interface SVGIconProps {
  className?: string;
  fill?: string;
  stroke?: string;
  viewBox?: string;
}

/**
 * 아이콘 서비스 구현체
 */
export class IconService implements IIconService {
  private static instance: IconService;
  private icons: Record<string, React.ReactElement> = {};

  private constructor() {
    this.initializeDefaultIcons();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): IconService {
    if (!IconService.instance) {
      IconService.instance = new IconService();
    }
    return IconService.instance;
  }

  /**
   * 기본 아이콘들 초기화
   */
  private initializeDefaultIcons(): void {
    const iconProps: SVGIconProps = {
      className: "card__icon-svg",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    };

    // 클립보드 아이콘
    this.icons['clipboard'] = React.createElement('svg', iconProps, 
      React.createElement('path', {
        strokeLinecap: "round",
        strokeLinejoin: "round", 
        strokeWidth: "2",
        d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      })
    );

    // 방패 아이콘
    this.icons['shield'] = React.createElement('svg', iconProps,
      React.createElement('path', {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2", 
        d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      })
    );

    // 문서 아이콘
    this.icons['document'] = React.createElement('svg', iconProps,
      React.createElement('path', {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      })
    );

    // 별 아이콘
    this.icons['star'] = React.createElement('svg', iconProps,
      React.createElement('path', {
        strokeLinecap: "round", 
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      }),
      React.createElement('path', {
        strokeLinecap: "round",
        strokeLinejoin: "round", 
        strokeWidth: "2",
        d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      })
    );
  }

  /**
   * 아이콘 조회
   */
  getIcon(iconName: string): React.ReactElement | null {
    return this.icons[iconName] || null;
  }

  /**
   * 새로운 아이콘 등록
   */
  registerIcon(iconName: string, iconComponent: React.ReactElement): void {
    this.icons[iconName] = iconComponent;
  }

  /**
   * 모든 아이콘 반환
   */
  getAllIcons(): Record<string, React.ReactElement> {
    return { ...this.icons };
  }

  /**
   * 아이콘 존재 여부 확인
   */
  hasIcon(iconName: string): boolean {
    return iconName in this.icons;
  }

  /**
   * 동적으로 아이콘 추가 (확장성)
   */
  addCustomIcon(iconName: string, svgPath: string, additionalPaths?: string[]): void {
    const iconProps: SVGIconProps = {
      className: "card__icon-svg",
      fill: "none", 
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    };

    const paths = [svgPath, ...(additionalPaths || [])].map((path, index) =>
      React.createElement('path', {
        key: index,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: path
      })
    );

    this.icons[iconName] = React.createElement('svg', iconProps, ...paths);
  }
}
