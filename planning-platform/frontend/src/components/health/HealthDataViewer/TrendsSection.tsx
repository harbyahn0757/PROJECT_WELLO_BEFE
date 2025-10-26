/**
 * TrendsSection - 건강지표 추이 분석 컴포넌트
 * ComprehensiveAnalysisPage에서 추출한 추이 섹션
 */
import React, { useState, useEffect, useMemo } from 'react';
import LineChart from '../../charts/LineChart';
import BarChart from '../../charts/BarChart';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import '../../../pages/ComprehensiveAnalysisPage/styles.scss';

interface TrendsSectionProps {
  healthData: TilkoHealthCheckupRaw[];
  prescriptionData: TilkoPrescriptionRaw[];
  filterMode: 'all' | 'checkup' | 'pharmacy' | 'treatment';
  isLoading?: boolean;
}

const TrendsSection: React.FC<TrendsSectionProps> = ({
  healthData,
  prescriptionData,
  filterMode,
  isLoading = false
}) => {
  // 건강 지표 슬라이더 상태
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const [activeVisitDotIndex, setActiveVisitDotIndex] = useState(0);
  const [isLoadingVisitData, setIsLoadingVisitData] = useState(true);
  
  // 건강 지표 목록
  const healthMetrics = [
    '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
    '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
    'LDL 콜레스테롤', '중성지방', '헤모글로빈'
  ];

  // 헬퍼 함수들 (ComprehensiveAnalysisPage에서 복사)
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


  // 🔧 건강범위 추출 함수 (6ecb1ca에서 추출)
  const getHealthRanges = (metric: string, healthDataItem: any, gender: string = 'M'): {
    normal: { min: number; max: number } | null;
    borderline: { min: number; max: number } | null;
    abnormal: { min: number; max: number } | null;
  } | null => {
    if (!healthDataItem?.raw_data) return null;
    
    const rawData = healthDataItem.raw_data;
    
    if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
      for (const inspection of rawData.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
              const item = illness.Items.find((item: any) => 
                item.Name && (
                  item.Name.includes(metric.replace(' (수축기)', '').replace(' (이완기)', '')) ||
                  (metric.includes('혈압') && item.Name.includes('혈압')) ||
                  (metric.includes('콜레스테롤') && item.Name.includes('콜레스테롤')) ||
                  (metric === '중성지방' && item.Name.includes('중성지방')) ||
                  (metric === '헤모글로빈' && item.Name.includes('혈색소'))
                )
              );
              
              if (item && item.ItemReferences && Array.isArray(item.ItemReferences)) {
                const ranges = {
                  normal: null as { min: number; max: number } | null,
                  borderline: null as { min: number; max: number } | null,
                  abnormal: null as { min: number; max: number } | null
                };
                
                // 정상(A) 범위
                const normalRef = item.ItemReferences.find((ref: any) => ref.Name === '정상(A)');
                if (normalRef && normalRef.Value) {
                  ranges.normal = parseNormalRange(normalRef.Value, gender, metric);
                }
                
                // 정상(B) 또는 경계 범위
                const borderlineRef = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)');
                if (borderlineRef && borderlineRef.Value) {
                  ranges.borderline = parseNormalRange(borderlineRef.Value, gender, metric);
                }
                
                // 질환의심 범위
                const abnormalRef = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
                if (abnormalRef && abnormalRef.Value) {
                  ranges.abnormal = parseNormalRange(abnormalRef.Value, gender, metric);
                }
                
                return ranges;
              }
            }
          }
        }
      }
    }
    
    return null;
  };

  // 🔧 정상 범위 파싱 함수 (6ecb1ca에서 추출)
  const parseNormalRange = (rangeStr: string, gender: string = 'M', metric: string): { min: number; max: number } | null => {
    try {
      // 성별 구분 처리 (예: "남: 13-16.5 / 여: 12-15.5")
      if (rangeStr.includes('남') && rangeStr.includes('여')) {
        const parts = rangeStr.split('/');
        const targetPart = gender === 'M' ? 
          parts.find(p => p.includes('남'))?.trim() : 
          parts.find(p => p.includes('여'))?.trim();
        
        if (targetPart) {
          const cleanRange = targetPart.replace(/남:|여:/, '').trim();
          return parseSimpleRange(cleanRange);
        }
      }
      
      // 혈압 특수 처리 (예: "120미만 이며/80미만", "120-139 또는 /80-89")
      if (metric.includes('혈압')) {
        if (metric.includes('수축기')) {
          // 수축기 처리
          const systolicMinMatch = rangeStr.match(/(\d+)미만/);
          if (systolicMinMatch) {
            return { min: 0, max: parseInt(systolicMinMatch[1]) - 1 };
          }
          const systolicRangeMatch = rangeStr.match(/(\d+)-(\d+)/);
          if (systolicRangeMatch) {
            return { min: parseInt(systolicRangeMatch[1]), max: parseInt(systolicRangeMatch[2]) };
          }
          const systolicAboveMatch = rangeStr.match(/(\d+)이상/);
          if (systolicAboveMatch) {
            return { min: parseInt(systolicAboveMatch[1]), max: 300 }; // 임의의 큰 값
          }
        } else if (metric.includes('이완기')) {
          // 이완기 처리 - "또는 /" 뒤의 값들 추출
          const diastolicMinMatch = rangeStr.match(/\/(\d+)미만/);
          if (diastolicMinMatch) {
            return { min: 0, max: parseInt(diastolicMinMatch[1]) - 1 };
          }
          // "또는 /80-89" 형태 처리
          const diastolicRangeMatch = rangeStr.match(/\/(\d+)-(\d+)/);
          if (diastolicRangeMatch) {
            return { min: parseInt(diastolicRangeMatch[1]), max: parseInt(diastolicRangeMatch[2]) };
          }
          // "또는 /90이상" 형태 처리
          const diastolicAboveMatch = rangeStr.match(/\/(\d+)이상/);
          if (diastolicAboveMatch) {
            return { min: parseInt(diastolicAboveMatch[1]), max: 200 }; // 임의의 큰 값
          }
        }
      }
      
      // 일반 범위 처리
      return parseSimpleRange(rangeStr);
      
    } catch (error) {
      console.warn('정상 범위 파싱 실패:', rangeStr, error);
      return null;
    }
  };

  // 🔧 단순 범위 파싱 함수 (6ecb1ca에서 추출)
  const parseSimpleRange = (rangeStr: string): { min: number; max: number } | null => {
    // "18.5-24.9" 형태
    if (rangeStr.includes('-')) {
      const [minStr, maxStr] = rangeStr.split('-');
      const min = parseFloat(minStr.trim());
      const max = parseFloat(maxStr.trim());
      if (!isNaN(min) && !isNaN(max)) {
        return { min, max };
      }
    }
    
    // "100미만" 형태
    if (rangeStr.includes('미만')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
      if (match) {
        return { min: 0, max: parseFloat(match[1]) - 0.1 };
      }
    }
    
    // "60이상" 형태
    if (rangeStr.includes('이상')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
      if (match) {
        return { min: parseFloat(match[1]), max: 1000 }; // 임의의 큰 값
      }
    }
    
    return null;
  };

  // 🔧 범위 체크 함수 (6ecb1ca에서 복원)
  const isInRange = (value: number, rangeStr: string): boolean => {
    if (!rangeStr) return false;
    
    try {
      // "40미만" 형태 처리
      if (rangeStr.includes('미만')) {
        const max = parseFloat(rangeStr.replace('미만', '').trim());
        return !isNaN(max) && value < max;
      }
      
      // "60이상" 형태 처리
      if (rangeStr.includes('이상')) {
        const min = parseFloat(rangeStr.replace('이상', '').trim());
        return !isNaN(min) && value >= min;
      }
      
      // "40-59" 형태 처리
      if (rangeStr.includes('-')) {
        const [min, max] = rangeStr.split('-').map(s => parseFloat(s.trim()));
        return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
      }
      
      // ">=120" 형태
      if (rangeStr.includes('>=')) {
        const min = parseFloat(rangeStr.replace('>=', '').trim());
        return !isNaN(min) && value >= min;
      }
      
      // "<=140" 형태
      if (rangeStr.includes('<=')) {
        const max = parseFloat(rangeStr.replace('<=', '').trim());
        return !isNaN(max) && value <= max;
      }
      
      // ">120" 형태
      if (rangeStr.includes('>')) {
        const min = parseFloat(rangeStr.replace('>', '').trim());
        return !isNaN(min) && value > min;
      }
      
      // "<140" 형태
      if (rangeStr.includes('<')) {
        const max = parseFloat(rangeStr.replace('<', '').trim());
        return !isNaN(max) && value < max;
      }
      
      return false;
    } catch (error) {
      console.warn('범위 체크 실패:', rangeStr, error);
      return false;
    }
  };

  // 건강지표 상태 판단 함수
  const getHealthStatus = (metric: string, value: number, healthDataItem: any): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string } => {
    console.log(`🔍 [${metric}] 상태 판정 시작:`, { metric, value, healthDataItem: healthDataItem ? 'exists' : 'null' });
    
    if (metric === '신장') {
      return {
        status: 'neutral',
        text: '측정',
        date: healthDataItem?.CheckUpDate || ''
      };
    }

    const rawData = healthDataItem?.raw_data;
    if (!rawData) {
      console.log(`⚠️ [${metric}] raw_data 없음 - 기본 정상 반환`, {
        healthDataItem: healthDataItem ? 'exists' : 'null',
        healthDataItemKeys: healthDataItem ? Object.keys(healthDataItem) : [],
        rawDataValue: healthDataItem?.raw_data
      });
      return {
        status: 'normal',
        text: '정상',
        date: healthDataItem?.CheckUpDate || ''
      };
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

    console.log(`🔍 [${metric}] 전체 상태 코드:`, { code, overallStatus });

    let itemStatus = overallStatus;
    let foundItem = false;
    
    if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
      for (const inspection of rawData.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
              const item = illness.Items.find((item: any) => {
                if (!item.Name) return false;
                
                const itemName = item.Name.toLowerCase();
                const metricName = metric.toLowerCase();
                
                // 🔧 실제 데이터 구조에 맞는 매칭 로직
                if (metric === 'HDL 콜레스테롤') {
                  return itemName.includes('hdl') || itemName.includes('고밀도');
                }
                if (metric === 'LDL 콜레스테롤') {
                  return itemName.includes('ldl') || itemName.includes('저밀도');
                }
                if (metric === '총 콜레스테롤') {
                  return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl') && !itemName.includes('고밀도') && !itemName.includes('저밀도'));
                }
                
                // 기존 매칭 로직
                return itemName.includes(metricName.replace(' (수축기)', '').replace(' (이완기)', '')) ||
                       (metricName.includes('혈압') && itemName.includes('혈압')) ||
                       (metricName.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                       (metricName === '중성지방' && itemName.includes('중성지방')) ||
                       (metricName === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
              });
              
              if (item) {
                foundItem = true;
                console.log(`✅ [${metric}] 매칭된 항목 발견:`, { 
                  itemName: item.Name, 
                  itemValue: item.Value, 
                  hasReferences: !!(item.ItemReferences && Array.isArray(item.ItemReferences)),
                  referencesCount: item.ItemReferences?.length || 0
                });
                
                if (item.ItemReferences && Array.isArray(item.ItemReferences)) {
                  const itemValue = parseFloat(item.Value);
                  console.log(`🔍 [${metric}] 판정 범위 체크:`, { itemValue, references: item.ItemReferences });
                  
                  if (!isNaN(itemValue)) {
                    for (const ref of item.ItemReferences) {
                      const inRange = isInRange(itemValue, ref.Value);
                      console.log(`🔍 [${metric}] 범위 체크:`, { 
                        refName: ref.Name, 
                        refValue: ref.Value, 
                        itemValue, 
                        inRange 
                      });
                      
                      if (ref.Name === '질환의심' && inRange) {
                        itemStatus = 'abnormal';
                        console.log(`🚨 [${metric}] 질환의심 범위에 해당 → 이상`);
                        break;
                      } else if ((ref.Name === '정상(B)' || ref.Name === '정상(경계)') && inRange) {
                        itemStatus = 'warning';
                        console.log(`⚠️ [${metric}] 정상(B) 범위에 해당 → 경계`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!foundItem) {
      console.log(`⚠️ [${metric}] 매칭된 항목 없음 - 전체 상태 사용:`, overallStatus);
    }

    const statusText = itemStatus === 'normal' ? '정상' : 
                      itemStatus === 'warning' ? '경계' : '이상';
    
    console.log(`🎯 [${metric}] 최종 판정 결과:`, { 
      metric, 
      value, 
      foundItem, 
      overallStatus, 
      itemStatus, 
      statusText 
    });
    
    return {
      status: itemStatus,
      text: statusText,
      date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || ''
    };
  };

  // 🔧 처방전 차트 데이터 생성 (약국 방문 추이)
  const prescriptionChartData = useMemo(() => {
    if (!Array.isArray(prescriptionData) || prescriptionData.length === 0) {
      return [];
    }
    
    try {
      // DB 처방전 데이터를 년도별 약국 방문 건수로 집계 (약국만 필터링)
      const yearlyData: { [year: string]: number } = {};
      
      prescriptionData.forEach((item: any) => {
        // 약국 여부 판단 (UnifiedHealthTimeline 로직 사용)
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        // 약국인 경우만 집계
        if (!isPharmacy) return;
        
        // treatment_date는 "YYYY-MM-DD" 형식
        const year = item.treatment_date ? item.treatment_date.split('-')[0] : '2024';
        
        // 각 처방전은 1회 약국 방문으로 계산
        if (yearlyData[year]) {
          yearlyData[year] += 1;
        } else {
          yearlyData[year] = 1;
        }
      });
      
      // 년도별 데이터를 차트 형식으로 변환 (최신 5년만)
      const chartData = [{
        id: 'pharmacy-visits',
        name: '년도별 약국 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 5) // 최신 5년만
          .map(([year, count]) => {
            // 데이터 검증
            const finalValue = parseInt(count.toString());
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`,
              status: 'normal' as const
            };
          }).filter((item): item is NonNullable<typeof item> => item !== null)
      }];
      
      return chartData;
    } catch (error) {
      console.error('❌ [처방차트] 처방전 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData]);

  // 🔧 병원 방문 차트 데이터 생성 (병원만 필터링)
  const hospitalVisitChartData = useMemo(() => {
    if (!Array.isArray(prescriptionData) || prescriptionData.length === 0) {
      return [];
    }
    
    try {
      // 처방전 데이터를 년도별 병원 방문으로 집계 (병원만 필터링)
      const yearlyData: { [year: string]: Set<string> } = {};
      
      prescriptionData.forEach((item: any) => {
        // 약국 여부 판단 (UnifiedHealthTimeline 로직 사용)
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        // 병원인 경우만 집계 (약국 제외)
        if (isPharmacy) return;
        
        // 처방전 날짜에서 년도 추출
        let year = '2024'; // 기본값
        
        if (item.treatment_date) {
          // treatment_date에서 년도 추출 (YYYY-MM-DD 형식)
          year = item.treatment_date.substring(0, 4);
        } else if (item.TreatDate) {
          // TreatDate에서 년도 추출
          year = item.TreatDate.substring(0, 4);
        } else if (item.Year) {
          // Year 필드에서 년도 추출 ("YYYY년" 형식)
          year = item.Year.replace('년', '');
        }
        
        // 병원명으로 방문 횟수 집계 (같은 병원 같은 날 = 1회 방문)
        const hospitalKey = hospitalName || 'Unknown';
        const dateKey = item.treatment_date || item.TreatDate || `${year}-01-01`;
        const visitKey = `${hospitalKey}_${dateKey}`;
        
        if (!yearlyData[year]) {
          yearlyData[year] = new Set();
        }
        yearlyData[year].add(visitKey);
      });
      
      // 년도별 데이터를 차트 형식으로 변환 (최신 5년만)
      const chartData = [{
        id: 'hospital-visits',
        name: '년도별 병원 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 5) // 최신 5년만
          .map(([year, visitSet]) => {
            const finalValue = visitSet.size;
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`,
              status: 'normal' as const
            };
          }).filter((item): item is NonNullable<typeof item> => item !== null)
      }];
      
      return chartData;
    } catch (error) {
      console.error('❌ [병원차트] 병원 방문 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData]);

  // 로딩 상태 및 데이터 디버깅
  useEffect(() => {
    console.log('🔍 [TrendsSection] 데이터 확인:', {
      healthData: healthData,
      healthDataType: typeof healthData,
      healthDataIsArray: Array.isArray(healthData),
      healthDataLength: Array.isArray(healthData) ? healthData.length : 'N/A',
      prescriptionData: prescriptionData,
      prescriptionDataType: typeof prescriptionData,
      prescriptionDataIsArray: Array.isArray(prescriptionData),
      prescriptionDataLength: Array.isArray(prescriptionData) ? prescriptionData.length : 'N/A'
    });
    
    setIsLoadingVisitData(true);
    const timer = setTimeout(() => setIsLoadingVisitData(false), 500);
    return () => clearTimeout(timer);
  }, [healthData, prescriptionData]);

  // 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
    if (!slider) return;

    const handleScroll = () => {
      const cards = document.querySelectorAll('.health-metric-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      const contentWidth = sliderRect.width;
      const sliderCenter = sliderRect.left + contentWidth / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - sliderCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveDotIndex(closestIndex);
    };

    slider.addEventListener('scroll', handleScroll);
    return () => slider.removeEventListener('scroll', handleScroll);
  }, [healthData]);

  // 방문 추이 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
    if (!slider) return;

    const handleVisitScroll = () => {
      const cards = document.querySelectorAll('.visit-trend-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      const contentWidth = sliderRect.width;
      const sliderCenter = sliderRect.left + contentWidth / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - sliderCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveVisitDotIndex(closestIndex);
    };

    slider.addEventListener('scroll', handleVisitScroll);
    return () => slider.removeEventListener('scroll', handleVisitScroll);
  }, [prescriptionData]);

  if (isLoading) {
    return (
      <div className="trends-loading">
        <div className="loading-spinner">
          <img 
            src="/wello/wello-icon.png" 
            alt="로딩 중" 
            className="spinner-icon"
            style={{
              width: '48px',
              height: '48px',
              animation: 'faviconBlink 1.5s ease-in-out infinite'
            }}
          />
        </div>
        <p className="loading-text">건강 추이를 분석하는 중...</p>
      </div>
    );
  }

  return (
    <div className="trends-section">
      {/* 건강지표 추이 분석 카드 */}
      <section className="analysis-card">
        <div className="card-header">
          <h2 className="section-title">건강지표 추이 분석</h2>
          <div className="chart-info">
            <span className="info-text">12개 주요 지표</span>
          </div>
        </div>
        
        {/* 건강지표 컨테이너 */}
        <div className="health-metrics-wrapper">
          <div className="health-metrics-container">
            <div className="health-metrics-slider">
              {healthMetrics.map((metric, index) => {
                // 🔧 해당 지표의 값이 있는 가장 최신 데이터 추출
      const getLatestHealthDataForMetric = (targetMetric: string) => {
        // healthData가 배열인지 확인하고 안전하게 처리
        if (!healthData) return null;
        
        let dataArray: any[] = [];
        
        if (Array.isArray(healthData)) {
          dataArray = healthData;
        } else if (healthData && typeof healthData === 'object' && (healthData as any).ResultList) {
          dataArray = (healthData as any).ResultList;
        } else {
          return null;
        }
        
        if (!dataArray || dataArray.length === 0) return null;
        
        // 🔧 해당 지표의 값이 있는 데이터만 필터링
        const dataWithMetric = dataArray.filter(item => {
          const fieldName = getFieldNameForMetric(targetMetric);
          const hasDirectValue = item[fieldName] && parseFloat(item[fieldName]) > 0;
          
          // raw_data에서도 확인
          let hasRawValue = false;
          if (item.raw_data?.Inspections) {
            for (const inspection of item.raw_data.Inspections) {
              if (inspection.Illnesses) {
                for (const illness of inspection.Illnesses) {
                  if (illness.Items) {
                    const foundItem = illness.Items.find((rawItem: any) => {
                      if (!rawItem.Name) return false;
                      const itemName = rawItem.Name.toLowerCase();
                      const metricName = targetMetric.toLowerCase().replace(' (수축기)', '').replace(' (이완기)', '');
                      
                       // 🔧 실제 데이터 구조에 맞는 매칭 로직
                       if (targetMetric === 'HDL 콜레스테롤') {
                         return itemName.includes('hdl') || itemName.includes('고밀도');
                       }
                       if (targetMetric === 'LDL 콜레스테롤') {
                         return itemName.includes('ldl') || itemName.includes('저밀도');
                       }
                       if (targetMetric === '총 콜레스테롤') {
                         return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl') && !itemName.includes('고밀도') && !itemName.includes('저밀도'));
                       }
                       
                       return itemName.includes(metricName) ||
                              (targetMetric.includes('혈압') && itemName.includes('혈압')) ||
                              (targetMetric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                              (targetMetric === '중성지방' && itemName.includes('중성지방')) ||
                              (targetMetric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                    });
                    
                    // 🔧 빈 문자열과 0값 모두 필터링
                    if (foundItem && foundItem.Value && 
                        foundItem.Value.trim() !== "" && 
                        parseFloat(foundItem.Value) > 0) {
                      hasRawValue = true;
                      break;
                    }
                  }
                }
                if (hasRawValue) break;
              }
            }
          }
          
          return hasDirectValue || hasRawValue;
        });
        
        if (dataWithMetric.length === 0) {
          console.log(`⚠️ [${targetMetric}] 해당 지표의 데이터가 없음`);
          return null;
        }
        
        // 년도 기준 정렬 (최신 먼저)
        const sortedData = [...dataWithMetric].sort((a, b) => {
          const yearA = parseInt((a.Year || '1900').replace('년', ''));
          const yearB = parseInt((b.Year || '1900').replace('년', ''));
          return yearB - yearA; // 최신 년도 먼저 (내림차순)
        });
        
        console.log(`🔍 [${targetMetric}] 지표별 최신 데이터 선택:`, {
          metric: targetMetric,
          totalData: dataArray.length,
          dataWithMetric: dataWithMetric.length,
          selectedYear: sortedData[0]?.Year,
          selectedDate: sortedData[0]?.CheckUpDate,
          hasRawData: !!(sortedData[0]?.raw_data),
          selectedDataKeys: sortedData[0] ? Object.keys(sortedData[0]) : []
        });
        
        return sortedData[0];
      };

                const getValueFromHealthData = (healthDataItem: any, metric: string): number => {
                  if (!healthDataItem) return 0;
                  
                  if (healthDataItem.raw_data?.Inspections) {
                    for (const inspection of healthDataItem.raw_data.Inspections) {
                      if (inspection.Illnesses) {
                        for (const illness of inspection.Illnesses) {
                          if (illness.Items) {
                            const item = illness.Items.find((item: any) => {
                              if (!item.Name) return false;
                              const itemName = item.Name.toLowerCase();
                              const metricName = metric.toLowerCase().replace(' (수축기)', '').replace(' (이완기)', '');
                              
                              // 🔧 실제 데이터 구조에 맞는 매칭 로직
                              if (metric === 'HDL 콜레스테롤') {
                                return itemName.includes('hdl') || itemName.includes('고밀도');
                              }
                              if (metric === 'LDL 콜레스테롤') {
                                return itemName.includes('ldl') || itemName.includes('저밀도');
                              }
                              if (metric === '총 콜레스테롤') {
                                return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl') && !itemName.includes('고밀도') && !itemName.includes('저밀도'));
                              }
                              
                              return itemName.includes(metricName) ||
                                     (metric.includes('혈압') && itemName.includes('혈압')) ||
                                     (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                     (metric === '중성지방' && itemName.includes('중성지방')) ||
                                     (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                            });
                            
                            // 🔧 빈 문자열 체크 추가
                            if (item && item.Value && item.Value.trim() !== "") {
                              const value = parseFloat(item.Value);
                              console.log(`✅ [${metric}] raw_data에서 값 추출:`, {
                                metric,
                                itemName: item.Name,
                                value,
                                source: 'raw_data'
                              });
                              return isNaN(value) ? 0 : value;
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  const fieldName = getFieldNameForMetric(metric);
                  const value = parseFloat(healthDataItem[fieldName]) || 0;
                  return value;
                };

                // 🔧 차트 데이터 생성 (6ecb1ca에서 추출한 로직)
                const fieldName = getFieldNameForMetric(metric);
                const metricChartData = healthData.length > 0 ? [{
                  id: `metric-${index}`,
                  name: metric,
                  data: (() => {
                    // 년도별로 데이터 그룹화 (중복 처리)
                    const yearlyData: { [year: string]: any } = {};
                    
                    healthData.forEach((item: any) => {
                      // year 필드는 "YYYY년" 형식이므로 "년" 제거
                      const year = item.year ? item.year.replace('년', '') : '2024';
                      let value = 0;
                      
                      // 필드 타입에 따른 값 추출
                      const rawValue = (item as any)[fieldName];
                      if (typeof rawValue === 'string') {
                        value = parseFloat(rawValue) || 0;
                      } else if (typeof rawValue === 'number') {
                        value = rawValue;
                      }
                      
                      if (value > 0 && !isNaN(value) && isFinite(value)) {
                        // 같은 년도에 여러 데이터가 있으면 최신 데이터 사용 (마지막 데이터)
                        yearlyData[year] = {
                          year,
                          value,
                          checkup_date: item.checkup_date,
                          location: item.location || item.Location || "병원", // 🔧 실제 location 필드 추가
                          item
                        };
                      }
                    });
                    
                    // 년도별 데이터를 차트 포인트로 변환 (최신 5년만)
                    return Object.values(yearlyData)
                      .sort((a: any, b: any) => b.year.localeCompare(a.year)) // 최신 년도 순 정렬
                      .slice(0, 5) // 최신 5년만 선택
                      .map((data: any) => {
                      let dateString;
                      try {
                        // checkup_date는 "MM/DD" 형식
                        const checkupDate = data.checkup_date || '01/01';
                        const [month, day] = checkupDate.split('/');
                        dateString = `${data.year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        
                      } catch (error) {
                        dateString = `${data.year}-01-01`;
                      }
                      
                      // 최종 데이터 검증
                      const finalValue = parseFloat(data.value.toString());
                      if (isNaN(finalValue) || !isFinite(finalValue) || finalValue <= 0) {
                        return null;
                      }

                      return {
                        date: dateString,
                        value: finalValue,
                        label: `${data.year.slice(-2)}년`, // 00년 형식으로 변경
                        status: 'normal' as const,
                        location: data.location || "병원" // 🔧 실제 병원명 사용
                      };
                    }).filter((item): item is NonNullable<typeof item> => item !== null); // null 값 제거
                  })()
                }] : [];

                const latestHealthData = getLatestHealthDataForMetric(metric);
                const latestValue = latestHealthData ? 
                  getValueFromHealthData(latestHealthData, metric) : 0;

                // 🔍 디버깅: 최신 데이터 및 상태 확인
                console.log(`🔍 [${metric}] 최신 데이터 분석:`, {
                  metric,
                  latestHealthData: latestHealthData ? {
                    year: latestHealthData.Year,
                    checkupDate: latestHealthData.CheckUpDate,
                    rawDataExists: !!(latestHealthData as any).raw_data,
                    codeField: (latestHealthData as any).raw_data?.Code
                  } : null,
                  latestValue,
                  healthDataAll: healthData.map(item => ({
                    year: item.Year,
                    checkupDate: item.CheckUpDate,
                    code: (item as any).raw_data?.Code
                  }))
                });

                const healthStatus = latestHealthData ? 
                  getHealthStatus(metric, latestValue, latestHealthData) : 
                  { status: 'normal' as const, text: '정상', date: '' };

                // 🔍 디버깅: 상태 판정 결과
                console.log(`🔍 [${metric}] 상태 판정 결과:`, {
                  metric,
                  healthStatus,
                  latestValue
                });
                
                return (
                  <div 
                    key={metric}
                    className="health-metric-card"
                  >
                    <div className="metric-header">
                      <div className={`status-badge status-${healthStatus.status}`}>
                        <span className="status-text">{healthStatus.text}</span>
                        {healthStatus.date && (
                          <span className="status-date">
                            {latestHealthData?.Year?.replace('년', '').slice(-2) || '25'}년 {healthStatus.date}
                          </span>
                        )}
                      </div>
                      <h3 className="metric-title">{metric}</h3>
                      <div className="metric-value">
                        <span className="value">
                          {latestValue > 0 ? latestValue.toFixed(1) : 
                           (latestValue === 0 ? '0.0' : '-')}
                        </span>
                        <span className="unit">{getUnitForMetric(metric)}</span>
                      </div>
                    </div>
                    
                    <div className="metric-chart">
                      {(() => {
                        const hasData = metricChartData.length > 0 && metricChartData[0].data.length > 0;
                        const dataCount = hasData ? metricChartData[0].data.length : 0;
                        
                        console.log(`🔍 [${metric}] 차트 렌더링 결정:`, {
                          metric,
                          dataCount,
                          hasData,
                          metricChartData: metricChartData[0]?.data
                        });

                        if (dataCount === 0) {
                          console.log(`📊 [${metric}] 데이터 없음으로 렌더링`);
                          return (
                            <div className="no-data">
                              <p>데이터 없음</p>
                            </div>
                          );
                        } else if (dataCount === 1) {
                          console.log(`📊 [${metric}] 단일 데이터로 렌더링`);
                          const singlePoint = metricChartData[0]?.data[0];
                          
                          return (
                            <div className="single-data">
                              <div 
                                className="single-point"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  if (singlePoint) {
                                    console.log(`🔍 [툴팁] 단일 데이터 포인트 클릭: ${metric}, 값: ${singlePoint.value}`);
                                    
                                    // 간단한 알림으로 툴팁 대체
                                    const statusText = singlePoint.status ? 
                                      (singlePoint.status === 'normal' ? '정상' : 
                                       singlePoint.status === 'warning' ? '경계' : '이상') : '';
                                    const locationText = (singlePoint as any).location || "병원";
                                    const headerText = statusText ? `${locationText} | ${statusText}` : locationText;
                                    
                                    alert(`${headerText}\n${singlePoint.value.toFixed(1)} ${getUnitForMetric(metric)}`);
                                  }
                                }}
                              >
                                <div className="point-dot"></div>
                                <div className="point-value">
                                  {metricChartData[0]?.data[0]?.value?.toFixed(1) || '-'}
                                </div>
                              </div>
                              <p className="single-data-label">단일 데이터 (클릭 가능)</p>
                            </div>
                          );
                        } else {
                          // 2개 이상 데이터가 있을 때만 LineChart 사용
                          const validData = metricChartData[0]?.data?.filter(point => 
                            point && 
                            point.value > 0 && 
                            !isNaN(point.value) && 
                            isFinite(point.value) &&
                            point.date && 
                            !isNaN(new Date(point.date).getTime())
                          ) || [];
                          
                          console.log(`🔍 [${metric}] validData 필터링 결과:`, {
                            metric,
                            originalDataLength: metricChartData[0]?.data?.length || 0,
                            validDataLength: validData.length,
                            validData
                          });

                          if (validData.length < 2) {
                            console.log(`📊 [${metric}] validData < 2이므로 단일 데이터로 렌더링`);
                            // 🔧 단일 데이터에도 툴팁 추가
                            const singleDataPoint = validData.length > 0 ? validData[0] : null;
                            
                            return (
                              <div className="single-data">
                                <div 
                                  className="single-point"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    if (singleDataPoint) {
                                      console.log(`🔍 [툴팁] 단일 데이터 포인트 클릭: ${metric}, 값: ${singleDataPoint.value}`);
                                      
                                      // 간단한 알림으로 툴팁 대체
                                      const statusText = singleDataPoint.status ? 
                                        (singleDataPoint.status === 'normal' ? '정상' : 
                                         singleDataPoint.status === 'warning' ? '경계' : '이상') : '';
                                      const locationText = (singleDataPoint as any).location || "병원";
                                      const headerText = statusText ? `${locationText} | ${statusText}` : locationText;
                                      
                                      alert(`${headerText}\n${singleDataPoint.value.toFixed(1)} ${getUnitForMetric(metric)}`);
                                    }
                                  }}
                                >
                                  <div className="point-dot"></div>
                                  <div className="point-value">
                                    {validData.length > 0 ? validData[0]?.value?.toFixed(1) || '-' : '-'}
                                  </div>
                                </div>
                                <p className="single-data-label">단일 데이터 (클릭 가능)</p>
                              </div>
                            );
                          }
                          
                          // 🔧 다중 건강 범위 추출 (6ecb1ca 방식 복원)
                          const healthRanges = getHealthRanges(metric, latestHealthData, 'M'); // 성별은 추후 환자 정보에서 가져올 수 있음
                          
                          // 🔧 모든 건강지표 파싱 상태 확인 (6ecb1ca 로직 복원)
                          console.log(`🎯 [${metric}] 건강범위 파싱 결과:`, {
                            metric,
                            healthRanges,
                            hasAllRanges: !!(healthRanges?.normal && healthRanges?.borderline && healthRanges?.abnormal),
                            missingRanges: {
                              normal: !healthRanges?.normal,
                              borderline: !healthRanges?.borderline, 
                              abnormal: !healthRanges?.abnormal
                            }
                          });
                          
                          console.log(`📊 [${metric}] LineChart 렌더링:`, {
                            metric,
                            validDataLength: validData.length,
                            seriesData: {
                              ...metricChartData[0],
                              data: validData
                            }
                          });

                          return (
                            <LineChart 
                              series={[{
                                ...metricChartData[0],
                                data: validData
                              }]}
                              width={260}
                              height={170}
                              healthRanges={healthRanges || undefined}
                            />
                          );
                        }
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 닷 인디케이터 - 12개 고정 */}
            <div className="slider-dots">
              {Array.from({ length: 12 }, (_, index) => (
                <div 
                  key={index}
                  className={`dot ${index === activeDotIndex ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDotIndex(index);
                    const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
                    const card = document.querySelectorAll('.health-metric-card')[index] as HTMLElement;
                    if (slider && card) {
                      const cardOffsetLeft = card.offsetLeft;
                      const sliderClientWidth = slider.clientWidth;
                      const cardWidth = card.offsetWidth;
                      
                      let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                      const maxScrollLeft = slider.scrollWidth - sliderClientWidth;
                      targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
                      
                      slider.scrollTo({
                        left: targetScrollLeft,
                        behavior: 'smooth'
                      });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 방문 추이 분석 카드 */}
      <section className="analysis-card">
        <div className="card-header">
          <h2 className="section-title">의료기관 방문 추이</h2>
          <div className="chart-info">
            <span className="info-text">약국 및 병원 방문 건수</span>
          </div>
        </div>
        
        {/* 방문 추이 컨테이너 */}
        <div className="visit-trends-wrapper">
          <div className="visit-trends-container">
            <div className="visit-trends-slider">
              {/* 약국 방문 추이 */}
              <div className="visit-trend-card">
                <div className="trend-header">
                  <h3 className="trend-title">약국 방문 추이</h3>
                </div>
                <div className="trend-chart">
                  {isLoadingVisitData ? (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="로딩 중" 
                          className="spinner-icon"
                        />
                      </div>
                      <p className="loading-text">처방 데이터 분석 중...</p>
                    </div>
                  ) : prescriptionChartData.length > 0 && prescriptionChartData[0].data.length > 0 ? (
                    <BarChart 
                      series={prescriptionChartData}
                      width={280}
                      height={170}
                    />
                  ) : (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="데이터 없음" 
                          className="spinner-icon"
                          style={{ opacity: 0.5, animation: 'none' }}
                        />
                      </div>
                      <p className="loading-text">처방 데이터가 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 병원 방문 추이 */}
              <div className="visit-trend-card">
                <div className="trend-header">
                  <h3 className="trend-title">병원 방문 추이</h3>
                </div>
                <div className="trend-chart">
                  {isLoadingVisitData ? (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="로딩 중" 
                          className="spinner-icon"
                        />
                      </div>
                      <p className="loading-text">병원 방문 데이터 분석 중...</p>
                    </div>
                  ) : hospitalVisitChartData.length > 0 && hospitalVisitChartData[0].data.length > 0 ? (
                    <BarChart 
                      series={hospitalVisitChartData}
                      width={280}
                      height={170}
                    />
                  ) : (
                    <div className="chart-loading">
                      <div className="loading-spinner">
                        <img 
                          src="/wello/wello-icon.png" 
                          alt="데이터 없음" 
                          className="spinner-icon"
                          style={{ opacity: 0.5, animation: 'none' }}
                        />
                      </div>
                      <p className="loading-text">병원 방문 데이터가 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 닷 인디케이터 */}
            <div className="visit-trends-dots">
              <div className={`dot ${activeVisitDotIndex === 0 ? 'active' : ''}`} onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  slider.scrollTo({ left: 0, behavior: 'smooth' });
                }
              }}></div>
              <div className={`dot ${activeVisitDotIndex === 1 ? 'active' : ''}`} onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  const card = document.querySelectorAll('.visit-trend-card')[1] as HTMLElement;
                  if (card) {
                    const cardOffsetLeft = card.offsetLeft;
                    const sliderClientWidth = slider.clientWidth;
                    const cardWidth = card.offsetWidth;
                    let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                    const maxScrollLeft = slider.scrollWidth - sliderClientWidth;
                    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
                    slider.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
                  }
                }
              }}></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrendsSection;
