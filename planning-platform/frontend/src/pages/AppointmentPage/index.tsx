/**
 * AppointmentPage
 * 예약 날짜 선택 페이지
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppointmentLayout from '../../layouts/AppointmentLayout';
import DateSelector from '../../components/appointment/DateSelector';
import Legend from '../../components/appointment/Legend';
import './styles.scss';

const AppointmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDates, setSelectedDates] = useState<string[]>([]); // 선택된 날짜들 (1지망, 2지망)

  const handleBack = () => {
    navigate(-1);
  };

  const handleButtonClick = () => {
    if (selectedDates.length === 0) {
      alert('예약을 희망하는 날짜를 선택해주세요.');
      return;
    }
    
    console.log('예약 신청 완료', selectedDates);
    // TODO: 다음 단계로 이동 (시간 선택 등)
    // navigate('/appointment/time', { state: { dates: selectedDates } });
  };

  return (
    <AppointmentLayout
      onBack={handleBack}
      buttonText="예약 신청 완료"
      onButtonClick={handleButtonClick}
      buttonDisabled={selectedDates.length === 0}
    >
      {/* 안내 텍스트 */}
      <div className="appointment-page__instruction">
        예약을 희망하는 날짜와 시간을 선택해주세요.
      </div>

      {/* 캘린더 영역 */}
      <div className="appointment-page__calendar">
        <DateSelector
          selectedDates={selectedDates}
          onDateSelect={setSelectedDates}
        />
      </div>

      {/* 범례 */}
      <div className="appointment-page__legend">
        <Legend />
      </div>

      {/* 안내 문구 */}
      <div className="appointment-page__notice">
        *희망일은 확정일이 아니며, 선택하신 일정을 확인하고 전화로 안내드리고 있습니다.
      </div>
    </AppointmentLayout>
  );
};

export default AppointmentPage;

