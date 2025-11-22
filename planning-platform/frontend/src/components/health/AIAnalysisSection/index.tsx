/**
 * AI 분석 섹션 컴포넌트
 * ComprehensiveAnalysisPage에서 AI 분석 관련 섹션만 추출
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WelloIndexedDB } from '../../../services/WelloIndexedDB';
import { WELLO_API } from '../../../constants/api';
import HealthJourneyChartSlider from './HealthJourneyChartSlider';
import LineChart from '../../charts/LineChart';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import chatgptIcon from '../../../assets/images/icons8-chatgpt-50.png';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
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
    gradeEvidence?: {
      koreanStandard: string;
      reasoning: string;
      dataPoints: string[];
    };
    analysisDate: string;
    dataRange: string;
    keyFindings: Array<{
      category: string;
      status: string;
      title: string;
      description: string;
      dataEvidence?: {
        checkupDate: string;
        actualValues: string;
        koreanNorm: string;
        academicSource: string;
      };
      trendAnalysis?: {
        [key: string]: string;
      };
      chartExplanation?: string;
    }>;
    riskFactors: Array<{
      factor: string;
      level: string;
      description: string;
      evidence?: string;
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
  // 백엔드에서 제공하는 새로운 필드들
  yearlyMedicationAnalysis?: Array<{
    year: string;
    period: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      purpose: string;
      status: string;
    }>;
    analysis: string;
    cautions: string[];
  }>;
  improvementRecommendations?: Array<{
    category: string;
    icon: string;
    priority: string;
    title: string;
    description: string;
    currentState: {
      label: string;
      value: string;
    };
    targetState: {
      label: string;
      value: string;
    };
    evidence: {
      title: string;
      description: string;
      source: string;
    };
    actionPlan: {
      title: string;
      steps: string[];
    };
    expectedOutcome: {
      title: string;
      description: string;
    };
  }>;
  recheckSchedule?: Array<{
    recommendedDate: string;
    urgency: string;
    checkType: string;
    reason: string;
    recommendedTests: string[];
    preparation: string;
    estimatedCost: string;
  }>;
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

  // 통합 건강 타임라인 생성 함수 (년도별 이벤트 정리)
  const generateHealthTimeline = (healthData: any[], prescriptionData: any[]) => {
    // 년도별 데이터 그룹화 및 이벤트 정리
    const yearlyData: { [year: string]: any } = {};
    
    // 건강검진 데이터 처리
    healthData?.forEach(item => {
      const year = item.year?.replace('년', '') || new Date(item.checkup_date || item.date).getFullYear().toString();
      if (!yearlyData[year]) {
        yearlyData[year] = { 
          checkups: [], 
          prescriptions: [], 
          visits: 0, 
          medications: new Set(),
          keyEvents: [],
          healthStatus: '정상'
        };
      }
      yearlyData[year].checkups.push(item);
      
      // 주요 건강 이벤트 추출
      if (item.Inspections) {
        item.Inspections.forEach((inspection: any) => {
          if (inspection.Illnesses) {
            inspection.Illnesses.forEach((illness: any) => {
              if (illness.Items) {
                illness.Items.forEach((testItem: any) => {
                  if (testItem.Name && testItem.Value) {
                    // 주요 지표만 이벤트로 추가
                    if (['BMI', '혈압', '공복혈당', '총콜레스테롤'].some(key => testItem.Name.includes(key))) {
                      yearlyData[year].keyEvents.push({
                        type: 'checkup',
                        name: testItem.Name,
                        value: testItem.Value,
                        unit: testItem.Unit || '',
                        date: item.CheckUpDate || item.date
                      });
                    }
                  }
                });
              }
            });
          }
        });
      }
    });

    // 처방전 데이터 처리
    prescriptionData?.forEach(item => {
      const year = new Date(item.date || item.prescription_date).getFullYear().toString();
      if (!yearlyData[year]) {
        yearlyData[year] = { 
          checkups: [], 
          prescriptions: [], 
          visits: 0, 
          medications: new Set(),
          keyEvents: [],
          healthStatus: '정상'
        };
      }
      yearlyData[year].prescriptions.push(item);
      yearlyData[year].visits++;
      
      // 약물 정보 및 이벤트 수집
      if (item.medications) {
        item.medications.forEach((med: any) => {
          const medName = med.name || med.ChoBangYakPumMyung;
          yearlyData[year].medications.add(medName);
          
          // 주요 약물 처방 이벤트 추가
          if (medName && ['혈압', '당뇨', '콜레스테롤', '고지혈'].some(key => medName.includes(key))) {
            yearlyData[year].keyEvents.push({
              type: 'prescription',
              name: medName,
              date: item.date || item.prescription_date,
              hospital: item.hospital || '병원'
            });
          }
        });
      }
    });

    // 년도별 정렬 (최신순)
    const sortedYears = Object.keys(yearlyData).sort((a, b) => parseInt(b) - parseInt(a));

    return (
      <div className="health-timeline-unified">
        <div className="timeline-header">
          <h4>건강 여정 타임라인</h4>
          <p className="timeline-description">년도별 주요 건강 이벤트와 의료 활동을 정리했습니다.</p>
        </div>
        
        <div className="timeline-container">
          {sortedYears.map((year, index) => {
            const data = yearlyData[year];
            const checkupCount = data.checkups.length;
            const visitCount = data.visits;
            const medicationCount = data.medications.size;
            const eventCount = data.keyEvents.length;
            
            return (
              <div key={year} className="timeline-year-unified">
                <div className="year-marker">
                  <div className="year-dot"></div>
                  {index < sortedYears.length - 1 && <div className="year-line"></div>}
                </div>
                
                <div className="year-content">
                  <div className="year-header">
                    <h5 className="year-title">{year}년</h5>
                    <div className="year-summary">
                      {checkupCount > 0 && <span className="summary-item checkup">검진 {checkupCount}회</span>}
                      {visitCount > 0 && <span className="summary-item visit">병원 {visitCount}회</span>}
                      {medicationCount > 0 && <span className="summary-item medication">처방약 {medicationCount}종</span>}
                    </div>
                  </div>
                  
                  {/* 주요 이벤트 리스트 */}
                  {eventCount > 0 && (
                    <div className="year-events">
                      <h6>주요 이벤트 ({eventCount}건)</h6>
                      <div className="events-list">
                        {data.keyEvents.slice(0, 5).map((event: any, idx: number) => (
                          <div key={idx} className={`event-item ${event.type}`}>
                            <div className="event-content">
                              <span className="event-name">{event.name}</span>
                              {event.value && <span className="event-value">{event.value}{event.unit}</span>}
                              {event.hospital && <span className="event-location">{event.hospital}</span>}
                            </div>
                            <div className="event-date">{new Date(event.date).toLocaleDateString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 년도별 인사이트 */}
                  <div className="year-insight">
                    {checkupCount > 0 && visitCount > 0 ? 
                      `정기 검진과 함께 ${visitCount}회 병원 방문으로 적극적인 건강 관리` :
                      checkupCount > 0 ? 
                        '정기 검진을 통한 건강 상태 점검' :
                        visitCount > 0 ? 
                          `${visitCount}회 병원 방문으로 치료 중심의 관리` :
                          '건강 관리 활동 기록 없음'
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 인사이트 카테고리에 따른 메트릭 매핑 (다중 지표 지원)
  const getMetricsForInsight = (category: string): string[] => {
    switch (category) {
      case '체중 관리':
      case '체중':
        return ['BMI', '체중', '허리둘레'];
      case '심혈관 건강':
      case '혈압':
        return ['혈압 (수축기)', '혈압 (이완기)', '총콜레스테롤', 'HDL 콜레스테롤', 'LDL 콜레스테롤'];
      case '혈당 관리':
      case '혈당':
        return ['혈당'];
      case '콜레스테롤':
        return ['총콜레스테롤', 'HDL콜레스테롤', 'LDL콜레스테롤', '중성지방'];
      case '헤모글로빈':
        return ['헤모글로빈', '적혈구수'];
      default:
        return ['BMI'];
    }
  };

  // 단일 메트릭 (기존 호환성)
  const getMetricForInsight = (category: string): string => {
    return getMetricsForInsight(category)[0];
  };

  // TrendsSection의 getFieldNameForMetric 함수 복사 (허리둘레 매핑 추가)
  const getFieldNameForMetric = (metric: string): string => {
    const fieldMap: { [key: string]: string } = {
      'BMI': 'bmi',
      '체질량지수': 'bmi',
      '체중': 'weight',
      '허리둘레': 'waist_circumference',
      '공복혈당': 'blood_sugar',
      '혈당': 'blood_sugar',
      '수축기혈압': 'blood_pressure_high',
      '이완기혈압': 'blood_pressure_low',
      '혈압 (수축기)': 'blood_pressure_high',
      '혈압 (이완기)': 'blood_pressure_low',
      '총콜레스테롤': 'cholesterol',
      'HDL콜레스테롤': 'hdl_cholesterol',
      'LDL콜레스테롤': 'ldl_cholesterol',
      '중성지방': 'triglyceride',
      'HDL 콜레스테롤': 'hdl_cholesterol',
      'LDL 콜레스테롤': 'ldl_cholesterol',
      '헤모글로빈': 'hemoglobin',
      '혈색소': 'hemoglobin',
      '적혈구수': 'rbc_count',
      '백혈구수': 'wbc_count',
      '혈소판수': 'platelet_count',
      'AST': 'ast',
      'ALT': 'alt',
      '감마지티피': 'ggt',
      '크레아티닌': 'creatinine',
      '요산': 'uric_acid'
    };
    return fieldMap[metric] || metric.toLowerCase();
  };

  // TrendsSection의 차트 데이터 생성 로직 복사
  const createChartDataForMetric = (metric: string, healthData: TilkoHealthCheckupRaw[]) => {
    if (!healthData || healthData.length === 0) return null;

    const fieldName = getFieldNameForMetric(metric);
    const metricChartData = [{
      id: `metric-${metric}`,
      name: metric,
      data: (() => {
        // 년도별로 데이터 그룹화 (중복 처리)
        const yearlyData: { [year: string]: any } = {};
        
        healthData.forEach((item: any) => {
          // year 필드는 "YYYY년" 형식이므로 "년" 제거
          const year = item.year ? item.year.replace('년', '') : '2024';
          let value = 0;
          
          // raw_data에서 값 추출 (TrendsSection과 동일한 로직)
          if (item.Inspections && Array.isArray(item.Inspections)) {
            for (const inspection of item.Inspections) {
              // 새로운 구조: inspection.items (직접)
              if (inspection.items && Array.isArray(inspection.items)) {
                const foundItem = inspection.items.find((testItem: any) => {
                  if (!testItem.name) return false;
                  const itemName = testItem.name.toLowerCase();
                  const metricName = metric.toLowerCase();
                  
                  return itemName.includes(metricName) ||
                         (metric.includes('혈압') && itemName.includes('혈압')) ||
                         (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                         (metric === '중성지방' && itemName.includes('중성지방')) ||
                         (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈'))) ||
                         (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('둘레'))) ||
                         (metric === '공복혈당' && itemName.includes('혈당'));
                });
                
                if (foundItem && foundItem.value && foundItem.value.trim() !== "") {
                  value = parseFloat(foundItem.value);
                  if (!isNaN(value) && isFinite(value)) {
                    break;
                  }
                }
              }
              // 기존 구조: inspection.Illnesses.Items (호환성)
              else if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
                for (const illness of inspection.Illnesses) {
                  if (illness.Items && Array.isArray(illness.Items)) {
                    const foundItem = illness.Items.find((testItem: any) => {
                      if (!testItem.Name) return false;
                      const itemName = testItem.Name.toLowerCase();
                      const metricName = metric.toLowerCase();
                      
                      return itemName.includes(metricName) ||
                             (metric.includes('혈압') && itemName.includes('혈압')) ||
                             (metric.includes('콜레스테롤') && itemName.includes('콜레스테롤')) ||
                             (metric === '중성지방' && itemName.includes('중성지방')) ||
                             (metric === '헤모글로빈' && (itemName.includes('혈색소') || itemName.includes('헤모글로빈'))) ||
                             (metric === '허리둘레' && (itemName.includes('허리') || itemName.includes('둘레'))) ||
                             (metric === '공복혈당' && itemName.includes('혈당'));
                    });
                    
                    if (foundItem && foundItem.Value && foundItem.Value.trim() !== "") {
                      value = parseFloat(foundItem.Value);
                      if (!isNaN(value) && isFinite(value)) {
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
          
          // 필드 타입에 따른 값 추출 (백업)
          if (value === 0) {
            const rawValue = (item as any)[fieldName];
            if (typeof rawValue === 'string') {
              value = parseFloat(rawValue) || 0;
            } else if (typeof rawValue === 'number') {
              value = rawValue;
            }
          }
          
          if (value > 0 && !isNaN(value) && isFinite(value)) {
            yearlyData[year] = {
              year,
              value,
              checkup_date: item.checkup_date,
              location: item.location || item.Location || "병원",
              item
            };
          }
        });
        
        // 년도순 정렬하여 반환
        return Object.values(yearlyData)
          .sort((a: any, b: any) => parseInt(a.year) - parseInt(b.year))
          .map((data: any) => ({
            date: data.year,
            value: data.value,
            checkup_date: data.checkup_date,
            location: data.location
          }));
      })()
    }];

    return metricChartData.length > 0 && metricChartData[0].data.length > 0 ? metricChartData : null;
  };

  // 건강 범위 정보 (TrendsSection과 동일)
  const getHealthRangesForMetric = (metric: string) => {
    const rangeMap: { [key: string]: any } = {
      'BMI': { normal: { min: 18.5, max: 23.0 }, warning: { min: 23.0, max: 25.0 } },
      '체중': { normal: { min: 50, max: 80 }, warning: { min: 80, max: 100 } }, // 일반적인 성인 기준
      '허리둘레': { normal: { min: 0, max: 90 }, warning: { min: 90, max: 102 } }, // 남성 기준, 여성은 85/95
      '수축기혈압': { normal: { min: 0, max: 120 }, warning: { min: 120, max: 140 } },
      '이완기혈압': { normal: { min: 0, max: 80 }, warning: { min: 80, max: 90 } },
      '공복혈당': { normal: { min: 70, max: 100 }, warning: { min: 100, max: 126 } },
      '총콜레스테롤': { normal: { min: 0, max: 200 }, warning: { min: 200, max: 240 } },
      'HDL콜레스테롤': { normal: { min: 40, max: 999 }, warning: { min: 35, max: 40 } },
      'LDL콜레스테롤': { normal: { min: 0, max: 130 }, warning: { min: 130, max: 160 } },
      '중성지방': { normal: { min: 0, max: 150 }, warning: { min: 150, max: 200 } },
      '헤모글로빈': { normal: { min: 12, max: 17 }, warning: { min: 10, max: 12 } }
  };
  return rangeMap[metric] || null;
};

// 발견사항 차트 섹션 컴포넌트 (Hooks 규칙 준수)
const FindingChartSection: React.FC<{
  category: string;
  healthData: any[];
  finding?: any;
}> = ({ category, healthData, finding }) => {
  const targetMetrics = getMetricsForInsight(category);
  const [currentMetricIndex, setCurrentMetricIndex] = useState(0);
  const currentMetric = targetMetrics[currentMetricIndex];
  const chartData = createChartDataForMetric(currentMetric, healthData);
  const healthRanges = getHealthRangesForMetric(currentMetric);
  
  if (!chartData || chartData[0].data.length === 0) {
    return (
      <div className="detail-section">
        <h6>{category} 추이 차트</h6>
        <div className="finding-chart-container">
          <div className="chart-no-data">
            <p>해당 지표의 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }
  
  const latestValue = chartData[0].data[chartData[0].data.length - 1]?.value || 0;
  
  return (
    <div className="detail-section">
      <h6>{category} 추이 차트</h6>
      
      {/* 차트 설명을 제목 바로 아래로 이동 */}
      {finding?.chartExplanation && (
        <div className="chart-explanation">
          <p>{finding.chartExplanation}</p>
        </div>
      )}
      
      <div className="finding-chart-container">
        <div className="finding-chart-slider">
          {/* 다중 지표 네비게이션 */}
          {targetMetrics.length > 1 && (
            <div className="metric-tabs">
              {targetMetrics.map((metric, index) => (
                <button
                  key={metric}
                  className={`metric-tab ${index === currentMetricIndex ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation(); // 이벤트 버블링 방지
                    setCurrentMetricIndex(index);
                  }}
                >
                  {metric}
                </button>
              ))}
            </div>
          )}
          
          {/* 차트 */}
          <div className="finding-chart">
            <LineChart 
              series={chartData}
              width={280}
              height={150}
              healthRanges={healthRanges}
            />
          </div>
          
          {/* GPT 추이 분석 */}
          <TrendAnalysisSection 
            currentMetric={currentMetric}
            finding={finding}
          />
        </div>
      </div>
    </div>
  );
};

// 추이 분석 섹션 컴포넌트 (통합 응답 사용)
const TrendAnalysisSection: React.FC<{
  currentMetric: string;
  finding: any;
}> = ({ currentMetric, finding }) => {
  // 통합 응답에서 추이 분석 가져오기
  const getTrendAnalysis = (metric: string, finding: any): string => {
    if (finding?.trendAnalysis) {
      // 메트릭에 따른 분석 매핑
      const metricMap: { [key: string]: string } = {
        'BMI': finding.trendAnalysis.BMI || finding.trendAnalysis['체질량지수'],
        '체질량지수': finding.trendAnalysis.BMI || finding.trendAnalysis['체질량지수'],
        '허리둘레': finding.trendAnalysis['허리둘레'] || finding.trendAnalysis.BMI,
        '수축기혈압': finding.trendAnalysis['혈압'] || finding.trendAnalysis['심혈관'],
        '이완기혈압': finding.trendAnalysis['혈압'] || finding.trendAnalysis['심혈관'],
        '공복혈당': finding.trendAnalysis['혈당'] || finding.trendAnalysis['당뇨'],
        '총콜레스테롤': finding.trendAnalysis['콜레스테롤'] || finding.trendAnalysis['지질'],
        'HDL콜레스테롤': finding.trendAnalysis['콜레스테롤'] || finding.trendAnalysis['지질'],
        'LDL콜레스테롤': finding.trendAnalysis['콜레스테롤'] || finding.trendAnalysis['지질'],
        '중성지방': finding.trendAnalysis['콜레스테롤'] || finding.trendAnalysis['지질'],
        '헤모글로빈': finding.trendAnalysis['혈액'] || finding.trendAnalysis['헤모글로빈']
      };
      
      return metricMap[metric] || `${metric} 지표의 추이를 분석한 결과, 정상 범위 대비 현재 상태를 확인할 수 있습니다.`;
    }
    
    return `${metric} 지표의 정상 범위 대비 현재 상태를 분석한 결과입니다.`;
  };
  
  const analysis = getTrendAnalysis(currentMetric, finding);
  
  return (
    <div className="trend-analysis">
      <h6>상세 분석</h6>
      <div className="analysis-content">
        <p>{analysis}</p>
      </div>
    </div>
  );
};

// analyzeTrend 함수 제거 - 통합 응답 사용으로 더 이상 필요 없음

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
        gradeEvidence: analysis.structuredSummary.gradeEvidence ? {
          koreanStandard: analysis.structuredSummary.gradeEvidence.koreanStandard || '',
          reasoning: analysis.structuredSummary.gradeEvidence.reasoning || '',
          dataPoints: analysis.structuredSummary.gradeEvidence.dataPoints || []
        } : undefined,
        analysisDate: analysis.structuredSummary.analysisDate || '분석 일자 없음',
        dataRange: analysis.structuredSummary.dataRange || '데이터 범위 없음',
        keyFindings: analysis.structuredSummary.keyFindings?.map((finding: any) => ({
          category: finding.category || '',
          status: finding.status || 'good',
          title: finding.title || '',
          description: finding.description || '',
          dataEvidence: finding.dataEvidence ? {
            checkupDate: finding.dataEvidence.checkupDate || '',
            actualValues: finding.dataEvidence.actualValues || '',
            koreanNorm: finding.dataEvidence.koreanNorm || '',
            academicSource: finding.dataEvidence.academicSource || ''
          } : undefined,
          trendAnalysis: finding.trendAnalysis || {},
          chartExplanation: finding.chartExplanation || ''
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
      } : undefined,
      // 새로 추가된 백엔드 필드들 매핑
      yearlyMedicationAnalysis: analysis.yearlyMedicationAnalysis || [],
      improvementRecommendations: analysis.improvementRecommendations || [],
      recheckSchedule: analysis.recheckSchedule || []
    };
  };

  // 데이터 기반 순환 메시지 배열 - 캐주얼한 톤
  const getRotatingMessages = () => {
    const healthCount = healthData?.length || 0;
    const prescriptionCount = prescriptionData?.length || 0;
    const patientName = patientInfo?.name || '환자';
    
    return [
      `${patientName}님의 건강검진 데이터 ${healthCount}건을 분석하고 있어요`,
      `처방전 데이터 ${prescriptionCount}건을 검토하고 있어요`,
      '건강 지표들의 변화 추이를 파악하고 있어요',
      '약물 상호작용과 부작용을 체크하고 있어요',
      '개인 맞춤 영양 가이드를 준비하고 있어요',
      'AI가 종합적인 건강 분석을 수행하고 있어요',
      '개인화된 건강 인사이트를 생성하고 있어요'
    ];
  };

  // GPT 분석 요청 함수
  const analyzeHealthData = useCallback(async () => {
    console.log('🚀 [AI분석] analyzeHealthData 함수 시작');
    console.log('🔍 [AI분석] 입력 데이터:', { healthData: healthData?.length, prescriptionData: prescriptionData?.length });
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);
    setCurrentMessageIndex(0);

    // 메시지 순환 타이머 시작
    const messages = getRotatingMessages();
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % messages.length);
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
    <section className="analysis-card ai-analysis-section">
      <div className="card-header">
        <h2 className="section-title">AI 종합 분석 결과</h2>
        <div className="chart-info">
          <span className="info-text">GPT-4 기반 분석</span>
        </div>
      </div>
      
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
                src={WELLO_LOGO_IMAGE}
                alt="분석 중" 
                className="wello-icon-blink"
              />
            </div>
            <div className="progress-info">
              <p className="progress-step">{getRotatingMessages()[currentMessageIndex]}</p>
              <div className="progress-description">
                <p>GPT-4 기반 AI가 개인 맞춤 분석을 진행합니다</p>
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
            <div className="ai-sub-content structured-summary-container">
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

                  {/* 주요 발견사항 (고도화) */}
                  {gptAnalysis.structuredSummary.keyFindings.length > 0 && (
                    <div className="key-findings-section">
                      <h4 className="section-subtitle">주요 발견사항</h4>
                      <div className="findings-grid">
                        {gptAnalysis.structuredSummary.keyFindings.map((finding, index) => (
                          <div 
                            key={index} 
                            className={`finding-card ${finding.status} enhanced clickable`}
                            onClick={() => {
                              // 상세 정보 모달 또는 확장 영역 표시
                              const detailsElement = document.getElementById(`finding-details-${index}`);
                              if (detailsElement) {
                                detailsElement.style.display = detailsElement.style.display === 'none' ? 'block' : 'none';
                              }
                              
                              // 관련 차트로 스크롤 (예: 해당 지표의 HealthJourneyChartSlider)
                              if (finding.category) {
                                const chartSection = document.querySelector('.health-journey-chart-slider');
                                if (chartSection) {
                                  chartSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }
                            }}
                          >
                            <div className="finding-header">
                              <div className="finding-title-group">
                                <span className="finding-category">{finding.category}</span>
                              <span className="finding-title">{finding.title}</span>
                              </div>
                              <div className="finding-indicators">
                              <span className={`status-indicator ${finding.status}`}>
                                {finding.status === 'good' ? '정상' : 
                                 finding.status === 'warning' ? '주의' : '위험'}
                              </span>
                                <span className="expand-icon">▼</span>
                              </div>
                            </div>
                            <p className="finding-description">{finding.description}</p>
                            
                            {/* 상세 정보 확장 영역 */}
                            <div id={`finding-details-${index}`} className="finding-details" style={{ display: 'none' }}>
                              <div className="details-content">
                                <div className="detail-section">
                                  <h6>상세 분석</h6>
                                  <p>{finding.description}</p>
                                  
                                  {/* GPT 데이터 근거 표시 */}
                                  {finding.dataEvidence && (
                                    <div className="data-evidence">
                                      <h6>검진 근거</h6>
                                      <ul>
                                        <li><strong>검진일:</strong> {finding.dataEvidence.checkupDate}</li>
                                        <li><strong>실제 수치:</strong> {finding.dataEvidence.actualValues}</li>
                                        <li><strong>한국인 기준:</strong> {finding.dataEvidence.koreanNorm}</li>
                                        <li><strong>학술 근거:</strong> {finding.dataEvidence.academicSource}</li>
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="detail-section">
                                  <h6>권장 조치</h6>
                                  <ul>
                                    {finding.status === 'good' ? (
                                      <>
                                        <li>현재 상태를 유지하세요</li>
                                        <li>정기적인 검진을 받으세요</li>
                                        <li>건강한 생활습관을 지속하세요</li>
                                      </>
                                    ) : finding.status === 'warning' ? (
                                      <>
                                        <li>생활습관 개선이 필요합니다</li>
                                        <li>정기적인 모니터링을 하세요</li>
                                        <li>의사와 상담을 고려해보세요</li>
                                      </>
                                    ) : (
                                      <>
                                        <li>즉시 의료진과 상담하세요</li>
                                        <li>추가 검사가 필요할 수 있습니다</li>
                                        <li>치료 계획을 수립하세요</li>
                                      </>
                                    )}
                                  </ul>
                                </div>
                                
                        <FindingChartSection 
                          category={finding.category} 
                          healthData={healthData}
                          finding={finding}
                        />
                              </div>
                            </div>
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
                  
                  {/* 등급 근거 보기 - 카드 하단에 배치 */}
                  {gptAnalysis.structuredSummary.gradeEvidence && (
                    <div className="grade-evidence-bottom">
                      <div className="evidence-toggle" onClick={() => {
                        const evidenceEl = document.getElementById('grade-evidence-detail-bottom');
                        if (evidenceEl) {
                          evidenceEl.style.display = evidenceEl.style.display === 'none' ? 'block' : 'none';
                        }
                      }}>
                        <span>등급 근거 보기</span>
                        <span className="toggle-icon">▼</span>
                      </div>
                      <div id="grade-evidence-detail-bottom" className="evidence-detail" style={{ display: 'none' }}>
                        <div className="evidence-section">
                          <h6>한국인 기준</h6>
                          <p>{gptAnalysis.structuredSummary.gradeEvidence.koreanStandard}</p>
                        </div>
                        <div className="evidence-section">
                          <h6>판단 근거</h6>
                          <p>{gptAnalysis.structuredSummary.gradeEvidence.reasoning}</p>
                        </div>
                        {gptAnalysis.structuredSummary.gradeEvidence.dataPoints && (
                          <div className="evidence-section">
                            <h6>검진 데이터 근거</h6>
                            <ul>
                              {gptAnalysis.structuredSummary.gradeEvidence.dataPoints.map((point: string, idx: number) => (
                                <li key={idx}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="summary-text">{gptAnalysis.summary}</p>
              )}
              
              {/* 주요 지표 변화 슬라이더는 별도 건강 여정 섹션에서 처리 */}
            </div>
          </div>

          {/* 건강 여정 타임라인 - 2번째로 이동 */}
          <div className="ai-simple-section">
            <div className="simple-section-header" onClick={() => toggleSection('healthJourney')} style={{ cursor: 'pointer' }}>
              <h3 className="simple-section-title">건강 여정 타임라인</h3>
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
                  {/* 새로운 타임라인 디자인 */}
                  <div className="health-timeline-container">
                    {generateHealthTimeline(healthData, prescriptionData)}
                  </div>

                  {/* 주요 지표 변화 슬라이더 (근거 데이터 통합) */}
                  <div className="health-journey-charts with-evidence">
                    <div className="charts-header">
                    <h4 className="charts-title">주요 건강 지표 변화</h4>
                      <div className="evidence-info">
                        <div className="data-source">
                          <span className="source-icon"></span>
                          <div className="source-details">
                            <span className="source-label">데이터 기준</span>
                            <span className="source-value">
                              {healthData && healthData.length > 0 ? 
                                `${healthData.length}회 검진 결과 (${healthData[healthData.length - 1]?.CheckUpDate?.substring(0, 4) || '최근'} ~ ${healthData[0]?.CheckUpDate?.substring(0, 4) || '과거'})` :
                                '건강검진 데이터 기반'
                              }
                            </span>
                  </div>
                        </div>
                        <div className="reference-standards">
                          <span className="standards-icon"></span>
                          <div className="standards-details">
                            <span className="standards-label">참고 기준</span>
                            <span className="standards-value">국민건강보험공단 건강검진 기준</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* 건강 여정 차트 슬라이더 제거 - 주요 발견사항에서 직접 차트 표시 */}
                    
                    {/* 변화율 요약 - 슬라이더 하단에 통합 */}
                    <div className="change-rate-summary integrated">
                      <h5 className="summary-title">주요 변화율 요약</h5>
                      <div className="change-rate-grid compact">
                        {gptAnalysis.healthJourney?.keyMilestones?.flatMap(m => m.keyChanges || []).slice(0, 6).map((change, index) => {
                          // 변화율 계산
                          const prevValue = parseFloat(change.previousValue?.replace(/[^0-9.]/g, '') || '0');
                          const currentValue = parseFloat(change.currentValue?.replace(/[^0-9.]/g, '') || '0');
                          const changeRate = prevValue > 0 ? ((currentValue - prevValue) / prevValue * 100).toFixed(1) : '0';
                          
                          return (
                            <div key={`change-rate-${change.metric}-${index}`} className={`change-rate-item compact ${change.changeType}`}>
                              <div className="rate-header">
                                <span className="rate-metric">{change.metric}</span>
                                <span className={`rate-badge ${change.changeType}`}>
                                  {change.changeType === 'improved' ? '개선' : change.changeType === 'worsened' ? '악화' : '유지'}
                                  {Math.abs(parseFloat(changeRate))}%
                                </span>
                              </div>
                              <div className="rate-comparison">
                                <span className="rate-from">{change.previousValue}</span>
                                <span className="rate-arrow">→</span>
                                <span className="rate-to">{change.currentValue}</span>
                              </div>
                            </div>
                          );
                        }) || []}
                      </div>
                    </div>
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
                        {(gptAnalysis.yearlyMedicationAnalysis || []).map((yearData: any, index: number) => (
                          <div key={yearData.year} className="yearly-medication-card">
                            <div className="year-header">
                              <h5 className="year-title">{yearData.period || `${yearData.year}년`}</h5>
                              <div className="year-stats">
                                <span className="stat-item">
                                  <span className="stat-label">약물</span>
                                  <span className="stat-value">{yearData.medications?.length || 0}종</span>
                          </span>
                              </div>
                        </div>
                        
                            <div className="medications-list">
                              {(yearData.medications || []).map((med: any, medIndex: number) => (
                                <div key={medIndex} className="medication-item">
                                  <div className="medication-info">
                                    <span className="medication-name">{med.name}</span>
                                    <span className="medication-frequency">{med.frequency}</span>
                                  </div>
                                  <div className="medication-details">
                                    <span className="medication-effect">{med.purpose}</span>
                                    <span className="medication-duration">{med.status}</span>
                                  </div>
                                </div>
                            ))}
                          </div>
                            
                            {/* 분석 및 주의사항 */}
                            <div className="medication-analysis">
                              <p className="analysis-text">{yearData.analysis}</p>
                              {yearData.cautions && yearData.cautions.length > 0 && (
                                <div className="cautions-list">
                                  <div className="cautions-header">
                                    <span className="warning-icon"></span>
                                    <span className="warning-title">주의사항</span>
                                  </div>
                                  {yearData.cautions.map((caution: string, cautionIndex: number) => (
                                    <div key={cautionIndex} className="caution-item">
                                      <span className="caution-text">{caution}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                      {/* 년도별 슬라이더 닷 네비게이션 */}
                      {(gptAnalysis.yearlyMedicationAnalysis || []).length > 1 && (
                        <div className="yearly-slider-dots">
                          {(gptAnalysis.yearlyMedicationAnalysis || []).map((_: any, index: number) => (
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
                    
                    {/* 종합 약물 상호작용 분석 (고도화 + 근거 데이터) */}
                    <div className="comprehensive-interactions-section with-evidence">
                      <div className="section-header-with-evidence">
                        <h4 className="section-subtitle">종합 약물 상호작용 분석</h4>
                        <div className="evidence-metadata">
                          <div className="analysis-basis">
                            <span className="basis-icon"></span>
                            <div className="basis-details">
                              <span className="basis-label">분석 기준</span>
                              <span className="basis-value">
                                {prescriptionData && prescriptionData.length > 0 ? 
                                  `최근 ${prescriptionData.length}건 처방 데이터 (${prescriptionData[0]?.JinRyoGaesiIl ? prescriptionData[0].JinRyoGaesiIl.substring(0, 4) : '최근'}년 기준)` : 
                                  '처방전 데이터 없음'
                                }
                              </span>
                            </div>
                          </div>
                          <div className="analysis-period">
                            <span className="period-icon"></span>
                            <div className="period-details">
                              <span className="period-label">분석 시점</span>
                              <span className="period-value">
                                {prescriptionData && prescriptionData.length > 0 ? 
                                  `${prescriptionData[prescriptionData.length - 1]?.JinRyoGaesiIl || '과거'} ~ ${prescriptionData[0]?.JinRyoGaesiIl || '최근'}` :
                                  '데이터 없음'
                                }
                              </span>
                            </div>
                          </div>
                          <div className="reference-database">
                            <span className="database-icon"></span>
                            <div className="database-details">
                              <span className="database-label">Evidence 출처</span>
                              <span className="database-value">FDA 약물상호작용 DB + 국내 의약품안전관리원</span>
                            </div>
                          </div>
                          <div className="update-info">
                            <span className="update-icon">🔄</span>
                            <div className="update-details">
                              <span className="update-label">업데이트</span>
                              <span className="update-value">
                                {new Date().toLocaleDateString('ko-KR')} 기준
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="interactions-summary">
                        {(gptAnalysis.drugInteractions || []).map((interaction: any, index: number) => (
                          <div key={index} className={`interaction-summary-card ${interaction.severity} enhanced`}>
                            <div className="interaction-header">
                              <div className="severity-indicator">
                                <span className={`severity-badge ${interaction.severity}`}>
                                  {interaction.severity === 'high' ? '높음' : 
                                   interaction.severity === 'medium' ? '보통' : '낮음'}
                                </span>
                                <span className="category-badge">{interaction.category}</span>
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
                              
                              <div className="interaction-details">
                                <div className="interaction-effect">
                                  <h5 className="detail-title">예상 효과</h5>
                                  <p>{interaction.effect}</p>
                                </div>
                                
                                {interaction.mechanism && (
                                  <div className="interaction-mechanism">
                                    <h5 className="detail-title">작용 기전</h5>
                                    <p>{interaction.mechanism}</p>
                </div>
              )}
                                
                                <div className="interaction-recommendation">
                                  <h5 className="detail-title">권장사항</h5>
                                  <p>{interaction.recommendation}</p>
                                </div>
                                
                                {interaction.monitoring && (
                                  <div className="interaction-monitoring">
                                    <h5 className="detail-title">모니터링</h5>
                                    <p>{interaction.monitoring}</p>
            </div>
          )}
                              </div>
                            </div>
                            
                            <div className="interaction-metadata">
                              <div className="metadata-item">
                                <span className="metadata-label">발현 시간:</span>
                                <span className="metadata-value">{interaction.timeToOnset}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">임상적 중요도:</span>
                                <span className="metadata-value">{interaction.clinicalSignificance}</span>
                              </div>
                              <div className="metadata-item">
                                <span className="metadata-label">동시 복용 기간:</span>
                                <span className="metadata-value">{interaction.overlapDuration}</span>
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

          {/* 맞춤 영양 권장사항 티저 */}
          {(gptAnalysis.nutritionRecommendations && gptAnalysis.nutritionRecommendations.length > 0) && (
            <div className="ai-simple-section nutrition-teaser">
              <div className="simple-section-header">
                <h3 className="simple-section-title">맞춤 영양 권장사항</h3>
                <span className="teaser-badge">미리보기</span>
              </div>
              <div className="simple-section-content">
                <div className="nutrition-teaser-content">
                  <div className="teaser-summary">
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-number">
                          {gptAnalysis.nutritionRecommendations.filter(item => item.category === '추천 식품').length}
                        </span>
                        <span className="stat-label">추천 식품</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-number">
                          {gptAnalysis.nutritionRecommendations.filter(item => item.category === '피해야 할 식품').length}
                        </span>
                        <span className="stat-label">주의 식품</span>
                      </div>
                    </div>
                    
                    <div className="teaser-preview">
                      <div className="preview-items">
                        {gptAnalysis.nutritionRecommendations.slice(0, 3).map((item, index) => (
                          <div key={index} className={`preview-item ${item.category === '추천 식품' ? 'recommend' : 'avoid'}`}>
                            <span className="item-name">{item.foods[0]}</span>
                            <span className={`item-type ${item.category === '추천 식품' ? 'recommend' : 'avoid'}`}>
                              {item.category === '추천 식품' ? '추천' : '주의'}
                            </span>
                          </div>
                        ))}
                        {gptAnalysis.nutritionRecommendations.length > 3 && (
                          <div className="preview-more">
                            +{gptAnalysis.nutritionRecommendations.length - 3}개 더
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="teaser-cta">
                    <div className="cta-message">
                      <h4>상세한 맞춤 영양 가이드가 필요하신가요?</h4>
                      <p>개인별 건강 상태와 생활 패턴을 고려한 정확한 영양 권장사항을 받아보세요.</p>
                    </div>
                    <button className="cta-button" onClick={() => {
                      // 문진 페이지로 이동 또는 문진 모달 열기
                      alert('문진을 통해 더 정확한 맞춤 영양 가이드를 제공받을 수 있습니다.');
                    }}>
                      문진하고 상세 가이드 받기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 기존 상세 영양 권장사항은 숨김 처리 */}
          {false && (gptAnalysis?.nutritionRecommendations && (gptAnalysis?.nutritionRecommendations?.length || 0) > 0) && (
            <div className="ai-simple-section" style={{ display: 'none' }}>
              <div className="simple-section-header" onClick={() => toggleSection('nutritionRecommendations')} style={{ cursor: 'pointer' }}>
                <h3 className="simple-section-title">맞춤 영양 권장사항 (상세)</h3>
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
                  <div className="nutrition-slider-container">
                    <div className="nutrition-cards-slider">
                      {(gptAnalysis?.nutritionRecommendations || []).map((item, index) => (
                        <div key={index} className={`nutrition-card ${item.category === '추천 식품' ? 'recommend' : 'avoid'}`}>
                          <div className="nutrition-card-header">
                            <div className="category-indicator">
                              <span className={`category-icon ${item.category === '추천 식품' ? 'recommend' : 'avoid'}`}>
                                {item.category === '추천 식품' ? '추천' : '주의'}
                                  </span>
                              <span className="category-label">
                                {item.category === '추천 식품' ? '추천' : '주의'}
                              </span>
                      </div>
                    </div>

                          <div className="nutrition-card-content">
                              <div className="nutrition-foods">
                                {item.foods?.map((food, foodIndex) => (
                                <span key={foodIndex} className={`food-tag ${item.category === '추천 식품' ? 'recommend' : 'avoid'}`}>
                                    {food}
                                  </span>
                                ))}
                              </div>
                            
                            <div className="nutrition-reason">
                              <h5 className="reason-title">
                                {item.category === '추천 식품' ? '추천 이유' : '주의 이유'}
                              </h5>
                              <p>{item.reason}</p>
                            </div>
                            
                            {/* 추가 정보 */}
                            <div className="nutrition-tips">
                              {item.category === '추천 식품' ? (
                                <div className="recommend-tips">
                                  <h6>섭취 팁</h6>
                                  <ul>
                                    <li>하루 권장량을 지켜주세요</li>
                                    <li>다양한 조리법으로 섭취하세요</li>
                                    <li>신선한 상태로 드세요</li>
                                  </ul>
                                </div>
                              ) : (
                                <div className="avoid-tips">
                                  <h6>대체 방법</h6>
                                  <ul>
                                    <li>섭취량을 줄이거나 피해주세요</li>
                                    <li>건강한 대체 식품을 찾아보세요</li>
                                    <li>의사와 상담 후 조절하세요</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                            </div>
                          ))}
                      </div>
                    
                    {/* 슬라이더 네비게이션 */}
                    {(gptAnalysis?.nutritionRecommendations?.length || 0) > 1 && (
                      <div className="nutrition-slider-dots">
                        {(gptAnalysis?.nutritionRecommendations || []).map((_, index) => (
                          <button
                            key={index}
                            className={`slider-dot compact ${index === 0 ? 'active' : ''}`}
                            onClick={() => {
                              const slider = document.querySelector('.nutrition-cards-slider') as HTMLElement;
                              if (slider) {
                                const cardWidth = slider.querySelector('.nutrition-card')?.clientWidth || 0;
                                const gap = 16;
                                slider.scrollTo({
                                  left: (cardWidth + gap) * index,
                                  behavior: 'smooth'
                                });
                                // 활성 닷 업데이트
                                document.querySelectorAll('.nutrition-slider-dots .slider-dot').forEach((dot, i) => {
                                  dot.classList.toggle('active', i === index);
                                });
                              }
                            }}
                            aria-label={`${index + 1}번째 영양 권장사항으로 이동`}
                          />
                        ))}
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


        </section>
      )}

      {/* 개선 권장사항 섹션 - 숨김 처리 */}
      {false && (healthData && healthData.length > 0) && (
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
                    {(gptAnalysis?.improvementRecommendations || []).map((goal: any, index: number) => (
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
                              <span className="metric-label">{goal.currentState?.label || '현재'}</span>
                              <span className="metric-value current">{goal.currentState?.value || 'N/A'}</span>
                            </div>
                            <div className="goal-arrow">→</div>
                            <div className="target-state">
                              <span className="metric-label">{goal.targetState?.label || '목표'}</span>
                              <span className="metric-value target">{goal.targetState?.value || 'N/A'}</span>
                            </div>
                          </div>
                          
                          {/* 에비던스 정보 */}
                          <div className="evidence-info">
                            <div className="evidence-header">
                              <span className="evidence-icon"></span>
                              <span className="evidence-title">{goal.evidence?.title || '근거'}</span>
                            </div>
                            <p className="evidence-description">{goal.evidence?.description || ''}</p>
                            <div className="evidence-source">
                              <span className="source-label">출처:</span>
                              <span className="source-value">{goal.evidence?.source || ''}</span>
                            </div>
                          </div>
                          
                          {/* 실행 계획 */}
                          <div className="action-plan">
                            <h6 className="action-title">{goal.actionPlan?.title || '실행 계획'}</h6>
                            <ul className="action-steps">
                              {(goal.actionPlan?.steps || []).map((step: string, stepIndex: number) => (
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
                              <span className="outcome-icon"></span>
                              <span className="outcome-title">{goal.expectedOutcome?.title || '예상 효과'}</span>
                    </div>
                            <p className="outcome-description">{goal.expectedOutcome?.description || ''}</p>
                  </div>
                </div>
            </div>
                    ))}
                  </div>
                </div>
                
                {/* 재검 일정 섹션 */}
                {(gptAnalysis?.recheckSchedule && (gptAnalysis?.recheckSchedule?.length || 0) > 0) ? (
                  <div className="recheck-schedule-section">
                    <h4 className="section-subtitle">맞춤 재검 일정</h4>
                    <div className="schedule-timeline">
                    {(gptAnalysis?.recheckSchedule || []).map((schedule: any, index: number) => (
                      <div key={index} className={`schedule-item ${schedule.urgency}`}>
                        <div className="schedule-timeline-marker">
                          <div className={`timeline-dot ${schedule.urgency}`}></div>
                          {index < (gptAnalysis?.recheckSchedule || []).length - 1 && (
                            <div className="timeline-line"></div>
                          )}
                        </div>
                        
                        <div className="schedule-content">
                          <div className="schedule-header">
                            <div className="schedule-date">
                              <span className="date-icon"></span>
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
                ) : (
                  <div className="recheck-schedule-section">
                    <h4 className="section-subtitle">맞춤 재검 일정</h4>
                    <div className="no-schedule-message">
                      <p>현재 추가적인 재검 일정이 필요하지 않습니다. 정기적인 건강검진을 지속해주세요.</p>
                    </div>
                  </div>
                )}
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
    </section>
  );
};

export default AIAnalysisSection;
