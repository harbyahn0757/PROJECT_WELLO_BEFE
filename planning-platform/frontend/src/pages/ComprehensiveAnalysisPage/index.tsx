/**
 * ComprehensiveAnalysisPage - 종합적 건강 분석 페이지
 * GPT 기반 건강 상태 분석 및 약물 상호작용 분석
 * 디자인 가이드라인 준수: 브랜드 컬러, 카드 시스템, 타이포그래피
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGlobalSessionDetection from '../../hooks/useGlobalSessionDetection';
import { STORAGE_KEYS, StorageManager } from '../../constants/storage';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import { 
  transformHealthDataForLineChart,
  transformPrescriptionDataForBarChart 
} from '../../utils/healthDataTransformers';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../types/health';
import { WELNO_API, API_ENDPOINTS } from '../../constants/api';
import { WelnoIndexedDB } from '../../services/WelnoIndexedDB';
import { WELNO_LOGO_IMAGE } from '../../constants/images';
import config from '../../config/config.json';
import './styles.scss';
import '../../components/health/HealthDataViewer/styles.scss';

interface HealthInsight {
  category: string;
  status: 'good' | 'warning' | 'danger';
  message: string;
  recommendation?: string;
}

interface DrugInteraction {
  drugs: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

interface NutritionRecommendation {
  avoid: Array<{ name: string; reason: string }>;
  recommend: Array<{ name: string; benefit: string }>;
}

interface GPTAnalysisResult {
  summary: string;
  insights: HealthInsight[];
  drugInteractions: DrugInteraction[];
  nutritionRecommendations: NutritionRecommendation;
}

const ComprehensiveAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useGlobalSessionDetection({ enabled: true });
  
  // 상태 관리
  const [healthData, setHealthData] = useState<TilkoHealthCheckupRaw[]>([]);
  const [prescriptionData, setPrescriptionData] = useState<TilkoPrescriptionRaw[]>([]);
  const [gptAnalysis, setGptAnalysis] = useState<GPTAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeDotIndex, setActiveDotIndex] = useState(0); // 닷 슬라이더 활성 인덱스
  const [analysisStep, setAnalysisStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // 건강 지표 슬라이더 상태
  const [selectedHealthMetric, setSelectedHealthMetric] = useState(0);
  const [healthMetrics, setHealthMetrics] = useState<string[]>([
    '신장', '체중', 'BMI', '허리둘레', '혈압 (수축기)', 
    '혈압 (이완기)', '혈당', '총콜레스테롤', 'HDL 콜레스테롤', 
    'LDL 콜레스테롤', '중성지방', '헤모글로빈'
  ]); // 초기값으로 미리 설정하여 접힘 현상 방지
  
  // 의료기관 방문추이 슬라이더 상태
  const [activeVisitDotIndex, setActiveVisitDotIndex] = useState(0);
  
  // 의료기관 방문추이 로딩 상태
  const [isLoadingVisitData, setIsLoadingVisitData] = useState(true);
  
  // GPT 분석 요청 함수 (useCallback으로 먼저 정의)
  const analyzeHealthData = useCallback(async () => {
    if (healthData.length === 0 && prescriptionData.length === 0) {
      setError('분석할 건강 데이터가 없습니다.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisStep('데이터 준비 중...');
    
    // 재분석인 경우 기존 결과 초기화
    if (gptAnalysis) {
      console.log('[GPT분석] 재분석 시작 - 기존 결과 초기화');
      setGptAnalysis(null);
    }

    try {
      // 진행률 업데이트
      setAnalysisProgress(20);
      setAnalysisStep('건강 데이터 분석 중...');
      
      console.log('[GPT분석] 분석 요청 시작');
      console.log('[GPT분석] 전송 데이터:', {
        healthDataCount: healthData.length,
        prescriptionDataCount: prescriptionData.length,
        healthSample: healthData.slice(0, 1),
        prescriptionSample: prescriptionData.slice(0, 1)
      });
      
      // 진행률 업데이트
      setAnalysisProgress(50);
      setAnalysisStep('AI 분석 요청 중...');
      
      // DB 데이터를 백엔드가 기대하는 형식으로 변환
      const healthDataForAPI = healthData.map(item => ({
        ...item,
        // 필요한 필드들 확인 및 변환
        checkup_date: (item as any).checkup_date || item.CheckUpDate,
        year: (item as any).year || item.Year,
        location: (item as any).location || item.Location
      }));

      const prescriptionDataForAPI = prescriptionData.map(item => ({
        ...item,
        // 필요한 필드들 확인 및 변환
        treatment_date: (item as any).treatment_date || (item as any).JinRyoGaesiIl,
        hospital_name: (item as any).hospital_name || (item as any).ByungEuiwonYakGukMyung
      }));

      const requestData = {
        health_data: healthDataForAPI,
        prescription_data: prescriptionDataForAPI
      };

      console.log('📤 [GPT분석] API 요청 데이터:', requestData);

      const response = await fetch('/api/v1/health-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 진행률 업데이트
      setAnalysisProgress(80);
      setAnalysisStep('분석 결과 처리 중...');

      const result = await response.json();
      console.log('[GPT분석] API 응답:', result);

      if (result.success && result.analysis) {
        // 진행률 완료
        setAnalysisProgress(100);
        setAnalysisStep('분석 완료!');
        setGptAnalysis(result.analysis);
        
        // localStorage에 분석 결과 저장 (플로팅 버튼 상태 업데이트용)
        localStorage.setItem('gpt_analysis_result', JSON.stringify(result.analysis));
        
        // 플로팅 버튼 상태 업데이트 이벤트 발생
        window.dispatchEvent(new CustomEvent('gpt-analysis-completed'));
        
        // 분석 완료 후 결과 섹션으로 부드럽게 스크롤
        setTimeout(() => {
          const analysisResultsSection = document.querySelector('.gpt-analysis-section');
          if (analysisResultsSection) {
            analysisResultsSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }, 500);
      } else {
        throw new Error('분석 결과가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('[GPT분석] 분석 실패:', error);
      console.log('[GPT분석] 목 데이터로 폴백');
      // 목 데이터로 폴백
      const mockResult = getMockAnalysisResult();
      setGptAnalysis(mockResult);
      
      // localStorage에 목 분석 결과 저장 (플로팅 버튼 상태 업데이트용)
      localStorage.setItem('gpt_analysis_result', JSON.stringify(mockResult));
      
      // 플로팅 버튼 상태 업데이트 이벤트 발생
      window.dispatchEvent(new CustomEvent('gpt-analysis-completed'));
      
      // 목 데이터 설정 후에도 스크롤
      setTimeout(() => {
        const analysisResultsSection = document.querySelector('.gpt-analysis-section');
        if (analysisResultsSection) {
          analysisResultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 500);
    } finally {
      setIsAnalyzing(false);
    }
  }, [healthData, prescriptionData]);

  // 플로팅 버튼에서 AI 분석 시작 이벤트 리스너
  useEffect(() => {
    const handleStartAnalysis = () => {
      console.log('[ComprehensiveAnalysisPage] 플로팅 버튼에서 AI 분석 시작 요청');
      analyzeHealthData();
    };
    
    window.addEventListener('start-ai-analysis', handleStartAnalysis);
    
    return () => {
      window.removeEventListener('start-ai-analysis', handleStartAnalysis);
    };
  }, [analyzeHealthData]);
  
  // 헬퍼 함수들
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

  // 건강지표 상태 판단 함수
  const getHealthStatus = (metric: string, value: number, healthDataItem: any): { status: 'normal' | 'warning' | 'abnormal' | 'neutral', text: string, date: string } => {
    // 신장은 정상/비정상 구분 없이 중립
    if (metric === '신장') {
      return {
        status: 'neutral',
        text: '측정',
        date: healthDataItem?.checkup_date || ''
      };
    }

    // raw_data에서 상태 정보 추출
    const rawData = healthDataItem?.raw_data;
    if (!rawData) {
      return {
        status: 'normal',
        text: '정상',
        date: healthDataItem?.checkup_date || ''
      };
    }

    // Code 필드 기반 판단 (전체 검진 결과)
    const code = rawData.Code || '';
    let overallStatus: 'normal' | 'warning' | 'abnormal' = 'normal';
    
    if (code.includes('정상') || code === '정A') {
      overallStatus = 'normal';
    } else if (code.includes('의심') || code === '의심') {
      overallStatus = 'warning';
    } else if (code.includes('질환') || code.includes('이상')) {
      overallStatus = 'abnormal';
    }

    // 개별 항목 상태 확인 (Inspections에서 해당 지표 찾기)
    const fieldName = getFieldNameForMetric(metric);
    let itemStatus = overallStatus;
    
    if (rawData.Inspections && Array.isArray(rawData.Inspections)) {
      for (const inspection of rawData.Inspections) {
        if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
          for (const illness of inspection.Illnesses) {
            if (illness.Items && Array.isArray(illness.Items)) {
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
                if (metric === '총콜레스테롤') {
                  return itemName.includes('총콜레스테롤') || (itemName.includes('콜레스테롤') && !itemName.includes('hdl') && !itemName.includes('ldl'));
                }
                
                return itemName.includes(metricName) ||
                       (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                       (metric.includes('혈압') && itemName.includes('혈압')) ||
                       (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                       (metric === '중성지방' && itemName.includes('중성지방')) ||
                       (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
              });
              
              if (item && item.ItemReferences && Array.isArray(item.ItemReferences)) {
                // UnifiedHealthTimeline의 determineItemStatus 로직과 동일하게 적용
                const itemValue = parseFloat(item.Value);
                if (!isNaN(itemValue)) {
                  // 질환의심 범위 체크 (우선순위)
                  // 정상 범위 체크 (우선순위 1) - "정상", "정상(A)", "정상(B)" 모두 포함
                  const normal = item.ItemReferences.find((ref: any) => 
                    ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
                  );
                  if (normal && isInRange(itemValue, normal.Value)) {
                    itemStatus = 'normal';
                  } else {
                    // 질환의심 범위 체크 (우선순위 2)
                    const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
                    if (abnormal && isInRange(itemValue, abnormal.Value)) {
                      itemStatus = 'abnormal';
                    } else {
                      // 정상(B) 또는 경계 범위 체크 (우선순위 3)
                      const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
                      if (normalB && isInRange(itemValue, normalB.Value)) {
                        itemStatus = 'warning';
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

    const statusText = itemStatus === 'normal' ? '정상' : 
                      itemStatus === 'warning' ? '경계' : '이상';
    
    return {
      status: itemStatus,
      text: statusText,
      date: rawData.CheckUpDate || healthDataItem?.checkup_date || ''
    };
  };

  // 다중 건강 범위 추출 함수
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
                
                // 정상 범위 ("정상", "정상(A)", "정상(B)" 모두 포함)
                const normalRef = item.ItemReferences.find((ref: any) => 
                  ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
                );
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

  // 정상 범위 추출 함수 (기존 호환성 유지)
  const getNormalRanges = (metric: string, healthDataItem: any, gender: string = 'M'): { min: number; max: number } | null => {
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
                // 정상 범위 우선 사용 ("정상", "정상(A)", "정상(B)" 모두 포함)
                const normalRef = item.ItemReferences.find((ref: any) => 
                  ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
                );
                if (normalRef && normalRef.Value) {
                  return parseNormalRange(normalRef.Value, gender, metric);
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  };

  // 정상 범위 문자열 파싱 함수
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

  // 단순 범위 파싱 함수
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

  // 범위 체크 함수
  const isInRange = (value: number, rangeStr: string): boolean => {
    if (!rangeStr) return false;
    
    try {
      // "120-140" 형태
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
      return false;
    }
  };

  // 차트 데이터 검증 및 정리 함수
  const validateChartData = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return null;
    
    // LineChart 데이터 검증
    if (Array.isArray(data) && data.length > 0 && data[0].data) {
      return data.map(series => ({
        ...series,
        data: series.data.filter((point: any) => 
          point && 
          typeof point.value === 'number' &&
          !isNaN(point.value) && 
          isFinite(point.value) && 
          point.value > 0
        )
      })).filter(series => series.data && series.data.length > 0);
    }
    
    // BarChart 데이터 검증
    if (Array.isArray(data) && data.length > 0 && data[0].data) {
      return data.map(series => ({
        ...series,
        data: series.data.filter((point: any) => 
          point && 
          typeof point.value === 'number' &&
          !isNaN(point.value) && 
          isFinite(point.value) && 
          point.value > 0
        )
      })).filter(series => series.data && series.data.length > 0);
    }
    
    return [];
  }, []);

  // 차트 데이터 변환 및 검증
  const healthChartData = useMemo(() => {
    if (healthData.length === 0) {
      return [];
    }
    
    try {
      // 건강 지표는 이미 초기값으로 설정되어 있음 (중복 설정 방지)
      
      // 선택된 지표에 따라 데이터 변환
      const selectedMetric = healthMetrics[selectedHealthMetric] || '혈압 (수축기)';
      let fieldName = '';
      
      switch (selectedMetric) {
        case '신장': fieldName = 'height'; break;
        case '체중': fieldName = 'weight'; break;
        case 'BMI': fieldName = 'bmi'; break;
        case '허리둘레': fieldName = 'waist_circumference'; break;
        case '혈압 (수축기)': fieldName = 'blood_pressure_high'; break;
        case '혈압 (이완기)': fieldName = 'blood_pressure_low'; break;
        case '혈당': fieldName = 'blood_sugar'; break;
        case '총콜레스테롤': fieldName = 'cholesterol'; break;
        case 'HDL 콜레스테롤': fieldName = 'hdl_cholesterol'; break;
        case 'LDL 콜레스테롤': fieldName = 'ldl_cholesterol'; break;
        case '중성지방': fieldName = 'triglyceride'; break;
        case '헤모글로빈': fieldName = 'hemoglobin'; break;
        default: fieldName = 'blood_pressure_high';
      }
      
      const chartData = healthData.map((item: any) => ({
        name: selectedMetric,
        data: [{
          date: item.checkup_date || new Date().toISOString(),
          value: parseFloat((item as any)[fieldName]) || 0,
          label: `${item.year || '2024'}년 검진`,
          status: 'normal' as const
        }]
      })).filter(series => series.data[0].value > 0);
      
      const validatedData = validateChartData(chartData) || [];
      return validatedData;
    } catch (error) {
      console.error('[차트변환] 건강 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [healthData, validateChartData, selectedHealthMetric, healthMetrics]);

  const prescriptionChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    try {
      // DB 처방전 데이터를 년도별 약국 방문 건수로 집계 (약국만 필터링)
      const yearlyData: { [year: string]: number } = {};
      
      prescriptionData.forEach((item: any, index: number) => {
        // 약국 여부 판단 (UnifiedHealthTimeline 로직 사용)
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        // 약국 데이터 필터링 (디버깅 로그 제거)
        
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
      
      // 전역 변수로 저장 (디버깅용 - 필요시에만 사용)
      if (process.env.NODE_ENV === 'development') {
        (window as any).lastPharmacyYearlyData = yearlyData;
        (window as any).lastPrescriptionData = prescriptionData;
      }
      
      // 년도별 데이터를 차트 형식으로 변환 (최신 5년만)
      const chartData = [{
        name: '년도별 약국 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 10) // 최신 10년으로 확장하여 더 많은 데이터 확인
          .map(([year, count]) => {
            // 데이터 검증
            const finalValue = parseInt(count.toString());
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              console.warn('유효하지 않은 처방 데이터 제외:', { year, count });
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`, // 2025 → 25년
              status: 'normal' as const
            };
          })
          .filter(item => item !== null)
      }];
      
      const validatedData = validateChartData(chartData) || [];
      return validatedData;
    } catch (error) {
      console.error('[차트변환] 처방 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData, validateChartData]);

  // 병원 방문 추이 데이터 (처방전 데이터 기반, 병원만 필터링)
  const hospitalVisitChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
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
      
      // Set을 숫자로 변환 (고유한 방문 횟수)
      const yearlyVisitCounts: { [year: string]: number } = {};
      Object.entries(yearlyData).forEach(([year, visitSet]) => {
        yearlyVisitCounts[year] = visitSet.size;
      });
      
      // 전역 변수로 저장 (디버깅용 - 필요시에만 사용)
      if (process.env.NODE_ENV === 'development') {
        (window as any).lastHospitalYearlyData = yearlyVisitCounts;
      }
      
      // 년도별 데이터를 차트 형식으로 변환 (최신 10년으로 확장)
      const chartData = [{
        name: '년도별 병원 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyVisitCounts)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 10) // 최신 10년으로 확장하여 더 많은 데이터 확인
          .map(([year, count]) => {
            // 데이터 검증
            const finalValue = parseInt(count.toString());
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              console.warn('유효하지 않은 병원 방문 데이터 제외:', { year, count });
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`, // 2025 → 25년
              status: 'normal' as const
            };
          })
          .filter(item => item !== null)
      }];
      
      const validatedData = validateChartData(chartData) || [];
      return validatedData;
    } catch (error) {
      console.error('[차트변환] 병원 방문 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData, validateChartData]);

  // 데이터 로드
  useEffect(() => {
    loadHealthData();
  }, [location.search]);

  // 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
    if (!slider) return;

    const handleScroll = () => {
      const cards = document.querySelectorAll('.health-metric-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      // 패딩 계산 제거 - wrapper에서 패딩 처리하므로 슬라이더 전체 너비 사용
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
  }, [healthData]); // healthData가 변경될 때마다 이벤트 리스너 재설정

  // 의료기관 방문추이 닷 슬라이더 스크롤 동기화
  useEffect(() => {
    const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
    if (!slider) return;

    const handleVisitScroll = () => {
      const cards = document.querySelectorAll('.visit-trend-card');
      if (cards.length === 0) return;

      const sliderRect = slider.getBoundingClientRect();
      // 패딩 계산 제거 - wrapper에서 패딩 처리하므로 슬라이더 전체 너비 사용
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
  }, [prescriptionChartData, hospitalVisitChartData]); // 차트 데이터가 변경될 때마다 이벤트 리스너 재설정

    const loadHealthData = async () => {
      try {
      // URL 파라미터에서 uuid와 hospital 추출
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      
      if (!uuid || !hospital) {
        // URL 파라미터가 없으면 IndexedDB에서 시도
        console.log('[종합분석] URL 파라미터 없음, IndexedDB에서 데이터 검색');
        
        try {
          // 모든 건강 데이터 조회하여 가장 최근 것 사용
          const allHealthData = await WelnoIndexedDB.getAllHealthData();
          
          if (allHealthData.length > 0) {
            // 가장 최근 업데이트된 데이터 선택
            const latestData = allHealthData.sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0];
            
            console.log('[IndexedDB] 최신 데이터 로드:', {
              uuid: latestData.uuid,
              patientName: latestData.patientName,
              건강검진개수: latestData.healthData.length,
              처방전개수: latestData.prescriptionData.length,
              업데이트: latestData.updatedAt
            });
            
            setHealthData(latestData.healthData);
            setPrescriptionData(latestData.prescriptionData);
            setIsLoadingVisitData(false);
            return;
          }
        } catch (indexedDBError) {
          console.error('[IndexedDB] 데이터 로드 실패:', indexedDBError);
        }
        
        // IndexedDB 실패 시 localStorage 폴백
        const collectedDataStr = localStorage.getItem('tilko_collected_data');
        if (collectedDataStr) {
          const collectedData = JSON.parse(collectedDataStr);
          console.log('[폴백] localStorage에서 데이터 로드');
          
          if (collectedData.health_data?.ResultList) {
            setHealthData(collectedData.health_data.ResultList);
          }
          
          if (collectedData.prescription_data?.ResultList) {
            setPrescriptionData(collectedData.prescription_data.ResultList);
          }
          
          setIsLoadingVisitData(false);
        }
        return;
      }

      // UUID가 있으면 먼저 IndexedDB에서 확인
      console.log('[종합분석] IndexedDB에서 특정 환자 데이터 조회:', uuid);
      
      try {
        const indexedDBRecord = await WelnoIndexedDB.getHealthData(uuid);
        
        if (indexedDBRecord) {
          console.log('[IndexedDB] 환자 데이터 로드 성공:', {
            uuid: indexedDBRecord.uuid,
            patientName: indexedDBRecord.patientName,
            건강검진개수: indexedDBRecord.healthData.length,
            처방전개수: indexedDBRecord.prescriptionData.length,
            업데이트: indexedDBRecord.updatedAt
          });
          
          setHealthData(indexedDBRecord.healthData);
          setPrescriptionData(indexedDBRecord.prescriptionData);
          setIsLoadingVisitData(false);
          return;
        } else {
          console.log('[IndexedDB] 해당 환자 데이터 없음, API 호출 진행');
        }
      } catch (indexedDBError) {
        console.error('[IndexedDB] 특정 환자 데이터 조회 실패:', indexedDBError);
      }

      // 실제 API 호출로 데이터 가져오기
      const response = await fetch(WELNO_API.PATIENT_HEALTH_DATA(uuid, hospital));
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 실제 데이터 구조 파악을 위한 핵심 로그
      console.log('[데이터 구조] API 응답:', {
        success: result.success,
        healthDataSample: result.data?.health_data?.[0] || null,
        prescriptionDataSample: result.data?.prescription_data?.[0] || null,
        healthDataCount: result.data?.health_data?.length || 0,
        prescriptionDataCount: result.data?.prescription_data?.length || 0
      });
      
      // API 응답의 첫 번째 건강 데이터 상세 구조 로깅
      if (result.data?.health_data?.[0]) {
        const firstHealthData = result.data.health_data[0];
        console.log('[API 구조] 첫 번째 건강 데이터 상세:', {
          keys: Object.keys(firstHealthData),
          hasInspections: !!firstHealthData.Inspections,
          inspectionsCount: firstHealthData.Inspections?.length || 0,
          inspectionsSample: firstHealthData.Inspections?.[0] || null,
          rawDataKeys: firstHealthData.raw_data ? Object.keys(firstHealthData.raw_data) : null,
          sampleData: {
            Year: firstHealthData.Year,
            CheckUpDate: firstHealthData.CheckUpDate,
            cholesterol: firstHealthData.cholesterol,
            hdl_cholesterol: firstHealthData.hdl_cholesterol,
            ldl_cholesterol: firstHealthData.ldl_cholesterol,
            triglyceride: firstHealthData.triglyceride
          }
        });
      }
      
      if (result.success && result.data) {
        // API에서 오는 데이터는 직접 배열 형태 (ResultList 속성 없음)
        if (result.data.health_data && Array.isArray(result.data.health_data) && result.data.health_data.length > 0) {
          setHealthData(result.data.health_data);
        }
        
        if (result.data.prescription_data && Array.isArray(result.data.prescription_data) && result.data.prescription_data.length > 0) {
          setPrescriptionData(result.data.prescription_data);
        }
        
        // 로딩 완료
        setIsLoadingVisitData(false);
        
             // localStorage에 Tilko 형식으로 저장 (다른 페이지와 호환성 위해)
             // 용량 문제로 처방전 데이터는 요약만 저장
            // localStorage 저장 시 QuotaExceededError 방지를 위한 스마트 저장 로직
            const saveToLocalStorage = (healthData: any[], prescriptionData: any[]) => {
              const attempts = [
                { prescription: prescriptionData.slice(0, 50), label: '처방전 50개' },
                { prescription: prescriptionData.slice(0, 20), label: '처방전 20개' },
                { prescription: prescriptionData.slice(0, 10), label: '처방전 10개' },
                { prescription: prescriptionData.slice(0, 5), label: '처방전 5개' },
                { prescription: [], label: '건강검진만' }
              ];

              for (const attempt of attempts) {
                try {
                  const collectedData = {
                    health_data: {
                      ResultList: healthData
                    },
                    prescription_data: {
                      ResultList: attempt.prescription
                    }
                  };
                  
                  localStorage.setItem('tilko_collected_data', JSON.stringify(collectedData));
                  return true;
                } catch (error) {
                  continue;
                }
              }
              
              return false;
            };

            saveToLocalStorage(result.data.health_data || [], result.data.prescription_data || []);
      } else {
        console.error('[종합분석] API 응답 구조 오류:', { success: result.success, data: result.data });
        throw new Error('API 응답 데이터가 올바르지 않습니다.');
      }
        
      } catch (error) {
      console.error('[종합분석] 데이터 로드 실패:', error);
      setError(`건강 데이터를 불러오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      
      // API 실패 시 localStorage 폴백
      try {
        const collectedDataStr = localStorage.getItem('tilko_collected_data');
        if (collectedDataStr) {
          const collectedData = JSON.parse(collectedDataStr);
          
          if (collectedData.health_data?.ResultList) {
            setHealthData(collectedData.health_data.ResultList);
          }
          
          if (collectedData.prescription_data?.ResultList) {
            setPrescriptionData(collectedData.prescription_data.ResultList);
          }
          
          setError(null); // 폴백 성공 시 에러 클리어
        }
      } catch (fallbackError) {
        console.error('[종합분석] localStorage 폴백도 실패:', fallbackError);
      }
    }
  };


  // 목 데이터 (개발용)
  const getMockAnalysisResult = (): GPTAnalysisResult => ({
    summary: "전반적으로 건강 상태가 양호하나, 일부 지표에서 주의가 필요합니다. 정기적인 건강관리와 생활습관 개선을 통해 더 나은 건강 상태를 유지할 수 있습니다.",
    insights: [
      {
        category: "혈압",
        status: "good",
        message: "혈압 수치가 정상 범위 내에 있습니다.",
        recommendation: "현재 상태를 유지하기 위해 규칙적인 운동과 저염식을 지속하세요."
      },
      {
        category: "혈당",
        status: "warning",
        message: "공복혈당이 약간 높은 편입니다.",
        recommendation: "당분 섭취를 줄이고 식후 가벼운 운동을 권장합니다."
      },
      {
        category: "콜레스테롤",
        status: "danger",
        message: "총 콜레스테롤 수치가 높습니다.",
        recommendation: "포화지방 섭취를 줄이고 오메가-3가 풍부한 음식을 섭취하세요."
      }
    ],
    drugInteractions: [
      {
        drugs: ["아스피린", "와파린"],
        severity: "high",
        description: "출혈 위험이 증가할 수 있습니다.",
        recommendation: "의사와 상담하여 용량 조절이나 대체 약물을 고려하세요."
      }
    ],
    nutritionRecommendations: {
      avoid: [
        { name: "고나트륨 식품", reason: "혈압 상승 위험" },
        { name: "트랜스지방", reason: "콜레스테롤 수치 악화" },
        { name: "과도한 당분", reason: "혈당 조절 어려움" }
      ],
      recommend: [
        { name: "오메가-3 풍부한 생선", benefit: "콜레스테롤 개선" },
        { name: "식이섬유가 많은 채소", benefit: "혈당 안정화" },
        { name: "견과류", benefit: "심혈관 건강 개선" }
      ]
    }
  });

  return (
    <div className="health-data-viewer">
      <div className="question__content">
        {/* 뒤로가기 버튼 - results-trend와 완전히 동일한 구조 */}
        <div className="back-button-container">
          <button className="back-button" onClick={() => navigate(-1)}>
            ←
          </button>
        </div>

        {/* 타이틀 - results-trend와 동일한 marginTop */}
        <div className="question__title" style={{ marginTop: '10px' }}>
          <div className="title-content">
            <h1 className="question__title-text">AI 종합 건강 분석</h1>
            <p className="title-subtitle">AI 기반 건강 상태 분석 및 맞춤형 건강 관리 제안</p>
          </div>
        </div>

        <div className="comprehensive-analysis-content">
        {/* 건강 추이 차트 카드 */}
        <section className="analysis-card">
          <div className="card-header">
            <h2 className="section-title">건강 지표 추이</h2>
            <div className="chart-info">
              <span className="info-text">검진 항목별 추이</span>
            </div>
          </div>
          
          {/* 건강 지표 카드들 - 각 카드에 개별 그래프 포함 */}
          {healthMetrics.length > 0 && (
            <div className="health-metrics-wrapper">
              <div className="health-metrics-container">
                <div className="health-metrics-slider">
              {/* 12개 고정 슬롯으로 표시 (모든 건강지표 포함) */}
              {Array.from({ length: 12 }, (_, index) => {
                const metric = healthMetrics[index];
                
                // 빈 슬롯인 경우 파비콘 표시
                if (!metric) {
                  return (
                    <div 
                      key={`empty-${index}`}
                      className="health-metric-card empty-card"
                    >
                      <div className="empty-content">
                        <img 
                          src={WELNO_LOGO_IMAGE} 
                          alt="빈 슬롯" 
                          className="empty-icon"
                        />
                        <p className="empty-label">데이터 없음</p>
                      </div>
                    </div>
                  );
                }
                
                // 기존 로직 유지
                return (() => {
                const fieldName = getFieldNameForMetric(metric);
                
                // 해당 지표의 개별 차트 데이터 생성 (먼저 선언)
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
                      
                      // 디버깅 로그 제거 (필요시에만 활성화)
                      
                      if (value > 0 && !isNaN(value) && isFinite(value)) {
                        // 같은 년도에 여러 데이터가 있으면 최신 데이터 사용 (마지막 데이터)
                        yearlyData[year] = {
                          year,
                          value,
                          checkup_date: item.checkup_date,
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
                                             (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('waist'))) ||
                                             (metric.includes('혈압') && itemName.includes('혈압')) ||
                                             (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                             (metric === '중성지방' && itemName.includes('중성지방')) ||
                                             (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                                    });
                                    
                                  if (item && item.ItemReferences && Array.isArray(item.ItemReferences)) {
                                    const itemValue = parseFloat(item.Value);
                                    if (!isNaN(itemValue)) {
                                      // UnifiedHealthTimeline의 determineItemStatus 로직과 동일하게 적용
                                      // 질환의심 범위 체크 (우선순위)
                                      const abnormal = item.ItemReferences.find((ref: any) => ref.Name === '질환의심');
                                      if (abnormal && isInRange(itemValue, abnormal.Value)) {
                                        console.log(`[${metric}] 포인트 상태: abnormal (질환의심), 값: ${itemValue}, 범위: ${abnormal.Value}`);
                                        return 'abnormal' as const;
                                      }
                                      
                                      // 정상 범위 체크 (우선순위 1) - "정상", "정상(A)", "정상(B)" 모두 포함
                                      const normal = item.ItemReferences.find((ref: any) => 
                                        ref.Name === '정상' || ref.Name === '정상(A)' || ref.Name === '정상(B)'
                                      );
                                      if (normal && isInRange(itemValue, normal.Value)) {
                                        console.log(`[${metric}] 포인트 상태: normal (정상), 값: ${itemValue}, 범위: ${normal.Value}`);
                                        return 'normal' as const;
                                      }
                                      
                                      // 정상(B) 또는 경계 범위 체크 (우선순위 2)
                                      const normalB = item.ItemReferences.find((ref: any) => ref.Name === '정상(B)' || ref.Name === '정상(경계)');
                                      if (normalB && isInRange(itemValue, normalB.Value)) {
                                        console.log(`[${metric}] 포인트 상태: warning (정상B), 값: ${itemValue}, 범위: ${normalB.Value}`);
                                        return 'warning' as const;
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
                        const latestHealthData = getLatestHealthData();
                        if (latestHealthData) {
                          const healthRanges = getHealthRanges(metric, latestHealthData, 'M'); // 성별은 추후 환자 정보에서 가져올 수 있음
                          
                          if (healthRanges) {
                            // 이상 범위 체크 (우선순위)
                            if (healthRanges.abnormal && pointValue >= healthRanges.abnormal.min && pointValue <= healthRanges.abnormal.max) {
                              console.log(`[${metric}] 포인트 상태: abnormal (healthRanges), 값: ${pointValue}, 범위: ${healthRanges.abnormal.min}-${healthRanges.abnormal.max}`);
                              return 'abnormal' as const;
                            }
                            // 경계 범위 체크
                            if (healthRanges.borderline && pointValue >= healthRanges.borderline.min && pointValue <= healthRanges.borderline.max) {
                              console.log(`[${metric}] 포인트 상태: warning (healthRanges), 값: ${pointValue}, 범위: ${healthRanges.borderline.min}-${healthRanges.borderline.max}`);
                              return 'warning' as const;
                            }
                            // 정상 범위 체크
                            if (healthRanges.normal && pointValue >= healthRanges.normal.min && pointValue <= healthRanges.normal.max) {
                              console.log(`[${metric}] 포인트 상태: normal (healthRanges), 값: ${pointValue}, 범위: ${healthRanges.normal.min}-${healthRanges.normal.max}`);
                              return 'normal' as const;
                            }
                          }
                        }
                        
                        // 3순위: 기본값 (상태를 알 수 없을 때)
                        console.warn(`[${metric}] 포인트 상태 계산 실패, 기본값 normal 반환, 값: ${pointValue}`);
                        return 'normal' as const;
                      })();

                      return {
                        date: dateString,
                        value: finalValue,
                        label: `${data.year.slice(-2)}년`, // 00년 형식으로 변경
                        status: pointStatus
                      };
                    }).filter((item): item is NonNullable<typeof item> => item !== null); // null 값 제거
                  })()
                }] : [];
                
                // 최신 건강 데이터 올바른 추출 (날짜 기준 정렬)
                const getLatestHealthData = () => {
                  if (!healthData || healthData.length === 0) return null;
                  
                  // 날짜 기준으로 정렬하여 최신 데이터 찾기
                  const sortedData = [...healthData].sort((a, b) => {
                    const dateA = new Date(a.CheckUpDate || a.Year || '1900-01-01');
                    const dateB = new Date(b.CheckUpDate || b.Year || '1900-01-01');
                    return dateB.getTime() - dateA.getTime(); // 내림차순 (최신 먼저)
                  });
                  
                  console.log(`[${metric}] 건강 데이터 정렬 결과:`, {
                    metric,
                    totalCount: healthData.length,
                    latestDate: sortedData[0]?.CheckUpDate || sortedData[0]?.Year,
                    source: 'healthData'
                  });
                  
                  return sortedData[0]; // 가장 최신 데이터
                };

                // 건강지표 값 직접 추출 (raw_data 우선)
                const getValueFromHealthData = (healthDataItem: any, metric: string): number => {
                  if (!healthDataItem) return 0;
                  
                  // raw_data에서 직접 추출 시도
                  if (healthDataItem.raw_data?.Inspections) {
                    for (const inspection of healthDataItem.raw_data.Inspections) {
                      if (inspection.Illnesses) {
                        for (const illness of inspection.Illnesses) {
                          if (illness.Items) {
                            const item = illness.Items.find((item: any) => {
                              if (!item.Name) return false;
                              const itemName = item.Name.toLowerCase();
                              const metricName = metric.toLowerCase().replace(' (수축기)', '').replace(' (이완기)', '');
                              
                              return itemName.includes(metricName) ||
                                     (metric.includes('혈압') && itemName.includes('혈압')) ||
                                     (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                                     (metric === '중성지방' && itemName.includes('중성지방')) ||
                                     (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈')));
                            });
                            
                            if (item && item.Value) {
                              const value = parseFloat(item.Value);
                              console.log(`[${metric}] raw_data에서 값 추출:`, {
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
                  
                  // 폴백: 기존 필드에서 추출
                  const fieldName = getFieldNameForMetric(metric);
                  const value = parseFloat(healthDataItem[fieldName]) || 0;
                  console.log(`[${metric}] 폴백으로 값 추출:`, {
                    metric,
                    fieldName,
                    value,
                    source: 'fallback'
                  });
                  return value;
                };

                const latestHealthData = getLatestHealthData();
                const latestValue = latestHealthData ? 
                  getValueFromHealthData(latestHealthData, metric) : 0;

                // 상태 판단 (최신 데이터 기준)
                const healthStatus = latestHealthData ? 
                  getHealthStatus(metric, latestValue, latestHealthData) : 
                  { status: 'normal' as const, text: '정상', date: '' };
                
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
                        
                        if (dataCount === 0) {
                          return (
                            <div className="no-data">
                              <p>데이터 없음</p>
                            </div>
                          );
                        } else if (dataCount === 1) {
                          return (
                            <div className="single-data">
                              <div className="single-point">
                                <div className="point-dot"></div>
                                <div className="point-value">
                                  {metricChartData[0]?.data[0]?.value?.toFixed(1) || '-'}
                                </div>
                              </div>
                              <p className="single-data-label">단일 데이터</p>
                            </div>
                          );
                        } else {
                          // 2개 이상 데이터가 있을 때만 LineChart 사용
                          // 추가 검증: 모든 데이터 포인트가 유효한 값인지 확인
                          const validData = metricChartData[0]?.data?.filter(point => 
                            point && 
                            point.value > 0 && 
                            !isNaN(point.value) && 
                            isFinite(point.value) &&
                            point.date && 
                            !isNaN(new Date(point.date).getTime())
                          ) || [];
                          
                          if (validData.length < 2) {
                            // 단일 데이터에서도 건강 범위 표시
                            const healthRanges = getHealthRanges(metric, healthData[0], 'M');
                            
                            return (
                              <div className="single-data-with-ranges">
                                {/* 건강 범위 배경 */}
                                {healthRanges && (
                                  <div className="health-ranges-background">
                                    {healthRanges.normal && (
                                      <div 
                                        className="range-zone normal-zone"
                                        style={{
                                          backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                          position: 'absolute',
                                          left: 0,
                                          right: 0,
                                          height: '100%',
                                          zIndex: 1
                                        }}
                                      >
                                        <span className="range-label">정상</span>
                                      </div>
                                    )}
                                    {healthRanges.borderline && (
                                      <div 
                                        className="range-zone borderline-zone"
                                        style={{
                                          backgroundColor: 'rgba(251, 146, 60, 0.15)',
                                          position: 'absolute',
                                          left: 0,
                                          right: 0,
                                          height: '100%',
                                          zIndex: 1
                                        }}
                                      >
                                        <span className="range-label">경계</span>
                                      </div>
                                    )}
                                    {healthRanges.abnormal && (
                                      <div 
                                        className="range-zone abnormal-zone"
                                        style={{
                                          backgroundColor: 'rgba(220, 38, 127, 0.12)',
                                          position: 'absolute',
                                          left: 0,
                                          right: 0,
                                          height: '100%',
                                          zIndex: 1
                                        }}
                                      >
                                        <span className="range-label">이상</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* 단일 데이터 포인트 */}
                                <div className="single-point" style={{ position: 'relative', zIndex: 2 }}>
                                  <div className="point-dot"></div>
                                  <div className="point-value">
                                    {validData.length > 0 ? validData[0]?.value?.toFixed(1) || '-' : '-'}
                                  </div>
                                </div>
                                <p className="single-data-label">단일 데이터</p>
                              </div>
                            );
                          }
                          
                          // 차트 데이터 검증 완료
                          
                          // 다중 건강 범위 추출 (최신 데이터 기준)
                          const healthRanges = getHealthRanges(metric, healthData[0], 'M'); // 성별은 추후 환자 정보에서 가져올 수 있음
                          
                          // 모든 건강지표 파싱 상태 확인
                          console.log(`[${metric}] 건강범위 파싱 결과:`, {
                            metric,
                            healthRanges,
                            hasAllRanges: !!(healthRanges?.normal && healthRanges?.borderline && healthRanges?.abnormal),
                            missingRanges: {
                              normal: !healthRanges?.normal,
                              borderline: !healthRanges?.borderline, 
                              abnormal: !healthRanges?.abnormal
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
                })();
              })}
              </div>
              
              {/* 닷 인디케이터 - 12개 고정 */}
              <div className="slider-dots">
                {Array.from({ length: 12 }, (_, index) => (
                    <div 
                      key={index}
                      className={`dot ${index === activeDotIndex ? 'active' : ''}`}
                      onClick={() => {
                        setActiveDotIndex(index); // 즉시 활성 상태 업데이트
                        const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
                        const card = document.querySelectorAll('.health-metric-card')[index] as HTMLElement;
                        if (slider && card) {
                          // 패딩을 고려한 정확한 스크롤 위치 계산
                          // 단순화된 스크롤 계산 - wrapper에서 패딩 처리하므로 복잡한 계산 불필요
                          const cardOffsetLeft = card.offsetLeft;
                          const sliderClientWidth = slider.clientWidth;
                          const cardWidth = card.offsetWidth;
                          
                          // 카드가 중앙에 오도록 스크롤 위치 계산
                          let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                          
                          // 스크롤 위치 제한
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
          )}
        </section>

        {/* 방문 추이 분석 카드 */}
        <section className="analysis-card">
          <div className="card-header">
            <h2 className="section-title">의료기관 방문 추이</h2>
            <div className="chart-info">
              <span className="info-text">약국 및 병원 방문 건수</span>
            </div>
          </div>
          
          {/* 방문 추이 컨테이너 - 건강지표와 동일한 구조 */}
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
                        src={WELNO_LOGO_IMAGE} 
                        alt="로딩 중" 
                        className="welno-icon-blink"
                      />
                    </div>
                    <p className="loading-text">처방 데이터 분석 중...</p>
                  </div>
                ) : prescriptionChartData.length > 0 && prescriptionChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={prescriptionChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 250) : 280}
                    height={170} // 건강지표와 동일한 높이 (250px → 170px)
                  />
                ) : (
                  <div className="chart-loading">
                    <div className="loading-spinner">
                      <img 
                        src={WELNO_LOGO_IMAGE} 
                        alt="데이터 없음" 
                        className="welno-icon-blink"
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
                        src={WELNO_LOGO_IMAGE} 
                        alt="로딩 중" 
                        className="welno-icon-blink"
                      />
                    </div>
                    <p className="loading-text">병원 방문 데이터 분석 중...</p>
                  </div>
                ) : hospitalVisitChartData.length > 0 && hospitalVisitChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={hospitalVisitChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 250) : 280}
                    height={170} // 건강지표와 동일한 높이 (250px → 170px)
                    showValues={true}
                  />
                ) : (
                  <div className="chart-loading">
                    <div className="loading-spinner">
                      <img 
                        src={WELNO_LOGO_IMAGE} 
                        alt="데이터 없음" 
                        className="welno-icon-blink"
                        style={{ opacity: 0.5, animation: 'none' }}
                      />
                    </div>
                    <p className="loading-text">병원 방문 데이터가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
            </div>
            
            {/* 닷 인디케이터 - 건강지표와 동일한 구조 */}
            <div className="visit-trends-dots">
              <div className="dot active" onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  slider.scrollTo({ left: 0, behavior: 'smooth' });
                }
              }}></div>
              <div className="dot" onClick={() => {
                const slider = document.querySelector('.visit-trends-slider') as HTMLElement;
                if (slider) {
                  const card = document.querySelectorAll('.visit-trend-card')[1] as HTMLElement;
                  if (card) {
                    // 단순화된 스크롤 계산 - wrapper에서 패딩 처리하므로 복잡한 계산 불필요
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

        {/* AI 분석 리포트 카드 - gptAnalysis가 있을 때만 표시 */}
        {gptAnalysis && (
        <section className="analysis-card gpt-analysis-section">
          <div className="card-header">
            <h2 className="section-title">AI 건강 분석 리포트</h2>
            <div className="analysis-badge">
              <span className="badge-text">GPT-4 분석</span>
        </div>
      </div>

          {gptAnalysis ? (
            <div className="analysis-results">
              {/* 종합 소견 */}
              <div className="summary-section">
                <h3 className="subsection-title">종합 소견</h3>
                <div className="summary-content">
                  <p className="summary-text">{gptAnalysis.summary}</p>
                </div>
        </div>
              
              {/* 주요 건강 지표 */}
              <div className="insights-section">
                <h3 className="subsection-title">주요 건강 지표 분석</h3>
        <div className="insights-grid">
                  {gptAnalysis.insights.map((insight, index) => (
                    <div key={index} className={`insight-item ${insight.status}`}>
                      <div className="insight-header">
                        <h4 className="insight-category">{insight.category}</h4>
                        <span className={`status-indicator ${insight.status}`}>
                          {insight.status === 'good' ? '정상' : 
                           insight.status === 'warning' ? '주의' : '위험'}
                        </span>
                      </div>
                      <p className="insight-message">{insight.message}</p>
                      {insight.recommendation && (
                        <div className="insight-recommendation">
                          <strong>권장사항:</strong> {insight.recommendation}
                        </div>
                      )}
            </div>
          ))}
        </div>
      </div>
          </div>
          ) : (
            <div className="analysis-loading">
              <div className="loading-content">
                <div className="loading-spinner">
                  <img 
                    src={WELNO_LOGO_IMAGE}
                    alt="분석 중" 
                    className="welno-icon-blink"
            />
          </div>
                <p className="loading-text">AI가 건강 데이터를 분석하고 있습니다...</p>
                
                {/* 분석 진행률 표시 */}
                {isAnalyzing && (
                  <div className="analysis-progress">
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${analysisProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">{analysisStep} ({analysisProgress}%)</p>
        </div>
      )}

                <button 
                  onClick={analyzeHealthData} 
                  disabled={isAnalyzing}
                  className={`analyze-button ${isAnalyzing ? 'loading' : ''}`}
                >
                  {isAnalyzing ? (
                    <>
                      <img 
                        src={WELNO_LOGO_IMAGE} 
                        alt="분석 중" 
                        className="button-spinner"
                      />
                      분석 중...
                    </>
                  ) : (
                    'AI 분석 시작'
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
        )}

        {/* 약물 상호작용 분석 카드 - gptAnalysis가 있을 때만 표시 */}
        {gptAnalysis && (
        <section className="analysis-card">
          <div className="card-header">
            <h2 className="section-title">약물 상호작용 분석</h2>
            <div className="chart-info">
              <span className="info-text">안전성 검토</span>
          </div>
        </div>
          
          <div className="analysis-results">
            {gptAnalysis?.drugInteractions && gptAnalysis.drugInteractions.length > 0 ? (
              <div className="interactions-list">
                {gptAnalysis.drugInteractions.map((interaction, index) => (
                  <div key={index} className={`interaction-item ${interaction.severity}`}>
                    <div className="interaction-header">
                      <h4 className="drug-combination">{interaction.drugs.join(' + ')}</h4>
                      <span className={`severity-badge ${interaction.severity}`}>
                        {interaction.severity === 'high' ? '고위험' : 
                         interaction.severity === 'medium' ? '중위험' : '저위험'}
                </span>
              </div>
                    <div className="interaction-details">
                      <p className="interaction-description">{interaction.description}</p>
                      <div className="interaction-recommendation">
                        <strong>권장사항:</strong> {interaction.recommendation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-interactions">
                <div className="safe-icon">
                  <img 
                    src="/welno/welno_logo.png" 
                    alt="안전" 
                    className="status-icon"
                  />
                </div>
                <p className="safe-message">현재 복용 중인 약물 간 심각한 상호작용은 발견되지 않았습니다.</p>
              </div>
            )}
          </div>
        </section>
        )}

        {/* 영양 권장사항 카드 */}
        {gptAnalysis?.nutritionRecommendations && (
          <section className="analysis-card">
            <div className="card-header">
              <h2 className="section-title">맞춤 영양 권장사항</h2>
              <div className="chart-info">
                <span className="info-text">개인 맞춤</span>
              </div>
            </div>
            
            <div className="analysis-results">
              <div className="nutrition-grid">
                {/* 피해야 할 음식 */}
                <div className="nutrition-section avoid-section">
                  <div className="section-header">
                    <h3 className="nutrition-title">피해야 할 음식</h3>
                    <div className="warning-icon">
                      <img 
                        src={WELNO_LOGO_IMAGE} 
                        alt="주의" 
                        className="status-icon warning"
                      />
                    </div>
                  </div>
                  <div className="nutrition-list">
                    {gptAnalysis.nutritionRecommendations.avoid.map((food, index) => (
                      <div key={index} className="nutrition-item avoid-item">
                        <h4 className="food-name">{food.name}</h4>
                        <p className="food-reason">{food.reason}</p>
            </div>
          ))}
        </div>
      </div>

                {/* 권장 음식 */}
                <div className="nutrition-section recommend-section">
          <div className="section-header">
                    <h3 className="nutrition-title">권장 음식</h3>
                    <div className="recommend-icon">
                      <img 
                        src={WELNO_LOGO_IMAGE} 
                        alt="권장" 
                        className="status-icon recommend"
                      />
                    </div>
                  </div>
                  <div className="nutrition-list">
                    {gptAnalysis.nutritionRecommendations.recommend.map((food, index) => (
                      <div key={index} className="nutrition-item recommend-item">
                        <h4 className="food-name">{food.name}</h4>
                        <p className="food-benefit">{food.benefit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 데이터 출처 및 면책 조항 - 간단한 회색 박스 */}
        {gptAnalysis && (
          <div className="disclaimer-box">
            <div className="disclaimer-content">
              <h3 className="disclaimer-title">데이터 출처 및 면책 조항</h3>
              <div className="disclaimer-text">
                <p>• 본 분석은 제공된 건강검진 결과와 처방전 데이터를 기반으로 합니다.</p>
                <p>• AI 분석 결과는 참고용이며, 의학적 진단이나 치료를 대체할 수 없습니다.</p>
                <p>• 건강상 문제가 있으시면 반드시 의료진과 상담하시기 바랍니다.</p>
                <p>• 약물 복용 전 의사나 약사와 상의하시기 바랍니다.</p>
              </div>
              <div className="data-source">
                <p><strong>데이터 출처:</strong> 건강보험공단 건강검진 결과, 의료기관 처방전 | <strong>분석 엔진:</strong> OpenAI GPT-4</p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysisPage;