/**
 * 염려 항목 선택 컴포넌트
 * UnifiedHealthTimeline 구조를 그대로 사용하여 진료/약국/검진으로 구분하여 항목 선택
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HealthTrendsHeader from '../../health/HealthTrendsHeader';
import WelloModal from '../../common/WelloModal';
import CheckupDesignSurveyPanel, { SurveyResponses } from '../CheckupDesignSurveyPanel';
import {
  ConcernSelectionProps,
  ConcernItemForAPI
} from '../../../types/checkupDesign';
import '../../health/UnifiedHealthTimeline/styles.scss';
import './styles.scss';

// UnifiedHealthTimeline의 HealthRecord 타입 재사용
interface HealthRecord {
  id: string;
  type: 'checkup' | 'prescription';
  year: string;
  date: string;
  institution: string;
  title: string;
  status?: string;
  treatmentType?: string;
  visitCount?: number;
  medicationCount?: number;
  prescriptionCount?: number;
  hasMedications?: boolean;
  isPharmacy?: boolean;
  details: any;
}

type FilterMode = 'treatment' | 'pharmacy' | 'checkup';

const ConcernSelection: React.FC<ConcernSelectionProps> = ({
  healthData,
  prescriptionData,
  onSelectionChange,
  onNext
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [filterMode] = useState<FilterMode>('checkup'); // 기본값: 검진 (토글 제거, 모든 타입 표시)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set()); // 펼치기 상태 (기본적으로 모두 펼쳐짐)
  const [selectedCheckupGroups, setSelectedCheckupGroups] = useState<{ [recordId: string]: string }>({});
  const [currentSlideIndexes, setCurrentSlideIndexes] = useState<{ [recordId: string]: number }>({});
  const [statusFilters, setStatusFilters] = useState<{ [recordId: string]: string | null }>({});
  const [groupedRecords, setGroupedRecords] = useState<{ 
    [year: string]: { 
      [month: string]: { 
        [date: string]: HealthRecord[] 
      } 
    } 
  }>({});
  
  // 장바구니 모달 상태
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<{
    itemId: string;
    record: HealthRecord | null;
    children: string[];
  } | null>(null);
  
  // 드래그 슬라이더용 상태
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [draggingYear, setDraggingYear] = useState<number | null>(null); // 드래그 중 년도 표시
  
  // 데이터에서 최소/최대 연도 추출
  const { minYear, maxYear } = useMemo(() => {
    const healthDataForParsing = Array.isArray(healthData) ? healthData : (healthData as any)?.ResultList || healthData;
    const dataArray = healthDataForParsing?.ResultList || healthDataForParsing || [];
    
    const years: number[] = [];
    dataArray.forEach((item: any) => {
      const yearValue = item.year || item.Year || item.raw_data?.Year;
      if (yearValue) {
        const yearStr = yearValue.toString().replace('년', '').trim();
        const year = parseInt(yearStr, 10);
        if (!isNaN(year)) years.push(year);
      }
    });
    
    const currentYear = new Date().getFullYear();
    return {
      minYear: years.length > 0 ? Math.min(...years) : currentYear - 10,
      maxYear: currentYear
    };
  }, [healthData]);
  
  // 드래그 슬라이더 범위 계산 (데이터 기준, 초기값은 전체 범위)
  const [rangeStartYear, setRangeStartYear] = useState<number>(minYear);
  const [rangeEndYear, setRangeEndYear] = useState<number>(maxYear);
  
  useEffect(() => {
    setRangeStartYear(minYear);
    setRangeEndYear(maxYear);
  }, [minYear, maxYear]);

  // UnifiedHealthTimeline 구조로 데이터 변환 및 그룹화
  useEffect(() => {
    if (!healthData && !prescriptionData) return;

    const records: HealthRecord[] = [];

    // 건강검진 데이터 변환 (기간 필터 적용)
    const healthDataArray = Array.isArray(healthData) ? healthData : (healthData as any)?.ResultList || [];
    if (healthDataArray.length > 0) {
      healthDataArray.forEach((checkup: any, index: number) => {
        // 기간 필터링
        const yearValue = checkup.year || checkup.Year || checkup.raw_data?.Year;
        if (yearValue) {
          const yearStr = yearValue.toString().replace('년', '').trim();
          const year = parseInt(yearStr, 10);
          if (isNaN(year) || year < rangeStartYear || year > rangeEndYear) {
            return; // 기간 범위 밖이면 제외
          }
        }
        
        // DB의 year 필드를 우선 사용, "년" 제거
        const yearRaw = checkup.year || checkup.Year || '2023';
        const year = yearRaw.toString().replace('년', '');
        
        // 날짜 조합: CheckUpDate가 "09/28" 형태면 연도를 붙여서 완전한 날짜로 만들기
        let fullDate = checkup.CheckUpDate || checkup.checkup_date;
        if (fullDate && fullDate.includes('/') && !fullDate.includes(year)) {
          // "09/28" -> "2021/09/28" 형태로 변환
          fullDate = `${year}/${fullDate}`;
        }
        
        records.push({
          id: `checkup-${index}`,
          type: 'checkup',
          year,
          date: fullDate || `${year}/01/01`,
          institution: checkup.Location || checkup.location || '국민건강보험공단',
          title: '건강검진',
          status: checkup.Code || checkup.code,
          details: checkup
        });
      });
    }

    // 처방전 데이터 변환 (기간 필터 적용)
    const prescriptionDataArray = Array.isArray(prescriptionData) ? prescriptionData : (prescriptionData as any)?.ResultList || [];
    if (prescriptionDataArray.length > 0) {
      prescriptionDataArray.forEach((prescription: any, index: number) => {
        const treatmentDate = prescription.treatment_date || prescription.JinRyoGaesiIl;
        if (!treatmentDate) return;
        
        const date = new Date(treatmentDate);
        if (isNaN(date.getTime())) return;
        const year = date.getFullYear().toString();
        
        // 기간 필터링
        if (parseInt(year) < rangeStartYear || parseInt(year) > rangeEndYear) {
          return; // 기간 범위 밖이면 제외
        }
        
        const hasMedications = (prescription.detail_records_count && prescription.detail_records_count > 0) ||
          (prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
           prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0);
        
        const visitCount = prescription.visit_count || (prescription.BangMoonIpWonIlsoo ? parseInt(prescription.BangMoonIpWonIlsoo) : null);
        const medicationCount = prescription.medication_count || (prescription.TuYakYoYangHoiSoo ? parseInt(prescription.TuYakYoYangHoiSoo) : null);
        const prescriptionCount = prescription.prescription_count || (prescription.CheoBangHoiSoo ? parseInt(prescription.CheoBangHoiSoo) : null);
        const hospitalName = prescription.hospital_name || prescription.ByungEuiwonYakGukMyung || '의료기관';
        const treatmentType = prescription.treatment_type || prescription.JinRyoHyungTae;
        
        // 약국 여부 판단
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        records.push({
          id: `prescription-${index}`,
          type: 'prescription',
          year,
          date: treatmentDate || `${year}년`,
          institution: hospitalName,
          title: isPharmacy ? '약국' : '진료',
          treatmentType: treatmentType,
          visitCount: visitCount,
          medicationCount: medicationCount,
          prescriptionCount: prescriptionCount,
          hasMedications,
          isPharmacy: isPharmacy,
          details: prescription
        });
      });
    }

    // 년도 → 월 → 날짜 3단계로 그룹화 (UnifiedHealthTimeline 구조 그대로)
    const safeDate = (dateString: string | null | undefined): Date | null => {
      if (!dateString) return null;
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date;
      } catch (error) {
        return null;
      }
    };

    const grouped = records.reduce((acc, record) => {
      const recordDate = safeDate(record.date);
      const year = record.year;
      
      let month, date;
      if (recordDate) {
        try {
          month = recordDate.toLocaleDateString('ko-KR', { month: 'long' });
          date = recordDate.toLocaleDateString('ko-KR', { day: 'numeric' });
        } catch (error) {
          month = '1월';
          date = '1일';
        }
      } else {
        month = '1월';
        date = '1일';
      }
      
      if (!acc[year]) {
        acc[year] = {};
      }
      if (!acc[year][month]) {
        acc[year][month] = {};
      }
      if (!acc[year][month][date]) {
        acc[year][month][date] = [];
      }
      
      acc[year][month][date].push(record);
      return acc;
    }, {} as { [year: string]: { [month: string]: { [date: string]: HealthRecord[] } } });

    // 각 날짜 내에서 시간순 정렬 (최신순)
    Object.keys(grouped).forEach(year => {
      Object.keys(grouped[year]).forEach(month => {
        Object.keys(grouped[year][month]).forEach(date => {
          grouped[year][month][date].sort((a, b) => {
            const dateA = safeDate(a.date);
            const dateB = safeDate(b.date);
            if (dateA && dateB) {
              return dateB.getTime() - dateA.getTime();
            }
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            return b.date.localeCompare(a.date);
          });
        });
      });
    });

    setGroupedRecords(grouped);
    
    // 기본적으로 모든 항목을 펼쳐진 상태로 설정 (약국 제외)
    const allRecordIds = records
      .filter(r => !(r.type === 'prescription' && r.isPharmacy)) // 약국 제외
      .map(r => r.id);
    setExpandedItems(new Set(allRecordIds));
  }, [healthData, prescriptionData, rangeStartYear, rangeEndYear]);

  // 필터링된 레코드 (하위 내용이 있는 아이템만 표시)
  const filteredRecords = useMemo(() => {
    return Object.keys(groupedRecords).reduce((accYear, year) => {
      const filteredYear: { [month: string]: { [date: string]: HealthRecord[] } } = {};
      
      Object.keys(groupedRecords[year]).forEach(month => {
        const filteredMonth: { [date: string]: HealthRecord[] } = {};
        
        Object.keys(groupedRecords[year][month]).forEach(date => {
          // 하위 내용이 있는 아이템만 필터링 (검진 또는 약품이 있는 처방전)
          const filteredDateRecords = groupedRecords[year][month][date].filter(record => {
            if (record.type === 'checkup') {
              return true; // 검진은 항상 표시
            }
            if (record.type === 'prescription' && record.hasMedications) {
              return true; // 약품이 있는 처방전만 표시
            }
            return false;
          });
          
          if (filteredDateRecords.length > 0) {
            filteredMonth[date] = filteredDateRecords;
          }
        });
        
        if (Object.keys(filteredMonth).length > 0) {
          filteredYear[month] = filteredMonth;
        }
      });
      
      if (Object.keys(filteredYear).length > 0) {
        accYear[year] = filteredYear;
      }
      
      return accYear;
    }, {} as { [year: string]: { [month: string]: { [date: string]: HealthRecord[] } } });
  }, [groupedRecords]);

  // 선택 항목 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onSelectionChange(selectedItems);
  }, [selectedItems, onSelectionChange]);

  // 체크박스 토글 (하위 선택 시 상위도 자동 선택)
  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      const isCurrentlySelected = newSet.has(itemId);
      
      if (isCurrentlySelected) {
        // 선택 해제
        newSet.delete(itemId);
        
        // 하위 항목이면 상위 항목도 해제할지 확인
        // (다른 하위 항목이 선택되어 있지 않으면 상위도 해제)
        if (itemId.includes('-medication-') || itemId.includes('-item-')) {
          const parentId = itemId.split('-medication-')[0].split('-item-')[0];
          const hasOtherSelectedChildren = Array.from(newSet).some(id => 
            (id.includes('-medication-') || id.includes('-item-')) && 
            (id.startsWith(`${parentId}-medication-`) || id.startsWith(`${parentId}-item-`))
          );
          if (!hasOtherSelectedChildren) {
            newSet.delete(parentId);
          }
        }
      } else {
        // 선택 추가
        newSet.add(itemId);
        
        // 하위 항목 선택 시 상위 항목도 자동 선택
        if (itemId.includes('-medication-') || itemId.includes('-item-')) {
          const parentId = itemId.split('-medication-')[0].split('-item-')[0];
          newSet.add(parentId);
        }
      }
      
      return newSet;
    });
  };

  // 뒤로가기
  const handleBack = () => {
    const queryString = location.search;
    navigate(`/${queryString}`);
  };

  // 드래그 슬라이더 이벤트 핸들러 (마우스 + 터치 지원)
  useEffect(() => {
    if (!isDragging || !sliderRef.current) {
      setDraggingYear(null);
      return;
    }

    const calculateYearFromPosition = (clientX: number) => {
      if (!sliderRef.current) return null;
      const rect = sliderRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(minYear + percent * (maxYear - minYear));
    };

    const handleMove = (clientX: number) => {
      const year = calculateYearFromPosition(clientX);
      if (year === null) return;
      
      setDraggingYear(year);
      
      if (isDragging === 'start') {
        const newStartYear = Math.min(year, rangeEndYear - 1);
        setRangeStartYear(newStartYear);
      } else if (isDragging === 'end') {
        const newEndYear = Math.max(year, rangeStartYear + 1);
        setRangeEndYear(newEndYear);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setDraggingYear(null);
    };

    const handleTouchEnd = () => {
      setIsDragging(null);
      setDraggingYear(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, minYear, maxYear, rangeStartYear, rangeEndYear]);

  // 펼치기 토글
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 검진 항목의 상태 분석 (UnifiedHealthTimeline 로직 재사용)
  const analyzeCheckupStatus = (checkup: any) => {
    const statusCounts = { normal: 0, warning: 0, abnormal: 0 };
    const groupedItems: any = {};
    
    if (!checkup.Inspections) return { statusCounts, groupedItems };
    
    const determineItemStatus = (item: any): 'normal' | 'warning' | 'abnormal' => {
      if (!item.ItemReferences || !Array.isArray(item.ItemReferences) || item.ItemReferences.length === 0) {
        return 'normal';
      }
      
      const itemValue = parseFloat(item.Value);
      if (isNaN(itemValue)) return 'normal';
      
      // 질환의심 범위 체크 (우선순위)
      const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
      if (abnormal && isInRange(itemValue, abnormal.Value)) {
        return 'abnormal';
      }
      
      // 정상(B) 또는 경계 범위 체크
      const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
      if (normalB && isInRange(itemValue, normalB.Value)) {
        return 'warning';
      }
      
      return 'normal';
    };
    
    const isInRange = (value: number, rangeStr: string): boolean => {
      if (!rangeStr) return false;
      const minMatch = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
      if (minMatch) return value < parseFloat(minMatch[1]);
      const maxMatch = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
      if (maxMatch) return value >= parseFloat(maxMatch[1]);
      const rangeMatch = rangeStr.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return value >= min && value <= max;
      }
      return false;
    };
    
    // 신장, 체중, 허리둘레 통합을 위한 임시 저장소
    const bodyMeasurements: any = {};
    
    checkup.Inspections.forEach((inspection: any) => {
      const groupName = inspection.Gubun;
      if (!groupedItems[groupName]) {
        groupedItems[groupName] = [];
      }
      
      if (inspection.Illnesses) {
        inspection.Illnesses.forEach((illness: any) => {
          if (illness.Items) {
            illness.Items.forEach((item: any) => {
              const itemName = item.Name;
              
              // 신장, 체중, 허리둘레는 별도로 처리
              if (itemName === '신장' || itemName === '체중' || itemName === '허리둘레') {
                bodyMeasurements[itemName] = {
                  name: itemName,
                  value: item.Value,
                  unit: item.Unit || '',
                  references: item.ItemReferences || [],
                  status: determineItemStatus(item),
                  illnessName: illness.Name
                };
                return; // 개별 추가하지 않음
              }
              
              // 다른 항목들은 기존대로 처리
              const status = determineItemStatus(item);
              statusCounts[status]++;
              
              groupedItems[groupName].push({
                name: item.Name,
                value: item.Value,
                unit: item.Unit || '',
                references: item.ItemReferences || [],
                status: status,
                illnessName: illness.Name
              });
            });
          }
        });
      }
    });
    
    // 신장, 체중, 허리둘레가 모두 있으면 통합 카드 추가
    if (bodyMeasurements['신장'] || bodyMeasurements['체중'] || bodyMeasurements['허리둘레']) {
      const hasAbnormal = Object.values(bodyMeasurements).some((m: any) => m.status === 'abnormal');
      const hasWarning = Object.values(bodyMeasurements).some((m: any) => m.status === 'warning');
      const overallStatus = hasAbnormal ? 'abnormal' : (hasWarning ? 'warning' : 'normal');
      
      if (overallStatus !== 'normal') {
        statusCounts[overallStatus]++;
      }
      
      groupedItems['계측검사'] = groupedItems['계측검사'] || [];
      groupedItems['계측검사'].unshift({
        isBodyMeasurement: true,
        name: '신체계측',
        measurements: bodyMeasurements,
        status: overallStatus
      });
    }
    
    return { statusCounts, groupedItems };
  };
  
  // 검진 상세 정보 렌더링 (UnifiedHealthTimeline 로직 재사용)
  const renderCheckupDetails = (checkup: any, recordId: string) => {
    const { statusCounts, groupedItems } = analyzeCheckupStatus(checkup);
    const selectedGroup = selectedCheckupGroups[recordId] || Object.keys(groupedItems)[0] || '';
    const currentSlideIndex = currentSlideIndexes[recordId] || 0;
    
    const setSelectedGroup = (groupName: string) => {
      setSelectedCheckupGroups(prev => ({
        ...prev,
        [recordId]: groupName
      }));
      setCurrentSlideIndexes(prev => ({
        ...prev,
        [recordId]: 0
      }));
    };
    
    const setCurrentSlideIndex = (index: number) => {
      setCurrentSlideIndexes(prev => ({
        ...prev,
        [recordId]: index
      }));
    };
    
    const getStatusBadgeClass = (status: string) => {
      switch (status) {
        case 'normal': return 'status-normal';
        case 'warning': return 'status-warning';
        case 'abnormal': return 'status-abnormal';
        default: return 'status-normal';
      }
    };
    
    const renderGroupSlider = () => (
      <div className="group-slider">
        {Object.keys(groupedItems).map((groupName) => (
          <button
            key={groupName}
            className={`group-tab ${selectedGroup === groupName ? 'active' : ''}`}
            onClick={() => setSelectedGroup(groupName)}
          >
            {groupName}
          </button>
        ))}
      </div>
    );
    
    const renderGroupItems = () => {
      const allItems = groupedItems[selectedGroup] || [];
      const currentFilter = statusFilters[recordId];
      
      const items = currentFilter 
        ? allItems.filter((item: any) => item.status === currentFilter)
        : allItems;
      
      const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const scrollLeft = container.scrollLeft;
        const cardWidth = 220;
        const newIndex = Math.round(scrollLeft / cardWidth);
        setCurrentSlideIndex(newIndex);
      };
      
      const scrollToSlide = (index: number) => {
        const container = document.querySelector(`#slider-${recordId}`) as HTMLElement;
        if (container) {
          const cardWidth = 220;
          container.scrollTo({
            left: index * cardWidth,
            behavior: 'smooth'
          });
        }
        setCurrentSlideIndex(index);
      };
      
      return (
        <div className="slider-container">
          <div 
            id={`slider-${recordId}`}
            className="group-items-slider"
            onScroll={handleScroll}
          >
            {items.map((item: any, index: number) => {
              const itemId = `${recordId}-item-${index}`;
              const isItemSelected = selectedItems.has(itemId);
              
              return (
              <div key={index} className={`checkup-item-card ${getStatusBadgeClass(item.status)} ${isItemSelected ? 'selected' : ''}`}>
                {/* 뱃지와 체크박스 - 우상단에 나란히 배치 (뱃지 왼쪽, 체크박스 오른쪽) */}
                <div className="checkup-item-badge-checkbox-wrapper">
                  {/* 뱃지 - 왼쪽 */}
                  <div className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                    {item.status === 'normal' ? '정' : 
                     item.status === 'warning' ? '경' : '이'}
                  </div>
                  {/* 체크박스 - 오른쪽 */}
                  <div className="checkup-item-checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={itemId}
                      className="checkup-item-checkbox"
                      checked={isItemSelected}
                      onChange={() => handleToggleItem(itemId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                {item.isBodyMeasurement ? (
                  <>
                    <div className="item-name-only">{item.name}</div>
                    <div className="body-measurements">
                      {item.measurements['신장'] && (
                        <div className="measurement-item">
                          <span className="measurement-label">신장</span>
                          <span className="measurement-value">
                            {item.measurements['신장'].value}
                            <span className="measurement-unit">{item.measurements['신장'].unit}</span>
                          </span>
                        </div>
                      )}
                      {item.measurements['체중'] && (
                        <div className="measurement-item">
                          <span className="measurement-label">체중</span>
                          <span className="measurement-value">
                            {item.measurements['체중'].value}
                            <span className="measurement-unit">{item.measurements['체중'].unit}</span>
                          </span>
                        </div>
                      )}
                      {item.measurements['허리둘레'] && (
                        <div className="measurement-item">
                          <span className="measurement-label">허리둘레</span>
                          <span className="measurement-value">
                            {item.measurements['허리둘레'].value}
                            <span className="measurement-unit">{item.measurements['허리둘레'].unit}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {item.measurements['허리둘레']?.references.length > 0 && (
                      <div className="item-references-compact">
                        {item.measurements['허리둘레'].references.map((ref: any, refIndex: number) => (
                          <div key={refIndex} className="reference-line">
                            <span className="ref-label">{ref.Name}</span>
                            <span className="ref-range">{ref.Value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="item-name-only">{item.name}</div>
                    <div className="item-value-large">
                      {item.value}
                      <span className="item-unit">{item.unit}</span>
                    </div>
                    {item.references.length > 0 && (
                      <div className="item-references-compact">
                        {item.references.map((ref: any, refIndex: number) => (
                          <div key={refIndex} className="reference-line">
                            <span className="ref-label">{ref.Name}</span>
                            <span className="ref-range">{ref.Value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
            })}
          </div>
          {items.length > 1 && (
            <div className="dot-indicators">
              {items.map((item: any, index: number) => (
                <button
                  key={index}
                  className={`dot ${index === currentSlideIndex ? 'active' : ''}`}
                  onClick={() => scrollToSlide(index)}
                  aria-label={`${index + 1}번째 항목으로 이동`}
                />
              ))}
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="advanced-checkup-details">
        {renderGroupSlider()}
        {renderGroupItems()}
      </div>
    );
  };
  
  // 처방전 상세 정보 렌더링
  const renderPrescriptionDetails = (prescription: any, recordId: string) => {
    const medicationList = prescription.RetrieveTreatmentInjectionInformationPersonDetailList || [];
    
    return (
      <div className="record-details">
        {medicationList.length > 0 && (
          <div className="medication-list">
            <span className="detail-label">처방 약품</span>
            <div className="medications">
              {medicationList.map((med: any, idx: number) => {
                const medicationId = `${recordId}-medication-${idx}`;
                const isMedicationSelected = selectedItems.has(medicationId);
                
                return (
                  <div key={idx} className={`medication-item ${isMedicationSelected ? 'selected' : ''}`}>
                    {/* 뱃지와 체크박스 - 우상단에 나란히 배치 */}
                    <div className="medication-badge-checkbox-wrapper">
                      {med.TuyakIlSoo && <span className="medication-duration">{med.TuyakIlSoo}일</span>}
                      {/* 체크박스 - 뱃지 옆에 배치 */}
                      <div className="medication-item-checkbox-wrapper">
                        <input
                          type="checkbox"
                          id={medicationId}
                          className="medication-item-checkbox"
                          checked={isMedicationSelected}
                          onChange={() => handleToggleItem(medicationId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    
                    {/* 효능 - 위에 표시 (두꺼운 글씨) */}
                    {med.ChoBangYakPumHyoneung && (
                      <div className="medication-effect-top">
                        <span className="medication-effect">{med.ChoBangYakPumHyoneung}</span>
                      </div>
                    )}
                    
                    {/* 약이름 - 아래에 표시 */}
                    <div className="medication-header">
                      <span className="medication-name">{med.ChoBangYakPumMyung || '약품명 미상'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 설문 패널 상태
  const [showSurveyPanel, setShowSurveyPanel] = useState(false);
  const [pendingConcerns, setPendingConcerns] = useState<ConcernItemForAPI[]>([]);

  // 다음 단계 (설문 패널 표시)
  const handleNext = () => {
    if (selectedItems.size === 0) return;
    
    // 선택된 HealthRecord를 ConcernItemForAPI 형식으로 변환
    const selectedConcerns: ConcernItemForAPI[] = [];
    
    Object.keys(filteredRecords).forEach(year => {
      Object.keys(filteredRecords[year]).forEach(month => {
        Object.keys(filteredRecords[year][month]).forEach(date => {
          filteredRecords[year][month][date].forEach(record => {
            // 상위 항목만 처리 (하위 항목은 상위 항목에 포함됨)
            if (selectedItems.has(record.id) && !record.id.includes('-medication-') && !record.id.includes('-item-')) {
              // 하위 항목 찾기
              const childMedications = Array.from(selectedItems).filter(id => 
                id.startsWith(`${record.id}-medication-`)
              );
              const childItems = Array.from(selectedItems).filter(id => 
                id.startsWith(`${record.id}-item-`)
              );
              
              if (record.type === 'checkup') {
                const { statusCounts } = analyzeCheckupStatus(record.details);
                selectedConcerns.push({
                  type: 'checkup',
                  id: record.id,
                  name: '건강검진',
                  date: record.date,
                  location: record.institution,
                  status: (record.status === '의심' || record.status === '이상' || record.status === '위험') ? 'abnormal' : 
                          (record.status === '주의' || record.status === '경계') ? 'warning' : undefined,
                  abnormalCount: statusCounts.abnormal,
                  warningCount: statusCounts.warning
                });
              } else if (record.type === 'prescription') {
                if (record.isPharmacy) {
                  // 약국
                  selectedConcerns.push({
                    type: 'medication',
                    id: record.id,
                    medicationName: record.institution,
                    period: record.date,
                    hospitalName: record.institution
                  });
                } else {
                  // 진료
                  selectedConcerns.push({
                    type: 'hospital',
                    id: record.id,
                    hospitalName: record.institution,
                    checkupDate: record.date
                  });
                }
              }
            }
          });
        });
      });
    });
    
    // 설문 패널 표시
    setPendingConcerns(selectedConcerns);
    setShowSurveyPanel(true);
  };

  // 설문 제출 후 실제 API 호출
  const handleSurveySubmit = (surveyResponses: any) => {
    setShowSurveyPanel(false);
    // 설문 응답을 포함하여 onNext 호출
    onNext(selectedItems, pendingConcerns, surveyResponses);
  };

  // UnifiedHealthTimeline 구조로 렌더링 (체크박스 추가)
  const sortedYears = Object.keys(filteredRecords).sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="concern-selection">
      {/* 헤더 */}
      <HealthTrendsHeader
        onBack={handleBack}
        title="검진 항목 설계"
        description="기존 검진/처방 이력중 설계에서
유의 하게 보실게 있으면 선택해주세요"
        headerType="large"
        lastUpdateTime={null}
      />


      {/* UnifiedHealthTimeline 구조로 렌더링 (체크박스 추가) */}
      <div className="concern-items-container unified-timeline">
        <div className="timeline-content">
          {sortedYears.length === 0 ? (
            <div className="concern-items-empty">
              <p>선택 가능한 항목이 없습니다.</p>
            </div>
          ) : (
            sortedYears
              .filter((year: string) => {
                // 필터링 후 아이템이 있는 월이 있는 년도만 표시
                const hasFilteredItems = Object.keys(filteredRecords[year])
                  .some((month: string) => {
                    return Object.keys(filteredRecords[year][month])
                      .some((date: string) => {
                        const filteredItems = filteredRecords[year][month][date]
                          .filter((record: HealthRecord) => {
                            if (record.type === 'checkup') return true;
                            if (record.type === 'prescription' && record.hasMedications) return true;
                            return false;
                          });
                        return filteredItems.length > 0;
                      });
                  });
                return hasFilteredItems;
              })
              .map((year: string) => {
                // 필터링된 아이템 개수만 계산
                const yearTotalCount = Object.keys(filteredRecords[year])
                  .reduce((total, month) => {
                    return total + Object.keys(filteredRecords[year][month])
                      .reduce((monthTotal, date) => {
                        const filteredItems = filteredRecords[year][month][date]
                          .filter((record: HealthRecord) => {
                            if (record.type === 'checkup') return true;
                            if (record.type === 'prescription' && record.hasMedications) return true;
                            return false;
                          });
                        return monthTotal + filteredItems.length;
                      }, 0);
                  }, 0);
              
              return (
                <div key={year} className="year-section" data-year={year}>
                  <div className="year-header">
                    <h3 className="year-title">{year}년</h3>
                    <span className="year-count">{yearTotalCount}건</span>
                  </div>
                  
                  <div className="months-list">
                    {Object.keys(filteredRecords[year])
                      .sort((a, b) => {
                        const monthA = parseInt(a.replace('월', ''));
                        const monthB = parseInt(b.replace('월', ''));
                        return monthB - monthA;
                      })
                      .filter((month: string) => {
                        // 필터링 후 아이템이 있는 날짜가 있는 월만 표시
                        const hasFilteredItems = Object.keys(filteredRecords[year][month])
                          .some((date: string) => {
                            const filteredItems = filteredRecords[year][month][date]
                              .filter((record: HealthRecord) => {
                                if (record.type === 'checkup') return true;
                                if (record.type === 'prescription' && record.hasMedications) return true;
                                return false;
                              });
                            return filteredItems.length > 0;
                          });
                        return hasFilteredItems;
                      })
                      .map((month: string) => {
                        // 필터링된 아이템 개수만 계산
                        const monthTotalCount = Object.keys(filteredRecords[year][month])
                          .reduce((total, date) => {
                            const filteredItems = filteredRecords[year][month][date]
                              .filter((record: HealthRecord) => {
                                if (record.type === 'checkup') return true;
                                if (record.type === 'prescription' && record.hasMedications) return true;
                                return false;
                              });
                            return total + filteredItems.length;
                          }, 0);
                        
                        return (
                          <div key={`${year}-${month}`} className="month-section" data-year={year} data-month={month}>
                            <div className="month-header">
                              <h4 className="month-title">{month}</h4>
                              <span className="month-count">{monthTotalCount}건</span>
                            </div>
                            
                            <div className="dates-list">
                              {Object.keys(filteredRecords[year][month])
                                .sort((a, b) => {
                                  const dateA = parseInt(a.replace('일', ''));
                                  const dateB = parseInt(b.replace('일', ''));
                                  return dateB - dateA;
                                })
                                .filter((date: string) => {
                                  // 필터링 후 아이템이 있는 날짜만 표시
                                  const filteredItems = filteredRecords[year][month][date]
                                    .filter((record: HealthRecord) => {
                                      // 펼칠 게 있는 아이템만 표시
                                      if (record.type === 'checkup') {
                                        return true; // 검진은 항상 펼칠 수 있음
                                      }
                                      if (record.type === 'prescription' && record.hasMedications) {
                                        return true; // 처방전은 약품이 있을 때만
                                      }
                                      return false; // 그 외는 표시하지 않음
                                    });
                                  return filteredItems.length > 0; // 아이템이 있는 날짜만
                                })
                                .map((date: string) => {
                                  // 필터링된 아이템만 가져오기
                                  const filteredItems = filteredRecords[year][month][date]
                                    .filter((record: HealthRecord) => {
                                      // 펼칠 게 있는 아이템만 표시
                                      if (record.type === 'checkup') {
                                        return true; // 검진은 항상 펼칠 수 있음
                                      }
                                      if (record.type === 'prescription' && record.hasMedications) {
                                        return true; // 처방전은 약품이 있을 때만
                                      }
                                      return false; // 그 외는 표시하지 않음
                                    });
                                  
                                  return (
                                    <div 
                                      key={`${year}-${month}-${date}`} 
                                      className="date-section"
                                      data-year={year}
                                      data-month={month}
                                      data-date={date}
                                    >
                                      <div className="records-list">
                                        {filteredItems.map((record: HealthRecord) => {
                                          const isSelected = selectedItems.has(record.id);
                                          const isExpanded = expandedItems.has(record.id);
                                          
                                          // 년.월.일 뱃지 생성
                                          const dateBadge = `${year}.${month.replace('월', '')}.${date.replace('일', '')}`;
                                          
                                          return (
                                            <div 
                                              key={record.id} 
                                              className={`record-item-wrapper ${record.type} ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                                            >
                                              <div 
                                                className={`record-item ${record.type} ${record.isPharmacy ? 'pharmacy' : ''} ${isExpanded ? 'expanded' : ''}`}
                                              >
                                                {/* 접기/펼치기 버튼과 체크박스 - 겹치지 않게 배치 */}
                                                <div className="record-header-actions">
                                                  {/* 접기/펼치기 버튼 - 약국은 제외 */}
                                                  {(record.type === 'checkup' || (record.type === 'prescription' && record.hasMedications && !record.isPharmacy)) && (
                                                    <div className="record-toggle">
                                                      <div 
                                                        className="toggle-button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          toggleExpanded(record.id);
                                                        }}
                                                        title={isExpanded ? "접기" : "펼치기"}
                                                      >
                                                        <svg 
                                                          className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}
                                                          viewBox="0 0 24 24" 
                                                          fill="none" 
                                                          stroke="currentColor"
                                                        >
                                                          <polyline points="6,9 12,15 18,9"></polyline>
                                                        </svg>
                                                      </div>
                                                    </div>
                                                  )}
                                                  
                                                  {/* 체크박스 - 접기/펼치기 버튼 옆에 배치 */}
                                                  <div className="record-checkbox-wrapper">
                                                    <input
                                                      type="checkbox"
                                                      id={record.id}
                                                      className="record-checkbox"
                                                      checked={isSelected}
                                                      onChange={() => handleToggleItem(record.id)}
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                  </div>
                                                </div>
                                                
                                                <div 
                                                  className="record-header"
                                                  style={{ cursor: 'pointer' }}
                                                  onClick={() => handleToggleItem(record.id)}
                                                >
                                                  <div className="record-icon">
                                                    {record.isPharmacy ? (
                                                      <div className="icon-badge pharmacy">
                                                        <span>약국</span>
                                                      </div>
                                                    ) : record.type === 'checkup' ? (
                                                      <div className="icon-badge checkup">
                                                        <span>검진</span>
                                                      </div>
                                                    ) : (
                                                      <div className="icon-badge prescription">
                                                        <span>진료</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  <div className="record-info">
                                                    <div className="record-main">
                                                      <span className="record-institution">{record.institution}</span>
                                                      {/* 년.월.일 뱃지 */}
                                                      <span className="record-date-badge">{dateBadge}</span>
                                                      {record.treatmentType && (
                                                        <>
                                                          <span className="record-separator">|</span>
                                                          <span className="record-treatment">{record.treatmentType}</span>
                                                        </>
                                                      )}
                                                      {record.type === 'checkup' && record.status && (
                                                        <>
                                                          <span className="record-separator">|</span>
                                                          <span className="record-treatment">{record.status}</span>
                                                        </>
                                                      )}
                                                    </div>
                                                    
                                                    {record.type === 'prescription' && (
                                                      <>
                                                        {record.isPharmacy ? (
                                                          // 약국: 약품 효능(설명) 뱃지 목록 표시
                                                          (() => {
                                                            const medicationList = record.details?.RetrieveTreatmentInjectionInformationPersonDetailList || [];
                                                            return medicationList.length > 0 ? (
                                                              <div className="record-summary">
                                                                {medicationList.map((med: any, idx: number) => {
                                                                  // 효능이 있으면 효능을, 없으면 약품명을 표시
                                                                  const displayText = med.ChoBangYakPumHyoneung || med.ChoBangYakPumMyung || '약품 정보 없음';
                                                                  return (
                                                                    <span key={idx} className="medication-effect-badge">
                                                                      {displayText}
                                                                    </span>
                                                                  );
                                                                })}
                                                              </div>
                                                            ) : null;
                                                          })()
                                                        ) : (
                                                          // 진료: 기존 뱃지 유지
                                                          <div className="record-summary">
                                                            {record.visitCount !== null && record.visitCount !== undefined && record.visitCount > 0 && (
                                                              <span className="visit-count">방문 {record.visitCount}회</span>
                                                            )}
                                                            {record.medicationCount !== null && record.medicationCount !== undefined && record.medicationCount > 0 && (
                                                              <span className="medication-count">투약 {record.medicationCount}회</span>
                                                            )}
                                                            {record.prescriptionCount !== null && record.prescriptionCount !== undefined && record.prescriptionCount > 0 && (
                                                              <span className="prescription-count">처방 {record.prescriptionCount}회</span>
                                                            )}
                                                          </div>
                                                        )}
                                                      </>
                                                    )}
                                                    
                                                    {record.type === 'checkup' && (() => {
                                                      const { statusCounts } = analyzeCheckupStatus(record.details);
                                                      return (
                                                        <div className="record-summary">
                                                          {statusCounts.normal > 0 && (
                                                            <span className="checkup-status-badge status-normal">정상 {statusCounts.normal}</span>
                                                          )}
                                                          {statusCounts.warning > 0 && (
                                                            <span className="checkup-status-badge status-warning">경계 {statusCounts.warning}</span>
                                                          )}
                                                          {statusCounts.abnormal > 0 && (
                                                            <span className="checkup-status-badge status-abnormal">이상 {statusCounts.abnormal}</span>
                                                          )}
                                                        </div>
                                                      );
                                                    })()}
                                                  </div>
                                                </div>
                                                
                                                {/* 펼쳐진 상세 정보 - 약국은 제외 */}
                                                {isExpanded && (
                                                  (record.type === 'checkup' || (record.type === 'prescription' && record.hasMedications && !record.isPharmacy))
                                                ) && (
                                                  <div className="record-content">
                                                    {record.type === 'checkup' 
                                                      ? renderCheckupDetails(record.details, record.id)
                                                      : renderPrescriptionDetails(record.details, record.id)
                                                    }
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 선택된 항목 썸네일 장바구니 (하단 고정) */}
      {selectedItems.size > 0 && (
        <div className="concern-selection-cart">
          <div className="concern-selection-cart__header">
            <span className="concern-selection-cart__title">선택한 항목 ({selectedItems.size}개)</span>
          </div>
          <div className="concern-selection-cart__items">
            {Array.from(selectedItems)
              .filter(itemId => {
                // 상위 항목만 표시 (하위 항목은 상위 항목에 포함됨)
                return !itemId.includes('-medication-') && !itemId.includes('-item-');
              })
              .map((itemId) => {
                // 선택된 HealthRecord 찾기
                let selectedRecord: HealthRecord | null = null;
                
                for (const year of Object.keys(filteredRecords)) {
                  for (const month of Object.keys(filteredRecords[year])) {
                    for (const date of Object.keys(filteredRecords[year][month])) {
                      const record = filteredRecords[year][month][date].find(r => r.id === itemId);
                      if (record) {
                        selectedRecord = record;
                        break;
                      }
                    }
                    if (selectedRecord) break;
                  }
                  if (selectedRecord) break;
                }
                
                if (!selectedRecord) return null;
                
                // 하위 항목 찾기
                const children = Array.from(selectedItems).filter(id => 
                  id.startsWith(`${itemId}-medication-`) || id.startsWith(`${itemId}-item-`)
                );
                
                return (
                  <div 
                    key={itemId} 
                    className="concern-selection-cart__item"
                    onClick={() => {
                      setSelectedCartItem({
                        itemId,
                        record: selectedRecord,
                        children
                      });
                      setIsCartModalOpen(true);
                    }}
                  >
                    <div className="concern-selection-cart__item-thumbnail">
                      <div className="concern-selection-cart__item-name">{selectedRecord.institution}</div>
                      <div className="concern-selection-cart__item-meta">
                        {selectedRecord.date} | {selectedRecord.isPharmacy ? '약국' : selectedRecord.type === 'checkup' ? '검진' : '진료'}
                        {children.length > 0 && ` (${children.length}개 세부항목)`}
                      </div>
                    </div>
                    <button
                      className="concern-selection-cart__item-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 상위 항목과 모든 하위 항목 제거
                        handleToggleItem(itemId);
                        children.forEach(childId => handleToggleItem(childId));
                      }}
                      aria-label="제거"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      
      {/* 장바구니 아이템 상세 모달 */}
      <WelloModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        showCloseButton={true}
        showWelloIcon={false}
        size="large"
      >
        {selectedCartItem && selectedCartItem.record && (
          <div className="cart-item-detail-modal">
            <h3 className="cart-item-detail-modal__title">선택된 항목 상세</h3>
            <div className="cart-item-detail-modal__content">
              <div className="cart-item-detail-modal__main">
                <div className="cart-item-detail-modal__field">
                  <span className="cart-item-detail-modal__label">기관명:</span>
                  <span className="cart-item-detail-modal__value">{selectedCartItem.record.institution}</span>
                </div>
                <div className="cart-item-detail-modal__field">
                  <span className="cart-item-detail-modal__label">날짜:</span>
                  <span className="cart-item-detail-modal__value">{selectedCartItem.record.date}</span>
                </div>
                <div className="cart-item-detail-modal__field">
                  <span className="cart-item-detail-modal__label">유형:</span>
                  <span className="cart-item-detail-modal__value">
                    {selectedCartItem.record.isPharmacy ? '약국' : selectedCartItem.record.type === 'checkup' ? '검진' : '진료'}
                  </span>
                </div>
                {selectedCartItem.children.length > 0 && (
                  <div className="cart-item-detail-modal__field">
                    <span className="cart-item-detail-modal__label">선택된 세부항목:</span>
                    <div className="cart-item-detail-modal__children">
                      {selectedCartItem.children.map((childId: string) => {
                        // 하위 항목 정보 찾기
                        let childInfo = childId;
                        
                        if (selectedCartItem.record) {
                          if (childId.includes('-medication-')) {
                            // 약품 정보 찾기
                            const medIndex = parseInt(childId.split('-medication-')[1]);
                            if (selectedCartItem.record.type === 'prescription' && selectedCartItem.record.details) {
                              const medList = selectedCartItem.record.details.RetrieveTreatmentInjectionInformationPersonDetailList || [];
                              const med = medList[medIndex];
                              if (med) {
                                childInfo = `약품: ${med.ChoBangYakPumMyung || '약품명 미상'}`;
                              }
                            }
                          } else if (childId.includes('-item-')) {
                            // 검진 항목 정보 찾기
                            const itemIndex = parseInt(childId.split('-item-')[1]);
                            if (selectedCartItem.record.type === 'checkup' && selectedCartItem.record.details) {
                              const { groupedItems } = analyzeCheckupStatus(selectedCartItem.record.details);
                              const allItems = Object.values(groupedItems).flat();
                              const item = allItems[itemIndex] as any;
                              if (item && item.name) {
                                childInfo = `검진항목: ${item.name}`;
                              }
                            }
                          }
                        }
                        
                        return (
                          <div key={childId} className="cart-item-detail-modal__child">
                            {childInfo}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="cart-item-detail-modal__json">
                <div className="cart-item-detail-modal__label">데이터 구조:</div>
                <pre className="cart-item-detail-modal__json-content">
                  {JSON.stringify(selectedCartItem.record, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </WelloModal>

      {/* 하단 버튼 (고정) */}
      <button
        className="concern-selection-next-button"
        onClick={handleNext}
        disabled={selectedItems.size === 0}
      >
        다음 단계로 진행하기
      </button>

      {/* 설문 패널 */}
      <CheckupDesignSurveyPanel
        isOpen={showSurveyPanel}
        onClose={() => setShowSurveyPanel(false)}
        onSubmit={handleSurveySubmit}
        selectedCount={selectedItems.size}
      />
    </div>
  );
};

export default ConcernSelection;

