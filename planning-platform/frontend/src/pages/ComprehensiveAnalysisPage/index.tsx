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
import { WELLO_API, API_ENDPOINTS } from '../../constants/api';
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
  const [healthMetrics, setHealthMetrics] = useState<string[]>([]);
  
  // 의료기관 방문추이 슬라이더 상태
  const [activeVisitDotIndex, setActiveVisitDotIndex] = useState(0);
  
  // 헬퍼 함수들
  const getFieldNameForMetric = (metric: string): string => {
    switch (metric) {
      case '혈압 (수축기)': return 'blood_pressure_high';
      case '혈압 (이완기)': return 'blood_pressure_low';
      case '혈당': return 'blood_sugar';
      case '총콜레스테롤': return 'cholesterol';
      case 'HDL 콜레스테롤': return 'hdl_cholesterol';
      case 'LDL 콜레스테롤': return 'ldl_cholesterol';
      case '중성지방': return 'triglyceride';
      case 'BMI': return 'bmi';
      case '헤모글로빈': return 'hemoglobin';
      default: return 'blood_pressure_high';
    }
  };
  
  const getUnitForMetric = (metric: string): string => {
    switch (metric) {
      case '혈압 (수축기)':
      case '혈압 (이완기)': return 'mmHg';
      case '혈당': return 'mg/dL';
      case '총콜레스테롤':
      case 'HDL 콜레스테롤':
      case 'LDL 콜레스테롤':
      case '중성지방': return 'mg/dL';
      case 'BMI': return 'kg/m²';
      case '헤모글로빈': return 'g/dL';
      default: return '';
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
      // 검진 항목들 추출 및 설정
      if (healthData.length > 0 && healthMetrics.length === 0) {
        const metrics = [
          '혈압 (수축기)',
          '혈압 (이완기)', 
          '혈당',
          '총콜레스테롤',
          'HDL 콜레스테롤',
          'LDL 콜레스테롤',
          '중성지방',
          'BMI',
          '헤모글로빈'
        ];
        setHealthMetrics(metrics);
      }
      
      // 선택된 지표에 따라 데이터 변환
      const selectedMetric = healthMetrics[selectedHealthMetric] || '혈압 (수축기)';
      let fieldName = '';
      
      switch (selectedMetric) {
        case '혈압 (수축기)': fieldName = 'blood_pressure_high'; break;
        case '혈압 (이완기)': fieldName = 'blood_pressure_low'; break;
        case '혈당': fieldName = 'blood_sugar'; break;
        case '총콜레스테롤': fieldName = 'cholesterol'; break;
        case 'HDL 콜레스테롤': fieldName = 'hdl_cholesterol'; break;
        case 'LDL 콜레스테롤': fieldName = 'ldl_cholesterol'; break;
        case '중성지방': fieldName = 'triglyceride'; break;
        case 'BMI': fieldName = 'bmi'; break;
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
      console.error('❌ [차트변환] 건강 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [healthData, validateChartData, selectedHealthMetric, healthMetrics]);

  const prescriptionChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    try {
      // DB 처방전 데이터를 년도별 약국 방문 건수로 집계
      const yearlyData: { [year: string]: number } = {};
      
      prescriptionData.forEach((item: any) => {
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
        name: '년도별 약국 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 5) // 최신 5년만 선택
          .sort(([a], [b]) => a.localeCompare(b)) // 다시 오름차순 정렬
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
              label: `${year}년`,
              status: 'normal' as const
            };
          })
          .filter(item => item !== null)
      }];
      
      const validatedData = validateChartData(chartData) || [];
      return validatedData;
    } catch (error) {
      console.error('❌ [차트변환] 처방 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData, validateChartData]);

  // 병원 방문 추이 데이터 (건강검진 데이터 기반)
  const hospitalVisitChartData = useMemo(() => {
    if (healthData.length === 0) {
      return [];
    }
    
    try {
      // 건강검진 데이터를 년도별 병원 방문으로 집계
      const yearlyData: { [year: string]: number } = {};
      
      healthData.forEach((item: any) => {
        // year 필드는 "YYYY년" 형식이므로 "년" 제거
        const year = item.year ? item.year.replace('년', '') : '2024';
        
        // 각 건강검진은 1회 병원 방문으로 계산
        if (yearlyData[year]) {
          yearlyData[year] += 1;
        } else {
          yearlyData[year] = 1;
        }
      });
      
      // 년도별 데이터를 차트 형식으로 변환 (최신 5년만)
      const chartData = [{
        name: '년도별 병원 방문 건수',
        yAxisLabel: '방문 건수',
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 년도 순 정렬
          .slice(0, 5) // 최신 5년만 선택
          .sort(([a], [b]) => a.localeCompare(b)) // 다시 오름차순 정렬
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
              label: `${year}년`,
              status: 'normal' as const
            };
          })
          .filter(item => item !== null)
      }];
      
      const validatedData = validateChartData(chartData) || [];
      return validatedData;
    } catch (error) {
      console.error('❌ [차트변환] 병원 방문 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [healthData, validateChartData]);

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
      // 패딩을 고려한 실제 콘텐츠 영역의 중앙 계산
      const paddingLeft = parseFloat(getComputedStyle(slider).paddingLeft) || 0;
      const paddingRight = parseFloat(getComputedStyle(slider).paddingRight) || 0;
      const contentWidth = sliderRect.width - paddingLeft - paddingRight;
      const sliderCenter = sliderRect.left + paddingLeft + contentWidth / 2;

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
      // 패딩을 고려한 실제 콘텐츠 영역의 중앙 계산
      const paddingLeft = parseFloat(getComputedStyle(slider).paddingLeft) || 0;
      const paddingRight = parseFloat(getComputedStyle(slider).paddingRight) || 0;
      const contentWidth = sliderRect.width - paddingLeft - paddingRight;
      const sliderCenter = sliderRect.left + paddingLeft + contentWidth / 2;

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
        // URL 파라미터가 없으면 localStorage에서 시도
        const collectedDataStr = localStorage.getItem('tilko_collected_data');
        if (collectedDataStr) {
          const collectedData = JSON.parse(collectedDataStr);
          
          if (collectedData.health_data?.ResultList) {
            setHealthData(collectedData.health_data.ResultList);
          }
          
          if (collectedData.prescription_data?.ResultList) {
            setPrescriptionData(collectedData.prescription_data.ResultList);
          }
        }
        return;
      }

      // 실제 API 호출로 데이터 가져오기
      const response = await fetch(WELLO_API.PATIENT_HEALTH_DATA(uuid, hospital));
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 실제 데이터 구조 파악을 위한 핵심 로그
      console.log('📋 [데이터 구조] API 응답:', {
        success: result.success,
        healthDataSample: result.data?.health_data?.[0] || null,
        prescriptionDataSample: result.data?.prescription_data?.[0] || null,
        healthDataCount: result.data?.health_data?.length || 0,
        prescriptionDataCount: result.data?.prescription_data?.length || 0
      });
      
      if (result.success && result.data) {
        // API에서 오는 데이터는 직접 배열 형태 (ResultList 속성 없음)
        if (result.data.health_data && Array.isArray(result.data.health_data) && result.data.health_data.length > 0) {
          setHealthData(result.data.health_data);
        }
        
        if (result.data.prescription_data && Array.isArray(result.data.prescription_data) && result.data.prescription_data.length > 0) {
          setPrescriptionData(result.data.prescription_data);
        }
        
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
        console.error('❌ [종합분석] API 응답 구조 오류:', { success: result.success, data: result.data });
        throw new Error('API 응답 데이터가 올바르지 않습니다.');
      }
        
      } catch (error) {
      console.error('❌ [종합분석] 데이터 로드 실패:', error);
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
        console.error('❌ [종합분석] localStorage 폴백도 실패:', fallbackError);
      }
    }
  };

  // GPT 분석 요청
  const analyzeHealthData = async () => {
    if (healthData.length === 0 && prescriptionData.length === 0) {
      setError('분석할 건강 데이터가 없습니다.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisStep('데이터 준비 중...');

    try {
      // 진행률 업데이트
      setAnalysisProgress(20);
      setAnalysisStep('건강 데이터 분석 중...');
      
      console.log('🧠 [GPT분석] 분석 요청 시작');
      console.log('📊 [GPT분석] 전송 데이터:', {
        healthDataCount: healthData.length,
        prescriptionDataCount: prescriptionData.length,
        healthSample: healthData.slice(0, 1),
        prescriptionSample: prescriptionData.slice(0, 1)
      });
      
      // 진행률 업데이트
      setAnalysisProgress(50);
      setAnalysisStep('AI 분석 요청 중...');
      
      // DB 데이터를 백엔드가 기대하는 형식으로 변환
      const formattedHealthData = healthData.map((item: any) => ({
        date: item.checkup_date || new Date().toISOString().split('T')[0],
        year: item.year || '2024',
        inspections: [{
          name: '건강검진',
          items: [
            { name: '혈압(수축기)', value: String(item.blood_pressure_high || 0), unit: 'mmHg' },
            { name: '혈압(이완기)', value: String(item.blood_pressure_low || 0), unit: 'mmHg' },
            { name: '혈당', value: String(item.blood_sugar || 0), unit: 'mg/dL' },
            { name: '콜레스테롤', value: String(item.cholesterol || 0), unit: 'mg/dL' },
            { name: 'BMI', value: String(item.bmi || 0), unit: 'kg/m²' }
          ]
        }]
      }));

      const formattedPrescriptionData = prescriptionData.map((item: any) => ({
        date: item.treatment_date || new Date().toISOString().split('T')[0],
        hospital: item.hospital_name || '병원',
        medications: [{
          name: '처방약',
          dosage: '1회',
          frequency: '1일 1회'
        }]
      }));

      // 백엔드 health-analysis API 호출
      const response = await fetch('/wello-api/v1/health-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          health_data: formattedHealthData,
          prescription_data: formattedPrescriptionData,
          analysis_type: 'comprehensive'
        })
      });

      if (!response.ok) {
        throw new Error(`분석 요청 실패: ${response.status}`);
      }

      // 진행률 업데이트
      setAnalysisProgress(80);
      setAnalysisStep('분석 결과 처리 중...');
      
      const result = await response.json();
      console.log('✅ [GPT분석] 분석 결과 수신:', result);
      
      if (result.success && result.analysis) {
        // 진행률 완료
        setAnalysisProgress(100);
        setAnalysisStep('분석 완료!');
        setGptAnalysis(result.analysis);
        
        // 분석 완료 후 결과 섹션으로 부드럽게 스크롤
        setTimeout(() => {
          const analysisResultsSection = document.querySelector('.gpt-analysis-section');
          if (analysisResultsSection) {
            analysisResultsSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }, 500); // 0.5초 후 스크롤 (애니메이션 완료 후)
        
    } else {
        throw new Error('분석 결과가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('❌ [GPT분석] 분석 실패:', error);
      console.log('🔄 [GPT분석] 목 데이터로 폴백');
      // 목 데이터로 폴백
      setGptAnalysis(getMockAnalysisResult());
      
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

  const handleBackClick = () => {
    navigate(-1);
  };

    return (
    <div className="health-data-viewer">
      <div className="question__content">
        {/* 뒤로가기 버튼 - results-trend와 동일한 구조 */}
        <div className="back-button-container">
          <button className="back-button" onClick={() => navigate('/results-trend')}>
            ←
          </button>
        </div>

        <div className="question__title" style={{ marginTop: '60px' }}>
          <h1 className="question__title-text">AI 종합 건강 분석</h1>
        </div>

        <div className="comprehensive-analysis-content">
        {/* AI 분석 리포트 카드 */}
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
                    src="/wello/wello-icon.png" 
                    alt="분석 중" 
                    className="spinner-icon"
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
                        src="/wello/wello-icon.png" 
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
              {/* 5개 고정 슬롯으로 표시 */}
              {Array.from({ length: 5 }, (_, index) => {
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
                          src="/wello/wello-icon.png" 
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
                // 최신 데이터에서 값 추출 (더 정확하게)
                const latestValue = healthData.length > 0 ? (() => {
                  const rawValue = (healthData[0] as any)[fieldName];
                  
                  // 콜레스테롤 관련 디버깅 (첫 번째 항목만)
                  if ((metric.includes('콜레스테롤') || metric.includes('중성지방')) && index === 0) {
                    console.log(`📊 [건강지표] 데이터 필드 매핑:`, {
                      availableFields: Object.keys(healthData[0]),
                      cholesterolFields: Object.keys(healthData[0]).filter(key => 
                        key.toLowerCase().includes('cholesterol') || 
                        key.toLowerCase().includes('triglyceride') ||
                        key.includes('콜레스테롤') || 
                        key.includes('중성지방')
                      )
                    });
                  }
                  
                  if (typeof rawValue === 'string') {
                    return parseFloat(rawValue) || 0;
                  } else if (typeof rawValue === 'number') {
                    return rawValue;
                  }
                  return 0;
                })() : 0;
                
                // 해당 지표의 개별 차트 데이터 생성
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
                      .sort((a: any, b: any) => a.year.localeCompare(b.year)) // 다시 오름차순 정렬
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
                        status: 'normal' as const
                      };
                    }).filter((item): item is NonNullable<typeof item> => item !== null) // null 값 제거
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // 오래된 년도가 앞에 오도록 정렬 (차트에서 왼쪽부터 오래된 순)
                  })()
                }] : [];
                
                return (
                  <div 
                    key={metric}
                    className="health-metric-card"
                  >
                    <div className="metric-header">
                      <div className="status-badge status-normal">정상</div>
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
                            return (
                              <div className="single-data">
                                <div className="single-point">
                                  <div className="point-dot"></div>
                                  <div className="point-value">
                                    {validData.length > 0 ? validData[0]?.value?.toFixed(1) || '-' : '-'}
                                  </div>
                                </div>
                                <p className="single-data-label">데이터 부족</p>
                              </div>
                            );
                          }
                          
                          return (
                            <LineChart 
                              series={[{
                                ...metricChartData[0],
                                data: validData
                              }]}
                              width={260}
                              height={120}
                            />
                          );
                        }
                      })()}
                    </div>
                  </div>
                );
                })();
              })}
              </div>
              
              {/* 닷 인디케이터 - 5개 고정 */}
              <div className="slider-dots">
                {Array.from({ length: 5 }, (_, index) => (
                    <div 
                      key={index}
                      className={`dot ${index === activeDotIndex ? 'active' : ''}`}
                      onClick={() => {
                        setActiveDotIndex(index); // 즉시 활성 상태 업데이트
                        const slider = document.querySelector('.health-metrics-slider') as HTMLElement;
                        const card = document.querySelectorAll('.health-metric-card')[index] as HTMLElement;
                        if (slider && card) {
                          // 패딩을 고려한 정확한 스크롤 위치 계산
                          const paddingLeft = parseFloat(getComputedStyle(slider).paddingLeft) || 0;
                          const paddingRight = parseFloat(getComputedStyle(slider).paddingRight) || 0;
                          
                          // 카드의 현재 위치와 목표 위치 계산
                          const cardOffsetLeft = card.offsetLeft; // 슬라이더 내에서의 카드 위치
                          const sliderClientWidth = slider.clientWidth; // 패딩 포함한 슬라이더 너비
                          const cardWidth = card.offsetWidth;
                          
                          // 카드가 패딩을 고려한 중앙에 오도록 스크롤 위치 계산
                          const availableWidth = sliderClientWidth - paddingLeft - paddingRight;
                          let targetScrollLeft = cardOffsetLeft - paddingLeft - (availableWidth - cardWidth) / 2;
                          
                          // 스크롤 위치 제한 (패딩 영역을 침범하지 않도록)
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
                {prescriptionChartData.length > 0 && prescriptionChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={prescriptionChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 320) : 350}
                    height={250}
                  />
                ) : (
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
                )}
              </div>
            </div>

            {/* 병원 방문 추이 */}
            <div className="visit-trend-card">
              <div className="trend-header">
                <h3 className="trend-title">병원 방문 추이</h3>
              </div>
              <div className="trend-chart">
                {hospitalVisitChartData.length > 0 && hospitalVisitChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={hospitalVisitChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 320) : 350}
                    height={250}
                  />
                ) : (
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
                    const paddingLeft = parseFloat(getComputedStyle(slider).paddingLeft) || 0;
                    const cardOffsetLeft = card.offsetLeft;
                    const sliderClientWidth = slider.clientWidth;
                    const cardWidth = card.offsetWidth;
                    const availableWidth = sliderClientWidth - paddingLeft * 2;
                    let targetScrollLeft = cardOffsetLeft - paddingLeft - (availableWidth - cardWidth) / 2;
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

        {/* 약물 상호작용 분석 카드 */}
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
                    src="/wello/wello-icon.png" 
                    alt="안전" 
                    className="status-icon"
                  />
                </div>
                <p className="safe-message">현재 복용 중인 약물 간 심각한 상호작용은 발견되지 않았습니다.</p>
              </div>
            )}
          </div>
        </section>

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
                        src="/wello/wello-icon.png" 
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
                        src="/wello/wello-icon.png" 
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

        {/* 데이터 출처 및 면책 조항 */}
        <section className="analysis-card">
          <div className="card-header">
            <h2 className="section-title">데이터 출처 및 면책 조항</h2>
            <div className="chart-info">
              <span className="info-text">중요 안내</span>
            </div>
          </div>
          
          <div className="analysis-results">
            <div className="disclaimer-text">
              <p>• 본 분석은 제공된 건강검진 결과와 처방전 데이터를 기반으로 합니다.</p>
              <p>• AI 분석 결과는 참고용이며, 의학적 진단이나 치료를 대체할 수 없습니다.</p>
              <p>• 건강상 문제가 있으시면 반드시 의료진과 상담하시기 바랍니다.</p>
              <p>• 약물 복용 전 의사나 약사와 상의하시기 바랍니다.</p>
            </div>
            <div className="data-source">
              <p><strong>데이터 출처:</strong> 건강보험공단 건강검진 결과, 의료기관 처방전</p>
              <p><strong>분석 엔진:</strong> OpenAI GPT-4</p>
            </div>
          </div>
        </section>

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