/**
 * 통합 건강 타임라인 컴포넌트
 * 건강검진과 처방전을 년도별로 통합하여 모던한 아코디언 형태로 표시
 */
import React, { useState, useEffect } from 'react';
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
}

const UnifiedHealthTimeline: React.FC<UnifiedHealthTimelineProps> = ({
  healthData,
  prescriptionData,
  loading = false
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [groupedRecords, setGroupedRecords] = useState<{ [year: string]: HealthRecord[] }>({});
  const [filterMode, setFilterMode] = useState<'all' | 'checkup' | 'pharmacy' | 'treatment'>('all');
  const [selectedCheckupGroups, setSelectedCheckupGroups] = useState<{ [recordId: string]: string }>({});
  const [currentSlideIndexes, setCurrentSlideIndexes] = useState<{ [recordId: string]: number }>({});
  const [statusFilters, setStatusFilters] = useState<{ [recordId: string]: string | null }>({});

  useEffect(() => {
    if (!healthData && !prescriptionData) return;

    const records: HealthRecord[] = [];

    // 건강검진 데이터 변환
    if (healthData?.ResultList) {
      healthData.ResultList.forEach((checkup: any, index: number) => {
        // DB의 year 필드를 우선 사용, "년" 제거
        const yearRaw = checkup.year || checkup.Year || new Date(checkup.CheckUpDate).getFullYear().toString();
        const year = yearRaw.toString().replace('년', '');
        
        records.push({
          id: `checkup-${index}`,
          type: 'checkup',
          year,
          date: checkup.CheckUpDate || checkup.checkup_date || `${year}년`,
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

    // 년도별로 그룹화하고 날짜순 정렬
    const grouped = records.reduce((acc, record) => {
      if (!acc[record.year]) {
        acc[record.year] = [];
      }
      acc[record.year].push(record);
      return acc;
    }, {} as { [year: string]: HealthRecord[] });

    // 각 년도 내에서 날짜순 정렬 (최신순)
    Object.keys(grouped).forEach(year => {
      grouped[year].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    setGroupedRecords(grouped);
  }, [healthData, prescriptionData]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', { 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
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
                            {item.measurements['신장'].value}{item.measurements['신장'].unit}
                          </span>
                        </div>
                      )}
                      {item.measurements['체중'] && (
                        <div className="measurement-item">
                          <span className="measurement-label">체중</span>
                          <span className="measurement-value">
                            {item.measurements['체중'].value}{item.measurements['체중'].unit}
                          </span>
                        </div>
                      )}
                      {item.measurements['허리둘레'] && (
                        <div className="measurement-item">
                          <span className="measurement-label">허리둘레</span>
                          <span className="measurement-value">
                            {item.measurements['허리둘레'].value}{item.measurements['허리둘레'].unit}
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
                      {item.value}{item.unit}
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
        {renderStatusBadges()}
        {renderGroupSlider()}
        {renderGroupItems()}
      </div>
    );

  };

  const renderPrescriptionDetails = (prescription: any) => (
    <div className="record-details">
      <div className="prescription-summary">
        <div className="summary-stats">
          {/* DB 파싱된 필드를 우선 사용, 0회는 표시하지 않음 */}
          {(() => {
            const visitCount = prescription.visit_count || parseInt(prescription.BangMoonIpWonIlsoo) || 0;
            const medicationCount = prescription.medication_count || parseInt(prescription.TuYakYoYangHoiSoo) || 0;
            const prescriptionCount = prescription.prescription_count || parseInt(prescription.CheoBangHoiSoo) || 0;
            
            return (
              <>
                {visitCount > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">방문</span>
                    <span className="stat-value">{visitCount}회</span>
                  </div>
                )}
                {medicationCount > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">투약</span>
                    <span className="stat-value">{medicationCount}회</span>
                  </div>
                )}
                {prescriptionCount > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">처방</span>
                    <span className="stat-value">{prescriptionCount}회</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      
              {prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
               prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0 && (
                <div className="medication-list">
                  <span className="detail-label">처방 약품</span>
                  <div className="medications">
                    {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.slice(0, 5).map((med: any, idx: number) => (
                      <div key={idx} className="medication-item">
                        <div className="medication-header">
                          <span className="medication-name">{med.ChoBangYakPumMyung || '약품명 미상'}</span>
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
            <div className="favicon-blink-spinner">
              <img 
                src="/wello/wello-icon.png" 
                alt="로딩 중" 
                style={{
                  width: '48px',
                  height: '48px',
                  animation: 'faviconBlink 1.5s ease-in-out infinite'
                }}
              />
            </div>
            <p>건강 기록을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 필터링 로직 적용
  const filteredRecords = Object.keys(groupedRecords).reduce((acc, year) => {
    const yearRecords = groupedRecords[year].filter(record => {
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
    
    if (yearRecords.length > 0) {
      acc[year] = yearRecords;
    }
    return acc;
  }, {} as { [year: string]: HealthRecord[] });

  const sortedYears = Object.keys(filteredRecords).sort((a, b) => parseInt(b) - parseInt(a));

  if (sortedYears.length === 0) {
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
    <div className={`unified-timeline vertical`}>
      <div className="timeline-content">
        {sortedYears.map((year: string) => (
          <div key={year} className="year-section">
            <div className="year-header">
              <h3 className="year-title">{year}년</h3>
              <span className="year-count">{filteredRecords[year].length}건</span>
            </div>
            
            <div className="records-list">
              {filteredRecords[year].map((record: any) => (
                <div 
                  key={record.id} 
                  className={`record-item-wrapper ${record.type}`}
                >
                  <div className="record-date-external">
                    {formatDate(record.date)}
                  </div>
                  
                  <div 
                    className={`record-item ${record.type} ${record.isPharmacy ? 'pharmacy' : ''} ${expandedItems.has(record.id) ? 'expanded' : ''}`}
                  >
                    <div 
                      className="record-header"
                      onClick={() => {
                        // 건강검진은 항상 펼칠 수 있음
                        if (record.type === 'checkup') {
                          toggleExpanded(record.id);
                        }
                        // 처방전은 약품 정보가 있을 때만 펼칠 수 있음
                        else if (record.type === 'prescription' && record.hasMedications) {
                          toggleExpanded(record.id);
                        }
                      }}
                      style={{ 
                        cursor: (record.type === 'checkup' || (record.type === 'prescription' && record.hasMedications)) 
                          ? 'pointer' : 'default' 
                      }}
                    >
                      <div className="record-icon">
                        {record.isPharmacy ? (
                          <div className="icon-badge pharmacy">
                            <img src={pillIconPath} alt="약국" />
                          </div>
                        ) : record.type === 'checkup' ? (
                          <div className="icon-badge checkup">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                            </svg>
                          </div>
                        ) : (
                          <div className="icon-badge prescription">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="record-info">
                        <div className="record-main">
                          <span className="record-title">{record.title}</span>
                          <span className="record-separator">|</span>
                          <span className="record-institution">{record.institution}</span>
                          {record.treatmentType && (
                            <>
                              <span className="record-separator">|</span>
                              <span className="record-treatment">{record.treatmentType}</span>
                            </>
                          )}
                          {record.status && (
                            <span 
                              className="record-status"
                              style={{ color: getStatusColor(record.status) }}
                            >
                              {record.status}
                            </span>
                          )}
                        </div>
                        
                        {record.type === 'prescription' && (
                          <div className="record-summary">
                            {/* 방문 - 뱃지 스타일 */}
                            {(record.visitCount !== null && record.visitCount !== undefined && record.visitCount > 0) && (
                              <span className="visit-count">방문 {record.visitCount}회</span>
                            )}
                            {/* 투약 - 뱃지 스타일 */}
                            {(record.medicationCount !== null && record.medicationCount !== undefined && record.medicationCount > 0) && (
                              <span className="medication-count">투약 {record.medicationCount}회</span>
                            )}
                            {/* 처방 - 뱃지 스타일 */}
                            {(record.prescriptionCount !== null && record.prescriptionCount !== undefined && record.prescriptionCount > 0) && (
                              <span className="prescription-count">처방 {record.prescriptionCount}회</span>
                            )}
                          </div>
                        )}
                      </div>
                    
                    <div className="record-toggle">
                      {/* 건강검진은 항상 펼칠 수 있음 */}
                      {record.type === 'checkup' && (
                        <svg 
                          className="toggle-icon"
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor"
                        >
                          <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                      )}
                      
                      {/* 처방전에서 투약 내역이 있을 경우 토글 아이콘과 약 뱃지 모두 표시 */}
                      {record.type === 'prescription' && record.hasMedications && (
                        <>
                          <svg 
                            className="toggle-icon"
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                          <div className="medication-badge">
                            <img src={pillIconPath} alt="투약" />
                          </div>
                        </>
                      )}
                      
                    </div>
                  </div>
                  
                    {expandedItems.has(record.id) && (
                      record.type === 'checkup' || (record.type === 'prescription' && record.hasMedications)
                    ) && (
                      <div className="record-content">
                        {record.type === 'checkup' 
                          ? renderCheckupDetails(record.details, record.id)
                          : renderPrescriptionDetails(record.details)
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="timeline-footer">
        <p className="last-update">
          마지막 업데이트: {new Date().toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>
    </div>
  );
};

export default UnifiedHealthTimeline;
