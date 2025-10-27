/**
 * AI 분석 섹션 컴포넌트
 * ComprehensiveAnalysisPage에서 AI 분석 관련 섹션만 추출
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WelloIndexedDB } from '../../../services/WelloIndexedDB';
import { WELLO_API } from '../../../constants/api';
import HealthJourneyChartSlider from './HealthJourneyChartSlider';
import { TilkoHealthCheckupRaw, TilkoPrescriptionRaw } from '../../../types/health';
import './styles.scss';

interface HealthInsight {
  category: string;
  status: 'good' | 'warning' | 'danger';
  message: string;
  recommendation?: string;
}

interface DrugInteraction {
  drugs: string[];
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

interface NutritionRecommendation {
  category: string;
  foods: string[];
  reason: string;
}

interface GPTAnalysisResult {
  summary?: string;
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
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
    healthJourney: false,
    yearlyAnalysis: false
  });

  // 섹션 토글 함수
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Mock 분석 결과 (개발용)
  const getMockAnalysisResult = (): GPTAnalysisResult => ({
    summary: "전반적으로 건강한 상태를 유지하고 계시며, 일부 지표에서 개선의 여지가 있습니다. 정기적인 건강관리와 생활습관 개선을 통해 더욱 건강한 상태를 유지하실 수 있습니다.",
    insights: [
      {
        category: "심혈관 건강",
        status: "warning",
        message: "혈압과 콜레스테롤 수치가 경계선에 있습니다.",
        recommendation: "저염식 식단과 규칙적인 유산소 운동을 권장합니다."
      },
      {
        category: "대사 건강",
        status: "good",
        message: "혈당과 BMI가 정상 범위 내에 있습니다.",
        recommendation: "현재 상태를 유지하시기 바랍니다."
      },
      {
        category: "간 기능",
        status: "good",
        message: "간 기능 지표들이 모두 정상 범위입니다."
      }
    ],
    drugInteractions: [
      {
        drugs: ["아스피린", "와파린"],
        severity: "moderate",
        description: "출혈 위험이 증가할 수 있습니다. 의사와 상의하세요."
      }
    ],
    nutritionRecommendations: [
      {
        category: "심혈관 건강",
        foods: ["연어", "견과류", "올리브오일", "아보카도"],
        reason: "오메가-3 지방산이 풍부하여 심혈관 건강에 도움이 됩니다."
      },
      {
        category: "항산화",
        foods: ["블루베리", "시금치", "브로콜리", "토마토"],
        reason: "항산화 성분이 풍부하여 세포 손상을 방지합니다."
      }
    ]
  });

  // GPT 분석 요청 함수
  const analyzeHealthData = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);

    try {
      // 진행률 시뮬레이션
      const progressSteps = [
        { progress: 20, step: '건강 데이터 수집 중...' },
        { progress: 40, step: '처방전 데이터 분석 중...' },
        { progress: 60, step: 'AI 분석 진행 중...' },
        { progress: 80, step: '결과 생성 중...' },
        { progress: 100, step: '분석 완료!' }
      ];

      for (const { progress, step } of progressSteps) {
        setAnalysisProgress(progress);
        setAnalysisStep(step);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // 실제 API 호출 (현재는 Mock 데이터 사용)
      const mockResult = getMockAnalysisResult();
      setGptAnalysis(mockResult);

      // localStorage에 분석 결과 저장
      localStorage.setItem('gpt_analysis_result', JSON.stringify(mockResult));

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
      setError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // 🔧 자동 분석 시작 이벤트 핸들러
  const handleStartAnalysis = useCallback(() => {
    console.log('🚀 [AI분석] 자동 분석 시작 요청 받음');
    if (!gptAnalysis && !isAnalyzing) {
      analyzeHealthData();
    }
  }, [gptAnalysis, isAnalyzing, analyzeHealthData]);

  // 컴포넌트 마운트 시 기존 분석 결과 로드
  useEffect(() => {
    const savedAnalysis = localStorage.getItem('gpt_analysis_result');
    if (savedAnalysis) {
      try {
        setGptAnalysis(JSON.parse(savedAnalysis));
      } catch (error) {
        console.error('저장된 분석 결과 로드 실패:', error);
      }
    }
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
                      src="/wello/wello-icon.png" 
                      alt="분석 중" 
                      className="spinner-icon"
                    />
                  </div>
                  분석 중...
                </>
              ) : (
                <>
                  🔍 AI 분석 시작
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
                src="/wello/wello-icon.png" 
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
              <p className="progress-step">{analysisStep}</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>
              <p className="progress-percent">{analysisProgress}%</p>
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
              <p className="summary-text">{gptAnalysis.summary}</p>
            </div>
          </div>
          
          {/* 주요 건강 지표 분석 카드 */}
          <div className="ai-sub-card">
            <div className="ai-sub-header">
              <h3 className="ai-sub-title">주요 건강 지표 분석</h3>
            </div>
            <div className="ai-sub-content">
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

          {/* 약물 상호작용 카드 */}
          {(gptAnalysis.drugInteractions && gptAnalysis.drugInteractions.length > 0) && (
            <div className="ai-sub-card">
              <div className="ai-sub-header">
                <h3 className="ai-sub-title">약물 상호작용 주의사항</h3>
              </div>
              <div className="ai-sub-content">
                <div className="interactions-list">
                  {(gptAnalysis.drugInteractions || []).map((interaction, index) => (
                    <div key={index} className={`interaction-item ${interaction.severity}`}>
                      <div className="interaction-header">
                        <h4 className="interaction-drugs">{interaction.drugs.join(' + ')}</h4>
                        <span className={`severity-indicator ${interaction.severity}`}>
                          {interaction.severity === 'mild' ? '경미' : 
                           interaction.severity === 'moderate' ? '보통' : '심각'}
                        </span>
                      </div>
                      <p className="interaction-description">{interaction.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 영양 권장사항 카드 */}
          {(gptAnalysis.nutritionRecommendations && gptAnalysis.nutritionRecommendations.length > 0) && (
            <div className="ai-sub-card">
              <div className="ai-sub-header">
                <h3 className="ai-sub-title">맞춤 영양 권장사항</h3>
              </div>
              <div className="ai-sub-content">
                <div className="nutrition-grid">
                  {(gptAnalysis.nutritionRecommendations || []).map((nutrition, index) => (
                    <div key={index} className="nutrition-item">
                      <h4 className="nutrition-category">{nutrition.category}</h4>
                      <div className="nutrition-foods">
                        {nutrition.foods.map((food, foodIndex) => (
                          <span key={foodIndex} className="food-tag">{food}</span>
                        ))}
                      </div>
                      <p className="nutrition-reason">{nutrition.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 건강 여정 섹션 */}
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
                    
                    {/* 좋은 점과 나쁜 점 요약 */}
                    <div className="journey-overview">
                      <div className="overview-positive">
                        <h4>👍 긍정적 변화</h4>
                        <div className="positive-trends">
                          {/* 차트 슬라이더 - 개선된 지표들 */}
                          <HealthJourneyChartSlider
                            healthData={healthData}
                            keyChanges={gptAnalysis.healthJourney.keyMilestones?.flatMap(m => m.keyChanges?.filter(c => c.changeType === 'improved') || []) || []}
                          />
                        </div>
                      </div>
                      
                      <div className="overview-negative">
                        <h4>⚠️ 주의 필요 사항</h4>
                        <div className="negative-trends">
                          {/* 주의가 필요한 지표들 */}
                          {gptAnalysis.healthJourney.keyMilestones?.flatMap(m => 
                            m.keyChanges?.filter(c => c.changeType === 'worsened').map((change, index) => (
                              <div key={index} className="concern-item">
                                <span className="metric-name">{change.metric}</span>
                                <span className="change-detail">{change.previousValue} → {change.currentValue}</span>
                                <p className="significance">{change.significance}</p>
                              </div>
                            )) || []
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 년도별 상세 분석 - 타임라인 형식 */}
                  <div className="yearly-timeline">
                    <h4>📅 년도별 상세 분석</h4>
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
