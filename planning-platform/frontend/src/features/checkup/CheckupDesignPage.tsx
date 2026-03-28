import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelnoData } from '../../contexts/WelnoDataContext';
import ConcernSelection from '../../components/checkup-design/ConcernSelection';
import ChatInterface from '../../components/checkup-design/ChatInterface';
import checkupDesignService, { Step1Result, CheckupDesignStep2Request } from '../../services/checkupDesignService';
import { loadHealthData } from '../../utils/healthDataLoader';
import ProcessingModal, { ProcessingStage } from '../../components/checkup-design/ProcessingModal';
import WelnoModal from '../../components/common/WelnoModal';
import { InteractionEvent } from '../../components/checkup-design/CheckupDesignSurveyPanel/useSurveyTracker';
import './CheckupDesignPage.scss';

// WelnoModal 확인 다이얼로그 (window.confirm 대체)
interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  desc: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const CheckupDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useWelnoData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('건강 데이터를 가져오고 있어요');
  const [loadingStage, setLoadingStage] = useState<'loading_data' | 'sending' | 'processing' | 'complete'>('loading_data');

  // WelnoModal 확인 다이얼로그 상태
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false, title: '', desc: '', confirmLabel: '', cancelLabel: '',
    onConfirm: () => {}, onCancel: () => {},
  });

  // 처리 모달 상태
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('preparing');
  const [processingProgress, setProcessingProgress] = useState(0);
  // STEP 1 결과 상태 (타이핑 효과용)
  const [step1Result, setStep1Result] = useState<any>(null);
  // HealthDataViewer 형식: { ResultList: any[] }
  const [healthData, setHealthData] = useState<{ ResultList: any[] }>({ ResultList: [] });
  const [prescriptionData, setPrescriptionData] = useState<{ ResultList: any[] }>({ ResultList: [] });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentSelectedConcerns, setCurrentSelectedConcerns] = useState<any[]>([]);

  // 건강 데이터 로드 및 설계 완료 여부 확인
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const urlParams = new URLSearchParams(window.location.search);
        let uuid = urlParams.get('uuid');
        let hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

        // URL 파라미터가 없으면 Context에서 가져오기
        if (!uuid && state.patient?.uuid) {
          uuid = state.patient.uuid;
        }
        if (!hospital && state.patient?.hospital_id) {
          hospital = state.patient.hospital_id;
        }
        if (!hospital && state.hospital?.hospital_id) {
          hospital = state.hospital.hospital_id;
        }

        if (!uuid || !hospital) {
          setError('정보를 찾지 못했어요');
          setLoading(false);
          return;
        }

        // link_data 모드 불필요 — 링크 데이터는 save-link-health-data API로 DB에 이미 저장됨

        // 설계 완료 여부 확인 (새로고침 플래그가 없을 때만)
        const shouldRefresh = urlParams.get('refresh') === 'true';
        const resumeId = urlParams.get('resume'); // ✅ 알림톡 재시도 파라미터
        
        if (!shouldRefresh) {
          try {
            // 1순위: 완료된 설계 확인
            const designResult = await checkupDesignService.getLatestCheckupDesign(uuid, hospital);
            if (designResult.success && designResult.data) {
              console.log('✅ [검진설계] 완료된 설계 발견 - 선택 모달');
              const savedData = designResult.data;
              setLoading(false);
              setConfirmModal({
                isOpen: true,
                title: '이전에 받은 설계가 있어요',
                desc: '어떻게 할까요?',
                confirmLabel: '결과 보기',
                cancelLabel: '새로 만들기',
                onConfirm: () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  navigate(`/recommendations${location.search}`, {
                    state: { checkupDesign: savedData, fromExisting: true }
                  });
                },
                onCancel: () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  navigate(`/checkup-design?uuid=${uuid}&hospital=${hospital}&refresh=true`);
                },
              });
              return;
            }
            
            // 2순위: 미완료 설계 확인 (STEP1만 완료)
            const incompleteResult = await checkupDesignService.getIncompleteCheckupDesign(uuid, hospital);
            if (incompleteResult.success && incompleteResult.data) {
              console.log('⚠️ [검진설계] 미완료 설계 발견 - 복구 처리');
              
              const requestId = incompleteResult.data.id;
              
              // ✅ resume 파라미터가 있으면 자동으로 재시도 (알림톡에서 진입)
              if (resumeId && requestId && parseInt(resumeId) === requestId) {
                console.log('🔄 [검진설계] 알림톡 재시도 - 자동 진행');
                setShowProcessingModal(true);
                setProcessingStage('preparing');
                setProcessingProgress(0);
                
                setTimeout(async () => {
                  try {
                    setProcessingStage('designing');
                    setProcessingProgress(50);
                    
                    const retryResult = await checkupDesignService.retryCheckupDesign(requestId);
                    
                    setProcessingProgress(100);
                    setProcessingStage('saving');
                    
                    if (retryResult.success && retryResult.data) {
                      console.log('✅ [검진설계] 재시도 성공');
                      await new Promise(resolve => setTimeout(resolve, 500));
                      setShowProcessingModal(false);
                      
                      const queryString = location.search.replace(/[?&]resume=\d+/, '');
                      navigate(`/recommendations${queryString}`, {
                        state: { checkupDesign: retryResult.data }
                      });
                    }
                  } catch (retryError) {
                    console.error('❌ [검진설계] 재시도 실패:', retryError);
                    setError('다시 시도했지만 안 됐어요. 처음부터 시작할게요');
                    setShowProcessingModal(false);
                    navigate(`/checkup-design?uuid=${uuid}&hospital=${hospital}&refresh=true`);
                  }
                }, 1000);
                
                return;
              }
              
              // ✅ 수동 진입: WelnoModal로 복구 확인
              setLoading(false);
              setConfirmModal({
                isOpen: true,
                title: '이전에 하던 설계가 있어요',
                desc: '이어서 할까요?',
                confirmLabel: '이어서 하기',
                cancelLabel: '처음부터',
                onConfirm: () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (!requestId) return;
                  setShowProcessingModal(true);
                  setProcessingStage('preparing');
                  setProcessingProgress(0);
                  setTimeout(async () => {
                    try {
                      setProcessingStage('designing');
                      setProcessingProgress(50);
                      const retryResult = await checkupDesignService.retryCheckupDesign(requestId);
                      setProcessingProgress(100);
                      setProcessingStage('saving');
                      if (retryResult.success && retryResult.data) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        setShowProcessingModal(false);
                        navigate(`/recommendations${location.search}`, {
                          state: { checkupDesign: retryResult.data }
                        });
                      }
                    } catch (retryError) {
                      setError('잠시 후 다시 시도해주세요');
                      setShowProcessingModal(false);
                    }
                  }, 1000);
                },
                onCancel: () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  navigate(`/checkup-design?uuid=${uuid}&hospital=${hospital}&refresh=true`);
                },
              });
              return;
            }
          } catch (err) {
            console.warn('⚠️ [검진설계] 설계 결과 조회 실패 (계속 진행):', err);
            // 조회 실패해도 계속 진행 (처음 설계하는 경우)
          }
        }

        // 공용 데이터 로더 사용 (API 우선, IndexedDB 폴백)
        const result = await loadHealthData(uuid, hospital, state.patient?.name);
        
        console.log('📊 [검진설계] 데이터 로드 완료:', {
          healthDataCount: result.healthData.ResultList.length,
          prescriptionDataCount: result.prescriptionData.ResultList.length,
          lastUpdate: result.lastUpdate
        });
        
        setHealthData(result.healthData);
        setPrescriptionData(result.prescriptionData);
        setLoading(false);
      } catch (err) {
        console.error('❌ [검진설계] 데이터 로드 실패:', err);
        setError('건강 데이터를 불러오지 못했어요');
        setLoading(false);
      }
    };

    loadData();
  }, [state.patient?.name, state.patient?.uuid, state.patient?.hospital_id, state.hospital?.hospital_id, location.search, navigate]);

  // 선택 항목 변경 핸들러
  const handleSelectionChange = (items: Set<string>) => {
    setSelectedItems(items);
  };

  // 다음 단계 핸들러 (설문 응답 포함)
  const handleNext = async (
    items: Set<string>, 
    selectedConcerns: any[], 
    surveyResponses?: any,
    events?: InteractionEvent[]
  ) => {
    try {
      console.log('✅ [검진설계] 선택된 항목:', Array.from(items));
      console.log('✅ [검진설계] 선택된 염려 항목:', selectedConcerns);
      console.log('✅ [검진설계] 설문 응답:', surveyResponses);
      console.log('✅ [검진설계] 행동 로그:', events);
      
      // 선택된 염려 항목 저장 (ProcessingModal에 전달용)
      setCurrentSelectedConcerns(selectedConcerns);
      
      const urlParams = new URLSearchParams(window.location.search);
      let uuid = urlParams.get('uuid');
      let hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
      
      // URL 파라미터가 없으면 Context에서 가져오기
      if (!uuid && state.patient?.uuid) {
        uuid = state.patient.uuid;
      }
      if (!hospital && state.patient?.hospital_id) {
        hospital = state.patient.hospital_id;
      }
      if (!hospital && state.hospital?.hospital_id) {
        hospital = state.hospital.hospital_id;
      }
      
      if (!uuid || !hospital) {
        setError('정보를 찾지 못했어요');
        return;
      }
      
      // 처리 모달 표시 시작
      setShowProcessingModal(true);
      setProcessingStage('preparing');
      setProcessingProgress(0);
      setStep1Result(null); // STEP 1 결과 초기화
      
      // 1단계: 데이터 준비 (0-20%)
      await new Promise(resolve => setTimeout(resolve, 800));
      setProcessingProgress(20);
      
      // 2단계: 서버 전송 (20-40%)
      setProcessingStage('sending');
      await new Promise(resolve => setTimeout(resolve, 600));
      setProcessingProgress(40);
      
      // STEP 1: 빠른 분석 수행
      setProcessingStage('analyzing');
      setLoadingStage('sending');
      setLoadingMessage('데이터를 보내고 있어요');
      
      console.log('🔍 [CheckupDesignPage] STEP 1 API 호출 시작');
      // events 파라미터가 있다면 API 호출에 포함
      // (현재 checkupDesignService는 any로 받아주거나, 별도 인터페이스 수정 필요)
      // 여기서는 service의 메서드 시그니처가 any를 포함하고 있다고 가정하고 보냄
      // 실제로는 service 정의도 업데이트 해야 함. (일단 any로 보낸다고 가정)
      
      const step1Request = {
        uuid,
        hospital_id: hospital,
        selected_concerns: selectedConcerns,
        survey_responses: surveyResponses,
        events: events // 행동 로그 추가
      };

      const step1Response = await checkupDesignService.createCheckupDesignStep1(step1Request);
      
      console.log('✅ [CheckupDesignPage] STEP 1 응답 수신:', step1Response);
      
      // ✅ STEP 1 결과 저장 (타이핑 효과용 + design_request_id 추출)
      let designRequestId: number | null = null;
      if (step1Response.success && step1Response.data) {
        setStep1Result(step1Response.data);
        setProcessingProgress(50);
        
        // ✅ design_request_id 저장 (DB에 저장된 요청 ID)
        designRequestId = step1Response.data.design_request_id ?? null;
        if (designRequestId) {
          console.log('✅ [STEP1] DB 저장 완료 - ID:', designRequestId);
        } else {
          console.warn('⚠️ [STEP1] design_request_id 없음 - DB 저장 실패 가능');
        }
        
        // 세션 ID 추출
        const sessionId = step1Response.data.session_id;
        if (sessionId) {
          console.log('🎬 [CheckupDesignPage] STEP 1에서 세션 ID 받음:', sessionId);
        } else {
          console.warn('⚠️ [CheckupDesignPage] STEP 1 응답에 session_id가 없음');
        }
        
        // analyzing 단계 유지 (타이핑 효과가 시작되도록)
        // 약간의 딜레이 후 designing 단계로 전환
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // STEP 2: 설계 및 근거 확보 (스피너는 계속 돌면서 타이핑 텍스트 유지)
      setProcessingStage('designing');
      setLoadingStage('processing');
      setLoadingMessage('검진 항목을 고르고 있어요');
      
      // STEP 1 결과를 STEP 2 요청에 포함 (타입 안전성 보장)
      if (!step1Response.success || !step1Response.data) {
        throw new Error('STEP 1 결과가 없습니다.');
      }
      
      const step1Data = step1Response.data;
      const step1Result: Step1Result = {
        patient_summary: step1Data.patient_summary || '',
        analysis: step1Data.analysis || '',
        survey_reflection: step1Data.survey_reflection || '',
        selected_concerns_analysis: step1Data.selected_concerns_analysis || [],
        basic_checkup_guide: step1Data.basic_checkup_guide || {
          title: '',
          description: '',
          focus_items: []
        },
        session_id: step1Data.session_id // 세션 ID 전달
      };
      
      const step2Request: CheckupDesignStep2Request = {
        uuid,
        hospital_id: hospital,
        step1_result: step1Result,
        selected_concerns: selectedConcerns,
        survey_responses: surveyResponses,
        session_id: step1Data.session_id // 세션 ID 전달
      };
      
      // 세션 ID 로그
      if (step1Data.session_id) {
        console.log('🎬 [CheckupDesignPage] STEP 2에 세션 ID 전달:', step1Data.session_id);
      }
      
      console.log('🔍 [CheckupDesignPage] STEP 2 API 호출 시작');
      
      // ✅ STEP2 호출을 try-catch로 감싸서 에러 시 폴백 처리
      try {
        const step2Response = await checkupDesignService.createCheckupDesignStep2(step2Request);
        
        console.log('✅ [CheckupDesignPage] STEP 2 응답 수신:', step2Response);
        
        setProcessingProgress(80);
        
        // STEP 2 응답에 이미 STEP 1 + STEP 2가 병합되어 있음
        // 프론트엔드는 STEP 2 응답만 사용
        const mergedData = step2Response.data;
        
        if (!mergedData) {
          throw new Error('STEP 2 응답 데이터가 없습니다.');
        }
        
        console.log('📦 [CheckupDesignPage] 최종 병합 데이터:', {
          keys: Object.keys(mergedData),
          has_priority_1: 'priority_1' in mergedData,
          has_priority_2: 'priority_2' in mergedData,
          has_priority_3: 'priority_3' in mergedData,
          has_recommended_items: 'recommended_items' in mergedData,
          recommended_items_count: mergedData.recommended_items?.length || 0
        });
        
        setProcessingProgress(90);
        
        // 5단계: 결과 저장 (90-100%)
        setProcessingStage('saving');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProcessingProgress(100);
        
        setLoadingStage('complete');
        setLoadingMessage('검진 설계가 완료됐어요!');
        
        // 모달 닫기 전 짧은 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
        setShowProcessingModal(false);
        
        // 결과 페이지로 이동 (병합된 데이터 사용)
        const queryString = location.search;
        navigate(`/recommendations${queryString}`, { 
          state: { 
            checkupDesign: mergedData,
            selectedConcerns: selectedConcerns,
            surveyResponses: surveyResponses,
            events // 결과 페이지에도 events 전달 (필요 시 활용)
          }
        });
        
      } catch (step2Error) {
        // ✅ STEP2 실패 시 폴백 로직
        console.error('❌ [STEP2] 실패:', step2Error);
        setShowProcessingModal(false);
        
        // STEP1 결과는 이미 DB에 저장되었음 → WelnoModal
        const savedDesignRequestId = designRequestId;
        setConfirmModal({
          isOpen: true,
          title: '중간에 멈췄어요',
          desc: '여기까지 분석한 건 저장했어요',
          confirmLabel: '다시 시도하기',
          cancelLabel: '나중에 할게요',
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            if (!savedDesignRequestId) {
              navigate(`/checkup-design${location.search}&refresh=true`);
              return;
            }
            setShowProcessingModal(true);
            setProcessingStage('designing');
            setProcessingProgress(50);
            try {
              const retryResult = await checkupDesignService.retryCheckupDesign(savedDesignRequestId);
              setProcessingProgress(100);
              setProcessingStage('saving');
              if (retryResult.success && retryResult.data) {
                await new Promise(resolve => setTimeout(resolve, 500));
                setShowProcessingModal(false);
                navigate(`/recommendations${location.search}`, {
                  state: { checkupDesign: retryResult.data }
                });
              }
            } catch (retryError) {
              setShowProcessingModal(false);
              setError('지금은 안 되네요. 나중에 다시 해볼게요');
            }
          },
          onCancel: () => {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            setError('여기까지 저장했어요. 나중에 알림 보내드릴게요');
          },
        });
      }
      
    } catch (error) {
      console.error('❌ [검진설계] 전체 실패:', error);
      setError('설계를 만들지 못했어요. 다시 시도해주세요');
      setLoading(false);
      setShowProcessingModal(false);
    }
  };

  if (loading) {
    return (
      <div className="checkup-design-page">
        <div className="checkup-design-page__loading">
          <div className="loading-spinner">
            <div className="loading-spinner__icon">
              <div className="spinner"></div>
            </div>
            <p className="loading-spinner__message">{loadingMessage}</p>
            <p className="loading-spinner__sub-message">데이터를 정제 중이에요...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checkup-design-page">
        <div className="checkup-design-page__error">
          <p>{error}</p>
          <button 
            onClick={() => {
              navigate(-1);
            }}
            className="checkup-design-page__back-button"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // HealthDataViewer 형식: { ResultList: [...] }
  const healthDataList = Array.isArray(healthData) ? healthData : healthData.ResultList || [];
  const prescriptionDataList = Array.isArray(prescriptionData) ? prescriptionData : prescriptionData.ResultList || [];
  
  if (healthDataList.length === 0 && prescriptionDataList.length === 0) {
    return (
      <div className="checkup-design-page">
        <div className="checkup-design-page__error">
          <p>아직 건강 데이터가 없어요</p>
          <button 
            onClick={() => {
              navigate(-1);
            }}
            className="checkup-design-page__back-button"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 확인 다이얼로그 (window.confirm 대체) */}
      <WelnoModal isOpen={confirmModal.isOpen} size="small" showWelnoIcon={false}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: '17px', fontWeight: 700, color: '#1a202c', margin: '0 0 8px' }}>{confirmModal.title}</p>
          <p style={{ fontSize: '14px', color: '#718096', margin: '0 0 20px' }}>{confirmModal.desc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={confirmModal.onConfirm} style={{ padding: '14px', background: '#7c746a', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              {confirmModal.confirmLabel}
            </button>
            <button onClick={confirmModal.onCancel} style={{ padding: '14px', background: '#f3f4f6', color: '#4a5568', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              {confirmModal.cancelLabel}
            </button>
          </div>
        </div>
      </WelnoModal>
      <ProcessingModal
        isOpen={showProcessingModal}
        stage={processingStage}
        progress={processingProgress}
        patientName={state.patient?.name}
        selectedConcernsCount={currentSelectedConcerns.length}
        healthDataCount={healthDataList.length}
        prescriptionDataCount={prescriptionDataList.length}
        step1Result={step1Result}
      />
      <ChatInterface
        healthData={healthData}
        prescriptionData={prescriptionData}
        onNext={handleNext}
      />
    </>
  );
};

export default CheckupDesignPage;
