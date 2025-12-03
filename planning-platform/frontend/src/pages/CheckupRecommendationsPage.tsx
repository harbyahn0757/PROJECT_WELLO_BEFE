import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import { getHospitalLogoUrl } from '../utils/hospitalLogoUtils';
import { WELLO_LOGO_IMAGE } from '../constants/images';
import checkPlannerImage from '../assets/images/check_planner.png';
import { renderTextWithFootnotes } from '../utils/footnoteParser';
import './MainPage.scss'; // MainPage 헤더 스타일 재사용
import './CheckupRecommendationsPage.scss';
import '../components/shared/BackButton/styles.scss'; // BackButton 스타일 재사용

// 목업 데이터 타입 정의
interface CheckupItem {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  reason?: string; // GPT 응답의 추천 이유 (각주 포함 가능)
  evidence?: string; // 의학적 근거 (각주 포함 가능)
  references?: string[]; // 참고 자료 링크 배열 (각주 번호 순서대로)
  recommended: boolean;
  difficulty_level?: 'Low' | 'Mid' | 'High'; // 난이도/비용
  difficulty_badge?: string; // 뱃지 텍스트 (부담없는, 추천, 프리미엄)
}

interface DoctorRecommendation {
  hasRecommendation: boolean;
  message: string;
  highlightedText?: string;
}

interface RecommendationCategory {
  categoryName: string;
  categoryNameEn?: string;
  itemCount: number;
  items: CheckupItem[];
  doctorRecommendation?: DoctorRecommendation;
  defaultExpanded: boolean;
  priorityLevel?: number; // 1, 2, 3
  priorityDescription?: string; // 우선순위 설명
}

interface PrioritySummary {
  past_results_summary?: string; // 과거 검진 결과 요약 (안 좋았던 항목 중심)
  survey_summary?: string; // 문진 내용 요약
  correlation_analysis?: string; // 과거 결과와 문진 내용의 연관성 분석 (추이를 봐야 할 항목)
  selected_concerns_context?: string; // 사용자가 선택한 항목의 맥락
  priority_1?: {
    title: string;
    description: string;
    items: string[];
    count: number;
    national_checkup_items?: string[]; // 일반검진 항목
    national_checkup_note?: string; // 일반검진 항목에 대한 설명
    focus_items?: Array<{ // 각 항목별 상세 정보 (basic_checkup_guide.focus_items와 동일한 형식)
      item_name: string;
      why_important: string;
      check_point: string;
    }>;
  };
  priority_2?: {
    title: string;
    description: string;
    items: string[];
    count: number;
    upselling_focus?: boolean; // 업셀링 위주 여부
    health_context?: string; // 건강 영역 맥락 (예: '심혈관 건강', '복부 장기 건강')
  };
  priority_3?: {
    title: string;
    description: string;
    items: string[];
    count: number;
    health_context?: string; // 건강 영역 맥락 (예: '심혈관 건강', '복부 장기 건강')
  };
}

interface RecommendationData {
  patientName: string;
  totalCount: number;
  categories: RecommendationCategory[];
  summary?: PrioritySummary;
}

// 목업 데이터
const mockRecommendationData: RecommendationData = {
  patientName: '안광수',
  totalCount: 5,
  categories: [
    {
      categoryName: '대장검사',
      categoryNameEn: 'Colonoscopy',
      itemCount: 3,
      defaultExpanded: true,
      items: [
        {
          id: 'colonoscopy-non-sedated',
          name: '대장내시경(비수면)',
          nameEn: 'Colonoscopy (non-sedated)',
          recommended: true,
        },
        {
          id: 'colonoscopy-sedated',
          name: '대장내시경(수면)',
          nameEn: 'Colonoscopy (sedated)',
          recommended: true,
        },
        {
          id: 'early-detection-test',
          name: '얼리텍 검사',
          nameEn: 'Early Detection Test',
          description: '분변 채취로 용종, 대장암을 확인 할 수 있는 검사',
          recommended: true,
        },
      ],
      doctorRecommendation: {
        hasRecommendation: true,
        message: '*안광수님은 과거 검진 결과, 대장검사에서 이상 소견이 보이고 추후 정밀검사를 필요로 할 수 있어 해당 검사를 추천드립니다!',
        highlightedText: '대장검사에서',
      },
    },
    {
      categoryName: 'CT 검사',
      categoryNameEn: 'CT Scan',
      itemCount: 2,
      defaultExpanded: false,
      items: [
        {
          id: 'ct-chest',
          name: '흉부 CT',
          nameEn: 'Chest CT',
          recommended: true,
        },
        {
          id: 'ct-abdomen',
          name: '복부 CT',
          nameEn: 'Abdomen CT',
          recommended: true,
        },
      ],
    },
    {
      categoryName: 'MRI 검사',
      categoryNameEn: 'MRI Scan',
      itemCount: 1,
      defaultExpanded: false,
      items: [
        {
          id: 'mri-brain',
          name: '뇌 MRI',
          nameEn: 'Brain MRI',
          recommended: true,
        },
      ],
    },
  ],
};

const CheckupRecommendationsPage: React.FC = () => {
  const { state } = useWelloData();
  const { patient, hospital } = state;
  const navigate = useNavigate();
  const location = useLocation();

  // GPT 응답 데이터 (location.state에서 받음)
  const gptResponse = location.state?.checkupDesign;
  const selectedConcerns = location.state?.selectedConcerns;
  const citations = gptResponse?._citations || []; // Perplexity citations
  const basicCheckupGuide = gptResponse?.basic_checkup_guide; // 기본 검진 가이드

  // 로딩 상태 관리 (GPT 응답이 없을 때만 로딩 표시)
  const [isLoading, setIsLoading] = useState(!gptResponse);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  // 로딩 메시지 단계
  const loadingMessages = [
    '검진 결과를 분석하고 있습니다...',
    '건강 상태에 맞는 검진 항목을 선별하고 있습니다...',
    '의사 추천 검진 계획을 수립하고 있습니다...',
    '맞춤형 검진 항목을 준비하고 있습니다...',
  ];

  // 헤더 높이 계산 및 CSS 변수 설정 (리사이즈 시 재계산)
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerSection = document.querySelector('.main-page__header-greeting-section');
      if (headerSection) {
        const height = headerSection.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    // 초기 계산
    updateHeaderHeight();

    // 리사이즈 시 재계산
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  // 로딩 시뮬레이션 (GPT 응답이 없을 때만)
  useEffect(() => {
    if (gptResponse) {
      // GPT 응답이 있으면 로딩 표시하지 않음
      setIsLoading(false);
      return;
    }

    let progress = 0;
    let messageIndex = 0;
    
    const loadingInterval = setInterval(() => {
      progress += 2;
      
      // 메시지 변경 (25%, 50%, 75% 지점)
      if (progress >= 25 && messageIndex === 0) {
        messageIndex = 1;
        setLoadingMessage(loadingMessages[1]);
      } else if (progress >= 50 && messageIndex === 1) {
        messageIndex = 2;
        setLoadingMessage(loadingMessages[2]);
      } else if (progress >= 75 && messageIndex === 2) {
        messageIndex = 3;
        setLoadingMessage(loadingMessages[3]);
      }
      
      setLoadingProgress(progress);
      
      if (progress >= 100) {
        clearInterval(loadingInterval);
        // 부드러운 종료를 위한 fade-out 애니메이션
        setIsFadingOut(true);
        setTimeout(() => {
          setIsLoading(false);
          setIsFadingOut(false);
        }, 500); // fade-out 애니메이션 시간
      }
    }, 50); // 50ms마다 2%씩 증가 (총 2.5초)

    // 초기 메시지 설정
    setLoadingMessage(loadingMessages[0]);

    return () => clearInterval(loadingInterval);
  }, [gptResponse]);

  // 헤더 텍스트에서 순위 관련 중복 텍스트 제거
  const removePriorityPrefix = (text: string): string => {
    if (!text) return text;
    // "1순위: ", "1순위 ", "2순위: ", "2순위 ", "3순위: ", "3순위 " 패턴 제거
    // "추가권고검진: ", "추가권고검진 ", "선택 추가 항목: ", "선택 추가 항목 " 패턴 제거
    return text
      .replace(/^1순위[:\s]+/i, '')
      .replace(/^2순위[:\s]+/i, '')
      .replace(/^3순위[:\s]+/i, '')
      .replace(/^추가권고검진[:\s]+/i, '')
      .replace(/^선택\s*추가\s*항목[:\s]+/i, '')
      .trim();
  };

  // 간호사 설명에서 불필요한 문구 제거
  const cleanNationalCheckupNote = (text: string): string => {
    if (!text) return text;
    // "일반검진 결과지를 확인하실 때 이 이유 때문에 잘 살펴보시길 바랍니다" 패턴 제거
    return text
      .replace(/일반검진\s*결과지를\s*확인하실\s*때[^.]*잘\s*살펴보시길\s*바랍니다[.\s]*/gi, '')
      .replace(/일반검진\s*결과지를\s*확인하실\s*때[^.]*잘\s*살펴보세요[.\s]*/gi, '')
      .trim();
  };

  // GPT 응답 데이터를 RecommendationData 형식으로 변환
  const convertGPTResponseToRecommendationData = (gptData: any): RecommendationData => {
    if (!gptData || !gptData.recommended_items) {
      // GPT 응답이 없으면 목업 데이터 사용
      return {
        ...mockRecommendationData,
        patientName: patient?.name || mockRecommendationData.patientName,
      };
    }

    const categories: RecommendationCategory[] = gptData.recommended_items.map((cat: any) => ({
      categoryName: cat.category || '기타',
      categoryNameEn: cat.category_en,
      itemCount: cat.itemCount || cat.items?.length || 0,
      priorityLevel: cat.priority_level, // 우선순위 레벨 추가
      priorityDescription: cat.priority_description, // 우선순위 설명 추가
      items: (cat.items || []).map((item: any, index: number) => ({
        id: `item-${cat.category}-${index}`,
        name: item.name || '',
        nameEn: item.nameEn || item.name_en,
        description: item.description,
        reason: item.reason, // 추천 이유
        evidence: item.evidence, // 의학적 근거
        references: item.references || [], // 참고 자료 (링크 또는 출처)
        recommended: item.recommended !== false, // 기본값 true
        difficulty_level: item.difficulty_level, // 난이도 레벨
        difficulty_badge: item.difficulty_badge, // 난이도 뱃지
      })),
      doctorRecommendation: cat.doctor_recommendation ? {
        hasRecommendation: cat.doctor_recommendation.has_recommendation !== false,
        message: cat.doctor_recommendation.message || '',
        highlightedText: cat.doctor_recommendation.highlighted_text || cat.doctor_recommendation.highlightedText,
      } : undefined,
      defaultExpanded: cat.defaultExpanded !== false, // 기본값 true
    }));

    // summary 객체 구성: gptData.summary가 있으면 사용하고, priority_1, priority_2, priority_3는 별도 필드에서 가져오기
    const summary = gptData.summary ? {
      ...gptData.summary,
      priority_1: gptData.priority_1 || gptData.summary.priority_1,
      priority_2: gptData.priority_2 || gptData.summary.priority_2,
      priority_3: gptData.priority_3 || gptData.summary.priority_3,
    } : (gptData.priority_1 || gptData.priority_2 || gptData.priority_3 ? {
      priority_1: gptData.priority_1,
      priority_2: gptData.priority_2,
      priority_3: gptData.priority_3,
    } : undefined);

    return {
      patientName: patient?.name || '환자',
      totalCount: gptData.total_count || categories.reduce((sum, cat) => sum + cat.itemCount, 0),
      categories,
      summary,
    };
  };

  // 추천 데이터 (GPT 응답 또는 목업 데이터) - useMemo로 메모이제이션
  const recommendationData: RecommendationData = useMemo(() => {
    return gptResponse
      ? convertGPTResponseToRecommendationData(gptResponse)
      : {
          ...mockRecommendationData,
          patientName: patient?.name || mockRecommendationData.patientName,
        };
  }, [gptResponse, patient?.name]);

  // 최종 설계 응답값 콘솔 로그 출력 (점검용)
  useEffect(() => {
    if (gptResponse) {
      console.group('🔍 [검진 설계] 최종 응답값 점검');
      console.log('📋 전체 응답 오브젝트:', JSON.parse(JSON.stringify(gptResponse)));
      console.log('✅ 변환된 Recommendation Data:', JSON.parse(JSON.stringify(recommendationData)));
      console.groupEnd();
    }
  }, [gptResponse, recommendationData]);

  // 아코디언 상태 관리 (기본적으로 첫 번째 카테고리 펼침)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState<boolean>(false);

  // priority 아코디언 기본 펼침 상태 설정
  useEffect(() => {
    const initialExpanded = new Set<string>();
    
    // 카테고리들은 기본적으로 접힘 상태 (defaultExpanded 무시)
    // priority_1, priority_2, priority_3 우선순위 카드만 기본 펼침
    if (recommendationData.summary?.priority_1) {
      initialExpanded.add(`priority_1_${recommendationData.summary.priority_1.title || '1순위'}`);
    }
    if (recommendationData.summary?.priority_2) {
      initialExpanded.add(`priority_2_${recommendationData.summary.priority_2.title || '2순위'}`);
    }
    if (recommendationData.summary?.priority_3) {
      initialExpanded.add(`priority_3_${recommendationData.summary.priority_3.title || '3순위'}`);
    }
    
    setExpandedCategories(initialExpanded);
  }, [recommendationData]);

  // 카테고리 토글
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // 닫기 버튼 클릭 (URL 파라미터 유지하여 메인 페이지로 이동)
  const handleCloseClick = () => {
    const queryString = location.search;
    navigate(`/${queryString}`);
  };

  // 강조 텍스트 렌더링
  const renderHighlightedText = (message: string, highlightedText?: string) => {
    if (!highlightedText) {
      return <span>{message}</span>;
    }

    const parts = message.split(highlightedText);
    if (parts.length === 1) {
      return <span>{message}</span>;
    }

    return (
      <>
        {parts[0]}
        <span className="checkup-recommendations__doctor-box-highlight">
          {highlightedText}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <div className="checkup-recommendations">
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className={`checkup-recommendations__loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
          <div className="checkup-recommendations__loading-content">
            <div className="checkup-recommendations__loading-spinner">
              <img
                src={WELLO_LOGO_IMAGE}
                alt="로딩 중"
                className="wello-icon-blink"
              />
            </div>
            <p className="checkup-recommendations__loading-message">
              {loadingMessage}
            </p>
            <div className="checkup-recommendations__loading-progress">
              <div
                className="checkup-recommendations__loading-progress-bar"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 헤더 + 인사말 섹션 (MainPage 구조 재사용) */}
      <div className="main-page__header-greeting-section">
        {/* 헤더 (로고 + 뒤로가기 버튼) */}
        <div className="main-page__header checkup-recommendations__header-with-back">
          <div className="main-page__header-logo">
            <img
              src={getHospitalLogoUrl(hospital)}
              alt={`${hospital?.name || '병원'} 로고`}
              className="main-page__header-logo-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const iconElement = target.nextElementSibling as HTMLElement;
                if (iconElement) {
                  iconElement.style.display = 'flex';
                }
              }}
            />
            <div className="main-page__header-logo-icon" style={{ display: 'none' }}>
              W
            </div>
          </div>
          {/* 뒤로가기 버튼 (좌측, 다른 페이지와 동일한 위치) */}
          <div className="back-button-container">
            <button
              className="back-button"
              onClick={handleCloseClick}
              aria-label="뒤로가기"
            >
              ←
            </button>
          </div>
        </div>

        {/* 환자 인사말 + 추천 설명 (MainPage 구조 재사용) */}
        <div className="main-page__greeting">
          <h1 className="main-page__greeting-title">
            <span className="patient-name">{recommendationData.patientName}</span>
            <span className="greeting-text">님 건강 상태에 꼭 필요한 검진 항목을 추천드려요!</span>
          </h1>
          <p className="main-page__greeting-message">
            <span className="checkup-recommendations__info">
              <span className="checkup-recommendations__info-icon">ⓘ</span>
              <span className="checkup-recommendations__info-text">
                건강검진 결과 기준 발병확률이 있는 항목을 추천
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* 추천 검진 항목 섹션 (스크롤 가능 영역) */}
      <div className="checkup-recommendations__content checkup-recommendations__scrollable-content">
        {/* 1. 종합 분석 섹션 (제일 위) */}
        {gptResponse?.analysis && (
          <>
            <div className="checkup-recommendations__section-header">
              <h2 className="checkup-recommendations__section-title">
                종합 분석
              </h2>
              <div 
                className="checkup-recommendations__analysis-header-toggle"
                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
              >
                <svg
                  className={`checkup-recommendations__analysis-header-arrow ${
                    isAnalysisExpanded ? 'expanded' : 'collapsed'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
            </div>
            <div className="checkup-recommendations__analysis-section">
              <div 
                className={`checkup-recommendations__analysis-text ${isAnalysisExpanded ? 'expanded' : 'collapsed'}`}
              >
              {(() => {
                // {highlight}...{/highlight} 패턴이 있는지 확인 (이중 중괄호 포함)
                const hasHighlight = gptResponse.analysis && (
                  gptResponse.analysis.includes('{highlight}') || 
                  gptResponse.analysis.includes('{{highlight}}') ||
                  gptResponse.analysis.includes('{') ||
                  gptResponse.analysis.includes('}')
                );
                const textLines = gptResponse.analysis.split('\n');
                const shouldShowPreview = !isAnalysisExpanded && textLines.length > 6;
                const displayLines = shouldShowPreview ? textLines.slice(0, 6) : textLines;
                const displayText = displayLines.join('\n');
                
                if (hasHighlight) {
                  // 강조 텍스트가 있는 경우 - 다양한 패턴 처리
                  let cleanedText = displayText
                    // {{highlight}}...{{/highlight}} 패턴 처리 (이중 중괄호)
                    .replace(/\{\{highlight\}\}(.*?)\{\{\/highlight\}\}/g, (_match: string, content: string) => {
                      return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                    })
                    // {highlight}...{{/highlight}} 패턴 처리 (여는 태그 단일, 닫는 태그 이중)
                    .replace(/\{highlight\}(.*?)\{\{\/highlight\}\}/g, (_match: string, content: string) => {
                      return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                    })
                    // {highlight}...{/highlight} 패턴 처리 (정상)
                    .replace(/\{highlight\}(.*?)\{\/highlight\}/g, (_match: string, content: string) => {
                      return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                    })
                    // 남은 태그 제거
                    .replace(/\{\{highlight\}\}/g, '')
                    .replace(/\{\{\/highlight\}\}/g, '')
                    .replace(/\{highlight\}/g, '')
                    .replace(/\{\/highlight\}/g, '')
                    .replace(/\{\}/g, '');
                  
                  // 플레이스홀더를 실제 강조 스타일로 변환
                  const parts: React.ReactNode[] = [];
                  let lastIndex = 0;
                  let key = 0;
                  
                  const highlightStartRegex = /__HIGHLIGHT_START__/g;
                  const highlightEndRegex = /__HIGHLIGHT_END__/g;
                  
                  let startMatch;
                  highlightStartRegex.lastIndex = 0;
                  
                  while ((startMatch = highlightStartRegex.exec(cleanedText)) !== null) {
                    // 강조 전 텍스트
                    if (startMatch.index > lastIndex) {
                      parts.push(
                        <span key={`text-${key++}`}>
                          {cleanedText.substring(lastIndex, startMatch.index)}
                        </span>
                      );
                    }
                    
                    // 강조 끝 위치 찾기
                    highlightEndRegex.lastIndex = startMatch.index;
                    const endMatch = highlightEndRegex.exec(cleanedText);
                    
                    if (endMatch) {
                      // 강조 텍스트
                      const highlightText = cleanedText.substring(startMatch.index + '__HIGHLIGHT_START__'.length, endMatch.index);
                      if (highlightText.trim()) {
                        parts.push(
                          <span key={`highlight-${key++}`} className="checkup-recommendations__analysis-highlight">
                            {highlightText}
                          </span>
                        );
                      }
                      lastIndex = endMatch.index + '__HIGHLIGHT_END__'.length;
                    } else {
                      // 닫는 태그가 없으면 일반 텍스트로 처리
                      lastIndex = startMatch.index;
                    }
                  }
                  
                  // 마지막 텍스트
                  if (lastIndex < cleanedText.length) {
                    const remainingText = cleanedText.substring(lastIndex);
                    if (remainingText) {
                      parts.push(
                        <span key={`text-${key++}`}>
                          {remainingText}
                        </span>
                      );
                    }
                  }
                  
                  return (
                    <>
                      {parts.length > 0 ? parts : cleanedText.split('\n').map((line: string, idx: number) => (
                        <p key={idx} className="checkup-recommendations__analysis-paragraph">
                          {line}
                        </p>
                      ))}
                      {shouldShowPreview && (
                        <div className="checkup-recommendations__analysis-gradient-overlay" />
                      )}
                    </>
                  );
                } else {
                  // 강조 텍스트가 없는 경우 (기존 방식)
                  return (
                    <>
                      {displayLines.map((line: string, idx: number) => (
                        <p key={idx} className="checkup-recommendations__analysis-paragraph">
                          {line}
                        </p>
                      ))}
                      {shouldShowPreview && (
                        <div className="checkup-recommendations__analysis-gradient-overlay" />
                      )}
                    </>
                  );
                }
              })()}
              </div>
              {!isAnalysisExpanded && (
                <div 
                  className="checkup-recommendations__analysis-toggle"
                  onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                >
                  <div className="checkup-recommendations__analysis-toggle-overlay">
                    <svg
                      className={`checkup-recommendations__analysis-arrow ${
                        isAnalysisExpanded ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
              )}
            </div>
            {/* Perplexity Citations 표시 (아코디언) */}
            {(gptResponse?.citations || gptResponse?._citations) && (gptResponse?.citations || gptResponse?._citations).length > 0 && (
              <div className="checkup-recommendations__card checkup-recommendations__citations-card">
                <div 
                  className="checkup-recommendations__card-header" 
                  onClick={() => {
                    const categoryName = 'citations';
                    toggleCategory(categoryName);
                  }}
                >
                  <div className="checkup-recommendations__card-header-left">
                  </div>
                  <div className="checkup-recommendations__card-header-right">
                    <span className="checkup-recommendations__citations-label">참고 자료:</span>
                    <span className="checkup-recommendations__citations-count">
                      {(gptResponse.citations || gptResponse._citations || []).length}개
                    </span>
                  </div>
                  <div className="checkup-recommendations__card-arrow">
                    <svg
                      className={`checkup-recommendations__card-arrow-icon ${
                        expandedCategories.has('citations') ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                {expandedCategories.has('citations') && (
                  <div className="checkup-recommendations__card-content">
                    <div className="checkup-recommendations__citations-list">
                      {(gptResponse.citations || gptResponse._citations || []).map((citation: string, index: number) => {
                        const isUrl = citation.startsWith('http://') || citation.startsWith('https://');
                        return (
                          <div key={index} className="checkup-recommendations__citation">
                            {isUrl ? (
                              <a 
                                href={citation} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="checkup-recommendations__citation-link"
                              >
                                {citation}
                              </a>
                            ) : (
                              <span className="checkup-recommendations__citation-text">{citation}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 주요 사항 요약 섹션 (priority_1, priority_2, priority_3 표시) */}
            {((recommendationData.summary?.priority_1?.items && recommendationData.summary.priority_1.items.length > 0) ||
              (recommendationData.summary?.priority_2?.items && recommendationData.summary.priority_2.items.length > 0) ||
              (recommendationData.summary?.priority_3?.items && recommendationData.summary.priority_3.items.length > 0)) && (
              <div className="checkup-recommendations__summary-section">
                <h3 className="checkup-recommendations__summary-title">주요 사항은 아래와 같아요</h3>
                <div className="checkup-recommendations__summary-content">
                {(() => {
                  const priority1Items = recommendationData.summary?.priority_1?.items || [];
                  const priority2Items = recommendationData.summary?.priority_2?.items || [];
                  const priority3Items = recommendationData.summary?.priority_3?.items || [];
                  
                  // 모델에서 제공하는 health_context 사용
                  const getHealthContext = () => {
                    const context2 = recommendationData.summary?.priority_2?.health_context;
                    const context3 = recommendationData.summary?.priority_3?.health_context;
                    
                    // 둘 다 있으면 합치기 (중복 제거)
                    if (context2 && context3) {
                      // 같은 내용이면 하나만
                      if (context2 === context3) {
                        return context2;
                      } else {
                        // 각 context를 쉼표로 분리하고 중복 제거
                        const parts2 = context2.split(',').map(p => p.trim()).filter(p => p);
                        const parts3 = context3.split(',').map(p => p.trim()).filter(p => p);
                        
                        // 중복 제거하면서 합치기
                        const allParts = [...parts2];
                        parts3.forEach(part => {
                          if (!allParts.includes(part)) {
                            allParts.push(part);
                          }
                        });
                        
                        return allParts.join(', ');
                      }
                    } else if (context2) {
                      return context2;
                    } else if (context3) {
                      return context3;
                    }
                    
                    // 모델에서 health_context를 제공하지 않은 경우 빈 문자열 반환
                    return '';
                  };
                  
                  // priority_2, priority_3 각각 최대 2개씩만 표시
                  const limitedPriority2Items = priority2Items.slice(0, 2);
                  const limitedPriority3Items = priority3Items.slice(0, 2);
                  const limitedAllAdditionalItems = [...limitedPriority2Items, ...limitedPriority3Items];
                  const context = getHealthContext();
                  
                  return (
                    <>
                      {/* priority_1: 올해 주의 깊게 보셔야 하는 항목 */}
                      {priority1Items.length > 0 && (
                        <p className="checkup-recommendations__summary-text">
                          올해 주의 깊게 보셔야 하는거<br />
                          {priority1Items.map((item: string, idx: number) => (
                            <React.Fragment key={idx}>
                              <span className="checkup-recommendations__summary-item-tag">{item}</span>
                              {idx < priority1Items.length - 1 && ' '}
                            </React.Fragment>
                          ))}
                        </p>
                      )}
                      
                      {/* priority_2, priority_3: 추가적으로 */}
                      {limitedAllAdditionalItems.length > 0 && context && (
                        <p className="checkup-recommendations__summary-text">
                          추가적으로<br />
                          {limitedAllAdditionalItems.map((item: string, idx: number) => (
                            <React.Fragment key={idx}>
                              <span className="checkup-recommendations__summary-item-tag">{item}</span>
                              {idx < limitedAllAdditionalItems.length - 1 && ', '}
                            </React.Fragment>
                          ))}{' '}
                          검사로<br />
                          {context}을(를) 더 확인해보시는게 좋을거 같아요
                        </p>
                      )}
                    </>
                  );
                })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* 2. 문진 반영 내용 섹션 (아코디언) */}
        {gptResponse?.survey_reflection && gptResponse.survey_reflection.trim() && (
          <div className="checkup-recommendations__card checkup-recommendations__survey-reflection-card">
            <div className="checkup-recommendations__card-header" onClick={() => {
              const categoryName = 'survey_reflection';
              toggleCategory(categoryName);
            }}>
              <div className="checkup-recommendations__card-header-left">
                <h3 className="checkup-recommendations__card-title">문진 반영 내용</h3>
              </div>
              <div className="checkup-recommendations__card-arrow">
                <svg
                  className={`checkup-recommendations__card-arrow-icon ${
                    expandedCategories.has('survey_reflection') ? 'expanded' : 'collapsed'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
            </div>
            {expandedCategories.has('survey_reflection') && (
              <div className="checkup-recommendations__card-content">
                <div className="checkup-recommendations__card-description">
                  {(() => {
                    // {highlight}...{/highlight} 패턴이 있는지 확인
                    const hasHighlight = gptResponse.survey_reflection && (
                      gptResponse.survey_reflection.includes('{highlight}') || 
                      gptResponse.survey_reflection.includes('{') ||
                      gptResponse.survey_reflection.includes('}')
                    );
                    const textLines = gptResponse.survey_reflection.split('\n');
                    
                    if (hasHighlight) {
                      // 강조 텍스트가 있는 경우 - 정규식으로 패턴 매칭
                      return textLines.map((line: string, lineIdx: number) => {
                        // 먼저 잘못된 태그 패턴들을 정리
                        let cleanedLine = line
                          // {{highlight}}...{{/highlight}} 패턴 처리 (이중 중괄호 - DB 저장 시 이스케이프)
                          .replace(/\{\{highlight\}\}(.*?)\{\{\/highlight\}\}/g, (match, content) => {
                            return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                          })
                          // {highlight}...{/highlight} 패턴 처리 (정상)
                          .replace(/\{highlight\}(.*?)\{\/highlight\}/g, (match, content) => {
                            return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                          })
                          // {{highlight}}...{} 패턴 처리 (이중 중괄호 + 빈 닫는 태그)
                          .replace(/\{\{highlight\}\}(.*?)\{\}/g, (match, content) => {
                            return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                          })
                          // {highlight}...{} 패턴 처리 (잘못된 닫는 태그)
                          .replace(/\{highlight\}(.*?)\{\}/g, (match, content) => {
                            return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                          })
                          // {{로 시작해서 {}로 끝나는 패턴 처리 (이중 중괄호 시작)
                          .replace(/\{\{([^{}]*?)\{\}/g, (match, content) => {
                            if (content && content.trim() && !content.includes('highlight')) {
                              return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                            }
                            return content || '';
                          })
                          // {로 시작해서 {}로 끝나는 패턴 처리 (예: {심혈관 건강...{})
                          .replace(/\{([^{}]+)\{\}$/g, (match, content) => {
                            if (content && content.trim() && !content.includes('highlight')) {
                              return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                            }
                            return content || '';
                          })
                          // 중간에 있는 {...{} 패턴도 처리
                          .replace(/\{([^{}]+)\{\}/g, (match, content) => {
                            if (content && content.trim() && !content.includes('highlight') && !match.includes('__HIGHLIGHT_START__')) {
                              return `__HIGHLIGHT_START__${content}__HIGHLIGHT_END__`;
                            }
                            return content || '';
                          })
                          // 남은 모든 태그 제거 (순서 중요: 먼저 특수 태그 제거)
                          .replace(/\{\{highlight\}\}/g, '')
                          .replace(/\{\{\/highlight\}\}/g, '')
                          .replace(/\{highlight\}/g, '')
                          .replace(/\{\/highlight\}/g, '')
                          .replace(/\{\}/g, ''); // 빈 {} 태그 제거 (마지막에 실행)
                        
                        // 플레이스홀더를 실제 강조 스타일로 변환
                        const parts: React.ReactNode[] = [];
                        let lastIndex = 0;
                        let key = 0;
                        
                        const highlightStartRegex = /__HIGHLIGHT_START__/g;
                        const highlightEndRegex = /__HIGHLIGHT_END__/g;
                        
                        // 강조 시작 위치 찾기
                        let startMatch;
                        highlightStartRegex.lastIndex = 0;
                        
                        while ((startMatch = highlightStartRegex.exec(cleanedLine)) !== null) {
                          // 강조 전 텍스트
                          if (startMatch.index > lastIndex) {
                            parts.push(
                              <span key={`text-${lineIdx}-${key++}`}>
                                {cleanedLine.substring(lastIndex, startMatch.index)}
                              </span>
                            );
                          }
                          
                          // 강조 끝 위치 찾기
                          highlightEndRegex.lastIndex = startMatch.index;
                          const endMatch = highlightEndRegex.exec(cleanedLine);
                          
                          if (endMatch) {
                            // 강조 텍스트
                            const highlightText = cleanedLine.substring(startMatch.index + '__HIGHLIGHT_START__'.length, endMatch.index);
                            if (highlightText.trim()) {
                              parts.push(
                                <span key={`highlight-${lineIdx}-${key++}`} className="checkup-recommendations__analysis-highlight">
                                  {highlightText}
                                </span>
                              );
                            }
                            lastIndex = endMatch.index + '__HIGHLIGHT_END__'.length;
                          } else {
                            // 닫는 태그가 없으면 강조 시작만 제거하고 일반 텍스트로 처리
                            lastIndex = startMatch.index;
                          }
                        }
                        
                        // 마지막 텍스트
                        if (lastIndex < cleanedLine.length) {
                          const remainingText = cleanedLine.substring(lastIndex);
                          if (remainingText) {
                            parts.push(
                              <span key={`text-${lineIdx}-${key++}`}>
                                {remainingText}
                              </span>
                            );
                          }
                        }
                        
                        return (
                          <p key={lineIdx} style={{ marginBottom: lineIdx < textLines.length - 1 ? '1em' : '0' }}>
                            {parts.length > 0 ? parts : cleanedLine}
                          </p>
                        );
                      });
                    } else {
                      // 강조 텍스트가 없는 경우 (기존 방식)
                      return textLines.map((line: string, idx: number) => (
                        <p key={idx} style={{ marginBottom: idx < textLines.length - 1 ? '1em' : '0' }}>
                          {line}
                        </p>
                      ));
                    }
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. 선택 항목 분석 섹션 (아코디언) */}
        {gptResponse?.selected_concerns_analysis && gptResponse.selected_concerns_analysis.length > 0 && (
          <div className="checkup-recommendations__card checkup-recommendations__selected-concerns-card">
            <div className="checkup-recommendations__card-header" onClick={() => {
              const categoryName = 'selected_concerns_analysis';
              toggleCategory(categoryName);
            }}>
              <div className="checkup-recommendations__card-header-left">
                <h3 className="checkup-recommendations__card-title">선택하신 항목 분석</h3>
              </div>
              <div className="checkup-recommendations__card-arrow">
                <svg
                  className={`checkup-recommendations__card-arrow-icon ${
                    expandedCategories.has('selected_concerns_analysis') ? 'expanded' : 'collapsed'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
            </div>
            {expandedCategories.has('selected_concerns_analysis') && (
              <div className="checkup-recommendations__card-content">
                {gptResponse.selected_concerns_analysis.map((concern: any, idx: number) => (
                  <div key={idx} className="checkup-recommendations__concern-analysis">
                    <h4 className="checkup-recommendations__concern-name">{concern.concern_name}</h4>
                    {concern.trend_analysis && (
                      <div className="checkup-recommendations__concern-section">
                        <span className="checkup-recommendations__concern-label">추이 분석:</span>
                        <p className="checkup-recommendations__concern-text">{concern.trend_analysis}</p>
                      </div>
                    )}
                    {concern.reflected_in_design && (
                      <div className="checkup-recommendations__concern-section">
                        <span className="checkup-recommendations__concern-label">검진 설계 반영:</span>
                        <p className="checkup-recommendations__concern-text">{concern.reflected_in_design}</p>
                      </div>
                    )}
                    {concern.related_items && concern.related_items.length > 0 && (
                      <div className="checkup-recommendations__concern-section">
                        <span className="checkup-recommendations__concern-label">관련 검진 항목:</span>
                        <div className="checkup-recommendations__concern-items">
                          {concern.related_items.map((item: string, itemIdx: number) => (
                            <span key={itemIdx} className="checkup-recommendations__concern-item-badge">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. 관리하실 항목이에요 섹션 (1순위만) */}
        {recommendationData.summary?.priority_1 && (
          <>
            <div className="checkup-recommendations__section-header">
              <h2 className="checkup-recommendations__section-title">
                이번 검진시 유의 깊게 보실 항목이에요
              </h2>
            </div>

            {/* 1순위 검진 항목 카드들 */}
            <div className="checkup-recommendations__cards">
              {/* 1순위 우선순위 카드 */}
              {recommendationData.summary?.priority_1 && (
                <>
              <div className="checkup-recommendations__card checkup-recommendations__card--priority-1">
                <div className="checkup-recommendations__card-header" onClick={() => {
                  const categoryName = `priority_1_${recommendationData.summary?.priority_1?.title || '1순위'}`;
                  toggleCategory(categoryName);
                }}>
                  <div className="checkup-recommendations__card-header-left">
                    <h3 className="checkup-recommendations__card-title">{removePriorityPrefix(recommendationData.summary.priority_1.title)}</h3>
                    {recommendationData.summary.priority_1.focus_items && recommendationData.summary.priority_1.focus_items.length > 0 && (
                      <div className="checkup-recommendations__card-header-badges">
                        {recommendationData.summary.priority_1.focus_items.map((item: any, idx: number) => (
                          <span key={idx} className="checkup-recommendations__card-header-badge">
                            {item.item_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="checkup-recommendations__card-arrow">
                    <svg
                      className={`checkup-recommendations__card-arrow-icon ${
                        expandedCategories.has(`priority_1_${recommendationData.summary?.priority_1?.title || '1순위'}`) ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                {expandedCategories.has(`priority_1_${recommendationData.summary?.priority_1?.title || '1순위'}`) && (
                  <div className="checkup-recommendations__card-content">
                    {/* national_checkup_note를 description 위치에 배치 (간호사 말풍선 형태) */}
                    {recommendationData.summary.priority_1.national_checkup_note && (() => {
                      const findReferencesForPriority1 = (): string[] => {
                        const category = recommendationData.categories.find(cat => cat.priorityLevel === 1);
                        if (category && category.items.length > 0) {
                          return (category.items[0] as any)?.references || [];
                        }
                        return [];
                      };
                      const priority1References = findReferencesForPriority1();
                      const cleanedNote = cleanNationalCheckupNote(recommendationData.summary.priority_1.national_checkup_note);
                      
                      return (
                        <div className="checkup-recommendations__doctor-box">
                          <div className="checkup-recommendations__doctor-box-image">
                            <img
                              src={checkPlannerImage}
                              alt="간호사 일러스트"
                              className="checkup-recommendations__doctor-illustration"
                            />
                          </div>
                          <div className="checkup-recommendations__doctor-box-text">
                            {renderTextWithFootnotes(cleanedNote, priority1References)}
                            {/* 각주 리스트 표시 */}
                            {priority1References && priority1References.length > 0 && (
                              <div className="checkup-recommendations__footnotes">
                                {priority1References.map((ref: string, refIndex: number) => {
                                  const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                  return (
                                    <div key={refIndex} className="checkup-recommendations__footnote-item">
                                      <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                      {isUrl ? (
                                        <a 
                                          href={ref} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="checkup-recommendations__footnote-link"
                                        >
                                          {ref}
                                        </a>
                                      ) : (
                                        <span className="checkup-recommendations__footnote-text">{ref}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* 각 항목별 상세 정보 (focus_items) */}
                    {recommendationData.summary.priority_1.focus_items && recommendationData.summary.priority_1.focus_items.length > 0 && (
                      <div className="checkup-recommendations__focus-items">
                        {recommendationData.summary.priority_1.focus_items.map((item: any, idx: number) => {
                          // priority_1의 items에 해당하는 recommended_items에서 references 찾기
                          const findReferencesForItem = (itemName: string): string[] => {
                            const category = recommendationData.categories.find(cat => cat.priorityLevel === 1);
                            if (category) {
                              const foundItem = category.items.find((it: any) => it.name === itemName);
                              return (foundItem as any)?.references || [];
                            }
                            return [];
                          };
                          const itemReferences = findReferencesForItem(item.item_name);
                          
                          return (
                            <div key={idx} className="checkup-recommendations__focus-item">
                              {item.why_important && (
                                <div className="checkup-recommendations__focus-item-section">
                                  <div className="checkup-recommendations__focus-item-header">
                                    <span className="checkup-recommendations__focus-item-label">왜 중요한지:</span>
                                    <span className="checkup-recommendations__focus-item-badge">{item.item_name}</span>
                                  </div>
                                  <div className="checkup-recommendations__focus-item-text">
                                    {renderTextWithFootnotes(item.why_important, itemReferences)}
                                  </div>
                                  {/* 각주 리스트 표시 */}
                                  {itemReferences && itemReferences.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {itemReferences.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                              {item.check_point && (
                                <div className="checkup-recommendations__focus-item-section">
                                  <span className="checkup-recommendations__focus-item-label">확인 포인트:</span>
                                  <div className="checkup-recommendations__focus-item-text">
                                    {renderTextWithFootnotes(item.check_point, itemReferences)}
                                  </div>
                                  {/* 각주 리스트 표시 */}
                                  {itemReferences && itemReferences.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {itemReferences.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* 1순위 카테고리들 */}
              {recommendationData.categories
                .filter((category) => category.priorityLevel === 1)
                .map((category) => {
                  const isExpanded = expandedCategories.has(category.categoryName);
                  // 1순위 우선순위 카드가 있으면 중복 설명 숨김
                  const hasPriorityCard = !!recommendationData.summary?.priority_1;
                  return (
                    <div
                      key={category.categoryName}
                      className={`checkup-recommendations__card ${
                        isExpanded ? 'checkup-recommendations__card--expanded' : ''
                      }`}
                    >
                      {/* 카드 헤더 */}
                      <div
                        className="checkup-recommendations__card-header"
                        onClick={() => toggleCategory(category.categoryName)}
                      >
                        <div className="checkup-recommendations__card-header-left">
                          {category.priorityLevel && (
                            <span className={`checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--${category.priorityLevel}`}>
                              {category.priorityLevel === 1 ? '1순위' : category.priorityLevel === 2 ? '추가권고검진' : '선택 추가 항목'}
                            </span>
                          )}
                          <h3 className="checkup-recommendations__card-title">
                            {category.categoryName}
                          </h3>
                        </div>
                        <div className="checkup-recommendations__card-arrow">
                          <svg
                            className={`checkup-recommendations__card-arrow-icon ${
                              isExpanded ? 'expanded' : 'collapsed'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      </div>

                      {/* 우선순위 설명 (카테고리 헤더 아래) - 우선순위 카드가 있으면 숨김 */}
                      {category.priorityDescription && !hasPriorityCard && (
                        <div className="checkup-recommendations__category-priority-description">
                          {category.priorityDescription}
                        </div>
                      )}

                      {/* 카드 내용 (펼쳐짐 시) */}
                      {isExpanded && (
                        <div className="checkup-recommendations__card-content">
                          {/* 카테고리 설명 (우선순위 설명 반복 표시) - 우선순위 카드가 있으면 숨김 */}
                          {category.priorityDescription && !hasPriorityCard && (
                            <div className="checkup-recommendations__category-description-in-content">
                              <span className="checkup-recommendations__category-description-label">이 카테고리는 {category.priorityLevel}순위입니다:</span>
                              <span className="checkup-recommendations__category-description-text">{category.priorityDescription}</span>
                            </div>
                          )}
                          
                          {category.items.map((item) => (
                            <div
                              key={item.id}
                              className="checkup-recommendations__checkup-item"
                            >
                              <div className="checkup-recommendations__checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  id={item.id}
                                  className="checkup-recommendations__checkbox"
                                  defaultChecked={item.recommended}
                                />
                                <label
                                  htmlFor={item.id}
                                  className="checkup-recommendations__checkbox-label"
                                >
                                  {item.name}
                                  {/* 난이도/비용 뱃지 표시 */}
                                  {(item as any).difficulty_level && (
                                    <span className={`checkup-recommendations__difficulty-badge checkup-recommendations__difficulty-badge--${(item as any).difficulty_level.toLowerCase()}`}>
                                      {(item as any).difficulty_badge || 
                                        ((item as any).difficulty_level === 'Low' ? '부담없는' :
                                         (item as any).difficulty_level === 'Mid' ? '추천' : '프리미엄')}
                                    </span>
                                  )}
                                </label>
                              </div>
                              {item.description && (
                                <div className="checkup-recommendations__item-description">
                                  <span className="checkup-recommendations__item-info-icon">
                                    ⓘ
                                  </span>
                                  <span className="checkup-recommendations__item-description-text">
                                    {item.description}
                                  </span>
                                </div>
                              )}
                              {/* 추천 이유 표시 - 우선순위 카드가 있으면 숨김 (중복 방지) */}
                              {(item as any).reason && !hasPriorityCard && (
                                <div className="checkup-recommendations__item-reason">
                                  <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
                                  <span className="checkup-recommendations__item-reason-text">
                                    {renderTextWithFootnotes(
                                      (item as any).reason,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* 의학적 근거 표시 (GPT 응답에 evidence가 있는 경우, 각주 포함) */}
                              {(item as any).evidence && (
                                <div className="checkup-recommendations__item-evidence">
                                  <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
                                  <span className="checkup-recommendations__item-evidence-text">
                                    {renderTextWithFootnotes(
                                      (item as any).evidence,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* 의사 추천 박스 */}
                          {category.doctorRecommendation?.hasRecommendation && (
                            <div className="checkup-recommendations__doctor-box">
                              <div className="checkup-recommendations__doctor-box-image">
                                <img
                                  src={checkPlannerImage}
                                  alt="의사 일러스트"
                                  className="checkup-recommendations__doctor-illustration"
                                />
                              </div>
                              <div className="checkup-recommendations__doctor-box-text">
                                {renderHighlightedText(
                                  category.doctorRecommendation.message,
                                  category.doctorRecommendation.highlightedText
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                </>
              )}
            </div>
          </>
        )}

        {/* 3. 추천검진 항목 섹션 (2순위, 3순위) */}
        {(recommendationData.summary?.priority_2 || recommendationData.summary?.priority_3 || 
          recommendationData.categories.some(cat => cat.priorityLevel === 2 || cat.priorityLevel === 3)) && (
          <>
            <div className="checkup-recommendations__section-header">
              <h2 className="checkup-recommendations__section-title">
                추천검진 항목
              </h2>
              <span className="checkup-recommendations__total-badge">
                총 {(recommendationData.summary?.priority_2?.count || 0) + (recommendationData.summary?.priority_3?.count || 0) + 
                  recommendationData.categories
                    .filter(cat => cat.priorityLevel === 2 || cat.priorityLevel === 3)
                    .reduce((sum, cat) => sum + cat.itemCount, 0)}개
              </span>
            </div>

            {/* 2순위, 3순위 검진 항목 카드들 */}
            <div className="checkup-recommendations__cards">
              {/* 2순위 섹션: 우선순위 카드 + 2순위 카테고리들 */}
              {recommendationData.summary?.priority_2 && (
            <>
              {/* 2순위 우선순위 카드 */}
              <div className="checkup-recommendations__card checkup-recommendations__card--priority-2">
                <div className="checkup-recommendations__card-header" onClick={() => {
                  const categoryName = `priority_2_${recommendationData.summary?.priority_2?.title || '2순위'}`;
                  toggleCategory(categoryName);
                }}>
                  <div className="checkup-recommendations__card-header-left">
                    <span className="checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--2">추가권고검진</span>
                    <h3 className="checkup-recommendations__card-title">{removePriorityPrefix(recommendationData.summary.priority_2.title)}</h3>
                    <span className="checkup-recommendations__card-badge">
                      {recommendationData.summary.priority_2.count}개
                    </span>
                  </div>
                  <div className="checkup-recommendations__card-arrow">
                    <svg
                      className={`checkup-recommendations__card-arrow-icon ${
                        expandedCategories.has(`priority_2_${recommendationData.summary?.priority_2?.title || '2순위'}`) ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                {expandedCategories.has(`priority_2_${recommendationData.summary?.priority_2?.title || '2순위'}`) && (
                  <div className="checkup-recommendations__card-content">
                    <p className="checkup-recommendations__card-description">{recommendationData.summary.priority_2.description}</p>
                    <div className="checkup-recommendations__priority-items">
                      {recommendationData.summary.priority_2.items.map((item, idx) => (
                        <div key={idx} className="checkup-recommendations__priority-item">
                          <span className="checkup-recommendations__priority-item-name">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2순위 카테고리들 (comprehensive 카테고리, 최대 3개) */}
              {recommendationData.categories
                .filter((category) => category.priorityLevel === 2)
                .slice(0, 3) // comprehensive 카테고리 중 상위 3개만
                .map((category) => {
                  const isExpanded = expandedCategories.has(category.categoryName);
                  // 2순위 우선순위 카드가 있으면 중복 설명 숨김
                  const hasPriorityCard = !!recommendationData.summary?.priority_2;
                  return (
                    <div
                      key={category.categoryName}
                      className={`checkup-recommendations__card ${
                        isExpanded ? 'checkup-recommendations__card--expanded' : ''
                      }`}
                    >
                      {/* 카드 헤더 */}
                      <div
                        className="checkup-recommendations__card-header"
                        onClick={() => toggleCategory(category.categoryName)}
                      >
                        <div className="checkup-recommendations__card-header-left">
                          {category.priorityLevel && (
                            <span className={`checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--${category.priorityLevel}`}>
                              {category.priorityLevel === 1 ? '1순위' : category.priorityLevel === 2 ? '추가권고검진' : '선택 추가 항목'}
                            </span>
                          )}
                          <h3 className="checkup-recommendations__card-title">
                            {category.categoryName}
                          </h3>
                        </div>
                        <div className="checkup-recommendations__card-arrow">
                          <svg
                            className={`checkup-recommendations__card-arrow-icon ${
                              isExpanded ? 'expanded' : 'collapsed'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      </div>

                      {/* 우선순위 설명 (카테고리 헤더 아래) - 우선순위 카드가 있으면 숨김 */}
                      {category.priorityDescription && !hasPriorityCard && (
                        <div className="checkup-recommendations__category-priority-description">
                          {category.priorityDescription}
                        </div>
                      )}

                      {/* 카드 내용 (펼쳐짐 시) */}
                      {isExpanded && (
                        <div className="checkup-recommendations__card-content">
                          {/* 카테고리 설명 (우선순위 설명 반복 표시) - 우선순위 카드가 있으면 숨김 */}
                          {category.priorityDescription && !hasPriorityCard && (
                            <div className="checkup-recommendations__category-description-in-content">
                              <span className="checkup-recommendations__category-description-label">이 카테고리는 {category.priorityLevel}순위입니다:</span>
                              <span className="checkup-recommendations__category-description-text">{category.priorityDescription}</span>
                            </div>
                          )}
                          
                          {category.items.map((item) => (
                            <div
                              key={item.id}
                              className="checkup-recommendations__checkup-item"
                            >
                              <div className="checkup-recommendations__checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  id={item.id}
                                  className="checkup-recommendations__checkbox"
                                  defaultChecked={item.recommended}
                                />
                                <label
                                  htmlFor={item.id}
                                  className="checkup-recommendations__checkbox-label"
                                >
                                  {item.name}
                                  {/* 난이도/비용 뱃지 표시 */}
                                  {(item as any).difficulty_level && (
                                    <span className={`checkup-recommendations__difficulty-badge checkup-recommendations__difficulty-badge--${(item as any).difficulty_level.toLowerCase()}`}>
                                      {(item as any).difficulty_badge || 
                                        ((item as any).difficulty_level === 'Low' ? '부담없는' :
                                         (item as any).difficulty_level === 'Mid' ? '추천' : '프리미엄')}
                                    </span>
                                  )}
                                </label>
                              </div>
                              {item.description && (
                                <div className="checkup-recommendations__item-description">
                                  <span className="checkup-recommendations__item-info-icon">
                                    ⓘ
                                  </span>
                                  <span className="checkup-recommendations__item-description-text">
                                    {item.description}
                                  </span>
                                </div>
                              )}
                              {/* 추천 이유 표시 - 우선순위 카드가 있으면 숨김 (중복 방지) */}
                              {(item as any).reason && !hasPriorityCard && (
                                <div className="checkup-recommendations__item-reason">
                                  <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
                                  <span className="checkup-recommendations__item-reason-text">
                                    {renderTextWithFootnotes(
                                      (item as any).reason,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* 의학적 근거 표시 (GPT 응답에 evidence가 있는 경우, 각주 포함) */}
                              {(item as any).evidence && (
                                <div className="checkup-recommendations__item-evidence">
                                  <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
                                  <span className="checkup-recommendations__item-evidence-text">
                                    {renderTextWithFootnotes(
                                      (item as any).evidence,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* 의사 추천 박스 */}
                          {category.doctorRecommendation?.hasRecommendation && (
                            <div className="checkup-recommendations__doctor-box">
                              <div className="checkup-recommendations__doctor-box-image">
                                <img
                                  src={checkPlannerImage}
                                  alt="의사 일러스트"
                                  className="checkup-recommendations__doctor-illustration"
                                />
                              </div>
                              <div className="checkup-recommendations__doctor-box-text">
                                {renderHighlightedText(
                                  category.doctorRecommendation.message,
                                  category.doctorRecommendation.highlightedText
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          {/* 3순위 섹션: 우선순위 카드 + 3순위 카테고리들 */}
          {recommendationData.summary?.priority_3 && (
            <>
              {/* 3순위 섹션 헤더 */}
              <div className="checkup-recommendations__section-header">
                <h2 className="checkup-recommendations__section-title">
                  이 검사도 고민해보세요
                </h2>
                <span className="checkup-recommendations__total-badge">
                  {recommendationData.summary.priority_3.count}개
                </span>
              </div>
              
              {/* 3순위 우선순위 카드 */}
              <div className="checkup-recommendations__card checkup-recommendations__card--priority-3">
                <div className="checkup-recommendations__card-header" onClick={() => {
                  const categoryName = `priority_3_${recommendationData.summary?.priority_3?.title || '3순위'}`;
                  toggleCategory(categoryName);
                }}>
                  <div className="checkup-recommendations__card-header-left">
                    <span className="checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--3">선택 추가 항목</span>
                    <h3 className="checkup-recommendations__card-title">{removePriorityPrefix(recommendationData.summary.priority_3.title)}</h3>
                    <span className="checkup-recommendations__card-badge">
                      {recommendationData.summary.priority_3.count}개
                    </span>
                  </div>
                  <div className="checkup-recommendations__card-arrow">
                    <svg
                      className={`checkup-recommendations__card-arrow-icon ${
                        expandedCategories.has(`priority_3_${recommendationData.summary?.priority_3?.title || '3순위'}`) ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>
                {expandedCategories.has(`priority_3_${recommendationData.summary?.priority_3?.title || '3순위'}`) && (
                  <div className="checkup-recommendations__card-content">
                    <p className="checkup-recommendations__card-description">{recommendationData.summary.priority_3.description}</p>
                    <div className="checkup-recommendations__priority-items">
                      {recommendationData.summary.priority_3.items.map((item, idx) => (
                        <div key={idx} className="checkup-recommendations__priority-item">
                          <span className="checkup-recommendations__priority-item-name">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3순위 카테고리들 (optional 카테고리, 최대 3개) */}
              {recommendationData.categories
                .filter((category) => category.priorityLevel === 3)
                .slice(0, 3) // optional 카테고리 중 상위 3개만
                .map((category) => {
                  const isExpanded = expandedCategories.has(category.categoryName);
                  // 3순위 우선순위 카드가 있으면 중복 설명 숨김
                  const hasPriorityCard = !!recommendationData.summary?.priority_3;
                  return (
                    <div
                      key={category.categoryName}
                      className={`checkup-recommendations__card ${
                        isExpanded ? 'checkup-recommendations__card--expanded' : ''
                      }`}
                    >
                      {/* 카드 헤더 */}
                      <div
                        className="checkup-recommendations__card-header"
                        onClick={() => toggleCategory(category.categoryName)}
                      >
                        <div className="checkup-recommendations__card-header-left">
                          {category.priorityLevel && (
                            <span className={`checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--${category.priorityLevel}`}>
                              {category.priorityLevel === 1 ? '1순위' : category.priorityLevel === 2 ? '추가권고검진' : '선택 추가 항목'}
                            </span>
                          )}
                          <h3 className="checkup-recommendations__card-title">
                            {category.categoryName}
                          </h3>
                        </div>
                        <div className="checkup-recommendations__card-arrow">
                          <svg
                            className={`checkup-recommendations__card-arrow-icon ${
                              isExpanded ? 'expanded' : 'collapsed'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      </div>

                      {/* 우선순위 설명 (카테고리 헤더 아래) - 우선순위 카드가 있으면 숨김 */}
                      {category.priorityDescription && !hasPriorityCard && (
                        <div className="checkup-recommendations__category-priority-description">
                          {category.priorityDescription}
                        </div>
                      )}

                      {/* 카드 내용 (펼쳐짐 시) */}
                      {isExpanded && (
                        <div className="checkup-recommendations__card-content">
                          {/* 카테고리 설명 (우선순위 설명 반복 표시) - 우선순위 카드가 있으면 숨김 */}
                          {category.priorityDescription && !hasPriorityCard && (
                            <div className="checkup-recommendations__category-description-in-content">
                              <span className="checkup-recommendations__category-description-label">이 카테고리는 {category.priorityLevel}순위입니다:</span>
                              <span className="checkup-recommendations__category-description-text">{category.priorityDescription}</span>
                            </div>
                          )}
                          
                          {category.items.map((item) => (
                            <div
                              key={item.id}
                              className="checkup-recommendations__checkup-item"
                            >
                              <div className="checkup-recommendations__checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  id={item.id}
                                  className="checkup-recommendations__checkbox"
                                  defaultChecked={item.recommended}
                                />
                                <label
                                  htmlFor={item.id}
                                  className="checkup-recommendations__checkbox-label"
                                >
                                  {item.name}
                                  {/* 난이도/비용 뱃지 표시 */}
                                  {(item as any).difficulty_level && (
                                    <span className={`checkup-recommendations__difficulty-badge checkup-recommendations__difficulty-badge--${(item as any).difficulty_level.toLowerCase()}`}>
                                      {(item as any).difficulty_badge || 
                                        ((item as any).difficulty_level === 'Low' ? '부담없는' :
                                         (item as any).difficulty_level === 'Mid' ? '추천' : '프리미엄')}
                                    </span>
                                  )}
                                </label>
                              </div>
                              {item.description && (
                                <div className="checkup-recommendations__item-description">
                                  <span className="checkup-recommendations__item-info-icon">
                                    ⓘ
                                  </span>
                                  <span className="checkup-recommendations__item-description-text">
                                    {item.description}
                                  </span>
                                </div>
                              )}
                              {/* 추천 이유 표시 - 우선순위 카드가 있으면 숨김 (중복 방지) */}
                              {(item as any).reason && !hasPriorityCard && (
                                <div className="checkup-recommendations__item-reason">
                                  <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
                                  <span className="checkup-recommendations__item-reason-text">
                                    {renderTextWithFootnotes(
                                      (item as any).reason,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* 의학적 근거 표시 (GPT 응답에 evidence가 있는 경우, 각주 포함) */}
                              {(item as any).evidence && (
                                <div className="checkup-recommendations__item-evidence">
                                  <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
                                  <span className="checkup-recommendations__item-evidence-text">
                                    {renderTextWithFootnotes(
                                      (item as any).evidence,
                                      (item as any).references
                                    )}
                                  </span>
                                  {/* 각주 리스트 표시 */}
                                  {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                                    <div className="checkup-recommendations__footnotes">
                                      {(item as any).references.map((ref: string, refIndex: number) => {
                                        const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                        return (
                                          <div key={refIndex} className="checkup-recommendations__footnote-item">
                                            <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                            {isUrl ? (
                                              <a 
                                                href={ref} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="checkup-recommendations__footnote-link"
                                              >
                                                {ref}
                                              </a>
                                            ) : (
                                              <span className="checkup-recommendations__footnote-text">{ref}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* 의사 추천 박스 */}
                          {category.doctorRecommendation?.hasRecommendation && (
                            <div className="checkup-recommendations__doctor-box">
                              <div className="checkup-recommendations__doctor-box-image">
                                <img
                                  src={checkPlannerImage}
                                  alt="의사 일러스트"
                                  className="checkup-recommendations__doctor-illustration"
                                />
                              </div>
                              <div className="checkup-recommendations__doctor-box-text">
                                {renderHighlightedText(
                                  category.doctorRecommendation.message,
                                  category.doctorRecommendation.highlightedText
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          {/* 우선순위가 없는 카테고리들 (priorityLevel이 없는 경우) - 추천검진 항목 섹션에 포함 */}
          {recommendationData.categories
            .filter((category) => !category.priorityLevel)
            .map((category) => {
            const isExpanded = expandedCategories.has(category.categoryName);

            return (
              <div
                key={category.categoryName}
                className={`checkup-recommendations__card ${
                  isExpanded ? 'checkup-recommendations__card--expanded' : ''
                }`}
              >
                {/* 카드 헤더 */}
                <div
                  className="checkup-recommendations__card-header"
                  onClick={() => toggleCategory(category.categoryName)}
                >
                  <div className="checkup-recommendations__card-header-left">
                    {category.priorityLevel && (
                      <span className={`checkup-recommendations__category-priority-badge checkup-recommendations__category-priority-badge--${category.priorityLevel}`}>
                        {category.priorityLevel}순위
                      </span>
                    )}
                    <h3 className="checkup-recommendations__card-title">
                      {category.categoryName}
                    </h3>
                    <span className="checkup-recommendations__card-badge">
                      {category.itemCount}개
                    </span>
                  </div>
                  <div className="checkup-recommendations__card-arrow">
                    <svg
                      className={`checkup-recommendations__card-arrow-icon ${
                        isExpanded ? 'expanded' : 'collapsed'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                </div>

                {/* 우선순위 설명 (카테고리 헤더 아래) */}
                {category.priorityDescription && (
                  <div className="checkup-recommendations__category-priority-description">
                    {category.priorityDescription}
                  </div>
                )}

                {/* 카드 내용 (펼쳐짐 시) */}
                {isExpanded && (
                  <div className="checkup-recommendations__card-content">
                    {/* 카테고리 설명 (우선순위 설명 반복 표시) */}
                    {category.priorityDescription && (
                      <div className="checkup-recommendations__category-description-in-content">
                        <span className="checkup-recommendations__category-description-label">이 카테고리는 {category.priorityLevel}순위입니다:</span>
                        <span className="checkup-recommendations__category-description-text">{category.priorityDescription}</span>
                      </div>
                    )}
                    
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="checkup-recommendations__checkup-item"
                      >
                        <div className="checkup-recommendations__checkbox-wrapper">
                          <input
                            type="checkbox"
                            id={item.id}
                            className="checkup-recommendations__checkbox"
                            defaultChecked={item.recommended}
                          />
                          <label
                            htmlFor={item.id}
                            className="checkup-recommendations__checkbox-label"
                          >
                            {item.name}
                            {/* 난이도/비용 뱃지 표시 */}
                            {(item as any).difficulty_level && (
                              <span className={`checkup-recommendations__difficulty-badge checkup-recommendations__difficulty-badge--${(item as any).difficulty_level.toLowerCase()}`}>
                                {(item as any).difficulty_badge || 
                                  ((item as any).difficulty_level === 'Low' ? '부담없는' :
                                   (item as any).difficulty_level === 'Mid' ? '추천' : '프리미엄')}
                              </span>
                            )}
                          </label>
                        </div>
                        {item.description && (
                          <div className="checkup-recommendations__item-description">
                            <span className="checkup-recommendations__item-info-icon">
                              ⓘ
                            </span>
                            <span className="checkup-recommendations__item-description-text">
                              {item.description}
                            </span>
                          </div>
                        )}
                        {/* 추천 이유 표시 (GPT 응답에 reason이 있는 경우, 각주 포함) */}
                        {(item as any).reason && (
                          <div className="checkup-recommendations__item-reason">
                            <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
                            <span className="checkup-recommendations__item-reason-text">
                              {renderTextWithFootnotes(
                                (item as any).reason,
                                (item as any).references
                              )}
                            </span>
                            {/* 각주 리스트 표시 */}
                            {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                              <div className="checkup-recommendations__footnotes">
                                {(item as any).references.map((ref: string, refIndex: number) => {
                                  const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                  return (
                                    <div key={refIndex} className="checkup-recommendations__footnote-item">
                                      <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                      {isUrl ? (
                                        <a 
                                          href={ref} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="checkup-recommendations__footnote-link"
                                        >
                                          {ref}
                                        </a>
                                      ) : (
                                        <span className="checkup-recommendations__footnote-text">{ref}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 의학적 근거 표시 (GPT 응답에 evidence가 있는 경우, 각주 포함) */}
                        {(item as any).evidence && (
                          <div className="checkup-recommendations__item-evidence">
                            <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
                            <span className="checkup-recommendations__item-evidence-text">
                              {renderTextWithFootnotes(
                                (item as any).evidence,
                                (item as any).references
                              )}
                            </span>
                            {/* 각주 리스트 표시 */}
                            {(item as any).references && Array.isArray((item as any).references) && (item as any).references.length > 0 && (
                              <div className="checkup-recommendations__footnotes">
                                {(item as any).references.map((ref: string, refIndex: number) => {
                                  const isUrl = ref.startsWith('http://') || ref.startsWith('https://');
                                  return (
                                    <div key={refIndex} className="checkup-recommendations__footnote-item">
                                      <span className="checkup-recommendations__footnote-number">[{refIndex + 1}]</span>
                                      {isUrl ? (
                                        <a 
                                          href={ref} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="checkup-recommendations__footnote-link"
                                        >
                                          {ref}
                                        </a>
                                      ) : (
                                        <span className="checkup-recommendations__footnote-text">{ref}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 의사 추천 박스 */}
                    {category.doctorRecommendation?.hasRecommendation && (
                      <div className="checkup-recommendations__doctor-box">
                        <div className="checkup-recommendations__doctor-box-image">
                          <img
                            src={checkPlannerImage}
                            alt="의사 일러스트"
                            className="checkup-recommendations__doctor-illustration"
                          />
                        </div>
                        <div className="checkup-recommendations__doctor-box-text">
                          {renderHighlightedText(
                            category.doctorRecommendation.message,
                            category.doctorRecommendation.highlightedText
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
            </div>
          </>
        )}

        {/* 의사 코멘트 섹션 (하단) */}
        {gptResponse?.doctor_comment && (
          <div className="checkup-recommendations__doctor-comment-section">
            <div className="checkup-recommendations__doctor-box">
              <div className="checkup-recommendations__doctor-box-image">
                <img
                  src={checkPlannerImage}
                  alt="의사 일러스트"
                  className="checkup-recommendations__doctor-illustration"
                />
              </div>
              <div className="checkup-recommendations__doctor-box-text">
                {gptResponse.doctor_comment.split('\n').map((line: string, idx: number) => (
                  <p key={idx} style={{ marginBottom: idx < gptResponse.doctor_comment.split('\n').length - 1 ? '0.5em' : '0' }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckupRecommendationsPage;

