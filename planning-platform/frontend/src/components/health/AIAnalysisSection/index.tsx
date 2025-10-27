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
    nutritionRecommendations: false
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
      summary: analysis.summary || '분서 결과를 불러올 수 없습니다.',
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

      // localStorage에 분석 결과 저장
      localStorage.setItem('gpt_analysis_result', JSON.stringify(convertedResult));

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

  // 컴포넌트 마운트 시 기존 분석 결과 로드 (구조화된 종합소견 적용을 위해 임시 비활성화)
  useEffect(() => {
    // localStorage 캐시를 사용하지 않고 항상 새로운 분석 실행
    console.log('🔍 [AI분석] localStorage 캐시 사용 안함 - 항상 새로운 분석 실행');
    localStorage.removeItem('gpt_analysis_result'); // 기존 캐시 제거
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
              
              {/* 주요 지표 변화 슬라이더 */}
              {gptAnalysis.healthJourney?.keyMilestones && (
                <div className="metrics-changes-section">
                  <h4 className="metrics-title">주요 지표 변화</h4>
                  <HealthJourneyChartSlider
                    healthData={healthData}
                    keyChanges={gptAnalysis.healthJourney.keyMilestones.flatMap(m => m.keyChanges || [])}
                  />
                </div>
              )}
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
                <div className="insights-grid">
                  {(gptAnalysis.insights || []).map((insight, index) => (
                    <div key={index} className={`insight-item ${insight.status}`}>
                      <div className="insight-header">
                        <h4 className="insight-category">{insight.category}</h4>
                        <span className={`status-indicator ${insight.status}`}>
                          {insight.status === 'good' ? '정상' : 
                           insight.status === 'warning' ? '주의' : '위험'}
                        </span>
                      </div>
                      
                      {/* 지표별 미니 차트 추가 */}
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
