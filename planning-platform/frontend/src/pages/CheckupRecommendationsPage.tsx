import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelnoData } from '../contexts/WelnoDataContext';
import { getHospitalLogoUrl } from '../utils/hospitalLogoUtils';
import { WELNO_LOGO_IMAGE } from '../constants/images';
import checkPlannerImage from '../assets/images/check_planner.png';
import { renderTextWithFootnotes } from '../utils/footnoteParser';
import checkupDesignService from '../services/checkupDesignService';
import { CheckupItemCard, DoctorMessageBox } from '../components/checkup-design/CheckupComponents';
import './MainPage.scss'; // MainPage 헤더 스타일 재사용
import './CheckupRecommendationsPage.scss';
import '../components/shared/BackButton/styles.scss'; // BackButton 스타일 재사용

/**
 * 텍스트에서 실제로 사용된 각주 번호들을 추출
 * @param text 각주가 포함된 텍스트
 * @returns 사용된 각주 번호 배열 (예: [1, 2, 3])
 */
const extractFootnoteNumbers = (text: string): number[] => {
  if (!text) return [];
  const footnoteRegex = /\[(\d+)\]/g;
  const matches: number[] = [];
  let match;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const footnoteNum = parseInt(match[1], 10);
    if (!matches.includes(footnoteNum)) {
      matches.push(footnoteNum);
    }
  }
  return matches.sort((a, b) => a - b); // 오름차순 정렬
};

// --- [Evidence Modal Component] ---
interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceData: any; // 구체적인 타입은 CheckupDesignResponse 참조
  targetItemName?: string;
}

const EvidenceModal: React.FC<EvidenceModalProps> = ({ isOpen, onClose, evidenceData, targetItemName }) => {
  // 아코디언 상태 관리 (항상 최상위에서 호출)
  const [expandedEvidences, setExpandedEvidences] = useState<Set<string>>(new Set());

  // evidenceData가 배열인지 단일 객체인지 확인하여 처리
  const evidences = Array.isArray(evidenceData) ? evidenceData : (evidenceData ? [evidenceData] : []);

  if (!isOpen) return null;

  // 아코디언 토글 함수
  const toggleEvidence = (evidenceId: string) => {
    setExpandedEvidences((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(evidenceId)) {
        newSet.delete(evidenceId);
      } else {
        newSet.add(evidenceId);
      }
      return newSet;
    });
  };

  return (
    <div 
      className="processing-modal-overlay" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        paddingBottom: '5vh',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        overflowY: 'auto'
      }}
    >
      <div 
        className="processing-modal-content" 
        style={{ 
          position: 'relative',
          maxWidth: '600px', 
          width: '90%', 
          maxHeight: '87vh',
          marginTop: 0,
          overflowY: 'auto', 
          padding: '0',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
             🩺 의학적 근거 자료
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        
        <div style={{ padding: '20px' }}>
          {targetItemName && (
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px', fontSize: '14px', color: '#374151' }}>
              <strong>'{targetItemName}'</strong> 검사와 관련된 전문 의학 지침입니다.
            </div>
          )}

          {evidences.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>관련된 근거 자료를 찾을 수 없습니다.</p>
          ) : (
            evidences.map((ev, idx) => {
              const evidenceId = `evidence-${idx}-${ev.organization || 'unknown'}-${ev.year || 'no-year'}`;
              const isExpanded = expandedEvidences.has(evidenceId);

              return (
                <div key={idx} style={{ marginBottom: '24px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* 아코디언 헤더 */}
                  <div 
                    onClick={() => toggleEvidence(evidenceId)}
                    style={{ 
                      backgroundColor: '#f9fafb', 
                      padding: '12px 16px', 
                      borderBottom: '1px solid #e5e7eb', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <span style={{ fontWeight: 'bold', color: '#4b5563', fontSize: '14px' }}>
                        {ev.organization || '출처 미상'} {ev.year ? `(${ev.year})` : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                        신뢰도: {ev.confidence_score ? Math.round(ev.confidence_score * 100) + '%' : 'N/A'}
                      </span>
                    </div>
                    {/* 화살표 아이콘 */}
                    <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
                      <svg 
                        style={{ 
                          width: '20px', 
                          height: '20px', 
                          transition: 'transform 0.3s ease',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          color: '#6b7280'
                        }} 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                      >
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                    </div>
                  </div>
                  
                  {/* 아코디언 내용 (조건부 렌더링) */}
                  {isExpanded && (
                    <div style={{ padding: '16px', backgroundColor: '#fff' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                        {ev.source_document || '문서명 없음'}
                      </h4>
                      
                      {ev.page && (
                         <div style={{ display: 'inline-block', marginBottom: '12px', fontSize: '12px', color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '9999px' }}>
                           Page: {ev.page}
                         </div>
                      )}

                      <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151', backgroundColor: '#fff', padding: '12px', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
                        {ev.full_text || ev.citation || '내용 없음'}
                      </div>
                      
                      {ev.query && (
                        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
                          검색 키워드: {ev.query}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        <div style={{ padding: '16px 20px', borderTop: '1px solid #eee', textAlign: 'right', background: '#f9fafb' }}>
          <button 
            onClick={onClose}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: '500', 
              cursor: 'pointer' 
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const { state } = useWelnoData();
  const { patient, hospital } = state;
  const [debugClickCount, setDebugClickCount] = useState(0);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // URL에서 환자 정보 가져오기 (patient가 없을 때 대비)
  const urlParams = new URLSearchParams(window.location.search);
  const patientUuid = urlParams.get('uuid');
  const [patientName, setPatientName] = useState<string>(patient?.name || '사용자');

  // GPT 응답 데이터 (location.state에서 받음 또는 DB에서 불러옴)
  const [gptResponse, setGptResponse] = useState<any>(location.state?.checkupDesign);
  const [selectedConcerns, setSelectedConcerns] = useState<any[]>(location.state?.selectedConcerns || []);
  const citations = gptResponse?._citations || []; // Perplexity citations
  const basicCheckupGuide = gptResponse?.basic_checkup_guide; // 기본 검진 가이드

  // 로딩 상태 관리 (GPT 응답이 없을 때만 로딩 표시)
  const [isLoading, setIsLoading] = useState(!gptResponse);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Evidence Modal 상태
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [selectedItemName, setSelectedItemName] = useState<string>('');

  const handleShowEvidence = (evidenceIdOrName: string) => {
    // 1. rag_evidences가 있는지 확인
    const ragEvidences = gptResponse?.rag_evidences || [];
    
    // 2. 매칭 로직 (현재는 evidence_id가 없으므로 간단한 키워드 매칭 또는 전체 표시)
    // TODO: 추후 백엔드에서 evidence_id를 내려주면 정확한 매칭 가능
    
    let matchedEvidences = [];
    
    if (ragEvidences.length > 0) {
      // 이름으로 매칭 시도 (검사명이 텍스트에 포함되어 있는지)
      matchedEvidences = ragEvidences.filter((ev: any) => {
        return ev.full_text?.includes(evidenceIdOrName) || ev.citation?.includes(evidenceIdOrName) || ev.query?.includes(evidenceIdOrName);
      });
      
      // 매칭된 게 없으면 신뢰도 높은 순으로 상위 3개 보여줌 (Fallback)
      if (matchedEvidences.length === 0) {
         matchedEvidences = ragEvidences.slice(0, 3);
      }
    }

    setSelectedItemName(evidenceIdOrName);
    setSelectedEvidence(matchedEvidences);
    setEvidenceModalOpen(true);
  };

  // 로딩 메시지 단계
  const loadingMessages = [
    '검진 결과를 분석하고 있습니다...',
    '건강 상태에 맞는 검진 항목을 선별하고 있습니다...',
    '의사 추천 검진 계획을 수립하고 있습니다...',
    '맞춤형 검진 항목을 준비하고 있습니다...',
  ];

  // 🔧 디버그 패널 토글 핸들러 (로고 5번 클릭)
  const handleLogoClick = () => {
    const newCount = debugClickCount + 1;
    setDebugClickCount(newCount);
    
    if (newCount >= 5) {
      setShowDebugPanel(!showDebugPanel);
      setDebugClickCount(0); // 카운트 초기화
    }
    
    // 3초 후 자동 초기화
    setTimeout(() => {
      setDebugClickCount(0);
    }, 3000);
  };

  // 🔧 로그 파일 다운로드 핸들러
  const handleDownloadLogs = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/debug/download-logs?count=6`);
      
      if (!response.ok) {
        throw new Error('로그 다운로드 실패');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gpt_logs_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('✅ 로그 파일 다운로드 완료!');
    } catch (error) {
      console.error('❌ 로그 다운로드 오류:', error);
      alert('❌ 로그 다운로드 실패');
    }
  };

  // 환자 이름 로드 (patient context에 없을 때 API 호출)
  useEffect(() => {
    const loadPatientName = async () => {
      if (patient?.name) {
        setPatientName(patient.name);
        return;
      }

      if (!patientUuid) return;

      try {
        const response = await fetch(`/welno-api/v1/patients/${patientUuid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.name) {
            console.log('✅ [환자정보] 환자 이름 로드:', data.data.name);
            setPatientName(data.data.name);
          }
        }
      } catch (error) {
        console.error('❌ [환자정보] 환자 이름 로드 실패:', error);
      }
    };

    loadPatientName();
  }, [patient?.name, patientUuid]);

  // 저장된 설계 결과 불러오기 (location.state에 없을 때만)
  useEffect(() => {
    const loadSavedDesign = async () => {
      // location.state에 이미 데이터가 있으면 불러오지 않음
      if (location.state?.checkupDesign) {
        console.log('✅ [검진설계] location.state에서 데이터 로드 완료');
        return;
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const uuid = urlParams.get('uuid');
        const hospitalId = urlParams.get('hospital') || urlParams.get('hospitalId');

        if (!uuid || !hospitalId) {
          console.warn('⚠️ [검진설계] UUID 또는 hospitalId가 없어 저장된 설계를 불러올 수 없습니다.');
          return;
        }

        console.log('🔍 [검진설계] 저장된 설계 결과 조회 시작:', { uuid, hospitalId });
        const result = await checkupDesignService.getLatestCheckupDesign(uuid, hospitalId);

        if (result.success && result.data) {
          console.log('✅ [검진설계] 저장된 설계 결과 발견 - 데이터 로드 완료');
          setGptResponse(result.data);
          // selectedConcerns는 design_result에 포함되어 있을 수 있으므로 확인 필요
          if (result.data.selected_concerns) {
            setSelectedConcerns(result.data.selected_concerns);
          }
          setIsLoading(false);
        } else {
          console.log('📭 [검진설계] 저장된 설계 결과 없음 - 처음 설계하는 경우');
          // 저장된 설계가 없으면 로딩 표시 유지 (사용자가 설계 페이지로 이동해야 함)
        }
      } catch (error) {
        console.error('❌ [검진설계] 저장된 설계 결과 조회 실패:', error);
        // 오류 발생 시에도 계속 진행 (처음 설계하는 경우일 수 있음)
      }
    };

    loadSavedDesign();
  }, [location.state]);

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
    if (!gptData) {
      return {
        ...mockRecommendationData,
        patientName: patient?.name || mockRecommendationData.patientName,
      };
    }

    // 1. Strategies 매핑 (Item Name -> Strategy)
    const strategyMap = new Map<string, any>();
    if (gptData.strategies && Array.isArray(gptData.strategies)) {
      gptData.strategies.forEach((strat: any) => {
        if (strat.target) {
          strategyMap.set(strat.target, strat);
        }
      });
    }

    // 2. 카테고리 구성 (Priority 2, 3 및 기타 카테고리 통합)
    let categories: RecommendationCategory[] = [];

    // Priority 2 (병원 추천 정밀 검진)
    if (gptData.priority_2) {
      const p2 = gptData.priority_2;
      const p2Items = (p2.items || []).map((itemName: string, idx: number) => {
        const strategy = strategyMap.get(itemName);
        // strategy가 없으면 기본값 생성
        const reason = strategy?.doctor_recommendation?.reason || '';
        const evidence = strategy?.doctor_recommendation?.evidence || '';
        
        return {
          id: `p2-item-${idx}`,
          name: itemName,
          nameEn: '',
          description: p2.health_context || '',
          reason: reason,
          evidence: evidence,
          recommended: true,
          difficulty_level: 'Mid',
          // ⭐ Bridge Strategy 주입
          bridge_strategy: strategy ? {
            step1_anchor: strategy.step1_anchor,
            step2_gap: strategy.step2_gap,
            step3_offer: strategy.step3_offer,
            evidence_id: strategy.target // 임시로 target 이름을 ID로 사용 (추후 백엔드 ID로 교체)
          } : undefined
        };
      });

      categories.push({
        categoryName: p2.title || '병원 추천 정밀 검진',
        itemCount: p2Items.length,
        priorityLevel: 2,
        priorityDescription: p2.description,
        items: p2Items,
        defaultExpanded: true
      });
    }

    // Priority 3 (선택 검진)
    if (gptData.priority_3) {
      const p3 = gptData.priority_3;
      const p3Items = (p3.items || []).map((itemName: string, idx: number) => {
        const strategy = strategyMap.get(itemName);
        const reason = strategy?.doctor_recommendation?.reason || '';
        const evidence = strategy?.doctor_recommendation?.evidence || '';

        return {
          id: `p3-item-${idx}`,
          name: itemName,
          nameEn: '',
          description: p3.health_context || '',
          reason: reason,
          evidence: evidence,
          recommended: false, // 선택 항목은 기본 해제 검토
          difficulty_level: 'High',
          bridge_strategy: strategy ? {
            step1_anchor: strategy.step1_anchor,
            step2_gap: strategy.step2_gap,
            step3_offer: strategy.step3_offer,
            evidence_id: strategy.target
          } : undefined
        };
      });

      categories.push({
        categoryName: p3.title || '선택 검진 항목',
        itemCount: p3Items.length,
        priorityLevel: 3,
        priorityDescription: '개인적 필요에 따라 선택할 수 있는 항목입니다.',
        items: p3Items,
        defaultExpanded: true
      });
    }

    // 기존 recommended_items가 있다면 추가 (호환성 유지)
    if (gptData.recommended_items && (!gptData.priority_2 && !gptData.priority_3)) {
      const legacyCategories = gptData.recommended_items.map((cat: any) => ({
        categoryName: cat.category || '기타',
        itemCount: cat.itemCount || cat.items?.length || 0,
        items: (cat.items || []).map((item: any, index: number) => ({
          id: `legacy-${index}`,
          name: item.name,
          reason: item.reason,
          recommended: true
        })),
        defaultExpanded: true
      }));
      categories = [...categories, ...legacyCategories];
    }

    // summary 객체 구성
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
      patientName: patientName,
      totalCount: categories.reduce((sum, cat) => sum + cat.itemCount, 0),
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
        patientName: patientName,
      };
  }, [gptResponse, patientName]);

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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set()); // 각 아이템 아코디언 상태
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState<boolean>(false);

  // priority 아코디언 기본 펼침 상태 설정
  useEffect(() => {
    const initialExpanded = new Set<string>();
    
    // Priority 1: 간호사 말풍선과 focus_items 기본 펼침
    if (recommendationData.summary?.priority_1) {
      initialExpanded.add(`priority_1_nurse_${recommendationData.summary.priority_1.title || '1순위'}`);
    }
    
    // priority_2, priority_3 우선순위 카드만 기본 펼침
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

  // 아이템 아코디언 토글
  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
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

  // 카테고리 섹션 렌더링 헬퍼 함수
  const renderCategorySection = (
    categoriesToRender: RecommendationCategory[], 
    sectionClass: string = "checkup-recommendations__cards",
    hasPriorityCardInHeader: boolean = false
  ) => {
    return (
      <div className={sectionClass}>
        {categoriesToRender.map((category) => {
          const isCategoryExpanded = category.priorityLevel ? true : expandedCategories.has(category.categoryName);
          const wrapperClass = category.priorityLevel 
             ? "checkup-recommendations__category-section" 
             : `checkup-recommendations__card ${isCategoryExpanded ? 'checkup-recommendations__card--expanded' : ''}`;

          return (
            <div key={category.categoryName} className={wrapperClass}>
              {!category.priorityLevel && (
                 <div className="checkup-recommendations__card-header" onClick={() => toggleCategory(category.categoryName)}>
                   <div className="checkup-recommendations__card-header-left">
                     <h3 className="checkup-recommendations__card-title">{category.categoryName}</h3>
                   </div>
                   <div className="checkup-recommendations__card-arrow">
                     <svg className={`checkup-recommendations__card-arrow-icon ${isCategoryExpanded ? 'expanded' : 'collapsed'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                       <polyline points="6,9 12,15 18,9"></polyline>
                     </svg>
                   </div>
                 </div>
              )}
              {category.priorityDescription && !category.priorityLevel && (
                 <div className="checkup-recommendations__category-priority-description">
                   {category.priorityDescription}
                 </div>
              )}
              {isCategoryExpanded && (
                <div className={!category.priorityLevel ? "checkup-recommendations__card-content" : ""}>
                   {category.priorityDescription && !category.priorityLevel && (
                      <div className="checkup-recommendations__category-description-in-content">
                        <span className="checkup-recommendations__category-description-label">이 카테고리는 {category.priorityLevel}순위입니다:</span>
                        <span className="checkup-recommendations__category-description-text">{category.priorityDescription}</span>
                      </div>
                   )}
                   {category.items.map((item) => (
                     <CheckupItemCard
                       key={item.id}
                       item={item}
                       isExpanded={expandedItems.has(item.id)}
                       onToggle={toggleItem}
                       hideReason={hasPriorityCardInHeader && !!category.priorityLevel} 
                       onShowEvidence={handleShowEvidence}
                     />
                   ))}
                   {category.doctorRecommendation?.hasRecommendation && (
                     <DoctorMessageBox
                       message={category.doctorRecommendation.message}
                       highlightedText={category.doctorRecommendation.highlightedText}
                       imageSrc={checkPlannerImage}
                     />
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
                src={WELNO_LOGO_IMAGE}
                alt="로딩 중"
                className="welno-icon-blink"
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
        {/* 헤더 (로고 + 뒤로가기 버튼 + 새로고침 버튼) */}
        <div className="main-page__header checkup-recommendations__header-with-back">
          {/* 뒤로가기 버튼 (좌측) */}
          <div className="back-button-container">
            <button
              className="back-button"
              onClick={handleCloseClick}
              aria-label="뒤로가기"
            >
              ←
            </button>
          </div>
          
          <div className="main-page__header-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
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
          
          {/* 새로고침 버튼 (우측) */}
          <div className="checkup-recommendations__refresh-button-container">
            <button
              className="checkup-recommendations__refresh-button"
              onClick={async () => {
                try {
                  const urlParams = new URLSearchParams(window.location.search);
                  const uuid = urlParams.get('uuid');
                  const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
                  
                  if (uuid && hospital) {
                    // 기존 설계 요청 삭제
                    console.log('🗑️ [검진설계] 새로고침 - 기존 설계 요청 삭제 시작');
                    await checkupDesignService.deleteCheckupDesign(uuid, hospital);
                    console.log('✅ [검진설계] 새로고침 - 기존 설계 요청 삭제 완료');
                  }
                  
                  // 채팅 화면으로 이동 (refresh=true 파라미터 포함)
                  urlParams.set('refresh', 'true');
                  navigate(`/checkup-design?${urlParams.toString()}`);
                } catch (error) {
                  console.error('❌ [검진설계] 새로고침 중 오류:', error);
                  // 오류가 발생해도 채팅 화면으로 이동
                  const urlParams = new URLSearchParams(window.location.search);
                  urlParams.set('refresh', 'true');
                  navigate(`/checkup-design?${urlParams.toString()}`);
                }
              }}
              aria-label="새로 설계하기"
              title="처음부터 다시 설계하기"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 환자 인사말 + 추천 설명 */}
        <div className="main-page__greeting">
          <h1 className="main-page__greeting-title checkup-recommendations__title">
            <span className="patient-name checkup-recommendations__patient-name">{recommendationData.patientName} 님</span>
            <br />
            <span className="greeting-text">건강 상태에 꼭 필요한 검진 항목을 추천드려요!</span>
          </h1>
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
                <div className="checkup-recommendations__card-content">
                    {/* description 또는 national_checkup_note를 간호사 말풍선으로 표시 */}
                    {(recommendationData.summary?.priority_1?.description || recommendationData.summary?.priority_1?.national_checkup_note || recommendationData.summary?.priority_1?.focus_items) && (
                      <>
                        {(() => {
                          const findReferencesForPriority1 = (): string[] => {
                            const category = recommendationData.categories.find(cat => cat.priorityLevel === 1);
                            if (category && category.items.length > 0) {
                              return (category.items[0] as any)?.references || [];
                            }
                            return [];
                          };
                          const priority1References = findReferencesForPriority1();
                          const noteText = recommendationData.summary?.priority_1?.national_checkup_note || recommendationData.summary?.priority_1?.description || '';
                          const cleanedNote = cleanNationalCheckupNote(noteText);
                          const nurseAccordionKey = `priority_1_nurse_${recommendationData.summary?.priority_1?.title || '1순위'}`;
                          const isNurseExpanded = expandedCategories.has(nurseAccordionKey);
                          
                          return (
                            <>
                              <div className="checkup-recommendations__doctor-box-wrapper">
                              <div className={`checkup-recommendations__doctor-box ${!isNurseExpanded ? 'collapsed' : ''}`}>
                                <div className="checkup-recommendations__doctor-box-image">
                                  <img
                                    src={checkPlannerImage}
                                    alt="간호사 일러스트"
                                    className="checkup-recommendations__doctor-illustration"
                                  />
                                </div>
                                <div className="checkup-recommendations__doctor-box-text">
                                  {renderTextWithFootnotes(cleanedNote, priority1References)}
                                  {!isNurseExpanded && (
                                    <div className="checkup-recommendations__nurse-gradient-overlay" />
                                  )}
                                  {/* 각주 리스트 표시 - 텍스트에 실제로 사용된 각주만 표시 */}
                                  {(() => {
                                    const usedFootnoteNumbers = extractFootnoteNumbers(cleanedNote);
                                    
                                    if (usedFootnoteNumbers.length === 0) {
                                      return null;
                                    }
                                    
                                    return (
                                      <div className="checkup-recommendations__footnotes">
                                        {usedFootnoteNumbers.map((footnoteNum: number) => {
                                          const refIndex = footnoteNum - 1;
                                          const ref = priority1References && priority1References.length > refIndex ? priority1References[refIndex] : null;
                                          
                                          return (
                                            <div key={footnoteNum} className="checkup-recommendations__footnote-item">
                                              <span className="checkup-recommendations__footnote-number">[{footnoteNum}]</span>
                                              {ref ? (
                                                (ref.startsWith('http://') || ref.startsWith('https://')) ? (
                                                  <a 
                                                    href={ref} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="checkup-recommendations__footnote-link"
                                                  >
                                                    [링크]
                                                  </a>
                                                ) : (
                                                  <span className="checkup-recommendations__footnote-text">{ref}</span>
                                                )
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            </>
                          )})()}
                        </>
                      )}
                      
                      {/* 아코디언 화살표 - 간호사 박스 밑 중앙 (항상 고정 위치) */}
                      {recommendationData.summary?.priority_1?.focus_items && recommendationData.summary.priority_1.focus_items.length > 0 && (
                        <div 
                          className="checkup-recommendations__nurse-accordion-toggle"
                          onClick={() => {
                            const nurseKey = `priority_1_nurse_${recommendationData.summary?.priority_1?.title || '1순위'}`;
                            toggleCategory(nurseKey);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <svg
                            className={`checkup-recommendations__card-arrow-icon ${
                              expandedCategories.has(`priority_1_nurse_${recommendationData.summary?.priority_1?.title || '1순위'}`) ? 'expanded' : 'collapsed'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      )}
                    
                    {/* 각 항목별 상세 정보 (focus_items) - 간호사 말풍선 기준 아코디언 */}
                    {expandedCategories.has(`priority_1_nurse_${recommendationData.summary?.priority_1?.title || '1순위'}`) && recommendationData.summary?.priority_1?.focus_items && recommendationData.summary.priority_1.focus_items.length > 0 && (
                              <div className="checkup-recommendations__focus-items">
                                {recommendationData.summary?.priority_1?.focus_items.map((item: any, idx: number) => {
                                  // priority_1의 items에 해당하는 recommended_items에서 references, evidence, description 찾기
                                  // 매칭 로직: 정확 일치 → 부분 포함 → 정규화 후 매칭
                                  const findItemData = (itemName: string): { references: string[], evidence?: string, description?: string } => {
                                    if (!itemName) return { references: [] };
                                    
                                    // 정규화 함수: 공백, 괄호, 특수문자 제거 후 소문자 변환
                                    const normalize = (str: string): string => {
                                      return str
                                        .replace(/\s+/g, '') // 공백 제거
                                        .replace(/[()（）]/g, '') // 괄호 제거
                                        .replace(/[등및]/g, '') // "등", "및" 제거
                                        .toLowerCase();
                                    };
                                    
                                    const normalizedItemName = normalize(itemName);
                                    
                                    // 모든 1순위 카테고리를 순회
                                    const priority1Categories = recommendationData.categories.filter(cat => cat.priorityLevel === 1);
                                    
                                    for (const category of priority1Categories) {
                                      if (!category.items || category.items.length === 0) continue;
                                      
                                      for (const categoryItem of category.items) {
                                        const categoryItemName = (categoryItem as any)?.name || '';
                                        if (!categoryItemName) continue;
                                        
                                        // 1. 정확 일치
                                        if (categoryItemName === itemName) {
                                          return {
                                            references: (categoryItem as any)?.references || [],
                                            evidence: (categoryItem as any)?.evidence,
                                            description: (categoryItem as any)?.description
                                          };
                                        }
                                        
                                        // 2. 부분 포함 (itemName이 categoryItemName을 포함하거나 그 반대)
                                        if (categoryItemName.includes(itemName) || itemName.includes(categoryItemName)) {
                                          return {
                                            references: (categoryItem as any)?.references || [],
                                            evidence: (categoryItem as any)?.evidence,
                                            description: (categoryItem as any)?.description
                                          };
                                        }
                                        
                                        // 3. 정규화 후 매칭
                                        const normalizedCategoryName = normalize(categoryItemName);
                                        if (normalizedItemName === normalizedCategoryName) {
                                          return {
                                            references: (categoryItem as any)?.references || [],
                                            evidence: (categoryItem as any)?.evidence,
                                            description: (categoryItem as any)?.description
                                          };
                                        }
                                        
                                        // 4. 정규화 후 부분 포함
                                        if (normalizedItemName.includes(normalizedCategoryName) || 
                                            normalizedCategoryName.includes(normalizedItemName)) {
                                          return {
                                            references: (categoryItem as any)?.references || [],
                                            evidence: (categoryItem as any)?.evidence,
                                            description: (categoryItem as any)?.description
                                          };
                                        }
                                        
                                        // 5. priority_1.items 배열과도 매칭 시도
                                        const priority1Items = recommendationData.summary?.priority_1?.items || [];
                                        if (priority1Items.includes(categoryItemName) && 
                                            (priority1Items.includes(itemName) || itemName.includes(categoryItemName))) {
                                          return {
                                            references: (categoryItem as any)?.references || [],
                                            evidence: (categoryItem as any)?.evidence,
                                            description: (categoryItem as any)?.description
                                          };
                                        }
                                      }
                                    }
                                    
                                    return { references: [] };
                                  };
                                  const itemName = item.name || item.item_name;
                                  const itemData = findItemData(itemName);
                                  const itemReferences = itemData.references;
                                  const itemEvidence = itemData.evidence;
                                  const itemDescription = itemData.description;
                                  
                                  return (
                                    <div key={idx} className="checkup-recommendations__focus-item">
                                      <div className="checkup-recommendations__focus-item-section">
                                        {/* 항목명 헤더 (제일 위로) */}
                                        <div className="checkup-recommendations__focus-item-header">
                                          <span className="checkup-recommendations__focus-item-label">확인 항목:</span>
                                          <span className="checkup-recommendations__focus-item-badge">{itemName}</span>
                                        </div>
                                        
                                        {/* 왜 중요한지 */}
                                        {(item.why_important || itemDescription) && (
                                          <>
                                            <div className="checkup-recommendations__focus-item-text">
                                              {renderTextWithFootnotes(item.why_important || itemDescription, itemReferences)}
                                              {item.check_point && (
                                                <>
                                                  {' '}
                                                  {renderTextWithFootnotes(item.check_point, itemReferences)}
                                                </>
                                              )}
                                            </div>
                                            {/* 각주 리스트 표시 - 텍스트에 실제로 사용된 각주만 표시 */}
                                            {(() => {
                                    // 텍스트에서 실제로 사용된 각주 번호 추출
                                    const combinedText = `${item.why_important || ''} ${item.check_point || ''}`;
                                    const usedFootnoteNumbers = extractFootnoteNumbers(combinedText);
                                    
                                    // 각주 참조가 없으면 표시하지 않음 (텍스트에 각주가 없으면)
                                    if (usedFootnoteNumbers.length === 0) {
                                      return null;
                                    }
                                    
                                    return (
                                      <div className="checkup-recommendations__footnotes">
                                        {usedFootnoteNumbers.map((footnoteNum: number) => {
                                          // 각주 번호는 1부터 시작, 배열은 0부터 시작
                                          const refIndex = footnoteNum - 1;
                                          const ref = itemReferences && itemReferences.length > refIndex ? itemReferences[refIndex] : null;
                                          
                                          return (
                                            <div key={footnoteNum} className="checkup-recommendations__footnote-item">
                                              <span className="checkup-recommendations__footnote-number">[{footnoteNum}]</span>
                                              {ref ? (
                                                (ref.startsWith('http://') || ref.startsWith('https://')) ? (
                                                  <a 
                                                    href={ref} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="checkup-recommendations__footnote-link"
                                                  >
                                                    [링크]
                                                  </a>
                                                ) : (
                                                  <span className="checkup-recommendations__footnote-text">{ref}</span>
                                                )
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                              );
                                            })()}
                                            {/* 의학적 근거를 "왜 중요한지" 섹션 하단으로 이동 */}
                                            {itemEvidence && (
                                              <div className="checkup-recommendations__item-evidence">
                                      <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
                                      <span className="checkup-recommendations__item-evidence-text">
                                        {renderTextWithFootnotes(
                                          itemEvidence,
                                          itemReferences
                                        )}
                                      </span>
                                      {/* 각주 리스트 표시 - 텍스트에 실제로 사용된 각주만 표시 */}
                                      {(() => {
                                        if (!itemEvidence || !itemReferences || itemReferences.length === 0) {
                                          return null;
                                        }
                                        
                                        // 텍스트에서 실제로 사용된 각주 번호 추출
                                        const usedFootnoteNumbers = extractFootnoteNumbers(itemEvidence);
                                        
                                        // 각주 참조가 없으면 표시하지 않음
                                        if (usedFootnoteNumbers.length === 0) {
                                          return null;
                                        }
                                        
                                        return (
                                          <div className="checkup-recommendations__footnotes">
                                            {usedFootnoteNumbers.map((footnoteNum: number) => {
                                              // 각주 번호는 1부터 시작, 배열은 0부터 시작
                                              const refIndex = footnoteNum - 1;
                                              const ref = itemReferences && itemReferences.length > refIndex ? itemReferences[refIndex] : null;
                                              
                                              return (
                                                <div key={footnoteNum} className="checkup-recommendations__footnote-item">
                                                  <span className="checkup-recommendations__footnote-number">[{footnoteNum}]</span>
                                                  {ref ? (
                                                    (ref.startsWith('http://') || ref.startsWith('https://')) ? (
                                                      <a 
                                                        href={ref} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="checkup-recommendations__footnote-link"
                                                      >
                                                        [링크]
                                                      </a>
                                                    ) : (
                                                      <span className="checkup-recommendations__footnote-text">{ref}</span>
                                                    )
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                  </div>
              </div>
                </>
              )}
            </div>
          </>
        )}

        {/* 3. 추천검진 항목 섹션 (2순위, 3순위 통합 - 개별 항목만 나열) */}
        {(recommendationData.summary?.priority_2 || recommendationData.summary?.priority_3) && (
          <>
            <div className="checkup-recommendations__section-header">
              <h2 className="checkup-recommendations__section-title">
                이 검사도 고민해보세요
              </h2>
            </div>

            {/* 2순위, 3순위 검진 항목들 - summary에서 가져와 strategies와 매칭하여 개별 항목으로 나열 */}
            <div className="checkup-recommendations__cards checkup-recommendations__cards--compact">
              {(() => {
                // priority_2와 priority_3의 items 배열을 합침
                const priority2Items = recommendationData.summary?.priority_2?.items || [];
                const priority3Items = recommendationData.summary?.priority_3?.items || [];
                const allPriorityItems = [...priority2Items, ...priority3Items];
                
                // strategies 배열에서 각 항목의 상세 정보 찾기
                const strategies = gptResponse?.strategies || [];
                
                return allPriorityItems.map((itemName: string, index: number) => {
                  // strategies에서 해당 항목 찾기
                  const strategy = strategies.find((s: any) => s.target === itemName);
                  
                  const item = {
                    id: `priority-item-${index}`,
                    name: itemName,
                    subtitle: strategy?.doctor_recommendation?.message || '', // 의사 메시지를 서브타이틀로 추가
                    description: strategy?.description || '',
                    reason: strategy?.doctor_recommendation?.reason || '',
                    evidence: strategy?.doctor_recommendation?.evidence || '',
                    references: strategy?.references || [],
                    recommended: true,
                    difficulty_level: strategy?.difficulty_level || (priority2Items.includes(itemName) ? 'Mid' : 'High'),
                    difficulty_badge: strategy?.difficulty_badge || (priority2Items.includes(itemName) ? '추천' : '프리미엄'),
                    // ⭐ Bridge 전략 3단계 데이터 추가
                    bridge_strategy: strategy ? {
                      step1_anchor: strategy.step1_anchor || '',
                      step2_gap: strategy.step2_gap || '',
                      step3_offer: strategy.step3_offer || '',
                    } : undefined,
                  };
                  
                  return (
                    <CheckupItemCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedItems.has(item.id)}
                      onToggle={toggleItem}
                      hideReason={false}
                      onShowEvidence={handleShowEvidence}
                    />
                  );
                });
              })()}
            </div>
          </>
        )}
            {/* 주요 사항 요약 섹션 (priority_1, priority_2, priority_3 표시) */}
            {((recommendationData.summary?.priority_1?.items && recommendationData.summary.priority_1.items.length > 0) ||
              (recommendationData.summary?.priority_2?.items && recommendationData.summary.priority_2.items.length > 0) ||
              (recommendationData.summary?.priority_3?.items && recommendationData.summary.priority_3.items.length > 0)) && (
              <div className="checkup-recommendations__summary-section">
                <h3 className="checkup-recommendations__summary-title">세심하게 체크 하고 고민해보세요</h3>
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
                      {/* priority_1: 올해 주의 깊게 보셔야 하는 항목 (최대 3개) */}
                      {priority1Items.length > 0 && (() => {
                        // 최대 3개로 제한
                        const limitedPriority1Items = priority1Items.slice(0, 3);
                        return (
                          <p className="checkup-recommendations__summary-text">
                            올해 주의 깊게 보셔야 하는거
                            <br />
                            <span className="checkup-recommendations__summary-tags-wrapper">
                              {limitedPriority1Items.map((item: string, idx: number) => (
                                <React.Fragment key={idx}>
                                  <span className="checkup-recommendations__summary-item-tag">{item}</span>
                                  {idx < limitedPriority1Items.length - 1 && ' '}
                                </React.Fragment>
                              ))}
                            </span>
                          </p>
                        );
                      })()}
                      
                      {/* priority_2, priority_3: 추가적으로 */}
                      {limitedAllAdditionalItems.length > 0 && context && (
                        <p className="checkup-recommendations__summary-text">
                          추가적으로
                          <br />
                          <span className="checkup-recommendations__summary-tags-wrapper">
                            {limitedAllAdditionalItems.map((item: string, idx: number) => (
                              <React.Fragment key={idx}>
                                <span className="checkup-recommendations__summary-item-tag">{item}</span>
                                {idx < limitedAllAdditionalItems.length - 1 && ' '}
                              </React.Fragment>
                            ))}
                          </span>
                          검사로
                          <br />
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

        {/* 2. 위험도 계층화 섹션 (아코디언) */}
        {gptResponse?.risk_profile && gptResponse.risk_profile.length > 0 && (
          <div className="checkup-recommendations__card checkup-recommendations__risk-profile-card">
            <div className="checkup-recommendations__card-header" onClick={() => {
              const categoryName = 'risk_profile';
              toggleCategory(categoryName);
            }}>
              <div className="checkup-recommendations__card-header-left">
              </div>
              <div className="checkup-recommendations__card-header-right">
                <h3 className="checkup-recommendations__card-title">위험도 계층화</h3>
                <span className="checkup-recommendations__risk-count-badge">
                  {gptResponse.risk_profile.filter((r: any) => r.risk_level && (r.risk_level.includes('High') || r.risk_level.includes('Very High'))).length}개 고위험
                </span>
              </div>
              <div className="checkup-recommendations__card-arrow">
                <svg
                  className={`checkup-recommendations__card-arrow-icon ${
                    expandedCategories.has('risk_profile') ? 'expanded' : 'collapsed'
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
            {expandedCategories.has('risk_profile') && (
              <div className="checkup-recommendations__card-content">
                <div className="checkup-recommendations__card-description">
                  <div className="checkup-recommendations__risk-profile-list">
                    {gptResponse.risk_profile.map((risk: any, idx: number) => {
                      const riskLevel = risk.risk_level || '';
                      const isHighRisk = riskLevel.includes('High') || riskLevel.includes('Very High');
                      return (
                        <div key={idx} className={`checkup-recommendations__risk-profile-item ${isHighRisk ? 'checkup-recommendations__risk-profile-item--high' : ''}`}>
                          <div className="checkup-recommendations__risk-profile-header">
                            <span className="checkup-recommendations__risk-profile-organ">{risk.organ_system}</span>
                            <span className={`checkup-recommendations__risk-profile-level checkup-recommendations__risk-profile-level--${riskLevel.toLowerCase().replace(/\s+/g, '-')}`}>
                              {riskLevel}
                            </span>
                          </div>
                          {risk.reason && (
                            <p className="checkup-recommendations__risk-profile-reason">{risk.reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 만성질환 연쇄 반응 섹션 (아코디언) */}
        {gptResponse?.chronic_analysis && gptResponse.chronic_analysis.has_chronic_disease && (
          <div className="checkup-recommendations__card checkup-recommendations__chronic-analysis-card">
            <div className="checkup-recommendations__card-header" onClick={() => {
              const categoryName = 'chronic_analysis';
              toggleCategory(categoryName);
            }}>
              <div className="checkup-recommendations__card-header-left">
              </div>
              <div className="checkup-recommendations__card-header-right">
                <h3 className="checkup-recommendations__card-title">만성질환 연쇄 반응</h3>
                {gptResponse.chronic_analysis.disease_list && gptResponse.chronic_analysis.disease_list.length > 0 && (
                  <span className="checkup-recommendations__chronic-disease-badge">
                    {gptResponse.chronic_analysis.disease_list.join(', ')}
                  </span>
                )}
              </div>
              <div className="checkup-recommendations__card-arrow">
                <svg
                  className={`checkup-recommendations__card-arrow-icon ${
                    expandedCategories.has('chronic_analysis') ? 'expanded' : 'collapsed'
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
            {expandedCategories.has('chronic_analysis') && (
              <div className="checkup-recommendations__card-content">
                <div className="checkup-recommendations__card-description">
                  {gptResponse.chronic_analysis.complication_risk && (
                    <div className="checkup-recommendations__chronic-complication">
                      <p className="checkup-recommendations__chronic-complication-text">
                        {gptResponse.chronic_analysis.complication_risk}
                      </p>
                    </div>
                  )}
                  {gptResponse.chronic_analysis.disease_list && gptResponse.chronic_analysis.disease_list.length > 0 && (
                    <div className="checkup-recommendations__chronic-disease-list">
                      <p className="checkup-recommendations__chronic-disease-label">보유 중인 만성질환:</p>
                      <ul className="checkup-recommendations__chronic-disease-items">
                        {gptResponse.chronic_analysis.disease_list.map((disease: string, idx: number) => (
                          <li key={idx} className="checkup-recommendations__chronic-disease-item">
                            {disease}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 우선순위가 없는 카테고리들 (priorityLevel이 없는 경우) - 2순위, 3순위 항목 중복 제거 */}
        {(() => {
          // 2순위, 3순위 항목명 리스트
          const priority2Items = recommendationData.summary?.priority_2?.items || [];
          const priority3Items = recommendationData.summary?.priority_3?.items || [];
          const priorityItemNames = [...priority2Items, ...priority3Items];
          
          // 우선순위가 없는 카테고리에서 2순위, 3순위 항목 제외
          const filteredCategories = recommendationData.categories
            .filter((category) => !category.priorityLevel)
            .map((category) => ({
              ...category,
              items: category.items.filter((item) => !priorityItemNames.includes(item.name))
            }))
            .filter((category) => category.items.length > 0); // 항목이 없는 카테고리 제외
          
          return renderCategorySection(
            filteredCategories,
            "checkup-recommendations__cards",
            false
          );
        })()}

        {/* ⭐ 의사 종합 코멘트 - 페이지 최하단 */}
        {gptResponse?.doctor_comment && (
          <div className="doctor-final-comment-section">
            <div className="checkup-recommendations__doctor-box doctor-final-comment-box">
              {/* 상단: 이미지 + 의사 코멘트 */}
              <div className="doctor-comment-top-row">
                <div className="checkup-recommendations__doctor-box-image">
                  <img
                    src={checkPlannerImage}
                    alt="의사 일러스트"
                    className="checkup-recommendations__doctor-illustration"
                  />
                </div>
                <div className="checkup-recommendations__doctor-box-text doctor-final-comment-text">
                  {/* 전체 평가 */}
                  {gptResponse.doctor_comment.overall_assessment && (
                    <div className="comment-assessment">
                      <h3>의사 종합 코멘트</h3>
                      <p>{gptResponse.doctor_comment.overall_assessment}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 하단: 핵심 추천사항 (전체 너비 사용) */}
              {gptResponse.doctor_comment.key_recommendations && 
               gptResponse.doctor_comment.key_recommendations.length > 0 && (
                <div className="comment-recommendations-full-width">
                  <h3>핵심 추천사항</h3>
                  <ul className="recommendations-list">
                    {gptResponse.doctor_comment.key_recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>
                        <span className="check-icon">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🔧 디버그 패널 (개발자 전용) */}
        {showDebugPanel && (
          <div className="debug-panel">
            <div className="debug-panel__header">
              <h3>🔧 개발자 디버그 패널</h3>
              <button 
                className="debug-panel__close"
                onClick={() => setShowDebugPanel(false)}
              >
                ✕
              </button>
            </div>
            <div className="debug-panel__content">
              <p className="debug-panel__description">
                최근 GPT 프롬프트 및 응답 로그 파일 (6개 세트)를 다운로드합니다.
              </p>
              <button 
                className="debug-panel__download-button"
                onClick={handleDownloadLogs}
              >
                📥 로그 파일 다운로드 (ZIP)
              </button>
              <p className="debug-panel__hint">
                💡 Tip: 로고를 5번 클릭하면 이 패널이 나타납니다
              </p>
            </div>
          </div>
        )}

      </div>
      {/* 근거 모달 */}
      <EvidenceModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        evidenceData={selectedEvidence}
        targetItemName={selectedItemName}
      />
    </div>
  );
};

export default CheckupRecommendationsPage;

