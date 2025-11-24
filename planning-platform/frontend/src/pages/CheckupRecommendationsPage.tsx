import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import { getHospitalLogoUrl } from '../utils/hospitalLogoUtils';
import { WELLO_LOGO_IMAGE } from '../constants/images';
import checkPlannerImage from '../assets/images/check_planner.png';
import './MainPage.scss'; // MainPage 헤더 스타일 재사용
import './CheckupRecommendationsPage.scss';
import '../components/shared/BackButton/styles.scss'; // BackButton 스타일 재사용

// 목업 데이터 타입 정의
interface CheckupItem {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  reason?: string; // GPT 응답의 추천 이유
  recommended: boolean;
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
}

interface RecommendationData {
  patientName: string;
  totalCount: number;
  categories: RecommendationCategory[];
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
      items: (cat.items || []).map((item: any, index: number) => ({
        id: `item-${cat.category}-${index}`,
        name: item.name || '',
        nameEn: item.nameEn || item.name_en,
        description: item.description,
        recommended: item.recommended !== false, // 기본값 true
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
    };
  };

  // 추천 데이터 (GPT 응답 또는 목업 데이터)
  const recommendationData: RecommendationData = gptResponse
    ? convertGPTResponseToRecommendationData(gptResponse)
    : {
        ...mockRecommendationData,
        patientName: patient?.name || mockRecommendationData.patientName,
      };

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
        {/* 종합 분석 섹션 (GPT 응답에 analysis가 있는 경우) */}
        {gptResponse?.analysis && (
          <div className="checkup-recommendations__analysis-section">
            <h3 className="checkup-recommendations__analysis-title">종합 분석</h3>
            <p className="checkup-recommendations__analysis-text">
              {gptResponse.analysis}
            </p>
          </div>
        )}

        {/* 섹션 제목 */}
        <div className="checkup-recommendations__section-header">
          <h2 className="checkup-recommendations__section-title">
            추천 검진 항목
          </h2>
          <span className="checkup-recommendations__total-badge">
            총 {recommendationData.totalCount}개
          </span>
        </div>

        {/* 검진 항목 카드들 */}
        <div className="checkup-recommendations__cards">
          {recommendationData.categories.map((category) => {
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

                {/* 카드 내용 (펼쳐짐 시) */}
                {isExpanded && (
                  <div className="checkup-recommendations__card-content">
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
                        {/* 추천 이유 표시 (GPT 응답에 reason이 있는 경우) */}
                        {(item as any).reason && (
                          <div className="checkup-recommendations__item-reason">
                            <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
                            <span className="checkup-recommendations__item-reason-text">
                              {(item as any).reason}
                            </span>
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
      </div>
    </div>
  );
};

export default CheckupRecommendationsPage;

