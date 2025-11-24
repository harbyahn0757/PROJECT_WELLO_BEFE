/**
 * DateSelector
 * 예약 날짜 선택 캘린더 컴포넌트
 * 다중 선택 지원 (1지망, 2지망)
 */
import React, { useState, useMemo } from 'react';
import './styles.scss';

interface DateSelectorProps {
  selectedDates?: string[]; // 선택된 날짜들 (YYYY-MM-DD 형식)
  onDateSelect?: (dates: string[]) => void; // 날짜 선택 콜백
  minDate?: Date; // 최소 선택 가능 날짜 (기본: 오늘)
  maxDate?: Date; // 최대 선택 가능 날짜
}

const DateSelector: React.FC<DateSelectorProps> = ({
  selectedDates = [],
  onDateSelect,
  minDate,
  maxDate
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const minSelectableDate = minDate || today;
  const maxSelectableDate = maxDate;

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // 날짜 선택 처리
  const handleDateClick = (date: Date) => {
    const dateString = formatDateString(date);
    const isPastDate = date < minSelectableDate;
    
    if (isPastDate) {
      return; // 과거 날짜는 선택 불가
    }

    if (maxSelectableDate && date > maxSelectableDate) {
      return; // 최대 날짜 초과 불가
    }

    let newSelectedDates: string[];
    
    if (selectedDates.includes(dateString)) {
      // 이미 선택된 날짜면 선택 해제
      newSelectedDates = selectedDates.filter(d => d !== dateString);
    } else {
      // 최대 2개까지만 선택 가능
      if (selectedDates.length >= 2) {
        // 첫 번째 선택을 제거하고 새로 추가 (1지망, 2지망 순서 유지)
        newSelectedDates = [selectedDates[1], dateString];
      } else {
        newSelectedDates = [...selectedDates, dateString];
      }
    }

    onDateSelect?.(newSelectedDates);
  };

  // 날짜 문자열 포맷팅 (YYYY-MM-DD)
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 날짜가 오늘인지 확인
  const isToday = (date: Date): boolean => {
    return formatDateString(date) === formatDateString(today);
  };

  // 날짜가 선택되었는지 확인
  const isSelected = (date: Date): boolean => {
    return selectedDates.includes(formatDateString(date));
  };

  // 날짜의 지망 순서 (1지망 또는 2지망)
  const getPreferenceOrder = (date: Date): number | null => {
    const dateString = formatDateString(date);
    const index = selectedDates.indexOf(dateString);
    return index >= 0 ? index + 1 : null;
  };

  // 날짜가 선택 가능한지 확인
  const isSelectable = (date: Date): boolean => {
    if (date < minSelectableDate) {
      return false; // 과거 날짜
    }
    if (maxSelectableDate && date > maxSelectableDate) {
      return false; // 최대 날짜 초과
    }
    return true;
  };

  // 캘린더 그리드 생성
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 해당 월의 첫 번째 날
    const firstDay = new Date(year, month, 1);
    // 해당 월의 마지막 날
    const lastDay = new Date(year, month + 1, 0);
    
    // 첫 번째 날의 요일 (0=일요일, 1=월요일, ...)
    const firstDayOfWeek = firstDay.getDay();
    // 일요일을 0으로 시작하도록 조정 (월요일=0, 일요일=6)
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days: (Date | null)[] = [];
    
    // 이전 달의 날짜들 (빈 칸 채우기)
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(date);
    }
    
    // 현재 달의 날짜들
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    // 다음 달의 날짜들 (빈 칸 채우기, 최대 6주)
    const remainingDays = 42 - days.length; // 6주 x 7일 = 42
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }
    
    return days;
  }, [currentMonth]);

  // 월 표시 텍스트 ("2월, 2025" 형식)
  const monthText = `${currentMonth.getMonth() + 1}월, ${currentMonth.getFullYear()}`;

  // 요일 헤더
  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="date-selector">
      {/* 캘린더 카드 */}
      <div className="date-selector__card">
        {/* 월 네비게이션 */}
        <div className="date-selector__header">
          <button
            className="date-selector__nav-button"
            onClick={() => changeMonth('prev')}
            aria-label="이전 달"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          
          <div className="date-selector__month">
            {monthText}
          </div>
          
          <button
            className="date-selector__nav-button"
            onClick={() => changeMonth('next')}
            aria-label="다음 달"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="date-selector__weekdays">
          {weekDays.map((day, index) => (
            <div key={index} className="date-selector__weekday">
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="date-selector__grid">
          {calendarGrid.map((date, index) => {
            if (!date) {
              return <div key={index} className="date-selector__day date-selector__day--empty" />;
            }

            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const dateIsToday = isToday(date);
            const dateIsSelected = isSelected(date);
            const dateIsSelectable = isSelectable(date);
            const preferenceOrder = getPreferenceOrder(date);

            return (
              <div
                key={index}
                className={`date-selector__day
                  ${!isCurrentMonth ? 'date-selector__day--other-month' : ''}
                  ${dateIsToday && !dateIsSelected ? 'date-selector__day--today' : ''}
                  ${dateIsSelected ? 'date-selector__day--selected' : ''}
                  ${!dateIsSelectable ? 'date-selector__day--disabled' : ''}
                `}
                onClick={() => dateIsSelectable && handleDateClick(date)}
              >
                <span className="date-selector__day-number">
                  {date.getDate()}
                </span>
                {preferenceOrder && (
                  <span className="date-selector__preference">
                    {preferenceOrder}지망
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DateSelector;




