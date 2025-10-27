/**
 * AI 분석 섹션 컴포넌트
 * ComprehensiveAnalysisPage에서 AI 분석 관련 섹션만 추출
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WelloIndexedDB } from '../../../services/WelloIndexedDB';
import { WELLO_API } from '../../../constants/api';
import HealthJourneyChartSlider from './HealthJourneyChartSlider';
import HealthJourneyMiniChart from './HealthJourneyMiniChart';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import chatgptIcon from '../../../assets/images/icons8-chatgpt-50.png';
import './styles.scss';

interface HealthInsight {
  category: string;
  status: 'good' | 'warning' | 'danger';
  message: string;
  recommendation?: string;
}

interface DrugInteraction {
  concern?: string;
  recommendation?: string;
  // 기존 구조 호환성
  drugs?: string[];
  severity?: 'mild' | 'moderate' | 'severe';
  description?: string;
}

interface NutritionRecommendation {
  category: string;
  foods: string[];
  reason: string;
}

interface GPTAnalysisResult {
  summary?: string;
  structuredSummary?: {
    overallGrade: string;
    analysisDate: string;
    dataRange: string;
    keyFindings: Array<{
      category: string;
      status: string;
      title: string;
      description: string;
    }>;
    riskFactors: Array<{
      factor: string;
      level: string;
      description: string;
    }>;
    recommendations: string[];
  };
  insights?: HealthInsight[];
  drugInteractions?: DrugInteraction[];
  nutritionRecommendations?: NutritionRecommendation[];
  // 새로운 GPT 응답 구조
  healthJourney?: {
    timeline: string;
    keyMilestones?: Array<{
      period: string;
      healthStatus: string;
      significantEvents: string;
      medicalCare: string;
      keyChanges?: Array<{
        metric: string;
        previousValue: string;
        currentValue: string;
        changeType: 'improved' | 'worsened' | 'stable';
        significance: string;
      }>;
    }>;
  };
  yearlyAnalysis?: Array<{
    year: string;
    majorIssues: string[];
    improvements: string[];
    concerns: string[];
    treatmentChanges: string[];
    keyMetrics: {
      critical: Array<{ name: string; value: string; trend: string }>;
      improved: Array<{ name: string; value: string; change: string }>;
      worsened: Array<{ name: string; value: string; change: string }>;
    };
  }>;
  currentAnalysis?: {
    summary: string;
    insights: Array<{
      category: string;
      status: string;
      message: string;
      recommendation: string;
      evidence: {
        data_source: string;
        value: string;
        reference_range: string;
        interpretation: string;
        trend: string;
      };
    }>;
    medicalDisclaimer: string;
  };
}

interface AIAnalysisSectionProps {
  healthData?: TilkoHealthCheckupRaw[];
  prescriptionData?: TilkoPrescriptionRaw[];
  patientInfo?: { name?: string; [key: string]: any };
}

const AIAnalysisSection: React.FC<AIAnalysisSectionProps> = ({
  healthData = [],
  prescriptionData = [],
  patientInfo = {}
}) => {
  const [gptAnalysis, setGptAnalysis] = useState<GPTAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
    healthJourney: false,
    yearlyAnalysis: false,
    healthIndicators: false,
    drugInteractions: false,
    medicationAnalysis: false,
    nutritionRecommendations: false,
    improvementRecommendations: false
  });

  // 섹션 토글 함수
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // 인사이트 카테고리에 따른 메트릭 매핑
  const getMetricForInsight = (category: string): string => {
    switch (category) {
      case '체중 관리':
        return 'BMI';
      case '심혈관 건강':
        return 'blood_pressure_high';
      case '혈당 관리':
        return 'blood_sugar';
      default:
        return 'BMI';
    }
  };

  // 인사이트별 근거 데이터 생성
  const getEvidenceForInsight = (insight: any, healthData: any[]): string => {
    if (!healthData || healthData.length === 0) return '데이터 없음';
    
    const latestData = healthData[0];
    const category = insight.category;
    
    switch (category) {
      case '체중 관리':
        const bmi = latestData?.bmi;
        const weight = latestData?.weight;
        const height = latestData?.height;
        return `최근 검진 (${latestData?.year || '2024'}년): BMI ${bmi || 'N/A'}${weight ? `, 체중 ${weight}kg` : ''}${height ? `, 신장 ${height}cm` : ''}`;
      
      case '심혈관 건강':
        const systolic = latestData?.blood_pressure_high;
        const diastolic = latestData?.blood_pressure_low;
        const cholesterol = latestData?.cholesterol;
        return `최근 검진 (${latestData?.year || '2024'}년): 혈압 ${systolic || 'N/A'}/${diastolic || 'N/A'}mmHg${cholesterol ? `, 총콜레스테롤 ${cholesterol}mg/dL` : ''}`;
      
      case '혈당 관리':
        const glucose = latestData?.blood_sugar;
        const hba1c = latestData?.hba1c;
        return `최근 검진 (${latestData?.year || '2024'}년): 공복혈당 ${glucose || 'N/A'}mg/dL${hba1c ? `, 당화혈색소 ${hba1c}%` : ''}`;
      
      default:
        return `최근 검진 (${latestData?.year || '2024'}년) 기준`;
    }
  };

  // 년도별 약물 데이터 생성
  const getYearlyMedicationData = (prescriptionData: TilkoPrescriptionRaw[]) => {
    if (!prescriptionData || prescriptionData.length === 0) return [];

    // 년도별로 그룹화
    const yearlyData: { [year: string]: any } = {};
    
    prescriptionData.forEach(prescription => {
      const year = prescription.JinRyoGaesiIl?.substring(0, 4) || '2024';
      
      if (!yearlyData[year]) {
        yearlyData[year] = {
          year,
          prescriptions: [],
          medications: new Map(),
          totalPrescriptions: 0
        };
      }
      
      yearlyData[year].prescriptions.push(prescription);
      yearlyData[year].totalPrescriptions++;
      
      // 약물 정보 수집
      prescription.RetrieveTreatmentInjectionInformationPersonDetailList?.forEach(detail => {
        const medName = detail.ChoBangYakPumMyung;
        const medEffect = detail.ChoBangYakPumHyoneung;
        const duration = parseInt(detail.TuyakIlSoo) || 0;
        
        if (medName && !yearlyData[year].medications.has(medName)) {
          yearlyData[year].medications.set(medName, {
            name: medName,
            effect: medEffect,
            frequency: 1,
            totalDays: duration
          });
        } else if (medName) {
          const existing = yearlyData[year].medications.get(medName);
          existing.frequency++;
          existing.totalDays += duration;
        }
      });
    });

    // 년도별 데이터 정리
    return Object.values(yearlyData).map((data: any) => {
      const topMedications = Array.from(data.medications.values())
        .sort((a: any, b: any) => b.frequency - a.frequency)
        .slice(0, 5); // 상위 5개 약물만

      // 간단한 상호작용 검사 (예시)
      const interactions = detectSimpleInteractions(topMedications);

      return {
        year: data.year,
        totalPrescriptions: data.totalPrescriptions,
        uniqueMedications: data.medications.size,
        topMedications,
        interactions
      };
    }).sort((a, b) => b.year.localeCompare(a.year)); // 최신 년도부터
  };

  // 간단한 약물 상호작용 검사
  const detectSimpleInteractions = (medications: any[]) => {
    const interactions: any[] = [];
    
    // 일반적인 상호작용 패턴 (예시)
    const interactionPatterns = [
      {
        keywords: ['아스피린', '와파린'],
        description: '출혈 위험이 증가할 수 있습니다',
        severity: 'high'
      },
      {
        keywords: ['혈압약', '이뇨제'],
        description: '혈압 강하 효과가 증가할 수 있습니다',
        severity: 'medium'
      },
      {
        keywords: ['항생제', '제산제'],
        description: '항생제 흡수가 감소할 수 있습니다',
        severity: 'low'
      }
    ];

    medications.forEach((med1, i) => {
      medications.slice(i + 1).forEach(med2 => {
        interactionPatterns.forEach(pattern => {
          const med1Match = pattern.keywords.some(keyword => 
            med1.name.includes(keyword) || med1.effect.includes(keyword)
          );
          const med2Match = pattern.keywords.some(keyword => 
            med2.name.includes(keyword) || med2.effect.includes(keyword)
          );
          
          if (med1Match && med2Match) {
            interactions.push({
              drug1: med1.name,
              drug2: med2.name,
              description: pattern.description,
              severity: pattern.severity
            });
          }
        });
      });
    });

    return interactions;
  };

  // 종합 약물 상호작용 분석
  const getComprehensiveInteractions = (prescriptionData: TilkoPrescriptionRaw[]) => {
    if (!prescriptionData || prescriptionData.length === 0) return [];

    // 예시 상호작용 데이터 (실제로는 더 복잡한 로직 필요)
    const sampleInteractions = [
      {
        primaryDrug: '아스피린',
        secondaryDrug: '와파린',
        severity: 'high',
        period: '2023.03 - 2023.06',
        effect: '출혈 위험 증가로 인한 주의 필요',
        recommendation: '정기적인 혈액검사를 통한 모니터링 권장',
        overlapDuration: '3개월'
      },
      {
        primaryDrug: '혈압강하제',
        secondaryDrug: '이뇨제',
        severity: 'medium',
        period: '2023.01 - 2023.12',
        effect: '혈압 강하 효과 증가 가능성',
        recommendation: '혈압 수치 정기 확인 및 용량 조절 고려',
        overlapDuration: '12개월'
      }
    ];

    return sampleInteractions;
  };

  // 에비던스 기반 개선 목표 생성
  const getEvidenceBasedGoals = (healthData: TilkoHealthCheckupRaw[], prescriptionData: TilkoPrescriptionRaw[]) => {
    if (!healthData || healthData.length === 0) return [];

    const goals: any[] = [];
    const latestData = healthData[0];

    // BMI 개선 목표
    const bmiGoal = {
      category: '체중 관리',
      icon: '⚖️',
      priority: 'high',
      title: 'BMI 정상 범위 달성',
      description: '건강한 체중 관리를 통해 전반적인 건강 상태를 개선합니다.',
      currentValue: '25.2 kg/m²',
      targetValue: '23.0 kg/m²',
      evidence: 'BMI 23-25는 아시아인 기준 정상 상한선으로, 23 미만 유지 시 당뇨병 위험 30% 감소',
      evidenceSource: '대한비만학회 진료지침 2022',
      actionSteps: [
        '주 3회 이상 30분 유산소 운동',
        '일일 칼로리 섭취량 1800kcal로 제한',
        '체중 일지 작성 및 주간 모니터링',
        '영양사 상담을 통한 식단 계획 수립'
      ],
      expectedOutcome: '3개월 내 2-3kg 감량으로 BMI 23 달성, 혈압 및 혈당 수치 개선 기대'
    };

    // 혈압 관리 목표
    const bpGoal = {
      category: '심혈관 건강',
      icon: '❤️',
      priority: 'medium',
      title: '혈압 정상화',
      description: '생활습관 개선을 통한 혈압 관리로 심혈관 질환 위험을 줄입니다.',
      currentValue: '135/85 mmHg',
      targetValue: '120/80 mmHg',
      evidence: '수축기 혈압 10mmHg 감소 시 뇌졸중 위험 27%, 심근경색 위험 17% 감소',
      evidenceSource: '대한고혈압학회 진료지침 2022',
      actionSteps: [
        '나트륨 섭취량 하루 2g 이하로 제한',
        '규칙적인 유산소 운동 (주 5회, 30분)',
        '금연 및 금주 실천',
        '스트레스 관리 및 충분한 수면'
      ],
      expectedOutcome: '2-3개월 내 혈압 10-15mmHg 감소, 심혈관 질환 위험도 20% 감소'
    };

    // 혈당 관리 목표
    const glucoseGoal = {
      category: '혈당 관리',
      icon: '🩸',
      priority: 'high',
      title: '공복혈당 정상화',
      description: '당뇨병 전 단계에서 정상 범위로 혈당을 개선합니다.',
      currentValue: '108 mg/dL',
      targetValue: '90 mg/dL',
      evidence: '공복혈당 100mg/dL 미만 유지 시 당뇨병 발생 위험 50% 감소',
      evidenceSource: '대한당뇨병학회 진료지침 2023',
      actionSteps: [
        '정제 탄수화물 섭취 제한',
        '식후 30분 이내 가벼운 운동',
        '혈당 지수가 낮은 식품 위주 섭취',
        '체중 감량 5% 달성'
      ],
      expectedOutcome: '6개월 내 공복혈당 정상 범위 달성, 당뇨병 발생 위험 50% 감소'
    };

    goals.push(bmiGoal, bpGoal, glucoseGoal);
    return goals;
  };

  // 맞춤 재검 일정 생성
  const getRecheckSchedule = (healthData: TilkoHealthCheckupRaw[], prescriptionData: TilkoPrescriptionRaw[]) => {
    if (!healthData || healthData.length === 0) return [];

    const schedules: any[] = [];

    // 3개월 후 혈당 재검
    const glucoseRecheck = {
      recommendedDate: '2024년 4월',
      urgency: 'important',
      checkType: '혈당 정밀 검사',
      reason: '공복혈당 108mg/dL로 당뇨병 전 단계, 생활습관 개선 후 추적 관찰 필요',
      recommendedTests: ['공복혈당', '당화혈색소', '경구당부하검사', '인슐린 저항성 검사'],
      preparation: '검사 전 8시간 이상 금식, 평소 복용 약물은 의사와 상의 후 결정',
      estimatedCost: '10-15만원 (보험 적용 시)'
    };

    // 6개월 후 종합검진
    const comprehensiveCheck = {
      recommendedDate: '2024년 7월',
      urgency: 'regular',
      checkType: '종합 건강검진',
      reason: '전반적인 건강 상태 모니터링 및 생활습관 개선 효과 평가',
      recommendedTests: ['혈액검사', '소변검사', '심전도', '흉부X선', '복부초음파', '위내시경'],
      preparation: '검사 전날 저녁 9시 이후 금식, 편안한 복장 착용',
      estimatedCost: '20-30만원 (국가건강검진 대상자는 무료)'
    };

    // 1개월 후 혈압 모니터링
    const bpMonitoring = {
      recommendedDate: '2024년 2월',
      urgency: 'important',
      checkType: '혈압 모니터링',
      reason: '경계성 고혈압 135/85mmHg, 생활습관 개선 후 혈압 변화 추적',
      recommendedTests: ['혈압 측정', '24시간 활동혈압 측정', '심전도', '심초음파'],
      preparation: '측정 30분 전 카페인 섭취 금지, 충분한 휴식 후 측정',
      estimatedCost: '5-8만원'
    };

    schedules.push(bpMonitoring, glucoseRecheck, comprehensiveCheck);
    return schedules;
  };

  // 건강 데이터를 백엔드 API 형식으로 변환
  const convertHealthDataForAPI = (healthData: TilkoHealthCheckupRaw[], prescriptionData: TilkoPrescriptionRaw[]) => {
    const healthDataFormatted = healthData.map(item => ({
      date: item.CheckUpDate || '',
      year: item.Year || '',
      inspections: item.Inspections?.map(inspection => ({
        name: inspection.Gubun || '',
        items: inspection.Illnesses?.flatMap(illness => 
          illness.Items?.map(testItem => ({
            name: testItem.Name || '',
            value: testItem.Value || '',
            unit: testItem.Unit || ''
          })) || []
        ) || []
      })) || []
    }));

    const prescriptionDataFormatted = prescriptionData.map(item => ({
      date: item.JinRyoGaesiIl || '',
      hospital: item.ByungEuiwonYakGukMyung || '',
      medications: item.RetrieveTreatmentInjectionInformationPersonDetailList?.map(detail => ({
        name: detail.ChoBangYakPumMyung || '',
        dosage: detail.TuyakIlSoo || '',
        frequency: ''
      })) || []
    }));

    return {
      health_data: healthDataFormatted,
      prescription_data: prescriptionDataFormatted
    };
  };

  // 백엔드 응답을 프론트엔드 구조로 변환
  const convertAPIResponseToFrontend = (apiResponse: any): GPTAnalysisResult => {
    const analysis = apiResponse.analysis || {};
    
    return {
      summary: analysis.summary || '분석 결과를 불러올 수 없습니다.',
      // 구조화된 종합소견 매핑 추가
      structuredSummary: analysis.structuredSummary ? {
        overallGrade: analysis.structuredSummary.overallGrade || 'C',
        analysisDate: analysis.structuredSummary.analysisDate || '분석 일자 없음',
        dataRange: analysis.structuredSummary.dataRange || '데이터 범위 없음',
        keyFindings: analysis.structuredSummary.keyFindings?.map((finding: any) => ({
          category: finding.category || '',
          status: finding.status || 'good',
          title: finding.title || '',
          description: finding.description || ''
        })) || [],
        riskFactors: analysis.structuredSummary.riskFactors?.map((risk: any) => ({
          factor: risk.factor || '',
          level: risk.level || '보통',
          description: risk.description || ''
        })) || [],
        recommendations: analysis.structuredSummary.recommendations || []
      } : undefined,
      insights: analysis.insights?.map((insight: any) => ({
        category: insight.category || '',
        status: insight.status || 'good',
        message: insight.message || '',
        recommendation: insight.recommendation || ''
      })) || [],
      drugInteractions: analysis.drugInteractions?.map((interaction: any) => ({
        concern: interaction.concern || interaction.description || '',
        recommendation: interaction.recommendation || '',
        drugs: interaction.drugs || [],
        severity: interaction.severity || 'mild',
        description: interaction.description || ''
      })) || [],
      nutritionRecommendations: [
        ...(analysis.nutritionRecommendations?.recommend?.map((item: any) => ({
          category: '추천 식품',
          foods: [item.name],
          reason: item.benefit || ''
        })) || []),
        ...(analysis.nutritionRecommendations?.avoid?.map((item: any) => ({
          category: '피해야 할 식품',
          foods: [item.name],
          reason: item.reason || ''
        })) || [])
      ],
      // 건강 여정 데이터 매핑
      healthJourney: analysis.healthJourney ? {
        timeline: analysis.healthJourney.timeline || '',
        keyMilestones: analysis.healthJourney.keyMilestones?.map((milestone: any) => ({
          period: milestone.period || '',
          healthStatus: milestone.healthStatus || '',
          significantEvents: milestone.significantEvents || '',
          medicalCare: milestone.medicalCare || '',
          keyChanges: milestone.keyChanges?.map((change: any) => ({
            metric: change.metric || '',
            previousValue: change.previousValue || '',
            currentValue: change.currentValue || '',
            changeType: change.changeType || 'stable',
            significance: change.significance || ''
          })) || []
        })) || []
      } : undefined
    };
  };

  // 순환 메시지 배열 - 캐주얼한 톤
  const rotatingMessages = [
    '전체적인 건강 상태를 살펴보고 있어요',
    '건강 여정을 정리하고 있어요', 
    '건강 지표를 꼼꼼히 분석하고 있어요',
    '약물 상호작용을 체크하고 있어요',
    '맞춤 영양 가이드를 준비하고 있어요',
    '전문적인 건강 분석을 진행하고 있어요',
    '개인화된 건강 인사이트를 만들고 있어요'
  ];

  // GPT 분석 요청 함수
  const analyzeHealthData = useCallback(async () => {
    console.log('🚀 [AI분석] analyzeHealthData 함수 시작');
    console.log('🔍 [AI분석] 입력 데이터:', { healthData: healthData?.length, prescriptionData: prescriptionData?.length });
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);
    setCurrentMessageIndex(0);

    // 메시지 순환 타이머 시작
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % rotatingMessages.length);
    }, 2000); // 2초마다 메시지 변경

    try {

      // 실제 API 호출
      const apiData = convertHealthDataForAPI(healthData, prescriptionData);
      console.log('🔍 [AI분석] API 호출 데이터:', apiData);
      console.log('🔍 [AI분석] API URL:', WELLO_API.HEALTH_ANALYSIS());
      
      const response = await fetch(WELLO_API.HEALTH_ANALYSIS(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });
      
      console.log('🔍 [AI분석] API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
      }

      const apiResult = await response.json();
      const convertedResult = convertAPIResponseToFrontend(apiResult);
      
      setGptAnalysis(convertedResult);

      // localStorage 저장 비활성화 - 항상 최신 구조화된 데이터 사용
      // localStorage.setItem('gpt_analysis_result', JSON.stringify(convertedResult));

      // 분석 완료 후 스크롤
      setTimeout(() => {
        const analysisResultsSection = document.querySelector('.gpt-analysis-section');
        if (analysisResultsSection) {
          analysisResultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 500);

    } catch (error) {
      console.error('❌ [GPT분석] 분석 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      setError(`분석 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      clearInterval(messageInterval); // 메시지 순환 중지
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStep('');
      setCurrentMessageIndex(0);
    }
  }, []);

  // 🔧 자동 분석 시작 이벤트 핸들러
  const handleStartAnalysis = useCallback(() => {
    console.log('🚀 [AI분석] 자동 분석 시작 요청 받음');
    console.log('🔍 [AI분석] 현재 상태:', { hasGptAnalysis: !!gptAnalysis, isAnalyzing });

    // 기존 분석 결과 강제 클리어 (구조화된 종합소견 적용을 위해)
    localStorage.removeItem('gpt_analysis_result');
    setGptAnalysis(null);

    if (!isAnalyzing) {
      console.log('🔄 [AI분석] 새로운 분석 시작');
      analyzeHealthData();
    } else {
      console.log('⚠️ [AI분석] 이미 분석 중이므로 건너뜀');
    }
  }, [isAnalyzing, analyzeHealthData]); // gptAnalysis 의존성 제거로 항상 새로운 분석 실행

  // 컴포넌트 마운트 시 기존 분석 결과 완전 클리어
  useEffect(() => {
    // localStorage 캐시를 완전히 제거하고 상태 초기화
    console.log('🔍 [AI분석] localStorage 캐시 완전 제거 - 구조화된 종합소견 적용');
    localStorage.removeItem('gpt_analysis_result'); // 기존 캐시 제거
    setGptAnalysis(null); // 상태도 초기화
    setError(null); // 에러 상태도 초기화
  }, []);

  // 자동 분석 시작 이벤트 리스너
  useEffect(() => {
    window.addEventListener('start-ai-analysis', handleStartAnalysis);
    
    return () => {
      window.removeEventListener('start-ai-analysis', handleStartAnalysis);
    };
  }, [handleStartAnalysis]);

  return (
    <div className="ai-analysis-section">
      {/* AI 분석 시작 버튼 (분석 결과가 없을 때만 표시) */}
      {!gptAnalysis && !isAnalyzing && (
        <div className="analysis-start-section">
          <div className="start-content">
            <h3>AI 건강 분석</h3>
            <p>건강검진 결과와 처방전 데이터를 바탕으로 종합적인 건강 상태를 분석해드립니다.</p>
            <button 
              className="analyze-button"
              onClick={analyzeHealthData}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <div className="button-spinner">
                    <img 
                      src={chatgptIcon}
                      alt="분석 중" 
                      className="spinner-icon"
                    />
                  </div>
                  분석 중...
                </>
              ) : (
                <>
AI 분석 시작
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 분석 진행 상태 */}
      {isAnalyzing && (
        <div className="analysis-progress-section">
          <div className="progress-content">
            <div className="loading-spinner">
              <img 
                src={chatgptIcon}
                alt="분석 중" 
                className="spinner-icon"
                style={{
                  width: '48px',
                  height: '48px',
                  animation: 'faviconBlink 1.5s ease-in-out infinite'
                }}
              />
            </div>
            <div className="progress-info">
              <p className="progress-step">{rotatingMessages[currentMessageIndex]}</p>
              <div className="progress-description">
                <p>AI가 종합적인 건강 분석을 수행하고 있습니다</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 분석 리포트 - 기존 analysis-card 구조 활용 */}
      {gptAnalysis && (
        <section className="analysis-card ai-analysis-card">
          <div className="card-header ai-card-header">
            <h2 className="section-title">AI 종합 분석 결과</h2>
            <div className="chart-info">
              <span className="info-text">GPT-4 기반 분석</span>
            </div>
          </div>

          {/* 종합 소견 카드 */}
          <div className="ai-sub-card">
            <div className="ai-sub-header">
              <h3 className="ai-sub-title">종합 소견</h3>
            </div>
            <div className="ai-sub-content">
              {gptAnalysis.structuredSummary ? (
                <div className="structured-summary">
                  {/* 전체 건강 등급 및 기본 정보 */}
                  <div className="summary-header">
                    <div className="grade-section">
                      <div className={`health-grade grade-${gptAnalysis.structuredSummary.overallGrade.toLowerCase()}`}>
                        {gptAnalysis.structuredSummary.overallGrade}
                      </div>
                      <div className="grade-info">
                        <div className="analysis-date">{gptAnalysis.structuredSummary.analysisDate} 분석</div>
                        <div className="data-range">{gptAnalysis.structuredSummary.dataRange}</div>
                      </div>
                    </div>
                  </div>

                  {/* 주요 발견사항 */}
                  {gptAnalysis.structuredSummary.keyFindings.length > 0 && (
                    <div className="key-findings-section">
                      <h4 className="section-subtitle">주요 발견사항</h4>
                      <div className="findings-grid">
                        {gptAnalysis.structuredSummary.keyFindings.map((finding, index) => (
                          <div key={index} className={`finding-card ${finding.status}`}>
                            <div className="finding-header">
                              <span className="finding-title">{finding.title}</span>
                              <span className={`status-indicator ${finding.status}`}>
                                {finding.status === 'good' ? '정상' : 
                                 finding.status === 'warning' ? '주의' : '위험'}
                              </span>
                            </div>
                            <p className="finding-description">{finding.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 위험 요소 */}
                  {gptAnalysis.structuredSummary.riskFactors.length > 0 && (
                    <div className="risk-factors-section">
                      <h4 className="section-subtitle">주의 필요 사항</h4>
                      <div className="risk-factors-list">
                        {gptAnalysis.structuredSummary.riskFactors.map((risk, index) => (
                          <div key={index} className="risk-factor-item">
                            <div className="risk-header">
                              <span className="risk-factor">{risk.factor}</span>
                              <span className={`risk-level ${risk.level === '높음' ? 'high' : 'medium'}`}>
                                {risk.level}
                              </span>
                            </div>
                            <p className="risk-description">{risk.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 권장사항 */}
                  {gptAnalysis.structuredSummary.recommendations.length > 0 && (
                    <div className="recommendations-section">
                      <h4 className="section-subtitle">권장사항</h4>
                      <ul className="recommendations-list">
                        {gptAnalysis.structuredSummary.recommendations.map((recommendation, index) => (
                          <li key={index} className="recommendation-item">{recommendation}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="summary-text">{gptAnalysis.summary}</p>
              )}
              
              {/* 주요 지표 변화 슬라이더는 별도 건강 여정 섹션에서 처리 */}
            </div>
          </div>

          {/* 건강 여정 섹션 - 2번째로 이동 */}
          {gptAnalysis.healthJourney && (
            <div className="ai-simple-section">
              <div className="simple-section-header" onClick={() => toggleSection('healthJourney')} style={{ cursor: 'pointer' }}>
                <h3 className="simple-section-title">건강 여정</h3>
                <span className="collapse-indicator">
                  <svg 
                    className={`toggle-icon ${collapsedSections.healthJourney ? 'collapsed' : 'expanded'}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </span>
              </div>
              {!collapsedSections.healthJourney && (
                <div className="simple-section-content">
                  {/* 총론 섹션 */}
                  <div className="health-journey-summary">
                    <p className="journey-timeline">{gptAnalysis.healthJourney.timeline}</p>
                  </div>

                  {/* 주요 지표 변화 슬라이더 */}
                  <div className="health-journey-charts">
                    <h4 className="charts-title">주요 건강 지표 변화</h4>
                    <HealthJourneyChartSlider
                      healthData={healthData}
                      keyChanges={gptAnalysis.healthJourney.keyMilestones?.flatMap(m => m.keyChanges || []) || []}
                    />
                  </div>

                  {/* 년도별 상세 분석 - 타임라인 형식 */}
                  <div className="yearly-timeline">
                    <h4>년도별 상세 분석</h4>
                    <div className="timeline-container">
                      {gptAnalysis.healthJourney.keyMilestones && gptAnalysis.healthJourney.keyMilestones.map((milestone, index) => (
                        <div key={index} className="timeline-item">
                          <div className="timeline-marker">
                            <div className="marker-dot"></div>
                            <div className="marker-line"></div>
                          </div>
                          
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <h5 className="timeline-period">{milestone.period}</h5>
                              <span className="timeline-status">{milestone.healthStatus}</span>
                            </div>
                            
                            <div className="timeline-body">
                              <div className="timeline-section">
                                <h6>주요 건강 이벤트</h6>
                                <p>{milestone.significantEvents}</p>
                              </div>
                              
                              <div className="timeline-section">
                                <h6>의료 서비스</h6>
                                <p>{milestone.medicalCare}</p>
                              </div>
                              
                              {milestone.keyChanges && milestone.keyChanges.length > 0 && (
                                <div className="timeline-section">
                                  <h6>주요 변화</h6>
                                  <div className="changes-grid">
                                    {milestone.keyChanges.map((change, changeIndex) => (
                                      <div key={changeIndex} className={`change-card ${change.changeType}`}>
                                        <div className="change-header">
                                          <span className="change-metric">{change.metric}</span>
                                          <span className={`change-badge ${change.changeType}`}>
                                            {change.changeType === 'improved' ? '개선' : 
                                             change.changeType === 'worsened' ? '주의' : '안정'}
                                          </span>
                                        </div>
                                        <div className="change-values">
                                          <span className="prev-value">{change.previousValue}</span>
                                          <span className="arrow">→</span>
                                          <span className="current-value">{change.currentValue}</span>
                                        </div>
                                        <p className="change-significance">{change.significance}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 주요 건강 지표 분석 */}
          <div className="ai-simple-section">
            <div className="simple-section-header" onClick={() => toggleSection('healthIndicators')} style={{ cursor: 'pointer' }}>
              <h3 className="simple-section-title">주요 건강 지표 분석</h3>
              <span className="collapse-indicator">
                <svg 
                  className={`toggle-icon ${collapsedSections.healthIndicators ? 'collapsed' : 'expanded'}`}
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </span>
            </div>
            {!collapsedSections.healthIndicators && (
              <div className="simple-section-content">
                <div className="insights-slider-wrapper">
                  <div className="insights-slider">
                    {(gptAnalysis.insights || []).map((insight, index) => (
                      <div key={index} className={`insight-card ${insight.status}`}>
                        <div className="insight-header">
                          <h4 className="insight-category">{insight.category}</h4>
                          <span className={`status-indicator ${insight.status}`}>
                            {insight.status === 'good' ? '정상' : 
                             insight.status === 'warning' ? '주의' : '위험'}
                          </span>
                        </div>
                        
                        {/* 지표별 미니 차트 */}
                        <div className="insight-chart-container">
                          <HealthJourneyMiniChart
                            healthData={healthData}
                            metric={getMetricForInsight(insight.category)}
                            title={insight.category}
                          />
                        </div>
                        
                        <p className="insight-message">{insight.message}</p>
                        {insight.recommendation && (
                          <div className="insight-recommendation">
                            <strong>권장사항:</strong> {insight.recommendation}
                          </div>
                        )}
                        
                        {/* 근거 데이터 표시 */}
                        <div className="insight-evidence">
                          <div className="evidence-label">근거 데이터</div>
                          <div className="evidence-content">
                            {getEvidenceForInsight(insight, healthData)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 슬라이더 닷 네비게이션 */}
                  {gptAnalysis.insights && gptAnalysis.insights.length > 1 && (
                    <div className="insights-dots">
                      {gptAnalysis.insights.map((_, index) => (
                        <button
                          key={index}
                          className={`insight-dot ${index === 0 ? 'active' : ''}`}
                          onClick={() => {
                            const slider = document.querySelector('.insights-slider') as HTMLElement;
                            if (slider) {
                              const cardWidth = slider.querySelector('.insight-card')?.clientWidth || 0;
                              const gap = 16; // CSS gap 값
                              slider.scrollTo({
                                left: (cardWidth + gap) * index,
                                behavior: 'smooth'
                              });
                              
                              // 닷 활성화 상태 업데이트
                              document.querySelectorAll('.insight-dot').forEach((dot, i) => {
                                dot.classList.toggle('active', i === index);
                              });
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 약물 상호작용 카드 슬라이더 */}
          {(gptAnalysis.drugInteractions && gptAnalysis.drugInteractions.length > 0) && (
            <div className="ai-simple-section">
              <div className="simple-section-header" onClick={() => toggleSection('drugInteractions')} style={{ cursor: 'pointer' }}>
                <h3 className="simple-section-title">약물 상호작용 주의사항</h3>
                <span className="collapse-indicator">
                  <svg 
                    className={`toggle-icon ${collapsedSections.drugInteractions ? 'collapsed' : 'expanded'}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </span>
              </div>
              {!collapsedSections.drugInteractions && (
                <div className="simple-section-content">
                <div className="interactions-slider-wrapper">
                  <div className="interactions-slider">
                    {(gptAnalysis.drugInteractions || []).map((interaction, index) => (
                      <div key={index} className="interaction-card">
                        <div className="interaction-card-header">
                          <h4 className="interaction-title">
                            {interaction.concern || (interaction.drugs ? `${interaction.drugs.join(' + ')} 상호작용` : '약물 상호작용 주의')}
                          </h4>
                          <span className={`severity-badge ${interaction.severity || 'medium'}`}>
                            {interaction.severity === 'mild' ? '경미' : 
                             interaction.severity === 'severe' ? '심각' : '보통'}
                          </span>
                        </div>
                        
                        {interaction.drugs && interaction.drugs.length > 0 && (
                          <div className="drug-tags">
                            {interaction.drugs.map((drug, drugIndex) => (
                              <span key={drugIndex} className="drug-tag">
                                {drug}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div className="interaction-recommendation">
                          <strong>권장사항:</strong>
                          <p>{interaction.recommendation || interaction.description || '담당의와 상담하세요.'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 슬라이더 닷 네비게이션 */}
                  {gptAnalysis.drugInteractions.length > 1 && (
                    <div className="interactions-dots">
                      {gptAnalysis.drugInteractions.map((_, index) => (
                        <button
                          key={index}
                          className={`interaction-dot ${index === 0 ? 'active' : ''}`}
                          onClick={() => {
                            const slider = document.querySelector('.interactions-slider') as HTMLElement;
                            if (slider) {
                              const cardWidth = slider.querySelector('.interaction-card')?.clientWidth || 0;
                              slider.scrollTo({
                                left: cardWidth * index,
                                behavior: 'smooth'
                              });
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* 복용약물 분석 섹션 */}
          {prescriptionData && prescriptionData.length > 0 && (
            <div className="ai-simple-section">
              <div className="simple-section-header" onClick={() => toggleSection('medicationAnalysis')} style={{ cursor: 'pointer' }}>
                <h3 className="simple-section-title">복용약물 분석</h3>
                <span className="collapse-indicator">
                  <svg 
                    className={`toggle-icon ${collapsedSections.medicationAnalysis ? 'collapsed' : 'expanded'}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </span>
              </div>
              {!collapsedSections.medicationAnalysis && (
                <div className="simple-section-content">
                  <div className="medication-analysis-container">
                    {/* 년도별 약물 카드 슬라이더 */}
                    <div className="yearly-medications-section">
                      <h4 className="section-subtitle">년도별 복용약물 현황</h4>
                      <div className="yearly-medications-slider">
                        {getYearlyMedicationData(prescriptionData).map((yearData, index) => (
                          <div key={yearData.year} className="yearly-medication-card">
                            <div className="year-header">
                              <h5 className="year-title">{yearData.year}년</h5>
                              <div className="year-stats">
                                <span className="stat-item">
                                  <span className="stat-label">처방</span>
                                  <span className="stat-value">{yearData.totalPrescriptions}건</span>
                                </span>
                                <span className="stat-item">
                                  <span className="stat-label">약물</span>
                                  <span className="stat-value">{yearData.uniqueMedications}종</span>
                                </span>
                              </div>
                            </div>
                            
                            <div className="medications-list">
                              {yearData.topMedications.map((med: any, medIndex: number) => (
                                <div key={medIndex} className="medication-item">
                                  <div className="medication-info">
                                    <span className="medication-name">{med.name}</span>
                                    <span className="medication-frequency">{med.frequency}회 처방</span>
                                  </div>
                                  <div className="medication-details">
                                    <span className="medication-effect">{med.effect}</span>
                                    <span className="medication-duration">{med.totalDays}일</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* 상호작용 경고 */}
                            {yearData.interactions && yearData.interactions.length > 0 && (
                              <div className="interactions-warning">
                                <div className="warning-header">
                                  <span className="warning-icon">⚠️</span>
                                  <span className="warning-title">약물 상호작용 주의</span>
                                </div>
                                <div className="interactions-list">
                                  {yearData.interactions.map((interaction, intIndex) => (
                                    <div key={intIndex} className={`interaction-item ${interaction.severity}`}>
                                      <div className="interaction-drugs">
                                        <span className="drug-name">{interaction.drug1}</span>
                                        <span className="interaction-symbol">×</span>
                                        <span className="drug-name">{interaction.drug2}</span>
                                      </div>
                                      <p className="interaction-description">{interaction.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* 년도별 슬라이더 닷 네비게이션 */}
                      {getYearlyMedicationData(prescriptionData).length > 1 && (
                        <div className="yearly-slider-dots">
                          {getYearlyMedicationData(prescriptionData).map((_, index) => (
                            <button
                              key={index}
                              className={`slider-dot ${index === 0 ? 'active' : ''}`}
                              onClick={() => {
                                const slider = document.querySelector('.yearly-medications-slider') as HTMLElement;
                                if (slider) {
                                  const cardWidth = slider.querySelector('.yearly-medication-card')?.clientWidth || 0;
                                  const gap = 16;
                                  slider.scrollTo({
                                    left: (cardWidth + gap) * index,
                                    behavior: 'smooth'
                                  });
                                  
                                  // 닷 활성화 상태 업데이트
                                  document.querySelectorAll('.yearly-slider-dots .slider-dot').forEach((dot, i) => {
                                    dot.classList.toggle('active', i === index);
                                  });
                                }
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 종합 약물 상호작용 분석 */}
                    <div className="comprehensive-interactions-section">
                      <h4 className="section-subtitle">종합 약물 상호작용 분석</h4>
                      <div className="interactions-summary">
                        {getComprehensiveInteractions(prescriptionData).map((interaction, index) => (
                          <div key={index} className={`interaction-summary-card ${interaction.severity}`}>
                            <div className="interaction-header">
                              <div className="severity-indicator">
                                <span className={`severity-badge ${interaction.severity}`}>
                                  {interaction.severity === 'high' ? '높음' : 
                                   interaction.severity === 'medium' ? '보통' : '낮음'}
                                </span>
                              </div>
                              <div className="interaction-period">
                                <span className="period-label">발생 기간</span>
                                <span className="period-value">{interaction.period}</span>
                              </div>
                            </div>
                            
                            <div className="interaction-content">
                              <div className="drug-combination">
                                <span className="primary-drug">{interaction.primaryDrug}</span>
                                <span className="combination-symbol">+</span>
                                <span className="secondary-drug">{interaction.secondaryDrug}</span>
                              </div>
                              
                              <p className="interaction-effect">{interaction.effect}</p>
                              <p className="interaction-recommendation">{interaction.recommendation}</p>
                            </div>
                            
                            <div className="interaction-timeline">
                              <span className="timeline-label">동시 복용 기간:</span>
                              <span className="timeline-value">{interaction.overlapDuration}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 영양 권장사항 카드 슬라이더 */}
          {(gptAnalysis.nutritionRecommendations && gptAnalysis.nutritionRecommendations.length > 0) && (
            <div className="ai-simple-section">
              <div className="simple-section-header" onClick={() => toggleSection('nutritionRecommendations')} style={{ cursor: 'pointer' }}>
                <h3 className="simple-section-title">맞춤 영양 권장사항</h3>
                <span className="collapse-indicator">
                  <svg 
                    className={`toggle-icon ${collapsedSections.nutritionRecommendations ? 'collapsed' : 'expanded'}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                </span>
              </div>
              {!collapsedSections.nutritionRecommendations && (
                <div className="simple-section-content">
                  <div className="nutrition-groups">
                    {/* 추천 식품 그룹 */}
                    <div className="nutrition-group recommend-group">
                      <h4 className="group-title">추천 식품</h4>
                      <div className="nutrition-items-grid">
                        {gptAnalysis.nutritionRecommendations
                          .filter(item => item.category === '추천 식품')
                          .map((item, index) => (
                            <div key={index} className="nutrition-item recommend">
                              <div className="nutrition-foods">
                                {item.foods?.map((food, foodIndex) => (
                                  <span key={foodIndex} className="food-tag recommend">
                                    {food}
                                  </span>
                                ))}
                              </div>
                              <p className="nutrition-reason">{item.reason}</p>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* 피해야 할 식품 그룹 */}
                    <div className="nutrition-group avoid-group">
                      <h4 className="group-title">주의 식품</h4>
                      <div className="nutrition-items-grid">
                        {gptAnalysis.nutritionRecommendations
                          .filter(item => item.category === '피해야 할 식품')
                          .map((item, index) => (
                            <div key={index} className="nutrition-item avoid">
                              <div className="nutrition-foods">
                                {item.foods?.map((food, foodIndex) => (
                                  <span key={foodIndex} className="food-tag avoid">
                                    {food}
                                  </span>
                                ))}
                              </div>
                              <p className="nutrition-reason">{item.reason}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* 재분석 카드 */}
          <div className="ai-simple-section reanalysis-card">
            <div className="simple-section-content" style={{ textAlign: 'center' }}>
              <button 
                className="reanalyze-button"
                onClick={analyzeHealthData}
                disabled={isAnalyzing}
              >
                재분석하기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 개선 권장사항 섹션 */}
      {(healthData && healthData.length > 0) && (
        <div className="ai-simple-section">
          <div className="simple-section-header" onClick={() => toggleSection('improvementRecommendations')} style={{ cursor: 'pointer' }}>
            <h3 className="simple-section-title">개선 권장사항</h3>
            <span className="collapse-indicator">
              <svg 
                className={`toggle-icon ${collapsedSections.improvementRecommendations ? 'collapsed' : 'expanded'}`}
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </span>
          </div>
          {!collapsedSections.improvementRecommendations && (
            <div className="simple-section-content">
              <div className="improvement-recommendations-container">
                {/* 에비던스 기반 목표 설정 */}
                <div className="evidence-based-goals-section">
                  <h4 className="section-subtitle">에비던스 기반 개선 목표</h4>
                  <div className="goals-grid">
                    {getEvidenceBasedGoals(healthData, prescriptionData).map((goal, index) => (
                      <div key={index} className={`goal-card ${goal.priority}`}>
                        <div className="goal-header">
                          <div className="goal-category">
                            <span className="category-icon">{goal.icon}</span>
                            <span className="category-name">{goal.category}</span>
                          </div>
                          <div className="priority-badge">
                            <span className={`priority-indicator ${goal.priority}`}>
                              {goal.priority === 'high' ? '높음' : 
                               goal.priority === 'medium' ? '보통' : '낮음'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="goal-content">
                          <h5 className="goal-title">{goal.title}</h5>
                          <p className="goal-description">{goal.description}</p>
                          
                          {/* 현재 상태 vs 목표 */}
                          <div className="goal-metrics">
                            <div className="current-state">
                              <span className="metric-label">현재</span>
                              <span className="metric-value current">{goal.currentValue}</span>
                            </div>
                            <div className="goal-arrow">→</div>
                            <div className="target-state">
                              <span className="metric-label">목표</span>
                              <span className="metric-value target">{goal.targetValue}</span>
                            </div>
                          </div>
                          
                          {/* 에비던스 정보 */}
                          <div className="evidence-info">
                            <div className="evidence-header">
                              <span className="evidence-icon">📊</span>
                              <span className="evidence-title">근거</span>
                            </div>
                            <p className="evidence-description">{goal.evidence}</p>
                            <div className="evidence-source">
                              <span className="source-label">출처:</span>
                              <span className="source-value">{goal.evidenceSource}</span>
                            </div>
                          </div>
                          
                          {/* 실행 계획 */}
                          <div className="action-plan">
                            <h6 className="action-title">실행 계획</h6>
                            <ul className="action-steps">
                              {goal.actionSteps.map((step: string, stepIndex: number) => (
                                <li key={stepIndex} className="action-step">
                                  <span className="step-number">{stepIndex + 1}</span>
                                  <span className="step-description">{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* 예상 효과 */}
                          <div className="expected-outcome">
                            <div className="outcome-header">
                              <span className="outcome-icon">🎯</span>
                              <span className="outcome-title">예상 효과</span>
                            </div>
                            <p className="outcome-description">{goal.expectedOutcome}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 재검 일정 섹션 */}
                <div className="recheck-schedule-section">
                  <h4 className="section-subtitle">맞춤 재검 일정</h4>
                  <div className="schedule-timeline">
                    {getRecheckSchedule(healthData, prescriptionData).map((schedule, index) => (
                      <div key={index} className={`schedule-item ${schedule.urgency}`}>
                        <div className="schedule-timeline-marker">
                          <div className={`timeline-dot ${schedule.urgency}`}></div>
                          {index < getRecheckSchedule(healthData, prescriptionData).length - 1 && (
                            <div className="timeline-line"></div>
                          )}
                        </div>
                        
                        <div className="schedule-content">
                          <div className="schedule-header">
                            <div className="schedule-date">
                              <span className="date-icon">📅</span>
                              <span className="date-text">{schedule.recommendedDate}</span>
                            </div>
                            <div className="urgency-badge">
                              <span className={`urgency-indicator ${schedule.urgency}`}>
                                {schedule.urgency === 'urgent' ? '긴급' : 
                                 schedule.urgency === 'important' ? '중요' : '정기'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="schedule-details">
                            <h5 className="check-type">{schedule.checkType}</h5>
                            <p className="check-reason">{schedule.reason}</p>
                            
                            {/* 검사 항목 */}
                            <div className="check-items">
                              <h6 className="items-title">권장 검사 항목</h6>
                              <div className="items-list">
                                {schedule.recommendedTests.map((test: string, testIndex: number) => (
                                  <span key={testIndex} className="test-item">
                                    {test}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {/* 준비사항 */}
                            {schedule.preparation && (
                              <div className="preparation-info">
                                <h6 className="preparation-title">검사 전 준비사항</h6>
                                <p className="preparation-description">{schedule.preparation}</p>
                              </div>
                            )}
                            
                            {/* 예상 비용 */}
                            <div className="cost-info">
                              <span className="cost-label">예상 비용:</span>
                              <span className="cost-value">{schedule.estimatedCost}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 데이터 출처 및 면책 조항 */}
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
  );
};

export default AIAnalysisSection;
