import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** 드롭다운 상단 고정 옵션 (예: 전체 보기) */
  pinnedOptions?: SelectOption[];
}

export const SearchableSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = '선택',
  className = '',
  pinnedOptions,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 열릴 때 input 포커스
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!filter) return options;
    const q = filter.toLowerCase();
    return options
      .filter(o => o.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const ai = a.label.toLowerCase().indexOf(q);
        const bi = b.label.toLowerCase().indexOf(q);
        return ai - bi;
      });
  }, [options, filter]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const pinned = pinnedOptions?.find(o => o.value === value);
    if (pinned) return pinned.label;
    return options.find(o => o.value === value)?.label || '';
  }, [value, options, pinnedOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setFilter('');
  };

  return (
    <div className={`searchable-select ${className}`} ref={ref}>
      <button
        className="searchable-select__trigger"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="searchable-select__label">
          {selectedLabel || placeholder}
        </span>
        <span className="searchable-select__arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="searchable-select__dropdown">
          <input
            ref={inputRef}
            className="searchable-select__input"
            type="text"
            placeholder="검색..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <div className="searchable-select__list">
            {pinnedOptions?.map(o => (
              <div
                key={o.value}
                className={`searchable-select__item searchable-select__item--pinned${value === o.value ? ' searchable-select__item--active' : ''}`}
                onClick={() => handleSelect(o.value)}
              >
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="searchable-select__empty">결과 없음</div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                className={`searchable-select__item${value === o.value ? ' searchable-select__item--active' : ''}`}
                onClick={() => handleSelect(o.value)}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
