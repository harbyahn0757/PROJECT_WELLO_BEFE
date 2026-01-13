/**
 * 검진 설계 데이터 파싱 유틸리티
 * 최근 3년간 검진 데이터 필터링 및 정상이 아닌 항목 추출
 */
import { CheckupConcernItem, HospitalConcernItem, MedicationConcernItem } from '../types/checkupDesign';

// 건강 지표 목록 (TrendsSection에서 재사용)
const HEALTH_METRICS = [
  '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
  '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
  'LDL 콜레스테롤', '중성지방', '헤모글로빈'
];

// 필드명 매핑 (TrendsSection에서 재사용)
const getFieldNameForMetric = (metric: string): string => {
  switch (metric) {
    case '신장': return 'height';
    case '체중': return 'weight';
    case 'BMI': return 'bmi';
    case '허리둘레': return 'waist_circumference';
    case '혈압 (수축기)': return 'blood_pressure_high';
    case '혈압 (이완기)': return 'blood_pressure_low';
    case '혈당': return 'blood_sugar';
    case '총콜레스테롤': return 'cholesterol';
    case 'HDL 콜레스테롤': return 'hdl_cholesterol';
    case 'LDL 콜레스테롤': return 'ldl_cholesterol';
    case '중성지방': return 'triglyceride';
    case '헤모글로빈': return 'hemoglobin';
    default: return 'blood_pressure_high';
  }
};

// 단위 매핑 (TrendsSection에서 재사용)
const getUnitForMetric = (metric: string): string => {
  switch (metric) {
    case '신장': return 'cm';
    case '체중': return 'kg';
    case 'BMI': return 'kg/m²';
    case '허리둘레': return 'cm';
    case '혈압 (수축기)':
    case '혈압 (이완기)': return 'mmHg';
    case '혈당': return 'mg/dL';
    case '총콜레스테롤':
    case 'HDL 콜레스테롤':
    case 'LDL 콜레스테롤':
    case '중성지방': return 'mg/dL';
    case '헤모글로빈': return 'g/dL';
    default: return '';
  }
};

// 상태 판정 함수 (TrendsSection의 getHealthStatus 로직 재사용)
const getHealthStatus = (
  metric: string,
  value: number,
  healthDataItem: any,
  gender: string = 'M'
): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string } => {
  if (metric === '신장') {
    return { status: 'neutral', text: '측정' };
  }

  const rawData = healthDataItem?.raw_data;
  if (!rawData) {
    return { status: 'normal', text: '정상' };
  }

  const code = rawData.Code || '';
  let overallStatus: 'normal' | 'warning' | 'abnormal' = 'normal';
  
  if (code.includes('정상') || code === '정A') {
    overallStatus = 'normal';
  } else if (code.includes('의심') || code === '의심') {
    overallStatus = 'warning';
  } else if (code.includes('질환') || code.includes('이상')) {
    overallStatus = 'abnormal';
  }

  let itemStatus: 'normal' | 'warning' | 'abnormal' | 'neutral' = overallStatus;
  
  if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
    for (const inspection of rawData.Inspections) {
      if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
        for (const illness of inspection.Illnesses) {
          if (illness.Items && Array.isArray(illness.Items)) {
            const item = illness.Items.find((item: any) => {
              if (!item.Name) return false;
              
              const itemName = item.Name.toLowerCase();
              const metricName = metric.toLowerCase();
              
              if (metric === 'HDL 콜레스테롤') {
                return itemName.includes('hdl') || itemName.includes('고밀도');
              }
              if (metric === 'LDL 콜레스테롤') {
                return itemName.includes('ldl') || itemName.includes('저밀도');
              }
              if (metric === '총콜레스테롤') {
                return itemName.includes('총콜레스테롤') || 
                       (itemName.includes('콜레스테롤') && 
                        !itemName.includes('hdl') && 
                        !itemName.includes('ldl') && 
                        !itemName.includes('고밀도') && 
                        !itemName.includes('저밀도'));
              }
              
              return itemName.includes(metricName.replace(' (수축기)', '').replace(' (이완기)', '')) ||
                     (metric === 'BMI' && (itemName.includes('체질량지수') || itemName.includes('bmi'))) ||
                     (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                     (metricName.includes('혈압') && itemName.includes('혈압')) ||
                     (metricName.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                     (metricName === '중성지방' && itemName.includes('중성지방')) ||
                     (metricName === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
            });
            
            if (item) {
              if (!item.ItemReferences || !Array.isArray(item.ItemReferences) || item.ItemReferences.length === 0) {
                itemStatus = 'neutral';
              } else if (item.ItemReferences && Array.isArray(item.ItemReferences) && item.ItemReferences.length > 0) {
                const itemValue = parseFloat(item.Value);
                
                if (!isNaN(itemValue)) {
                  // 질환의심 범위 체크 (우선순위)
                  const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
                  if (abnormal && isInRange(itemValue, abnormal.Value, gender)) {
                    itemStatus = 'abnormal';
                    return { status: itemStatus, text: abnormal.Name };
                  }
                  
                  // 정상 범위 체크 (우선순위 1) - "정상", "정상(A)", "정상(B)" 모두 포함
                  const normal = item.ItemReferences.find((ref: any) => 
                    ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
                  );
                  if (normal && isInRange(itemValue, normal.Value, gender)) {
                    itemStatus = 'normal';
                    return { status: itemStatus, text: normal.Name };
                  }
                  
                  // 정상(B) 또는 경계 범위 체크 (우선순위 2)
                  const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
                  if (normalB && isInRange(itemValue, normalB.Value, gender)) {
                    itemStatus = 'warning';
                    return { status: itemStatus, text: normalB.Name };
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  return { status: itemStatus, text: itemStatus === 'normal' ? '정상' : itemStatus === 'warning' ? '경계' : '이상' };
};

// 범위 체크 함수 (TrendsSection의 isInRange 로직 재사용)
const isInRange = (value: number, rangeStr: string, gender: string = 'M'): boolean => {
  if (!rangeStr) return false;
  
  // 성별 구분이 있는 경우
  if (rangeStr.includes('/')) {
    const parts = rangeStr.split('/');
    const targetPart = gender === 'M' ? parts[0] : parts[1];
    if (targetPart) {
      const cleanRange = targetPart.replace(/^남:|^여:/, '').trim();
      return checkRange(value, cleanRange);
    }
  }
  
  return checkRange(value, rangeStr);
};

const checkRange = (value: number, rangeStr: string): boolean => {
  // "미만" 패턴
  const minMatch = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
  if (minMatch) {
    const max = parseFloat(minMatch[1]);
    return value < max;
  }
  
  // "이상" 패턴
  const maxMatch = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
  if (maxMatch) {
    const min = parseFloat(maxMatch[1]);
    return value >= min;
  }
  
  // 범위 패턴 (예: "120-140")
  const rangeMatch = rangeStr.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return value >= min && value <= max;
  }
  
  return false;
};

/**
 * 최근 3년간 검진 데이터 필터링
 * HealthDataViewer 형식: { ResultList: [...] } 또는 배열 직접 전달
 */
export const filterRecentCheckups = (healthData: any): any[] => {
  // HealthDataViewer 형식 지원: { ResultList: [...] }
  const dataArray = healthData?.ResultList || (Array.isArray(healthData) ? healthData : []);
  
  const currentYear = new Date().getFullYear();
  const threeYearsAgo = currentYear - 3;
  
  return dataArray.filter((item: any) => {
    // year 필드: "2021년" 형식 또는 "2021" 형식
    const yearValue = item.year || item.Year || item.raw_data?.Year;
    if (!yearValue) return false;
    
    const yearStr = yearValue.toString().replace('년', '').trim();
    const year = parseInt(yearStr, 10);
    return !isNaN(year) && year >= threeYearsAgo;
  });
};

/**
 * 정상이 아닌 검진 항목 추출
 * HealthDataViewer 형식: { ResultList: [...] } 또는 배열 직접 전달
 */
export const extractAbnormalCheckupItems = (
  healthData: any,
  gender: string = 'M'
): CheckupConcernItem[] => {
  console.log('🔍 [파싱] extractAbnormalCheckupItems 시작:', {
    healthDataType: typeof healthData,
    isArray: Array.isArray(healthData),
    hasResultList: !!healthData?.ResultList,
    resultListLength: healthData?.ResultList?.length || 0
  });
  
  const items: CheckupConcernItem[] = [];
  // 이미 필터링된 데이터를 받으므로 filterRecentCheckups 호출 제거
  const dataArray = healthData?.ResultList || (Array.isArray(healthData) ? healthData : []);
  
  console.log('🔍 [파싱] 필터링된 데이터:', {
    dataCount: dataArray.length,
    firstItem: dataArray[0] ? {
      year: dataArray[0].year,
      checkup_date: dataArray[0].checkup_date || dataArray[0].CheckUpDate,
      hasRawData: !!dataArray[0].raw_data
    } : null
  });
  
  dataArray.forEach((healthDataItem: any) => {
    // HealthDataViewer 형식: raw_data가 이미 최상위에 있거나 raw_data 필드에 있음
    const rawData = healthDataItem.raw_data || healthDataItem;
    if (!rawData || !rawData.Inspections) {
      console.log('⚠️ [파싱] raw_data 또는 Inspections 없음:', {
        hasRawData: !!healthDataItem.raw_data,
        hasRawDataTop: !!rawData,
        hasInspections: !!rawData?.Inspections,
        healthDataItemKeys: Object.keys(healthDataItem).slice(0, 10)
      });
      return;
    }
    
    HEALTH_METRICS.forEach((metric) => {
      // 해당 지표의 값이 있는 가장 최신 데이터 추출
      let latestValue: number | null = null;
      let latestItem: any = null;
      
      if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
        for (const inspection of rawData.Inspections) {
          if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
            for (const illness of inspection.Illnesses) {
              if (illness.Items && Array.isArray(illness.Items)) {
                const item = illness.Items.find((item: any) => {
                  if (!item.Name) return false;
                  const itemName = item.Name.toLowerCase();
                  const metricName = metric.toLowerCase();
                  
                  if (metric === 'HDL 콜레스테롤') {
                    return itemName.includes('hdl') || itemName.includes('고밀도');
                  }
                  if (metric === 'LDL 콜레스테롤') {
                    return itemName.includes('ldl') || itemName.includes('저밀도');
                  }
                  if (metric === '총콜레스테롤') {
                    return itemName.includes('총콜레스테롤') || 
                           (itemName.includes('콜레스테롤') && 
                            !itemName.includes('hdl') && 
                            !itemName.includes('ldl'));
                  }
                  
                  return itemName.includes(metricName.replace(' (수축기)', '').replace(' (이완기)', '')) ||
                         (metric === 'BMI' && (itemName.includes('체질량지수') || itemName.includes('bmi'))) ||
                         (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                         (metricName.includes('혈압') && itemName.includes('혈압')) ||
                         (metricName.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                         (metricName === '중성지방' && itemName.includes('중성지방')) ||
                         (metricName === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                });
                
                if (item && item.Value) {
                  const value = parseFloat(item.Value);
                  if (!isNaN(value) && value > 0) {
                    latestValue = value;
                    latestItem = item;
                  }
                }
              }
            }
          }
        }
      }
      
      if (latestValue !== null && latestItem) {
        const status = getHealthStatus(metric, latestValue, healthDataItem, gender);
        
        // 정상이 아닌 항목만 추가
        if (status.status === 'warning' || status.status === 'abnormal') {
          const checkupDate = rawData.CheckUpDate || healthDataItem.CheckUpDate || '';
          const location = rawData.Location || healthDataItem.location || '병원';
          
          items.push({
            id: `${healthDataItem.id || Date.now()}-${metric}-${checkupDate}`,
            name: metric,
            value: latestValue,
            unit: getUnitForMetric(metric),
            date: checkupDate,
            location: location,
            status: status.status,
            checkupDate: checkupDate,
            year: healthDataItem.year || ''
          });
        }
      }
    });
  });
  
  // 중복 제거 (같은 항목, 같은 날짜, 같은 병원)
  // 추이보기처럼 병원별로 그룹화하지 않고, 검진 항목 자체를 반환
  const uniqueItems = items.filter((item, index, self) =>
    index === self.findIndex((t) => 
      t.name === item.name && 
      t.date === item.date && 
      t.location === item.location
    )
  );
  
  console.log('🔍 [파싱] extractAbnormalCheckupItems 완료:', {
    totalItems: items.length,
    uniqueItems: uniqueItems.length,
    sampleItem: uniqueItems[0] ? {
      name: uniqueItems[0].name,
      location: uniqueItems[0].location,
      date: uniqueItems[0].date
    } : null
  });
  
  return uniqueItems;
};

/**
 * 병원별 그룹화된 항목 추출
 */
export const extractHospitalItems = (
  checkupItems: CheckupConcernItem[]
): HospitalConcernItem[] => {
  const hospitalMap = new Map<string, CheckupConcernItem[]>();
  
  checkupItems.forEach((item) => {
    const key = `${item.location}-${item.date}`;
    if (!hospitalMap.has(key)) {
      hospitalMap.set(key, []);
    }
    hospitalMap.get(key)!.push(item);
  });
  
  const hospitalItems: HospitalConcernItem[] = [];
  
  hospitalMap.forEach((items, key) => {
    const [hospitalName, date] = key.split('-');
    const abnormalCount = items.filter(item => item.status === 'abnormal').length;
    const warningCount = items.filter(item => item.status === 'warning').length;
    
    if (abnormalCount > 0 || warningCount > 0) {
      hospitalItems.push({
        id: key,
        hospitalName: hospitalName,
        checkupDate: date,
        abnormalCount,
        warningCount,
        items
      });
    }
  });
  
  return hospitalItems.sort((a, b) => 
    new Date(b.checkupDate).getTime() - new Date(a.checkupDate).getTime()
  );
};

/**
 * 약물 복용 이력 추출
 * HealthDataViewer 형식: { ResultList: [...] } 또는 배열 직접 전달
 */
export const extractMedicationItems = (
  prescriptionData: any
): MedicationConcernItem[] => {
  console.log('🔍 [파싱] extractMedicationItems 시작:', {
    prescriptionDataType: typeof prescriptionData,
    isArray: Array.isArray(prescriptionData),
    hasResultList: !!prescriptionData?.ResultList,
    resultListLength: prescriptionData?.ResultList?.length || 0
  });
  
  // HealthDataViewer 형식 지원: { ResultList: [...] }
  const dataArray = prescriptionData?.ResultList || (Array.isArray(prescriptionData) ? prescriptionData : []);
  
  const medicationItems: MedicationConcernItem[] = [];
  
  dataArray.forEach((prescription: any) => {
    // HealthDataViewer 형식: raw_data가 이미 최상위에 있거나 raw_data 필드에 있음
    const rawData = prescription.raw_data || prescription;
    if (!rawData) {
      console.log('⚠️ [파싱] prescription raw_data 없음:', {
        hasRawData: !!prescription.raw_data,
        prescriptionKeys: Object.keys(prescription).slice(0, 10)
      });
      return;
    }
    
    // Items가 raw_data 안에 있거나 최상위에 있을 수 있음
    // 실제 API 응답: RetrieveTreatmentInjectionInformationPersonDetailList
    const prescriptionItems = rawData.RetrieveTreatmentInjectionInformationPersonDetailList || rawData.Items || [];
    if (!prescriptionItems || prescriptionItems.length === 0) {
      // 약물이 없는 처방전은 스킵 (로그만 남기지 않음)
      return;
    }
    
    // 처방일자: raw_data의 JinRyoGaesiIl 또는 파싱된 treatment_date
    const prescriptionDate = rawData.JinRyoGaesiIl || prescription.treatment_date || '';
    const hospitalName = rawData.ByungEuiwonYakGukMyung || prescription.hospital_name || '병원';
    
    prescriptionItems.forEach((item: any) => {
      // DrugName 또는 ChoBangYakPumMyung (처방약품명) 사용
      const drugName = item.ChoBangYakPumMyung || item.DrugName || item.medicationName;
      if (drugName) {
        // 처방일자는 prescription 레벨에서 가져옴
        // TuyakIlSoo는 투약일수 (복용 기간)
        const startDate = prescriptionDate;
        const endDate = null; // API 응답에 종료일 정보 없음
        
        medicationItems.push({
          id: `${prescription.idx || prescription.id || Date.now()}-${drugName}-${startDate}`,
          medicationName: drugName,
          startDate: startDate,
          endDate: endDate || undefined, // null을 undefined로 변환
          period: startDate, // 종료일 없으면 시작일만 표시
          hospitalName: hospitalName,
          prescriptionDate: prescriptionDate
        });
      }
    });
  });
  
  // 중복 제거 (같은 약물, 같은 시작일)
  const uniqueItems = medicationItems.filter((item, index, self) =>
    index === self.findIndex((t) => 
      t.medicationName === item.medicationName && t.startDate === item.startDate
    )
  );
  
  console.log('🔍 [파싱] extractMedicationItems 완료:', {
    totalItems: medicationItems.length,
    uniqueItems: uniqueItems.length
  });
  
  return uniqueItems.sort((a, b) => 
    new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime()
  );
};

