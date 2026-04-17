import React, { useEffect, useRef } from 'react';
import { useEmbedParams } from '../../hooks/useEmbedParams';
import './Drawer.scss';

export interface DrawerProps {
  /** 열림 상태 */
  open: boolean;
  /** 닫기 콜백 (ESC, overlay 클릭, 닫기 버튼) */
  onClose: () => void;
  /** 헤더 영역 — title 대신 완전 커스텀 시 사용 */
  header?: React.ReactNode;
  /** 간단한 제목 (header 미지정 시 기본 헤더 렌더) */
  title?: React.ReactNode;
  /**
   * 드로어 너비. 기본 "lg"
   * sm=360px | md=480px | lg=720px | xl=80% | full=100%
   */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | string;
  /** overlay 클릭으로 닫기 (기본 true) */
  closeOnOverlay?: boolean;
  /** ESC 로 닫기 (기본 true) */
  closeOnEsc?: boolean;
  /**
   * body scroll lock (기본 true).
   * iframe 내에서는 false 권장 — cross-origin iframe에서 부모 body 제어 불가.
   */
  lockBody?: boolean;
  /**
   * 컨테이너 기준 렌더 모드 (iframe 안전 핵심).
   * - "viewport" (기본): position: fixed — 일반 페이지에서 viewport 기준
   * - "container": position: absolute — 부모 .page 컨테이너 기준, iframe 부모 침범 방지
   */
  containment?: 'viewport' | 'container';
  /** 외부 영역 테스트용 data-testid */
  testId?: string;
  children: React.ReactNode;
}

const WIDTH_MAP: Record<string, string> = {
  sm: '360px',
  md: '480px',
  lg: '720px',
  xl: '80%',
  full: '100%',
};

/**
 * 오른쪽에서 슬라이드하는 공용 Drawer.
 * - focus trap + ESC + overlay click + body scroll lock (options)
 * - iframe 안전 모드 `containment="container"` 지원 (부모 페이지 영역 침범 방지)
 * - isEmbedMode=true 시 자동으로 container 모드 + lockBody=false 로 전환
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Drawer open={open} onClose={() => setOpen(false)} title="환자 상세" width="xl">
 *   <PatientDetail id={selected} />
 * </Drawer>
 */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  header,
  title,
  width = 'lg',
  closeOnOverlay = true,
  closeOnEsc = true,
  lockBody,
  containment,
  testId,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { isEmbedMode } = useEmbedParams();

  // iframe 기본값: containment=container, lockBody=false
  const resolvedContainment = containment ?? (isEmbedMode ? 'container' : 'viewport');
  const resolvedLockBody = lockBody ?? !isEmbedMode;

  // ESC 키 닫기
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  // body scroll lock
  useEffect(() => {
    if (!open || !resolvedLockBody) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, resolvedLockBody]);

  // focus trap (열릴 때 panel 으로 포커스)
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const widthValue = WIDTH_MAP[width] ?? width;

  return (
    <>
      <div
        className={[
          'app-drawer__overlay',
          `app-drawer__overlay--${resolvedContainment}`,
          open && 'app-drawer__overlay--visible',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden
      />
      <aside
        ref={panelRef}
        className={[
          'app-drawer',
          `app-drawer--${resolvedContainment}`,
          open && 'app-drawer--open',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: widthValue }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        {...(!open ? { inert: '' as any } : {})}
        data-testid={testId ?? 'app-drawer'}
      >
        {(header != null || title != null) && (
          <div className="app-drawer__header">
            {header ?? <h3 className="app-drawer__title">{title}</h3>}
            <button
              className="app-drawer__close"
              onClick={onClose}
              aria-label="닫기"
            >
              &times;
            </button>
          </div>
        )}
        <div className="app-drawer__body">{children}</div>
      </aside>
    </>
  );
};
