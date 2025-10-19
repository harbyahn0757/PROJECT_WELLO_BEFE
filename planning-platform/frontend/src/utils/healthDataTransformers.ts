/**
 * 건강 데이터 변환 유틸리티
 * Tilko API 데이터를 차트 컴포넌트에서 사용할 수 있는 형태로 변환
 */

import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../types/health';
import { LineChartSeries, LineChartDataPoint } from '../components/charts/LineChart';
import { BarChartSeries, BarChartDataPoint } from '../components/charts/BarChart';

// 건강 상태 판정
export const getHealthStatus = (code: string) => {
  switch (code) {
    case '정상':
      return 'normal' as const;
    case '의심':
    case '질환의심':
      return 'warning' as const;
    case '질환':
    case '이상':
      return 'danger' as const;
    default:
      return 'normal' as const;
  }
};

// 수치 추출 함수
export const extractNumericValue = (value: string): number => {
  // "140/90" 형태에서 첫 번째 값 추출 (수축기 혈압)
  if (value.includes('/')) {
    return parseFloat(value.split('/')[0]);
  }
  
  // 숫자만 추출
  const numericMatch = value.match(/[\d.]+/);
  return numericMatch ? parseFloat(numericMatch[0]) : 0;
};

// 단위 추출 함수
export const extractUnit = (value: string, unit?: string): string => {
  if (unit) return unit;
  
  // 일반적인 단위들
  const unitMap: Record<string, string> = {
    'Cm': 'cm',
    'Kg': 'kg',
    'kg/m2': 'kg/m²',
    'mmHg': 'mmHg',
    'mg/dL': 'mg/dL',
    'g/dL': 'g/dL',
    'U/L': 'U/L',
    'mL/min': 'mL/min'
  };
  
  return unitMap[unit || ''] || unit || '';
};

/**
 * 건강검진 데이터를 라인 차트용으로 변환
 */
export const transformHealthDataForLineChart = (
  healthDataList: TilkoHealthCheckupRaw[]
): LineChartSeries[] => {
  const seriesMap = new Map<string, LineChartDataPoint[]>();

  healthDataList.forEach(checkup => {
    const date = `${checkup.Year} ${checkup.CheckUpDate}`;
    const status = getHealthStatus(checkup.Code);

    checkup.Inspections.forEach((inspection: any) => {
      inspection.Illnesses.forEach((illness: any) => {
        illness.Items.forEach((item: any) => {
          const value = extractNumericValue(item.Value);
          if (value > 0) {
            const seriesKey = item.Name;
            
            if (!seriesMap.has(seriesKey)) {
              seriesMap.set(seriesKey, []);
            }

            seriesMap.get(seriesKey)!.push({
              date: new Date(`${checkup.Year.replace('년', '')}-${checkup.CheckUpDate.replace('/', '-')}`).toISOString(),
              value,
              label: date,
              status,
              reference: item.ItemReferences.length > 0 ? {
                // 참조값이 있으면 파싱 (예: "남 90미만 / 여 85미만")
                // 실제 구현에서는 성별에 따른 참조값 처리 필요
              } : undefined
            });
          }
        });
      });
    });
  });

  return Array.from(seriesMap.entries()).map(([name, data], index) => ({
    id: `health-${name.replace(/\s+/g, '-')}`,
    name,
    data: data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    unit: data[0] ? extractUnit(data[0].label || '', getUnitForMetric(name)) : '',
    color: index === 0 ? 'var(--color-primary)' : `var(--color-gray-${500 + (index % 3) * 100})`,
    showPoints: true,
    showArea: false
  }));
};

/**
 * 건강검진 데이터를 바 차트용으로 변환 (연도별 비교)
 */
export const transformHealthDataForBarChart = (
  healthDataList: TilkoHealthCheckupRaw[],
  metrics: string[] = ['신장', '체중', '혈압(최고/최저)', '공복혈당', '총콜레스테롤']
): BarChartSeries[] => {
  const seriesMap = new Map<string, BarChartDataPoint[]>();

  // 지정된 지표들만 추출
  metrics.forEach(metric => {
    seriesMap.set(metric, []);
  });

  healthDataList.forEach(checkup => {
    const year = checkup.Year;
    const status = getHealthStatus(checkup.Code);

    checkup.Inspections.forEach((inspection: any) => {
      inspection.Illnesses.forEach((illness: any) => {
        illness.Items.forEach((item: any) => {
          if (metrics.includes(item.Name)) {
            const value = extractNumericValue(item.Value);
            if (value > 0) {
              seriesMap.get(item.Name)!.push({
                label: year,
                value,
                status,
                category: inspection.Gubun,
                unit: extractUnit(item.Value, item.Unit),
                metadata: {
                  date: checkup.CheckUpDate,
                  location: checkup.Location,
                  illness: illness.Name
                }
              });
            }
          }
        });
      });
    });
  });

  return Array.from(seriesMap.entries())
    .filter(([_, data]) => data.length > 0)
    .map(([name, data], index) => ({
      id: `health-bar-${name.replace(/\s+/g, '-')}`,
      name,
      data: data.sort((a, b) => a.label.localeCompare(b.label)),
      unit: data[0]?.unit || '',
      color: index === 0 ? 'var(--color-primary)' : `var(--color-gray-${500 + (index % 3) * 100})`
    }));
};

/**
 * 병원별 검진 결과 비교용 바 차트 데이터
 */
export const transformHealthDataByHospital = (
  healthDataList: TilkoHealthCheckupRaw[],
  metric: string = '공복혈당'
): BarChartSeries[] => {
  const hospitalData: BarChartDataPoint[] = [];

  healthDataList.forEach(checkup => {
    const status = getHealthStatus(checkup.Code);

    checkup.Inspections.forEach((inspection: any) => {
      inspection.Illnesses.forEach((illness: any) => {
        illness.Items.forEach((item: any) => {
          if (item.Name === metric) {
            const value = extractNumericValue(item.Value);
            if (value > 0) {
              hospitalData.push({
                label: checkup.Location,
                value,
                status,
                category: inspection.Gubun,
                unit: extractUnit(item.Value, item.Unit),
                metadata: {
                  date: `${checkup.Year} ${checkup.CheckUpDate}`,
                  location: checkup.Location
                }
              });
            }
          }
        });
      });
    });
  });

  return [{
    id: `hospital-${metric.replace(/\s+/g, '-')}`,
    name: metric,
    data: hospitalData,
    unit: hospitalData[0]?.unit || '',
    color: 'var(--color-primary)'
  }];
};

/**
 * 처방전 데이터를 바 차트용으로 변환 (병원별 처방 횟수)
 */
export const transformPrescriptionDataForBarChart = (
  prescriptionDataList: TilkoPrescriptionRaw[]
): BarChartSeries[] => {
  const hospitalCounts = new Map<string, number>();
  const hospitalData: BarChartDataPoint[] = [];

  prescriptionDataList.forEach(prescription => {
    const hospital = prescription.ByungEuiwonYakGukMyung;
    const count = parseInt(prescription.CheoBangHoiSoo) || 1;
    
    hospitalCounts.set(hospital, (hospitalCounts.get(hospital) || 0) + count);
  });

  hospitalCounts.forEach((count, hospital) => {
    hospitalData.push({
      label: hospital,
      value: count,
      unit: '회',
      metadata: {
        hospital
      }
    });
  });

  return [{
    id: 'prescription-counts',
    name: '처방 횟수',
    data: hospitalData.sort((a, b) => b.value - a.value), // 내림차순 정렬
    unit: '회',
    color: 'var(--color-primary)'
  }];
};

/**
 * 지표별 단위 매핑
 */
const getUnitForMetric = (metric: string): string => {
  const unitMap: Record<string, string> = {
    '신장': 'cm',
    '체중': 'kg',
    '허리둘레': 'cm',
    '체질량지수': 'kg/m²',
    '혈압(최고/최저)': 'mmHg',
    '공복혈당': 'mg/dL',
    '총콜레스테롤': 'mg/dL',
    '고밀도(HDL) 콜레스테롤': 'mg/dL',
    '저밀도(LDL) 콜레스테롤': 'mg/dL',
    '중성지방': 'mg/dL',
    '혈색소': 'g/dL',
    '혈청크레아티닌': 'mg/dL',
    '신사구체여과율(GFR)': 'mL/min',
    '에이에스티(AST, SGOT)': 'U/L',
    '에이엘티(ALT, SGPT)': 'U/L',
    '감마지티피(y-GTP)': 'U/L'
  };

  return unitMap[metric] || '';
};

/**
 * 건강 상태별 데이터 분포 (파이 차트용)
 */
export const getHealthStatusDistribution = (
  healthDataList: TilkoHealthCheckupRaw[]
) => {
  const statusCounts = {
    normal: 0,
    warning: 0,
    danger: 0
  };

  healthDataList.forEach(checkup => {
    const status = getHealthStatus(checkup.Code);
    statusCounts[status]++;
  });

  return [
    { label: '정상', value: statusCounts.normal, color: 'var(--color-success)' },
    { label: '주의', value: statusCounts.warning, color: 'var(--color-warning)' },
    { label: '위험', value: statusCounts.danger, color: 'var(--color-danger)' }
  ].filter(item => item.value > 0);
};
