/**
 * TrendsSection - 건강지표 추이 분석 컴포넌트
 * ComprehensiveAnalysisPage에서 추출한 추이 섹션
 */
import React, { useState, useEffect, useMemo } from 'react';
import LineChart from '../../charts/LineChart';
import BarChart from '../../charts/BarChart';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import '../../../pages/ComprehensiveAnalysisPage/styles.scss';
// 이미지 import
import healthyPotatoImage from '../../../assets/images/gamgam/healthy_potato_nobg.png';
import tiredPotatoImage from '../../../assets/images/gamgam/tired_potato_nobg.png';
import docImage from '../../../assets/images/gamgam/doc_nobg.png';

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
  // 이미지 강조 애니메이션 상태
  const [imageKey, setImageKey] = useState(0);
  // 의료기관 방문 추이 관련 상태 제거됨 (의료 기록 타임라인 토글에 포함)
  
  // 건강 지표 목록
  const healthMetrics = [
    '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
    '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
    'LDL 콜레스테롤', '중성지방', '헤모글로빈'
  ];

  // 통합 년도 목록 생성 (모든 검진 데이터의 년도 수집)
  const allYears = useMemo(() => {
    const yearsSet = new Set<number>();
    healthData.forEach((item: any) => {
      if (item.year) {
        const year = parseInt(item.year.replace('년', ''), 10);
        if (!isNaN(year)) {
          yearsSet.add(year);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a); // 최신 년도 순
  }, [healthData]);

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


  // 🔧 건강범위 추출 함수 (6ecb1ca에서 추출) - ItemReferences의 Name도 함께 반환
  const getHealthRanges = (metric: string, healthDataItem: any, gender: string = 'M'): {
    normal: { min: number; max: number; name?: string } | null;
    borderline: { min: number; max: number; name?: string } | null;
    abnormal: { min: number; max: number; name?: string } | null;
  } | null => {
    // 🔍 디버깅: 입력 데이터 확인
    if (!healthDataItem) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [getHealthRanges] ${metric} - healthDataItem이 null/undefined입니다`);
      }
      return null;
    }
    
    if (!healthDataItem?.raw_data) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [getHealthRanges] ${metric} - raw_data가 없습니다:`, {
          healthDataItem: healthDataItem,
          hasRawData: !!healthDataItem?.raw_data
        });
      }
      return null;
    }
    
    const rawData = healthDataItem.raw_data;
    
    // 🔍 디버깅: rawData 구조 확인
    if (!rawData.Inspections || !Array.isArray(rawData.Inspections)) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [getHealthRanges] ${metric} - Inspections가 없거나 배열이 아닙니다:`, {
          hasInspections: !!rawData.Inspections,
          isArray: Array.isArray(rawData.Inspections),
          rawData: rawData
        });
      }
      return null;
    }
    
    let foundItem: any = null;
    let allItemNames: string[] = [];
    
    if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
      for (const inspection of rawData.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
              // 🔍 디버깅: 모든 Item 이름 수집
              allItemNames.push(...illness.Items.map((i: any) => i.Name).filter(Boolean));
              
              const item = illness.Items.find((item: any) => {
                if (!item.Name) return false;
                const itemName = item.Name;
                const metricName = metric.replace(' (수축기)', '').replace(' (이완기)', '');
                
                // 🔧 지표별 정확한 매칭 로직
                if (metric === 'HDL 콜레스테롤') {
                  return itemName.includes('hdl') || itemName.includes('고밀도');
                }
                if (metric === 'LDL 콜레스테롤') {
                  return itemName.includes('ldl') || itemName.includes('저밀도');
                }
                if (metric === '총콜레스테롤' || metric === '총 콜레스테롤') {
                  return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl') && !itemName.includes('고밀도') && !itemName.includes('저밀도'));
                }
                
                return itemName.includes(metricName) ||
                       (metric === 'BMI' && (itemName.includes('체질량지수') || itemName.includes('bmi'))) ||
                       (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                       (metric.includes('혈압') && itemName.includes('혈압')) ||
                       (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                       (metric === '중성지방' && itemName.includes('중성지방')) ||
                       (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
              });
              
              if (item) {
                foundItem = item;
                break; // 찾으면 루프 종료
              }
            }
          }
          if (foundItem) break; // 찾으면 루프 종료
        }
      }
    }
    
    // 🔍 디버깅: item을 찾지 못한 경우
    if (!foundItem) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [getHealthRanges] ${metric} - 해당 지표를 찾을 수 없습니다.`, {
          metric,
          검색한이름: metric.replace(' (수축기)', '').replace(' (이완기)', ''),
          사용가능한Item이름들: allItemNames,
          rawData구조: {
            hasInspections: !!rawData.Inspections,
            inspectionsCount: rawData.Inspections?.length || 0
          }
        });
      }
      return null;
    }
    
    const item = foundItem;
    
    if (item && item.ItemReferences && Array.isArray(item.ItemReferences)) {
      const ranges = {
        normal: null as { min: number; max: number; name?: string } | null,
        borderline: null as { min: number; max: number; name?: string } | null,
        abnormal: null as { min: number; max: number; name?: string } | null
      };
      
      // 정상(A) 범위 - 다양한 Name 형식 시도
      const normalRef = item.ItemReferences.find((ref: any) => 
        ref.Name === '정상(A)' || 
        ref.Name === '정상A' || 
        ref.Name === '정상' ||
        ref.Name?.includes('정상(A)') ||
        ref.Name?.includes('정상A')
      );
      if (normalRef && normalRef.Value) {
        const parsedRange = parseNormalRange(normalRef.Value, gender, metric);
        if (parsedRange) {
          ranges.normal = {
            ...parsedRange,
            name: normalRef.Name // 🔧 ItemReferences의 Name 그대로 사용
          };
        }
      }
      
      // 정상(B) 또는 경계 범위 - 다양한 Name 형식 시도
      const borderlineRef = item.ItemReferences.find((ref: any) => 
        ref.Name === '정상(B)' || 
        ref.Name === '정상B' || 
        ref.Name === '정상(경계)' ||
        ref.Name === '경계' ||
        ref.Name?.includes('정상(B)') ||
        ref.Name?.includes('정상B') ||
        ref.Name?.includes('경계')
      );
      if (borderlineRef && borderlineRef.Value) {
        const parsedRange = parseNormalRange(borderlineRef.Value, gender, metric);
        if (parsedRange) {
          ranges.borderline = {
            ...parsedRange,
            name: borderlineRef.Name // 🔧 ItemReferences의 Name 그대로 사용
          };
        }
      }
      
      // 질환의심 범위 - 다양한 Name 형식 시도
      const abnormalRef = item.ItemReferences.find((ref: any) => 
        ref.Name === '질환의심' || 
        ref.Name === '이상' ||
        ref.Name === '질환' ||
        ref.Name?.includes('질환의심') ||
        ref.Name?.includes('이상')
      );
      if (abnormalRef && abnormalRef.Value) {
        const parsedRange = parseNormalRange(abnormalRef.Value, gender, metric);
        if (parsedRange) {
          ranges.abnormal = {
            ...parsedRange,
            name: abnormalRef.Name // 🔧 ItemReferences의 Name 그대로 사용
          };
        }
      }
      
      return ranges;
    } else {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [getHealthRanges] ${metric} - ItemReferences 없음 또는 배열 아님:`, {
          item: item,
          hasItemReferences: !!item?.ItemReferences,
          isArray: Array.isArray(item?.ItemReferences),
          itemReferences: item?.ItemReferences
        });
      }
      return null;
    }
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
      
      // 복합 범위 처리 (예: "18.5미만/25~29.9" - "/"로 구분된 여러 범위)
      if (rangeStr.includes('/') && !rangeStr.includes('남') && !rangeStr.includes('여')) {
        // "/"로 구분된 부분 중 숫자 범위가 있는 부분 찾기 (예: "25~29.9")
        const parts = rangeStr.split('/');
        for (const part of parts) {
          const trimmedPart = part.trim();
          // "25~29.9" 또는 "25-29.9" 형태 찾기
          if (trimmedPart.includes('~') || trimmedPart.includes('-')) {
            const range = parseSimpleRange(trimmedPart);
            if (range) {
              return range;
            }
          }
        }
        // 범위를 찾지 못하면 첫 번째 부분 사용
        return parseSimpleRange(parts[0].trim());
      }
      
      // 일반 범위 처리
      return parseSimpleRange(rangeStr);
      
    } catch (error) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn('정상 범위 파싱 실패:', rangeStr, error);
      }
      return null;
    }
  };

  // 🔧 단순 범위 파싱 함수 (6ecb1ca에서 추출)
  const parseSimpleRange = (rangeStr: string): { min: number; max: number } | null => {
    // "18.5-24.9" 또는 "25~29.9" 형태 (하이픈 또는 물결표)
    if (rangeStr.includes('-') || rangeStr.includes('~')) {
      const separator = rangeStr.includes('-') ? '-' : '~';
      const [minStr, maxStr] = rangeStr.split(separator);
      const min = parseFloat(minStr.trim());
      const max = parseFloat(maxStr.trim());
      if (!isNaN(min) && !isNaN(max)) {
        return { min, max };
      }
    }
    
    // "100미만" 형태 - max를 경계값으로 설정 (빈 공간 제거를 위해)
    if (rangeStr.includes('미만')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
      if (match) {
        const maxValue = parseFloat(match[1]);
        // "90미만"이면 max를 90으로 설정하여 "90이상"과 연속되도록 함
        return { min: 0, max: maxValue };
      }
    }
    
    // "60이상" 형태 - max를 실제 데이터 기반으로 계산하기 위해 큰 값 대신 실제 데이터 범위 사용
    // 하지만 타입 안정성을 위해 여전히 숫자 반환 (LineChart에서 실제 데이터와 함께 계산됨)
    if (rangeStr.includes('이상')) {
      const match = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
      if (match) {
        const min = parseFloat(match[1]);
        // max는 실제 데이터 범위를 고려하여 계산되도록 큰 값 사용 (LineChart에서 실제 데이터와 함께 재계산됨)
        // 실제 데이터가 있으면 그 값이 우선됨
        return { min, max: min * 10 }; // 임시로 큰 값 사용 (실제 데이터 범위가 있으면 그게 우선됨)
      }
    }
    
    return null;
  };

  // 🔧 범위 체크 함수 (성별 구분 문자열 지원 추가)
  const isInRange = (value: number, rangeStr: string, gender: string = 'M'): boolean => {
    if (!rangeStr) return false;
    
    try {
      // 복합 범위 처리 (예: "18.5미만/25~29.9", "18.5미만/25-29.9")
      // "/"로 구분된 여러 범위 중 하나라도 매칭되면 true 반환
      if (rangeStr.includes('/') && !rangeStr.includes('남') && !rangeStr.includes('여')) {
        const parts = rangeStr.split('/');
        for (const part of parts) {
          const trimmedPart = part.trim();
          if (trimmedPart && isInRange(value, trimmedPart, gender)) {
            return true; // 하나라도 매칭되면 true
          }
        }
        return false; // 모든 부분이 매칭되지 않으면 false
      }
      
      // 성별 구분 처리 (예: "남 90이상 / 여 85이상", "남: 13-16.5 / 여: 12-15.5", "남:12.0미만 / 여:10.0미만")
      if (rangeStr.includes('남') && (rangeStr.includes('여') || rangeStr.includes('/'))) {
        const parts = rangeStr.split('/');
        const targetPart = gender === 'M' ? 
          parts.find(p => p.includes('남'))?.trim() : 
          parts.find(p => p.includes('여'))?.trim();
        
        if (targetPart) {
          // "남:" 또는 "여:" 제거하고 공백 정리
          const cleanRange = targetPart.replace(/^남:|^여:/, '').trim();
          return isInRange(value, cleanRange, gender); // 재귀 호출로 처리
        }
        return false;
      }
      
      // "40미만" 또는 "12.0미만" 형태 처리
      if (rangeStr.includes('미만')) {
        const match = rangeStr.match(/(\d+(?:\.\d+)?)미만/);
        if (match) {
          const max = parseFloat(match[1]);
          return !isNaN(max) && value < max;
        }
        // 숫자만 추출 시도
        const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(max) && value < max;
      }
      
      // "60이상" 형태 처리
      if (rangeStr.includes('이상')) {
        const match = rangeStr.match(/(\d+(?:\.\d+)?)이상/);
        if (match) {
          const min = parseFloat(match[1]);
          return !isNaN(min) && value >= min;
        }
        // 숫자만 추출 시도
        const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(min) && value >= min;
      }
      
      // "25~29.9" 또는 "25-29.9" 형태 처리 (물결표 또는 하이픈)
      if ((rangeStr.includes('~') || rangeStr.includes('-')) && !rangeStr.includes('이상') && !rangeStr.includes('미만')) {
        const separator = rangeStr.includes('~') ? '~' : '-';
        // "25~29.9" 또는 "25-29.9" 형태에서 숫자 추출
        const rangeMatch = rangeStr.match(/(\d+(?:\.\d+)?)\s*[~-]\s*(\d+(?:\.\d+)?)/);
        if (rangeMatch) {
          const min = parseFloat(rangeMatch[1]);
          const max = parseFloat(rangeMatch[2]);
          return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
        }
        // 정규식 매칭 실패 시 기존 방식 사용
        const parts = rangeStr.split(separator);
        if (parts.length === 2) {
          const min = parseFloat(parts[0].replace(/[^0-9.-]/g, ''));
          const max = parseFloat(parts[1].replace(/[^0-9.-]/g, ''));
          return !isNaN(min) && !isNaN(max) && value >= min && value <= max;
        }
      }
      
      // ">=120" 형태
      if (rangeStr.includes('>=')) {
        const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(min) && value >= min;
      }
      
      // "<=140" 형태
      if (rangeStr.includes('<=')) {
        const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(max) && value <= max;
      }
      
      // ">120" 형태
      if (rangeStr.includes('>') && !rangeStr.includes('>=')) {
        const min = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(min) && value > min;
      }
      
      // "<140" 형태
      if (rangeStr.includes('<') && !rangeStr.includes('<=')) {
        const max = parseFloat(rangeStr.replace(/[^0-9.-]/g, ''));
        return !isNaN(max) && value < max;
      }
      
      return false;
    } catch (error) {
      // 개발 모드에서만 경고 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn('범위 체크 실패:', rangeStr, error);
      }
      return false;
    }
  };

  // 건강지표 상태 판단 함수 - 데이터 기준으로만 판단, ItemReferences의 Name을 그대로 사용
  const getHealthStatus = (metric: string, value: number, healthDataItem: any, gender: string = 'M'): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string, refName?: string } => {
    // 디버그 로그 제거
    
    if (metric === '신장') {
      return {
        status: 'neutral',
        text: '측정',
        date: healthDataItem?.CheckUpDate || ''
      };
    }

    const rawData = healthDataItem?.raw_data;
    if (!rawData) {
      // raw_data 없음 - 기본 정상 반환 (로그 제거)
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

    // 전체 상태 코드 확인 (로그 제거)

    let itemStatus: 'normal' | 'warning' | 'abnormal' | 'neutral' = overallStatus;
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
                       (metric === 'BMI' && (itemName.includes('체질량지수') || itemName.includes('bmi'))) ||
                       (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                       (metricName.includes('혈압') && itemName.includes('혈압')) ||
                       (metricName.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                       (metricName === '중성지방' && itemName.includes('중성지방')) ||
                       (metricName === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
              });
              
              if (item) {
                // 매칭된 항목 발견 (로그 제거)
                
                // ItemReferences가 빈 배열이거나 없으면 neutral (측정) 반환
                if (!item.ItemReferences || !Array.isArray(item.ItemReferences) || item.ItemReferences.length === 0) {
                  itemStatus = 'neutral';
                } else if (item.ItemReferences && Array.isArray(item.ItemReferences) && item.ItemReferences.length > 0) {
                  const itemValue = parseFloat(item.Value);
                  
                  if (!isNaN(itemValue)) {
                    // 🔧 데이터 기준으로만 판단 - ItemReferences에 명시된 범위만 체크
                    // 질환의심 범위 체크 (우선순위)
                    const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
                    if (abnormal && isInRange(itemValue, abnormal.Value, gender)) {
                      itemStatus = 'abnormal';
                      return {
                        status: itemStatus,
                        text: abnormal.Name, // ItemReferences의 Name 그대로 사용
                        date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || '',
                        refName: abnormal.Name
                      };
                    }
                    
                    // 정상(B) 또는 경계 범위 체크
                    const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
                    if (normalB && isInRange(itemValue, normalB.Value, gender)) {
                      itemStatus = 'warning';
                      return {
                        status: itemStatus,
                        text: normalB.Name, // ItemReferences의 Name 그대로 사용
                        date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || '',
                        refName: normalB.Name
                      };
                    }
                    
                    // 정상(A) 범위 체크
                    const normalA = item.ItemReferences.find((ref: any) => ref.Name === '정상(A)');
                    if (normalA && isInRange(itemValue, normalA.Value, gender)) {
                      itemStatus = 'normal';
                      return {
                        status: itemStatus,
                        text: normalA.Name, // ItemReferences의 Name 그대로 사용
                        date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || '',
                        refName: normalA.Name
                      };
                    }
                    
                    // 🔧 데이터에 명시된 범위에 해당하지 않는 경우 - 임의 판정하지 않음
                    // ItemReferences에 명시된 범위만 사용, 범위를 벗어난 경우는 데이터에 명시된 기준이 없으므로 판정하지 않음
                  }
                }
              }
            }
          }
        }
      }
    }

    // 매칭된 항목 없으면 전체 상태 사용 (로그 제거)
    // ItemReferences에 매칭되지 않은 경우 기본 텍스트 사용
    const statusText = itemStatus === 'normal' ? '정상' : 
                      itemStatus === 'warning' ? '경계' : 
                      itemStatus === 'neutral' ? '측정' : '이상';
    
    // 최종 판정 결과 (로그 제거)
    
    return {
      status: itemStatus,
      text: statusText,
      date: rawData.CheckUpDate || healthDataItem?.CheckUpDate || ''
    };
  };

  // 🔧 처방전 차트 데이터 및 병원 방문 차트 데이터 제거됨
  // 의료기관 방문 추이 섹션이 UnifiedHealthTimeline으로 이동 예정

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

      if (closestIndex !== activeDotIndex) {
        setActiveDotIndex(closestIndex);
        // 카드 변경 시 이미지 강조 애니메이션 트리거
        setImageKey(prev => prev + 1);
      }
    };

    slider.addEventListener('scroll', handleScroll);
    return () => slider.removeEventListener('scroll', handleScroll);
  }, [healthData, activeDotIndex]);

  // 방문 추이 닷 슬라이더 스크롤 동기화 제거됨 (의료기관 방문 추이 섹션이 제거되어 불필요)

  if (isLoading) {
    return (
      <div className="trends-loading">
        <div className="loading-spinner">
          <img 
            src={WELLO_LOGO_IMAGE}
            alt="로딩 중" 
            className="wello-icon-blink"
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
        {/* 헤더 영역 제거됨 */}
        
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
                             (targetMetric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
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
          return null;
        }
        
        // 년도 기준 정렬 (최신 먼저)
        const sortedData = [...dataWithMetric].sort((a, b) => {
          const yearA = parseInt((a.Year || '1900').replace('년', ''));
          const yearB = parseInt((b.Year || '1900').replace('년', ''));
          return yearB - yearA; // 최신 년도 먼저 (내림차순)
        });
        
        // 지표별 최신 데이터 선택 (로그 제거)
        
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
                                     (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                                     (metric.includes('혈압') && itemName.includes('혈압')) ||
                                     (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                     (metric === '중성지방' && itemName.includes('중성지방')) ||
                                     (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                            });
                            
                            // 🔧 빈 문자열 체크 추가
                            if (item && item.Value && item.Value.trim() !== "") {
                              const value = parseFloat(item.Value);
                              // raw_data에서 값 추출 (로그 제거)
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
                    
                    // 년도별 데이터를 차트 포인트로 변환 (모든 년도 사용)
                    return Object.values(yearlyData)
                      .sort((a: any, b: any) => b.year.localeCompare(a.year)) // 최신 년도 순 정렬
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

                      // 각 데이터 포인트의 상태 계산
                      const pointStatus = (() => {
                        const pointValue = finalValue;
                        
                        // 1순위: raw_data에서 ItemReferences로 상태 계산
                        if (data.item?.raw_data) {
                          const rawData = data.item.raw_data;
                          const metricName = metric.toLowerCase().replace(' (수축기)', '').replace(' (이완기)', '');
                          
                          // raw_data에서 해당 지표 찾기
                          if (rawData.Inspections) {
                            for (const inspection of rawData.Inspections) {
                              if (inspection.Illnesses) {
                                for (const illness of inspection.Illnesses) {
                                  if (illness.Items) {
                                    const item = illness.Items.find((item: any) => {
                                      if (!item.Name) return false;
                                      const itemName = item.Name.toLowerCase();
                                      
                                      if (metric === 'HDL 콜레스테롤') {
                                        return itemName.includes('hdl') || itemName.includes('고밀도');
                                      }
                                      if (metric === 'LDL 콜레스테롤') {
                                        return itemName.includes('ldl') || itemName.includes('저밀도');
                                      }
                                      if (metric === '총콜레스테롤') {
                                        return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl'));
                                      }
                                      
                                      return itemName.includes(metricName) ||
                                             (metric === 'BMI' && (itemName.includes('체질량지수') || itemName.includes('bmi'))) ||
                                             (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                                             (metric.includes('혈압') && itemName.includes('혈압')) ||
                                             (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                             (metric === '중성지방' && itemName.includes('중성지방')) ||
                                             (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                                    });
                                    
                                    // ItemReferences가 빈 배열이거나 없으면 neutral 반환
                                    if (item && (!item.ItemReferences || !Array.isArray(item.ItemReferences) || item.ItemReferences.length === 0)) {
                                      return 'neutral' as const;
                                    }
                                    
                                    if (item && item.ItemReferences && Array.isArray(item.ItemReferences) && item.ItemReferences.length > 0) {
                                      const itemValue = parseFloat(item.Value);
                                      if (!isNaN(itemValue)) {
                                        // 질환의심 범위 체크 (우선순위)
                                        const abnormal = item.ItemReferences.find((ref: any) => 
                                          ref.Name === '질환의심' || 
                                          ref.Name === '이상' ||
                                          ref.Name === '질환' ||
                                          ref.Name?.includes('질환의심') ||
                                          ref.Name?.includes('이상')
                                        );
                                        if (abnormal && abnormal.Value && isInRange(itemValue, abnormal.Value, 'M')) {
                                          return 'abnormal' as const;
                                        }
                                        
                                        // 정상(B) 또는 경계 범위 체크
                                        const normalB = item.ItemReferences.find((ref: any) => 
                                          ref.Name === '정상(B)' || 
                                          ref.Name === '정상B' || 
                                          ref.Name === '정상(경계)' ||
                                          ref.Name === '경계' ||
                                          ref.Name?.includes('정상(B)') ||
                                          ref.Name?.includes('정상B') ||
                                          ref.Name?.includes('경계')
                                        );
                                        if (normalB && normalB.Value && isInRange(itemValue, normalB.Value, 'M')) {
                                          return 'warning' as const;
                                        }
                                        
                                        // 정상(A) 범위 체크
                                        const normalA = item.ItemReferences.find((ref: any) => 
                                          ref.Name === '정상(A)' || 
                                          ref.Name === '정상A' || 
                                          ref.Name === '정상' ||
                                          ref.Name?.includes('정상(A)') ||
                                          ref.Name?.includes('정상A')
                                        );
                                        if (normalA && normalA.Value && isInRange(itemValue, normalA.Value, 'M')) {
                                          return 'normal' as const;
                                        }
                                        
                                        // 🔧 데이터 기준으로만 판단 - ItemReferences에 명시된 범위만 체크
                                        // 범위를 벗어난 경우는 데이터에 명시된 기준이 없으므로 판정하지 않음
                                        // 문제 발생 시에만 로그 출력 (개발 모드에서만)
                                        if (itemValue && !isNaN(itemValue) && process.env.NODE_ENV === 'development') {
                                          console.warn(`⚠️ [${metric}] 범위 체크 실패 - ItemReferences에 매칭되는 범위 없음:`, {
                                            itemValue,
                                            itemName: item.Name,
                                            abnormal: abnormal ? { Name: abnormal.Name, Value: abnormal.Value } : '없음',
                                            normalB: normalB ? { Name: normalB.Name, Value: normalB.Value } : '없음',
                                            normalA: normalA ? { Name: normalA.Name, Value: normalA.Value } : '없음'
                                          });
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                        
                        // 2순위: healthRanges와 값 비교로 상태 계산 (raw_data가 없을 때)
                        const latestHealthData = getLatestHealthDataForMetric(metric);
                        if (latestHealthData) {
                          const healthRanges = getHealthRanges(metric, latestHealthData, 'M'); // 성별은 추후 환자 정보에서 가져올 수 있음
                          
                          if (healthRanges) {
                            // 🔧 데이터 기준으로만 판단 - ItemReferences에 명시된 범위만 체크
                            // 이상 범위 체크 (우선순위)
                            if (healthRanges.abnormal && pointValue >= healthRanges.abnormal.min && pointValue <= healthRanges.abnormal.max) {
                              return 'abnormal' as const;
                            }
                            // 경계 범위 체크
                            if (healthRanges.borderline && pointValue >= healthRanges.borderline.min && pointValue <= healthRanges.borderline.max) {
                              return 'warning' as const;
                            }
                            // 정상 범위 체크
                            if (healthRanges.normal && pointValue >= healthRanges.normal.min && pointValue <= healthRanges.normal.max) {
                              return 'normal' as const;
                            }
                            // 🔧 데이터에 명시된 범위에 해당하지 않는 경우 - 임의 판정하지 않음
                            // 문제 발생 시에만 로그 출력 (개발 모드에서만)
                            if (process.env.NODE_ENV === 'development') {
                              console.warn(`⚠️ [${metric}] healthRanges 범위 체크 실패 - 값: ${pointValue}, normal: ${healthRanges.normal ? `${healthRanges.normal.min}-${healthRanges.normal.max}` : '없음'}, borderline: ${healthRanges.borderline ? `${healthRanges.borderline.min}-${healthRanges.borderline.max}` : '없음'}, abnormal: ${healthRanges.abnormal ? `${healthRanges.abnormal.min}-${healthRanges.abnormal.max}` : '없음'}`);
                            }
                          }
                        }
                        
                        // 3순위: 기본값 (상태를 알 수 없을 때)
                        // 신장은 항상 neutral (측정값)
                        if (metric === '신장') {
                          return 'neutral' as const;
                        }
                        // 🔧 데이터에 명시된 범위에 해당하지 않는 경우 - 임의 판정하지 않음
                        // 범위를 벗어난 경우는 데이터에 명시된 기준이 없으므로 'neutral' 반환
                        // 문제 발생 시에만 로그 출력
                        // 개발 모드에서만 경고 출력
                        if (process.env.NODE_ENV === 'development') {
                          console.warn(`⚠️ [${metric}] 포인트 상태 계산 실패 - 데이터에 명시된 범위에 해당하지 않음, 값: ${pointValue}`);
                        }
                        return 'neutral' as const;
                      })();

                      return {
                        date: dateString,
                        value: finalValue,
                        label: `${data.year.slice(-2)}년`, // 00년 형식으로 변경
                        status: pointStatus,
                        location: data.location || "병원" // 🔧 실제 병원명 사용
                      };
                    }).filter((item): item is NonNullable<typeof item> => item !== null); // null 값 제거
                  })()
                }] : [];

                const latestHealthData = getLatestHealthDataForMetric(metric);
                const latestValue = latestHealthData ? 
                  getValueFromHealthData(latestHealthData, metric) : 0;

                // 🔍 디버깅: 최신 데이터 및 상태 확인 (로그 제거)

                const healthStatus = latestHealthData ? 
                  getHealthStatus(metric, latestValue, latestHealthData) : 
                  { status: 'normal' as const, text: '정상', date: '' };

                // 상태 판정 결과 (로그 제거)
                
                return (
                  <div 
                    key={metric}
                    className="health-metric-card"
                  >
                    <div className="metric-header">
                      <div className={`status-badge status-${healthStatus.status}`}>
                        <span className="status-text">{healthStatus.text}</span>
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
                        
                        // 차트 렌더링 결정 (로그 제거)

                        if (dataCount === 0) {
                          return (
                            <div className="no-data">
                              <p>데이터 없음</p>
                            </div>
                          );
                        } else if (dataCount === 1) {
                          const singlePoint = metricChartData[0]?.data[0];
                          
                          return (
                            <div className="single-data">
                              <div 
                                className="single-point"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  if (singlePoint) {
                                    // 툴팁 클릭 (로그 제거)
                                    
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
                          
                          // validData 필터링 결과 (로그 제거)

                          if (validData.length < 2) {
                            // validData < 2이므로 단일 데이터로 렌더링 (로그 제거)
                            // 🔧 단일 데이터에도 툴팁 추가
                            const singleDataPoint = validData.length > 0 ? validData[0] : null;
                            
                            return (
                              <div className="single-data">
                                <div 
                                  className="single-point"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    if (singleDataPoint) {
                                      // 툴팁 클릭 (로그 제거)
                                      
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
                          
                          // 건강범위 파싱 결과 (로그 제거)
                          // LineChart 렌더링 (로그 제거)

                          return (
                            <LineChart 
                              series={[{
                                ...metricChartData[0],
                                data: validData
                              }]}
                              width={260}
                              height={220}
                              responsive={false}
                              healthRanges={healthRanges || undefined}
                              allYears={allYears.map(y => parseInt(y.toString(), 10))}
                              metric={metric}
                            />
                          );
                        }
                      })()}
                    </div>
                    
                    {/* 측정일 표시 (카드 하단) */}
                    {healthStatus.date && latestHealthData && (() => {
                      const year = latestHealthData?.Year?.replace('년', '').slice(-2) || '25';
                      const dateStr = healthStatus.date;
                      // 날짜 포맷팅 (예: "25년 08월 13일")
                      let formattedDate = '';
                      try {
                        if (dateStr.includes('/')) {
                          const [month, day] = dateStr.split('/');
                          formattedDate = `${year}년 ${month.padStart(2, '0')}월 ${day.padStart(2, '0')}일`;
                        } else {
                          formattedDate = `${year}년 ${dateStr}`;
                        }
                      } catch (e) {
                        formattedDate = `${year}년 ${dateStr}`;
                      }
                      
                      return (
                        <div 
                          className="measurement-date"
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '24px',
                            fontSize: '0.75rem', // 12px (6px의 두 배)
                            color: '#718096',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            zIndex: 100,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}
                        >
                          <span className="date-label">측정일:</span>
                          <span className="date-value">{formattedDate}</span>
                        </div>
                      );
                    })()}
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

      {/* 의료기관 방문 추이 섹션 제거됨 - 의료 기록 타임라인 토글에 포함 */}
      
      {/* 오른쪽 하단 캐릭터 이미지 - 활성화된 카드의 뱃지 상태에 따라 표시 */}
      {(() => {
        // 현재 활성화된 카드의 상태 계산
        const activeMetric = healthMetrics[activeDotIndex];
        if (!activeMetric) return null;
        
        const getLatestHealthDataForMetric = (targetMetric: string) => {
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
          
          const dataWithMetric = dataArray.filter(item => {
            const fieldName = getFieldNameForMetric(targetMetric);
            const hasDirectValue = item[fieldName] && parseFloat(item[fieldName]) > 0;
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
                               (targetMetric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                               (targetMetric.includes('혈압') && itemName.includes('혈압')) ||
                               (targetMetric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                               (targetMetric === '중성지방' && itemName.includes('중성지방')) ||
                               (targetMetric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                      });
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
          if (dataWithMetric.length === 0) return null;
          const sortedData = [...dataWithMetric].sort((a, b) => {
            const yearA = parseInt((a.Year || '1900').replace('년', ''));
            const yearB = parseInt((b.Year || '1900').replace('년', ''));
            return yearB - yearA;
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
                             (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                             (metric.includes('혈압') && itemName.includes('혈압')) ||
                             (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                             (metric === '중성지방' && itemName.includes('중성지방')) ||
                             (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                    });
                    if (item && item.Value && item.Value.trim() !== "") {
                      const value = parseFloat(item.Value);
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
        
        const latestHealthData = getLatestHealthDataForMetric(activeMetric);
        const latestValue = latestHealthData ? 
          getValueFromHealthData(latestHealthData, activeMetric) : 0;
        const healthStatus = latestHealthData ? 
          getHealthStatus(activeMetric, latestValue, latestHealthData) : 
          { status: 'normal' as const, text: '정상', date: '' };
        
        // 상태에 따라 이미지 선택: 정상 → 건강감자, 측정 → 의사, 그 외 → 피곤한감자
        let characterImage: string;
        let altText: string;
        if (healthStatus.status === 'normal') {
          characterImage = healthyPotatoImage;
          altText = '건강감자';
        } else if (healthStatus.status === 'neutral') {
          characterImage = docImage;
          altText = '의사';
        } else {
          characterImage = tiredPotatoImage;
          altText = '피곤한감자';
        }
        
        return (
          <div 
            className="trends-character-image"
            key={imageKey}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '0px',
              width: '160px',
              height: 'auto',
              zIndex: 9999,
              pointerEvents: 'none',
              animation: 'characterHighlight 0.6s ease-out'
            }}
          >
            <img 
              src={characterImage} 
              alt={altText}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block'
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};

export default TrendsSection;
