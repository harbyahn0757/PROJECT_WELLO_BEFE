/**
 * 통합 건강 타임라인 컴포넌트
 * 건강검진과 처방전을 년도별로 통합하여 모던한 아코디언 형태로 표시
 */
import React, { useState, useEffect } from 'react';
import DrugDetailModal from '../DrugDetailModal';
import { API_ENDPOINTS } from '../../../config/api';
import { WELNO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

// 알약 이미지 경로
const pillIconPath = `${process.env.PUBLIC_URL || ''}/free-icon-pill-5405585.png`;

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

interface UnifiedHealthTimelineProps {
  healthData?: any;
  prescriptionData?: any;
  loading?: boolean;
  filterMode?: 'all' | 'checkup' | 'pharmacy' | 'treatment';
}

const UnifiedHealthTimeline: React.FC<UnifiedHealthTimelineProps> = ({
  healthData,
  prescriptionData,
  loading = false,
  filterMode = 'all'
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set()); // 병원명 확장 상태
  const [groupedRecords, setGroupedRecords] = useState<{ 
    [year: string]: { 
      [month: string]: { 
        [date: string]: HealthRecord[] 
      } 
    } 
  }>({});
  const [selectedCheckupGroups, setSelectedCheckupGroups] = useState<{ [recordId: string]: string }>({});
  const [currentSlideIndexes, setCurrentSlideIndexes] = useState<{ [recordId: string]: number }>({});
  
  // 약품 상세정보 모달 상태
  const [isDrugModalOpen, setIsDrugModalOpen] = useState(false);
  const [selectedDrugInfo, setSelectedDrugInfo] = useState<any>(null);
  const [selectedMedicationData, setSelectedMedicationData] = useState<any>(null);
  const [statusFilters, setStatusFilters] = useState<{ [recordId: string]: string | null }>({});
  
  // Sticky 헤더 상태 (현재 sticky로 표시할 헤더)
  const [stickyYearInfo, setStickyYearInfo] = useState<string | null>(null);
  const [stickyMonthInfo, setStickyMonthInfo] = useState<{ year: string; month: string } | null>(null);
  const [stickyDateInfo, setStickyDateInfo] = useState<{ year: string; month: string; date: string } | null>(null);
  
  // 스크롤 감지로 sticky 헤더 결정
  useEffect(() => {
    const bodyElement = document.querySelector('.content-layout-with-header__body') as HTMLElement;
    const headerElement = document.querySelector('.content-layout-with-header__header') as HTMLElement;
    const toggleElement = document.querySelector('.content-layout-with-header__toggle') as HTMLElement;
    
    if (!bodyElement) return;
    
    // stickyTop 위치 계산
    // sticky 헤더는 bodyElement 내부에서 position: sticky, top: 0으로 동작하므로
    // bodyElement의 상단 위치(뷰포트 기준)가 stickyTop이 됩니다
    const calculateStickyTop = () => {
      const bodyRect = bodyElement.getBoundingClientRect();
      // bodyElement의 상단이 stickyTop 위치 (뷰포트 기준)
      return bodyRect.top;
    };
    
    let stickyTop = calculateStickyTop();
    
    const isBodyScrollable = bodyElement.scrollHeight > bodyElement.clientHeight;
    const scrollTarget = isBodyScrollable ? bodyElement : window;
    
    const handleScroll = () => {
      // stickyTop 위치 재계산 (리사이즈나 다른 변경사항 대응)
      stickyTop = calculateStickyTop();
      
      // 일 헤더 감지 (가장 우선순위)
      const dateSections = document.querySelectorAll('.date-section[data-year][data-month][data-date]');
      type DateInfo = { year: string; month: string; date: string };
      let topStickyDate: DateInfo | null = null;
      
      dateSections.forEach((section) => {
        const header = section.querySelector('.date-header') as HTMLElement;
        if (!header) return;
        
        const rect = header.getBoundingClientRect();
        if (rect.top <= stickyTop + 2 && rect.top >= stickyTop - 2) {
          const year = section.getAttribute('data-year') || '';
          const month = section.getAttribute('data-month') || '';
          const date = section.getAttribute('data-date') || '';
          
          if (year && month && date && (!topStickyDate || rect.top < (document.querySelector(`[data-year="${topStickyDate.year}"][data-month="${topStickyDate.month}"][data-date="${topStickyDate.date}"]`)?.getBoundingClientRect().top || 0))) {
            topStickyDate = { year, month, date };
          }
        }
      });
      
      // 일 헤더가 stickyTop에 있으면 년 월 일 함께 표시
      if (topStickyDate !== null) {
        const dateInfo: DateInfo = topStickyDate;
        setStickyDateInfo(dateInfo);
        // 일의 월 정보 설정
        setStickyMonthInfo({ year: dateInfo.year, month: dateInfo.month });
        // 일의 년도 정보 유지 (년도는 항상 표시)
        setStickyYearInfo(dateInfo.year);
        return;
      }
      
      // 월 헤더 감지 (일이 없을 때)
      const monthHeaders = document.querySelectorAll('.month-header');
      let topStickyMonth: { year: string; month: string } | null = null;
      
      monthHeaders.forEach((header) => {
        const rect = header.getBoundingClientRect();
        const monthSection = header.closest('.month-section') as Element | null;
        
        if (monthSection) {
          const year = monthSection.getAttribute('data-year') || '';
          const month = monthSection.getAttribute('data-month') || 
                       header.querySelector('.month-title')?.textContent || '';
          
          if (year && month) {
            if (rect.top <= stickyTop + 2 && rect.top >= stickyTop - 2) {
              if (!topStickyMonth || rect.top < (document.querySelector(`[data-year="${topStickyMonth.year}"][data-month="${topStickyMonth.month}"]`)?.querySelector('.month-header')?.getBoundingClientRect().top || 0)) {
                topStickyMonth = { year, month };
              }
            }
          }
        }
      });
      
      // 월 헤더가 stickyTop에 있으면 년 월 함께 표시
      if (topStickyMonth !== null) {
        const monthInfo: { year: string; month: string } = topStickyMonth;
        setStickyDateInfo(null);
        setStickyMonthInfo(monthInfo);
        // 월의 년도 정보 유지 (년도는 항상 표시)
        setStickyYearInfo(monthInfo.year);
        return;
      }
      
      // 년도 헤더 감지 (월이 없을 때)
      const yearSections = document.querySelectorAll('.year-section[data-year]');
      let topStickyYear: string | null = null;
      
      yearSections.forEach((section) => {
        const yearHeader = section.querySelector('.year-header') as HTMLElement;
        if (!yearHeader) return;
        
        const rect = yearHeader.getBoundingClientRect();
        const year = section.getAttribute('data-year') || '';
        
        if (year) {
          // 년도 헤더가 stickyTop에 정확히 있으면 년도만 표시
          if (rect.top <= stickyTop + 2 && rect.top >= stickyTop - 2) {
            if (!topStickyYear || rect.top < (document.querySelector(`[data-year="${topStickyYear}"]`)?.querySelector('.year-header')?.getBoundingClientRect().top || 0)) {
              topStickyYear = year;
            }
          }
        }
      });
      
      // 년도 헤더가 stickyTop에 있으면 년도만 표시
      if (topStickyYear !== null) {
        setStickyDateInfo(null);
        setStickyMonthInfo(null);
        setStickyYearInfo(topStickyYear);
        return;
      }
      
      // 아무것도 없으면 초기화
      setStickyDateInfo(null);
      setStickyMonthInfo(null);
      setStickyYearInfo(null);
    };
    
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, [groupedRecords]);
  

  // 약품 클릭 핸들러
  const handleDrugClick = async (medication: any) => {
    const drugCode = medication.DrugCode;
    
    if (!drugCode) {
      console.warn('약품 코드가 없습니다:', medication);
      return;
    }
    
    try {
      console.log('🔍 [약품클릭] 상세정보 조회 시작:', drugCode);
      
      const response = await fetch(API_ENDPOINTS.DRUG_DETAIL(drugCode));
      const result = await response.json();
      
      if (result.success && result.data) {
        setSelectedDrugInfo(result.data);
        setSelectedMedicationData(medication);
        setIsDrugModalOpen(true);
        console.log('✅ [약품클릭] 상세정보 로드 완료:', result.data);
      } else {
        console.warn('⚠️ [약품클릭] 상세정보 없음:', drugCode);
        // 기본 정보만으로 모달 표시
        setSelectedDrugInfo({
          DrugCode: drugCode,
          MediPrdcNm: medication.ChoBangYakPumMyung || '약품명 미상',
          EfftEftCnte: medication.ChoBangYakPumHyoneung || ''
        });
        setSelectedMedicationData(medication);
        setIsDrugModalOpen(true);
      }
    } catch (error) {
      console.error('❌ [약품클릭] 오류:', error);
      // 에러 시에도 기본 정보로 모달 표시
      setSelectedDrugInfo({
        DrugCode: drugCode,
        MediPrdcNm: medication.ChoBangYakPumMyung || '약품명 미상',
        EfftEftCnte: medication.ChoBangYakPumHyoneung || ''
      });
      setSelectedMedicationData(medication);
      setIsDrugModalOpen(true);
    }
  };

  const closeDrugModal = () => {
    setIsDrugModalOpen(false);
    setSelectedDrugInfo(null);
    setSelectedMedicationData(null);
  };

  useEffect(() => {
    if (!healthData && !prescriptionData) return;

    const records: HealthRecord[] = [];

    // 건강검진 데이터 변환
    if (healthData?.ResultList) {
      healthData.ResultList.forEach((checkup: any, index: number) => {
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
          date: fullDate || `${year}/01/01`, // 기본값으로 해당 연도 1월 1일
          institution: checkup.Location || checkup.location || '국민건강보험공단',
          title: '건강검진',
          status: checkup.Code || checkup.code,
          details: checkup
        });
      });
    }

    // 처방전 데이터 변환
    if (prescriptionData?.ResultList) {
      prescriptionData.ResultList.forEach((prescription: any, index: number) => {
        const year = prescription.JinRyoGaesiIl ? 
          new Date(prescription.JinRyoGaesiIl).getFullYear().toString() : 
          '2023';
        
                // 처방약품 정보가 있는지 확인 (DB 파싱된 필드 우선 사용)
                const hasMedications = (prescription.detail_records_count && prescription.detail_records_count > 0) ||
                  (prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
                   prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0);
                
                // DB 파싱된 필드를 우선 사용, 없으면 raw_data에서 추출 (0은 제외)
                const visitCount = prescription.visit_count || (prescription.BangMoonIpWonIlsoo ? parseInt(prescription.BangMoonIpWonIlsoo) : null);
                const medicationCount = prescription.medication_count || (prescription.TuYakYoYangHoiSoo ? parseInt(prescription.TuYakYoYangHoiSoo) : null);
                const prescriptionCount = prescription.prescription_count || (prescription.CheoBangHoiSoo ? parseInt(prescription.CheoBangHoiSoo) : null);
                const treatmentDate = prescription.treatment_date || prescription.JinRyoGaesiIl;
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

    // 년도 → 월 → 날짜 3단계로 그룹화
    const grouped = records.reduce((acc, record) => {
      const recordDate = safeDate(record.date);
      const year = record.year;
      
      // 날짜가 유효하지 않으면 기본값 사용
      let month, date;
      if (recordDate) {
        try {
          month = recordDate.toLocaleDateString('ko-KR', { month: 'long' }); // "10월" 형태
          date = recordDate.toLocaleDateString('ko-KR', { day: 'numeric' }); // "15일" 형태
        } catch (error) {
          console.error('날짜 포맷팅 오류:', error, record.date);
          month = '1월';
          date = '1일';
        }
      } else {
        console.warn('유효하지 않은 날짜, 기본값 사용:', record.date);
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
            
            // 둘 다 유효한 날짜인 경우
            if (dateA && dateB) {
              return dateB.getTime() - dateA.getTime();
            }
            // 하나만 유효한 경우, 유효한 날짜를 앞으로
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            // 둘 다 유효하지 않은 경우, 문자열 비교
            return b.date.localeCompare(a.date);
          });
        });
      });
    });

    setGroupedRecords(grouped);
  }, [healthData, prescriptionData]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
      setLoadingItems(prev => {
        const newLoading = new Set(prev);
        newLoading.delete(id);
        return newLoading;
      });
    } else {
      // 펼칠 때 로딩 상태 추가
      setLoadingItems(prev => new Set(prev).add(id));
      newExpanded.add(id);
      setExpandedItems(newExpanded);
      
      // DOM이 추가된 후 transition 활성화를 위해 다음 프레임에서 처리
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 약품 리스트 로딩 시뮬레이션 (실제로는 데이터가 이미 있으므로 짧은 딜레이만)
          setTimeout(() => {
            setLoadingItems(prev => {
              const newLoading = new Set(prev);
              newLoading.delete(id);
              return newLoading;
            });
          }, 300); // 300ms 로딩
        });
      });
      return; // setExpandedItems는 위에서 이미 호출됨
    }
    setExpandedItems(newExpanded);
  };

  // 안전한 날짜 처리 함수
  const safeDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      // Invalid Date 체크
      if (isNaN(date.getTime())) {
        console.warn('잘못된 날짜 형식:', dateString);
        return null;
      }
      return date;
    } catch (error) {
      console.error('날짜 파싱 오류:', error, dateString);
      return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = safeDate(dateString);
    if (!date) {
      console.warn('날짜 포맷팅 실패, 원본 반환:', dateString);
      return dateString || '날짜 없음';
    }
    
    try {
      return date.toLocaleDateString('ko-KR', { 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return dateString || '날짜 없음';
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'var(--color-gray-500)';
    
    switch (status.toLowerCase()) {
      case '정상':
        return 'var(--color-success)';
      case '의심':
      case '주의':
        return 'var(--color-warning)';
      case '이상':
      case '위험':
        return 'var(--color-danger)';
      default:
        return 'var(--color-gray-600)';
    }
  };

  // 검진 항목의 상태 분석
  const analyzeCheckupStatus = (checkup: any) => {
    const statusCounts = { normal: 0, warning: 0, abnormal: 0 };
    const groupedItems: any = {};
    
    if (!checkup.Inspections) return { statusCounts, groupedItems };
    
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
    
    // 신장, 체중, 허리둘레가 모두 있으면 통합 카드 생성
    if (bodyMeasurements['신장'] || bodyMeasurements['체중'] || bodyMeasurements['허리둘레']) {
      // 허리둘레 기준으로 상태 결정 (없으면 정상으로 처리)
      const waistStatus = bodyMeasurements['허리둘레']?.status || 'normal';
      statusCounts[waistStatus as keyof typeof statusCounts]++;
      
      // 실제 그룹명 찾기 (기본검사, 일반검사 등 다양할 수 있음)
      const availableGroups = Object.keys(groupedItems);
      
      // 기본검사 관련 그룹 찾기 (기본검사, 일반검사, 신체계측 등)
      const targetGroup = availableGroups.find(group => 
        group.includes('기본') || group.includes('일반') || group.includes('신체') || group.includes('계측')
      ) || availableGroups[0] || '기본검사'; // 첫 번째 그룹 또는 기본값
      
      if (!groupedItems[targetGroup]) {
        groupedItems[targetGroup] = [];
      }
      
      groupedItems[targetGroup].unshift({ // 맨 앞에 추가
        name: '신체계측',
        isBodyMeasurement: true, // 통합 카드 식별자
        measurements: bodyMeasurements,
        status: waistStatus,
        value: '', // 통합 카드는 단일 값 없음
        unit: '',
        references: []
      });
    }
    
    return { statusCounts, groupedItems };
  };

  // 검사 항목의 상태 판정
  const determineItemStatus = (item: any): 'normal' | 'warning' | 'abnormal' => {
    if (!item.Value || !item.ItemReferences || item.ItemReferences.length === 0) {
      return 'normal';
    }
    
    const value = item.Value.toString().toLowerCase();
    
    // 텍스트 기반 판정 (정상, 음성 등)
    if (value.includes('정상') || value.includes('음성')) {
      return 'normal';
    }
    if (value.includes('의심') || value.includes('양성')) {
      return 'abnormal';
    }
    
    // 숫자 기반 판정
    const numValue = parseFloat(item.Value.toString().replace(/[^0-9.-]/g, ''));
    if (isNaN(numValue)) return 'normal';
    
    // 질환의심 범위 체크 (우선순위)
    const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
    if (abnormal && isInRange(numValue, abnormal.Value)) {
      return 'abnormal';
    }
    
    // 정상(B) 또는 경계 범위 체크
    const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
    if (normalB && isInRange(numValue, normalB.Value)) {
      return 'warning';
    }
    
    return 'normal';
  };

  // 범위 체크 함수
  const isInRange = (value: number, rangeStr: string): boolean => {
    if (rangeStr.includes('이상')) {
      const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(threshold) && value >= threshold;
    }
    if (rangeStr.includes('미만')) {
      const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(threshold) && value < threshold;
    }
    if (rangeStr.includes('이하')) {
      const threshold = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
      return !isNaN(threshold) && value <= threshold;
    }
    if (rangeStr.includes('-')) {
      const [min, max] = rangeStr.split('-').map(s => parseFloat(s.replace(/[^0-9.-]/g, '')));
      return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
    }
    return false;
  };

  const renderCheckupDetails = (checkup: any, recordId: string) => {
    console.log('🔍 [검진상세] 데이터 확인:', checkup);
    
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
      })); // 그룹 변경 시 첫 번째 슬라이드로 이동
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

    const renderStatusBadges = () => {
      const currentFilter = statusFilters[recordId];
      
      return (
        <div className="status-badges">
          {statusCounts.normal > 0 && (
            <button 
              className={`status-badge status-normal ${currentFilter === 'normal' ? 'active' : ''}`}
              onClick={() => setStatusFilters(prev => ({
                ...prev,
                [recordId]: currentFilter === 'normal' ? null : 'normal'
              }))}
            >
              정상 {statusCounts.normal}개
            </button>
          )}
          {statusCounts.warning > 0 && (
            <button 
              className={`status-badge status-warning ${currentFilter === 'warning' ? 'active' : ''}`}
              onClick={() => setStatusFilters(prev => ({
                ...prev,
                [recordId]: currentFilter === 'warning' ? null : 'warning'
              }))}
            >
              경계 {statusCounts.warning}개
            </button>
          )}
          {statusCounts.abnormal > 0 && (
            <button 
              className={`status-badge status-abnormal ${currentFilter === 'abnormal' ? 'active' : ''}`}
              onClick={() => setStatusFilters(prev => ({
                ...prev,
                [recordId]: currentFilter === 'abnormal' ? null : 'abnormal'
              }))}
            >
              이상 {statusCounts.abnormal}개
            </button>
          )}
        </div>
      );
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
      
      // 상태 필터 적용
      const items = currentFilter 
        ? allItems.filter((item: any) => item.status === currentFilter)
        : allItems;
      
      const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const scrollLeft = container.scrollLeft;
        const cardWidth = 220; // 카드 너비 + 간격
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
            {items.map((item: any, index: number) => (
              <div key={index} className={`checkup-item-card ${getStatusBadgeClass(item.status)}`}>
                {/* 상태 뱃지 - 우상단 배치 */}
                <div className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                  {item.status === 'normal' ? '정상' : 
                   item.status === 'warning' ? '경계' : '이상'}
                </div>
                
                {/* 통합 신체계측 카드 */}
                {item.isBodyMeasurement ? (
                  <>
                    <div className="item-name-only">
                      {item.name}
                    </div>
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
                    {/* 허리둘레 기준치 표시 */}
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
                    {/* 기존 개별 항목 카드 */}
                    <div className="item-name-only">
                      {item.name}
                    </div>
                    
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
            ))}
          </div>
          
          {/* 닷 슬라이더 인디케이터 */}
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

  const renderPrescriptionDetails = (prescription: any) => (
    <div className="record-details">
      {/* 펼쳤을 때는 방문/투약/처방 정보 제거 */}
      {prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
       prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0 && (
                <div className="medication-list">
                  <span className="detail-label">처방 약품</span>
                  <div className="medications">
                    {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.slice(0, 5).map((med: any, idx: number) => (
                      <div key={idx} className="medication-item">
                        <div className="medication-header">
                          <span 
                            className="medication-name clickable"
                            onClick={() => handleDrugClick(med)}
                            title="클릭하여 약품 상세정보 보기"
                          >
                            {med.ChoBangYakPumMyung || '약품명 미상'}
                          </span>
                          {med.TuyakIlSoo && <span className="medication-duration">{med.TuyakIlSoo}일분</span>}
                        </div>
                        {med.ChoBangYakPumHyoneung && (
                          <div className="medication-description">
                            <span className="medication-effect">{med.ChoBangYakPumHyoneung}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 5 && (
                      <div className="medication-more">
                        +{prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length - 5}개 더
                      </div>
                    )}
                  </div>
                </div>
              )}
    </div>
  );

  if (loading) {
    return (
      <div className="unified-timeline">
        <div className="timeline-loading">
          <div className="loading-spinner">
            <img 
              src={WELNO_LOGO_IMAGE}
              alt="로딩 중" 
              className="welno-icon-blink"
            />
            <p>건강 기록을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 필터링 로직 적용 (3단계 구조)
  const filteredRecords = Object.keys(groupedRecords).reduce((accYear, year) => {
    const filteredYear: { [month: string]: { [date: string]: HealthRecord[] } } = {};
    
    Object.keys(groupedRecords[year]).forEach(month => {
      const filteredMonth: { [date: string]: HealthRecord[] } = {};
      
      Object.keys(groupedRecords[year][month]).forEach(date => {
        const filteredDateRecords = groupedRecords[year][month][date].filter(record => {
          switch (filterMode) {
            case 'checkup':
              return record.type === 'checkup';
            case 'pharmacy':
              return record.type === 'prescription' && record.isPharmacy;
            case 'treatment':
              return record.type === 'prescription' && !record.isPharmacy;
            case 'all':
            default:
              return true;
          }
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

  const sortedYears = Object.keys(filteredRecords).sort((a, b) => parseInt(b) - parseInt(a));

  // 로딩 중일 때는 빈 상태를 표시하지 않음
  if (sortedYears.length === 0) {
    if (loading) {
      // 로딩 중일 때는 빈 div 반환 (부모의 로딩 스피너가 표시됨)
      return <div className="unified-timeline loading"></div>;
    }
    
    return (
      <div className="unified-timeline">
        <div className="timeline-empty">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </div>
          <h3>건강 기록이 없습니다</h3>
          <p>건강검진이나 처방전 데이터가 조회되지 않았습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`unified-timeline vertical`}>
      <div className="timeline-content">
        {sortedYears.map((year: string) => {
          // 년도별 총 건수 계산
          const yearTotalCount = Object.values(filteredRecords[year])
            .reduce((total, monthData) => 
              total + Object.values(monthData).reduce((monthTotal, dateRecords) => 
                monthTotal + dateRecords.length, 0), 0);
          
          const isYearSticky = stickyYearInfo === year && !stickyMonthInfo && !stickyDateInfo;
          
          return (
            <div key={year} className="year-section" data-year={year}>
              <div className={`year-header ${isYearSticky ? 'is-sticky' : ''}`}>
                <h3 className="year-title">{year}년</h3>
                <span className="year-count">{yearTotalCount}건</span>
              </div>
              
              <div className="months-list">
                {Object.keys(filteredRecords[year])
                  .sort((a, b) => {
                    // 월 정렬 (12월, 11월, 10월... 순)
                    const monthA = parseInt(a.replace('월', ''));
                    const monthB = parseInt(b.replace('월', ''));
                    return monthB - monthA;
                  })
                  .map((month: string) => {
                    // 월별 총 건수 계산
                    const monthTotalCount = Object.values(filteredRecords[year][month])
                      .reduce((total, dateRecords) => total + dateRecords.length, 0);
                    
                    const isMonthSticky = stickyMonthInfo?.year === year && stickyMonthInfo?.month === month && !stickyDateInfo;
                    
                    return (
                      <div key={`${year}-${month}`} className="month-section" data-year={year} data-month={month}>
                        <div className={`month-header ${isMonthSticky ? 'is-sticky' : ''}`}>
                          <h4 className="month-title">{isMonthSticky && stickyYearInfo ? `${stickyYearInfo}년 ${month}` : month}</h4>
                          <span className="month-count">{monthTotalCount}건</span>
                        </div>
                        
                        <div className="dates-list">
                          {Object.keys(filteredRecords[year][month])
                            .sort((a, b) => {
                              // 날짜 정렬 (31일, 30일, 29일... 순)
                              const dateA = parseInt(a.replace('일', ''));
                              const dateB = parseInt(b.replace('일', ''));
                              return dateB - dateA;
                            })
                            .map((date: string) => {
                              const isDateSticky = stickyDateInfo?.year === year && 
                                                   stickyDateInfo?.month === month && 
                                                   stickyDateInfo?.date === date;
                              
                              return (
                              <div 
                                key={`${year}-${month}-${date}`} 
                                className="date-section"
                                data-year={year}
                                data-month={month}
                                data-date={date}
                              >
                                <div className={`date-header ${isDateSticky ? 'is-sticky' : ''}`}>
                                  <span className="date-title">
                                    {isDateSticky && stickyYearInfo && stickyMonthInfo 
                                      ? `${stickyYearInfo}년 ${stickyMonthInfo.month} ${date}` 
                                      : date}
                                  </span>
                                </div>
                                
                                <div className="records-list">
                                  {filteredRecords[year][month][date].map((record: any) => (
                                    <div 
                                      key={record.id} 
                                      className={`record-item-wrapper ${record.type}`}
                                    >
                  
                  <div 
                    className={`record-item ${record.type} ${record.isPharmacy ? 'pharmacy' : ''} ${expandedItems.has(record.id) ? 'expanded' : ''}`}
                  >
                    <div 
                      className="record-header"
                      style={{ cursor: 'default' }}
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
                          {(() => {
                            const institutionLength = record.institution?.length || 0;
                            const isLong = institutionLength > 7;
                            const isExpanded = expandedInstitutions.has(record.id);
                            
                            return (
                              <span 
                                className={`record-institution ${isExpanded ? 'expanded' : ''} ${isLong ? 'clickable' : ''}`}
                                onClick={isLong ? (e) => {
                                  e.stopPropagation();
                                  setExpandedInstitutions(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(record.id)) {
                                      newSet.delete(record.id);
                                    } else {
                                      newSet.add(record.id);
                                    }
                                    return newSet;
                                  });
                                } : undefined}
                                style={{ cursor: isLong ? 'pointer' : 'default' }}
                                title={isLong ? (isExpanded ? '클릭하여 줄이기' : '클릭하여 전체 보기') : undefined}
                              >
                                {record.institution}
                              </span>
                            );
                          })()}
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
                          <div className="record-summary">
                            {/* 방문 - 뱃지 스타일 (접혔을 때와 펼쳤을 때 모두 표시) */}
                            {(record.visitCount !== null && record.visitCount !== undefined && record.visitCount > 0) && (
                              <span className="visit-count">방문 {record.visitCount}회</span>
                            )}
                            {/* 투약 - 뱃지 스타일 (접혔을 때와 펼쳤을 때 모두 표시) */}
                            {(record.medicationCount !== null && record.medicationCount !== undefined && record.medicationCount > 0) && (
                              <span className="medication-count">투약 {record.medicationCount}회</span>
                            )}
                            {/* 처방 - 뱃지 스타일 (접혔을 때와 펼쳤을 때 모두 표시) */}
                            {(record.prescriptionCount !== null && record.prescriptionCount !== undefined && record.prescriptionCount > 0) && (
                              <span className="prescription-count">처방 {record.prescriptionCount}회</span>
                            )}
                          </div>
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
                    
                    <div className="record-toggle">
                      {/* 건강검진은 항상 펼칠 수 있음 - 토글 버튼 */}
                      {record.type === 'checkup' && (
                        <div 
                          className="toggle-button"
                          onClick={(e) => {
                            e.stopPropagation(); // 이벤트 버블링 방지
                            toggleExpanded(record.id);
                          }}
                          title="상세 정보 보기/숨기기"
                        >
                          <svg 
                            className="toggle-icon"
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      )}
                      
                      {/* 처방전에서 투약 내역이 있을 경우 토글 버튼과 약 뱃지 */}
                      {record.type === 'prescription' && record.hasMedications && (
                        <>
                          <div 
                            className="toggle-button"
                            onClick={(e) => {
                              e.stopPropagation(); // 이벤트 버블링 방지
                              toggleExpanded(record.id);
                            }}
                            title="투약 내역 보기/숨기기"
                          >
                            <svg 
                              className="toggle-icon"
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor"
                            >
                              <polyline points="6,9 12,15 18,9"></polyline>
                            </svg>
                          </div>
                          <div className="medication-badge" title="투약 내역 있음">
                            <img src={pillIconPath} alt="투약" />
                          </div>
                        </>
                      )}
                      
                    </div>
                  </div>
                  
                    {expandedItems.has(record.id) && (
                      record.type === 'checkup' || (record.type === 'prescription' && record.hasMedications)
                    ) && (
                      <div className={`record-content ${loadingItems.has(record.id) ? 'has-loading' : 'has-content'}`}>
                        {loadingItems.has(record.id) ? (
                          <div className="medication-loading">
                            <div className="loading-spinner-small">
                              <img 
                                src={WELNO_LOGO_IMAGE}
                                alt="로딩 중" 
                                className="welno-icon-blink-small"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="medication-content-fade">
                            {record.type === 'checkup' 
                              ? renderCheckupDetails(record.details, record.id)
                              : renderPrescriptionDetails(record.details)
                            }
                          </div>
                        )}
                      </div>
                    )}
                                      </div>
                                    </div>
                                  ))}
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
    
    {/* 약품 상세정보 모달 */}
    <DrugDetailModal
      isOpen={isDrugModalOpen}
      onClose={closeDrugModal}
      drugInfo={selectedDrugInfo}
      medicationData={selectedMedicationData}
    />
  </>
  );
};

export default UnifiedHealthTimeline;
