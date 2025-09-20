import React, { useState, useEffect } from 'react';
import { BirthDate, CalendarOptions } from '../types';

interface CustomCalendarProps {
  value?: BirthDate;
  onChange?: (date: BirthDate, isComplete: boolean) => void;
  options?: Partial<CalendarOptions>;
  className?: string;
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  value,
  onChange,
  options = {},
  className = '',
}) => {
  const [selectedDate, setSelectedDate] = useState<BirthDate>({
    year: value?.year || null,
    month: value?.month || null,
    day: value?.day || null,
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
    onChange?.(newDate, Boolean(newDate.year && newDate.month && newDate.day));
  };

  // 월 변경
  const handleMonthChange = (month: string) => {
    const newDate = {
      ...selectedDate,
      month: month || null,
      day: null, // 월 변경 시 일 초기화
    };
    setSelectedDate(newDate);
    onChange?.(newDate, Boolean(newDate.year && newDate.month && newDate.day));
  };

  // 일 변경
  const handleDayChange = (day: string) => {
    const newDate = {
      ...selectedDate,
      day: day || null,
    };
    setSelectedDate(newDate);
    onChange?.(newDate, Boolean(newDate.year && newDate.month && newDate.day));
  };

  // value prop 변경 시 업데이트
  useEffect(() => {
    if (value) {
      setSelectedDate(value);
    }
  }, [value]);

  return (
    <div className={`custom-date-picker ${className}`}>
      <div className="date-picker-header">
        <span className="date-picker-title">생년월일 선택</span>
        <span className="date-picker-subtitle">정확한 건강 분석을 위해 필요합니다</span>
      </div>
      
      <div className="date-picker-selects">
        <div className="select-group">
          <select
            className="date-select year-select"
            value={selectedDate.year || ''}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">{defaultOptions.placeholder!.year}</option>
            {generateYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <label className="select-label">년</label>
        </div>
        
        <div className="select-group">
          <select
            className="date-select month-select"
            value={selectedDate.month || ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            disabled={!selectedDate.year}
          >
            <option value="">{defaultOptions.placeholder!.month}</option>
            {generateMonthOptions().map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
          <label className="select-label">월</label>
        </div>
        
        <div className="select-group">
          <select
            className="date-select day-select"
            value={selectedDate.day || ''}
            onChange={(e) => handleDayChange(e.target.value)}
            disabled={!selectedDate.year || !selectedDate.month}
          >
            <option value="">{defaultOptions.placeholder!.day}</option>
            {selectedDate.year && selectedDate.month && 
             generateDayOptions(selectedDate.year, selectedDate.month).map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <label className="select-label">일</label>
        </div>
      </div>
      
      <div className="date-picker-footer">
        <div className={`selected-date-display ${isComplete() ? 'has-date' : ''}`}>
          {getDisplayText()}
        </div>
      </div>
    </div>
  );
}; 