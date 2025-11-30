import React, { useState, useEffect } from 'react';
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
  };
  priority_2?: {
    title: string;
    description: string;
    items: string[];
    count: number;
    upselling_focus?: boolean; // 업셀링 위주 여부
  };
  priority_3?: {
    title: string;
    description: string;
    items: string[];
    count: number;
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

    return {
      patientName: patient?.name || '환자',
      totalCount: gptData.total_count || categories.reduce((sum, cat) => sum + cat.itemCount, 0),
      categories,
      summary: gptData.summary || undefined,
    };
  };

  // 추천 데이터 (GPT 응답 또는 목업 데이터)
  const recommendationData: RecommendationData = gptResponse
    ? convertGPTResponseToRecommendationData(gptResponse)
    : {
        ...mockRecommendationData,
        patientName: patient?.name || mockRecommendationData.patientName,
      };

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(
      recommendationData.categories
        .filter((cat) => cat.defaultExpanded)
        .map((cat) => cat.categoryName)
    )
  );

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
            </div>
            <div className="checkup-recommendations__analysis-section">
              <div className="checkup-recommendations__analysis-text">
              {(() => {
                // {highlight}...{/highlight} 패턴이 있는지 확인
                const hasHighlight = gptResponse.analysis && gptResponse.analysis.includes('{highlight}');
                if (hasHighlight) {
                  // 강조 텍스트가 있는 경우 - 정규식으로 패턴 매칭
                  const regex = /\{highlight\}(.*?)\{\/highlight\}/g;
                  const parts: React.ReactNode[] = [];
                  let lastIndex = 0;
                  let match;
                  let key = 0;
                  
                  while ((match = regex.exec(gptResponse.analysis)) !== null) {
                    // 강조 전 텍스트
                    if (match.index > lastIndex) {
                      parts.push(
                        <span key={`text-${key++}`}>
                          {gptResponse.analysis.substring(lastIndex, match.index)}
                        </span>
                      );
                    }
                    // 강조 텍스트
                    parts.push(
                      <span key={`highlight-${key++}`} className="checkup-recommendations__analysis-highlight">
                        {match[1]}
                      </span>
                    );
                    lastIndex = regex.lastIndex;
                  }
                  // 마지막 텍스트
                  if (lastIndex < gptResponse.analysis.length) {
                    parts.push(
                      <span key={`text-${key++}`}>
                        {gptResponse.analysis.substring(lastIndex)}
                      </span>
                    );
                  }
                  return parts;
                } else {
                  // 강조 텍스트가 없는 경우 (기존 방식)
                  return gptResponse.analysis.split('\n').map((line: string, idx: number) => (
                    <p key={idx} className="checkup-recommendations__analysis-paragraph">
                      {line}
                    </p>
                  ));
                }
              })()}
            </div>
            {/* Perplexity Citations 표시 */}
            {gptResponse?.citations && gptResponse.citations.length > 0 && (
              <div className="checkup-recommendations__citations">
                <span className="checkup-recommendations__citations-label">참고 자료:</span>
                <div className="checkup-recommendations__citations-list">
                  {gptResponse.citations.map((citation: string, index: number) => {
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
          </>
        )}

        {/* 2. 관리하실 항목이에요 섹션 (1순위만) */}
        {recommendationData.summary?.priority_1 && (
          <>
            <div className="checkup-recommendations__section-header">
              <h2 className="checkup-recommendations__section-title">
                관리하실 항목이에요
              </h2>
              <span className="checkup-recommendations__total-badge">
                {recommendationData.summary.priority_1.count}개
              </span>
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
                    <span className="checkup-recommendations__card-badge">
                      {recommendationData.summary.priority_1.count}개
                    </span>
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
                    <p className="checkup-recommendations__card-description">{recommendationData.summary.priority_1.description}</p>
                    
                    {/* 필수 검진 항목만 표시 (일반검진 항목 제외) - 뱃지 형태로 가로 배치 */}
                    {recommendationData.summary.priority_1.items && recommendationData.summary.priority_1.items.length > 0 && (
                      <div className="checkup-recommendations__priority-items">
                        <div className="checkup-recommendations__priority-items-label">관리하실 항목이에요</div>
                        <div className="checkup-recommendations__priority-items-badges">
                          {recommendationData.summary.priority_1.items.map((item, idx) => (
                            <span key={idx} className="checkup-recommendations__priority-item-badge">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 간호사 말풍선 (일반검진 안내) */}
                    {recommendationData.summary.priority_1.national_checkup_note && (
                      <div className="checkup-recommendations__doctor-box">
                        <div className="checkup-recommendations__doctor-box-image">
                          <img
                            src={checkPlannerImage}
                            alt="간호사 일러스트"
                            className="checkup-recommendations__doctor-illustration"
                          />
                        </div>
                        <div className="checkup-recommendations__doctor-box-text">
                          {cleanNationalCheckupNote(recommendationData.summary.priority_1.national_checkup_note)}
                        </div>
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

              {/* 2순위 카테고리들 */}
              {recommendationData.categories
                .filter((category) => category.priorityLevel === 2)
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

              {/* 3순위 카테고리들 */}
              {recommendationData.categories
                .filter((category) => category.priorityLevel === 3)
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
      </div>
    </div>
  );
};

export default CheckupRecommendationsPage;

