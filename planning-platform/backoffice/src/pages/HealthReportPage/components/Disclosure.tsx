import React from 'react';

interface DisclosureProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'planned';
}

export default function Disclosure({
  title,
  children,
  defaultOpen = false,
  variant = 'default',
}: DisclosureProps) {
  const modifierClass =
    variant === 'planned'
      ? 'report-view__disclosure report-view__disclosure--planned'
      : 'report-view__disclosure';

  return (
    <details
      className={modifierClass}
      open={defaultOpen}
      data-testid="disclosure"
    >
      <summary className="report-view__disclosure-summary">
        {title}
        {variant === 'planned' && (
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '11px',
              background: '#e5e7eb',
              borderRadius: '4px',
              padding: '0 4px',
              color: '#6b7280',
            }}
          >
            예정
          </span>
        )}
      </summary>
      <div className="report-view__disclosure-body">{children}</div>
    </details>
  );
}
