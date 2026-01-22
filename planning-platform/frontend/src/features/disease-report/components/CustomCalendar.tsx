import React, { useState, useEffect } from 'react';
import { BirthDate, CalendarOptions } from '../types';

interface CustomCalendarProps {
  value?: BirthDate;
  onChange?: (date: BirthDate, isComplete: boolean) => void;
  options?: Partial<CalendarOptions>;
  className?: string;
  showDropdownOnClick?: boolean; // 클릭 시 드롭다운 표시 여부
  displayMode?: 'full' | 'compact'; // full: 항상 드롭다운 표시, compact: 생년월일 있으면 표시만
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  value,
  onChange,
  options = {},
  className = '',
  showDropdownOnClick = false,
  displayMode = 'full',
}) => {
  // 앞의 0 제거 헬퍼 함수
  const removeLeadingZero = (str: string | null | undefined): string | null => {
    if (!str) return null;
    // 앞의 0 제거 (단, "0" 자체는 "0"으로 유지)
    const num = parseInt(String(str), 10);
    return isNaN(num) ? String(str) : String(num);
  };

  const [selectedDate, setSelectedDate] = useState<BirthDate>(() => ({
    year: value?.year ? String(value.year) : null,
    month: removeLeadingZero(value?.month),
    day: removeLeadingZero(value?.day),
  }));

  // 날짜 완성 여부 확인 (초기화용)
  const checkIsComplete = (date: BirthDate) => {
    return Boolean(date.year && date.month && date.day);
  };

  const [showDropdown, setShowDropdown] = useState<boolean>(() => {
    // compact 모드이고 생년월일이 없으면 드롭다운 표시
    if (displayMode === 'compact') {
      const initialDate = {
        year: value?.year ? String(value.year) : null,
        month: removeLeadingZero(value?.month),
        day: removeLeadingZero(value?.day),
      };
      return !checkIsComplete(initialDate);
    }
    return true; // full 모드는 항상 표시
  });

  const currentYear = new Date().getFullYear();
  const defaultOptions: CalendarOptions = {
    minYear: 1930,
    maxYear: currentYear,
    placeholder: {
      year: '연도',
      month: '월',
      day: '일',
    },
    ...options,
  };

  // 연도 옵션 생성
  const generateYearOptions = () => {
    const years = [];
    for (let year = defaultOptions.maxYear!; year >= defaultOptions.minYear!; year--) {
      years.push(year);
    }
    return years;
  };

  // 월 옵션 생성
  const generateMonthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // 일 옵션 생성
  const generateDayOptions = (year: string, month: string) => {
    if (!year || !month) return [];
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // 날짜 완성 여부 확인
  const isComplete = () => {
    return Boolean(selectedDate.year && selectedDate.month && selectedDate.day);
  };

  // 생년월일 표시 클릭 핸들러 (토글 방식)
  const handleDisplayClick = () => {
    if (displayMode === 'compact' && isComplete() && showDropdownOnClick) {
      setShowDropdown(prev => !prev); // 토글 방식으로 변경
    }
  };

  // 표시 텍스트 생성
  const getDisplayText = () => {
    if (isComplete()) {
      return `${selectedDate.year}년 ${selectedDate.month}월 ${selectedDate.day}일`;
    }
    return '날짜를 선택해주세요';
  };

  // 연도 변경
  const handleYearChange = (year: string) => {
    const newDate = {
      ...selectedDate,
      year: year || null,
      month: year ? selectedDate.month : null,
      day: null, // 연도 변경 시 일 초기화
    };
    setSelectedDate(newDate);
    const isDateComplete = Boolean(newDate.year && newDate.month && newDate.day);
    onChange?.(newDate, isDateComplete);
    // compact 모드에서 생년월일이 완성되면 드롭다운 숨김
    if (displayMode === 'compact' && isDateComplete) {
      setShowDropdown(false);
    }
  };

  // 월 변경
  const handleMonthChange = (month: string) => {
    const newDate = {
      ...selectedDate,
      month: month || null,
      day: null, // 월 변경 시 일 초기화
    };
    setSelectedDate(newDate);
    const isDateComplete = Boolean(newDate.year && newDate.month && newDate.day);
    onChange?.(newDate, isDateComplete);
    // compact 모드에서 생년월일이 완성되면 드롭다운 숨김
    if (displayMode === 'compact' && isDateComplete) {
      setShowDropdown(false);
    }
  };

  // 일 변경
  const handleDayChange = (day: string) => {
    const newDate = {
      ...selectedDate,
      day: day || null,
    };
    setSelectedDate(newDate);
    const isDateComplete = Boolean(newDate.year && newDate.month && newDate.day);
    onChange?.(newDate, isDateComplete);
    // compact 모드에서 생년월일이 완성되면 드롭다운 숨김
    if (displayMode === 'compact' && isDateComplete) {
      setShowDropdown(false);
    }
  };

  // value prop 변경 시 업데이트
  useEffect(() => {
    if (value) {
      const newDate = {
        year: value.year ? String(value.year) : null,
        month: removeLeadingZero(value.month),
        day: removeLeadingZero(value.day),
      };
      // 값이 실제로 변경된 경우에만 업데이트
      if (
        newDate.year !== selectedDate.year ||
        newDate.month !== selectedDate.month ||
        newDate.day !== selectedDate.day
      ) {
        setSelectedDate(newDate);
        // compact 모드에서 생년월일이 완성되면 드롭다운 숨김
        if (displayMode === 'compact' && checkIsComplete(newDate)) {
          setShowDropdown(false);
        } else if (displayMode === 'compact' && !checkIsComplete(newDate)) {
          setShowDropdown(true);
        }
      }
    } else {
      // value가 없으면 초기화
      setSelectedDate({
        year: null,
        month: null,
        day: null,
      });
      // compact 모드에서 생년월일이 없으면 드롭다운 표시
      if (displayMode === 'compact') {
        setShowDropdown(true);
      }
    }
  }, [value, displayMode]);

  // compact 모드에서 생년월일이 있으면 표시만, 없으면 드롭다운 표시
  // showDropdown이 true이거나 생년월일이 없으면 드롭다운 표시
  const shouldShowDropdown = displayMode === 'full' || showDropdown || !isComplete();

  return (
    <div className={`custom-date-picker ${className} ${displayMode === 'compact' ? 'compact-mode' : ''}`}>
      {/* 생년월일 표시 (위쪽) - compact 모드에서 생년월일이 있을 때만 표시 */}
      {displayMode === 'compact' && isComplete() && (
        <div 
          className="date-picker-display-top"
          onClick={handleDisplayClick}
          style={{ cursor: showDropdownOnClick ? 'pointer' : 'default' }}
        >
          <div className={`selected-date-display ${isComplete() ? 'has-date' : ''}`}>
            {getDisplayText()}
          </div>
          {showDropdownOnClick && (
            <span className="edit-hint">수정하려면 클릭하세요</span>
          )}
      </div>
      )}
      
      {/* 드롭다운 (아래쪽) */}
      {shouldShowDropdown && (
      <div className="date-picker-selects">
        <div className="select-group">
          <select
            className="date-select year-select"
              value={selectedDate.year ? String(selectedDate.year) : ''}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">{defaultOptions.placeholder!.year}</option>
            {generateYearOptions().map(year => (
                <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
          <label className="select-label">년</label>
        </div>
        
        <div className="select-group">
          <select
            className="date-select month-select"
              value={selectedDate.month ? String(selectedDate.month) : ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            disabled={!selectedDate.year}
          >
            <option value="">{defaultOptions.placeholder!.month}</option>
            {generateMonthOptions().map(month => (
                <option key={month} value={String(month)}>{month}</option>
            ))}
          </select>
          <label className="select-label">월</label>
        </div>
        
        <div className="select-group">
          <select
            className="date-select day-select"
              value={selectedDate.day ? String(selectedDate.day) : ''}
            onChange={(e) => handleDayChange(e.target.value)}
            disabled={!selectedDate.year || !selectedDate.month}
          >
            <option value="">{defaultOptions.placeholder!.day}</option>
            {selectedDate.year && selectedDate.month && 
             generateDayOptions(selectedDate.year, selectedDate.month).map(day => (
                <option key={day} value={String(day)}>{day}</option>
            ))}
          </select>
          <label className="select-label">일</label>
        </div>
      </div>
      )}
      
      {/* 생년월일 표시 (아래쪽) - full 모드 또는 compact 모드에서 드롭다운이 표시될 때 */}
      {displayMode === 'full' && (
      <div className="date-picker-footer">
        <div className={`selected-date-display ${isComplete() ? 'has-date' : ''}`}>
          {getDisplayText()}
        </div>
      </div>
      )}
    </div>
  );
}; 