import React, { useState, useRef, useEffect, useMemo } from 'react';
import './HospitalSearch.scss';

export interface HospitalOption {
  /** partner 포맷 (PartnerOfficeLayout 등) */
  hospital_id?: string;
  /** cdm 포맷 (CheckupDesignManagementPage) */
  hosnm?: string;
  hospital_name?: string;
  /** 선택적 서브텍스트용 — 마케팅 동의 수 */
  mkt_consent?: number;
  /** 선택적 서브텍스트용 — 발송 수 */
  pln_sent?: number;
}

export interface HospitalSearchProps {
  /** 병원 목록 */
  hospitals: HospitalOption[];
  /**
   * 선택된 값 (hospital_id 또는 hosnm 중 소비자 결정).
   * 빈 문자열 = "전체 병원" 선택 상태.
   */
  value: string;
  /** 선택 콜백. 빈 문자열이면 "전체 병원" 선택 */
  onChange: (value: string) => void;
  /**
   * 값 추출 함수.
   * 기본: h => h.hospital_id ?? h.hosnm ?? ''
   */
  getValue?: (h: HospitalOption) => string;
  /**
   * 표시 텍스트 추출 함수.
   * 기본: h => h.hospital_name ?? h.hosnm ?? ''
   */
  getLabel?: (h: HospitalOption) => string;
  /**
   * 아이템 아래 서브텍스트 추출 함수 (옵션).
   * null 반환 시 표시 안 함.
   */
  getSubtitle?: (h: HospitalOption) => string | null;
  /** input placeholder. 기본: `병원 검색 (N개)` */
  placeholder?: string;
  /** "전체 병원" 옵션 표시 여부 (기본 true) */
  showAllOption?: boolean;
  /** 컴포넌트 너비 (기본 240px) */
  width?: string;
}

const DEFAULT_GET_VALUE = (h: HospitalOption) =>
  h.hospital_id ?? h.hosnm ?? '';
const DEFAULT_GET_LABEL = (h: HospitalOption) =>
  h.hospital_name ?? h.hosnm ?? '';

/**
 * 병원 검색 드롭다운 공용 컴포넌트.
 * CheckupDesignManagementPage .cdm-hospital-select 로직에서 추출.
 * CSS 네임스페이스: .hospital-search (기존 .cdm-hospital-select 와 병존)
 *
 * @example
 * // CheckupDesign (hosnm 기반)
 * <HospitalSearch
 *   hospitals={hospitalsWithStats}
 *   value={selectedHospital}
 *   onChange={v => { setSelectedHospital(v); setSelectedTargets([]); }}
 *   getValue={h => h.hosnm!}
 *   getLabel={h => h.hosnm!}
 *   getSubtitle={h => `${h.mkt_consent}명 / ${h.pln_sent}명 발송`}
 * />
 *
 * // 일반 (hospital_id 기반)
 * <HospitalSearch hospitals={hospitals} value={selectedId} onChange={setSelectedId} />
 */
export const HospitalSearch: React.FC<HospitalSearchProps> = ({
  hospitals,
  value,
  onChange,
  getValue = DEFAULT_GET_VALUE,
  getLabel = DEFAULT_GET_LABEL,
  getSubtitle,
  placeholder,
  showAllOption = true,
  width = '240px',
}) => {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return hospitals;
    const lc = filter.toLowerCase();
    return hospitals.filter(h =>
      getLabel(h).toLowerCase().includes(lc)
    );
  }, [hospitals, filter, getLabel]);

  const selectedOption = hospitals.find(h => getValue(h) === value);
  const displayText = selectedOption
    ? getLabel(selectedOption)
    : showAllOption
    ? '전체 병원'
    : placeholder ?? '선택';

  const inputPlaceholder =
    placeholder ?? `병원 검색 (${hospitals.length}개)`;

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setFilter('');
  };

  return (
    <div
      className="hospital-search"
      ref={ref}
      style={{ width }}
    >
      <button
        type="button"
        className="hospital-search__trigger"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="hospital-search__label">{displayText}</span>
        <span className="hospital-search__arrow" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="hospital-search__dropdown" role="listbox">
          <input
            className="hospital-search__input"
            type="text"
            placeholder={inputPlaceholder}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div className="hospital-search__list">
            {showAllOption && (
              <div
                role="option"
                aria-selected={!value}
                className={[
                  'hospital-search__item',
                  !value ? 'hospital-search__item--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelect('')}
              >
                전체 병원
              </div>
            )}

            {filtered.length === 0 && (
              <div className="hospital-search__empty">검색 결과 없음</div>
            )}

            {filtered.slice(0, 50).map(h => {
              const v = getValue(h);
              const sub = getSubtitle?.(h);
              return (
                <div
                  key={v || getLabel(h)}
                  role="option"
                  aria-selected={value === v}
                  className={[
                    'hospital-search__item',
                    value === v ? 'hospital-search__item--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelect(v)}
                >
                  <span className="hospital-search__item-name">
                    {getLabel(h)}
                  </span>
                  {sub && (
                    <span className="hospital-search__item-sub">{sub}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
