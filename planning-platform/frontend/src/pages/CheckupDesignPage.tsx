import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import ConcernSelection from '../components/checkup-design/ConcernSelection';
import ChatInterface from '../components/checkup-design/ChatInterface';
import checkupDesignService, { Step1Result, CheckupDesignStep2Request } from '../services/checkupDesignService';
import { loadHealthData } from '../utils/healthDataLoader';
import ProcessingModal, { ProcessingStage } from '../components/checkup-design/ProcessingModal';
import './CheckupDesignPage.scss';

const CheckupDesignPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useWelloData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('건강 데이터를 불러오는 중...');
  const [loadingStage, setLoadingStage] = useState<'loading_data' | 'sending' | 'processing' | 'complete'>('loading_data');
  
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
        const uuid = urlParams.get('uuid');
        const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

        if (!uuid || !hospital) {
          setError('환자 정보가 없습니다.');
          setLoading(false);
          return;
        }

        // 설계 완료 여부 확인 (새로고침 플래그가 없을 때만)
        const shouldRefresh = urlParams.get('refresh') === 'true';
        if (!shouldRefresh) {
          try {
            const designResult = await checkupDesignService.getLatestCheckupDesign(uuid, hospital);
            if (designResult.success && designResult.data) {
              console.log('✅ [검진설계] 기존 설계 결과 발견 - 결과 페이지로 이동');
              // 기존 설계 결과가 있으면 결과 페이지로 바로 이동
              const queryString = location.search.replace(/[?&]refresh=true/, ''); // refresh 파라미터 제거
              navigate(`/checkup-recommendations${queryString}`, {
                state: {
                  checkupDesign: designResult.data,
                  fromExisting: true // 기존 설계 결과임을 표시
                }
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
        setError('건강 데이터를 불러오는데 실패했습니다.');
        setLoading(false);
      }
    };

    loadData();
  }, [state.patient?.name, location.search, navigate]);

  // 선택 항목 변경 핸들러
  const handleSelectionChange = (items: Set<string>) => {
    setSelectedItems(items);
  };

  // 다음 단계 핸들러 (설문 응답 포함)
  const handleNext = async (items: Set<string>, selectedConcerns: any[], surveyResponses?: any) => {
    try {
      console.log('✅ [검진설계] 선택된 항목:', Array.from(items));
      console.log('✅ [검진설계] 선택된 염려 항목:', selectedConcerns);
      console.log('✅ [검진설계] 설문 응답:', surveyResponses);
      
      // 선택된 염려 항목 저장 (ProcessingModal에 전달용)
      setCurrentSelectedConcerns(selectedConcerns);
      
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
      
      if (!uuid || !hospital) {
        setError('환자 정보가 없습니다.');
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
      setLoadingMessage('데이터를 보내는 중...');
      
      console.log('🔍 [CheckupDesignPage] STEP 1 API 호출 시작');
      const step1Response = await checkupDesignService.createCheckupDesignStep1({
        uuid,
        hospital_id: hospital,
        selected_concerns: selectedConcerns,
        survey_responses: surveyResponses
      });
      
      console.log('✅ [CheckupDesignPage] STEP 1 응답 수신:', step1Response);
      
      // STEP 1 결과 저장 (타이핑 효과용) - analyzing 단계에서 타이핑 시작
      if (step1Response.success && step1Response.data) {
        setStep1Result(step1Response.data);
        setProcessingProgress(50);
        // analyzing 단계 유지 (타이핑 효과가 시작되도록)
        // 약간의 딜레이 후 designing 단계로 전환
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // STEP 2: 설계 및 근거 확보 (스피너는 계속 돌면서 타이핑 텍스트 유지)
      setProcessingStage('designing');
      setLoadingStage('processing');
      setLoadingMessage('검진 항목 설계 중...');
      
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
        }
      };
      
      const step2Request: CheckupDesignStep2Request = {
        uuid,
        hospital_id: hospital,
        step1_result: step1Result,
        selected_concerns: selectedConcerns,
        survey_responses: surveyResponses
      };
      
      console.log('🔍 [CheckupDesignPage] STEP 2 API 호출 시작');
      const step2Response = await checkupDesignService.createCheckupDesignStep2(step2Request);
      
      console.log('✅ [CheckupDesignPage] STEP 2 응답 수신:', step2Response);
      
      setProcessingProgress(80);
      
      // STEP 1과 STEP 2 결과 병합 (백엔드에서 이미 병합되어 있지만, 프론트엔드에서도 확인)
      const mergedData = {
        ...step1Response.data,
        ...step2Response.data
      };
      
      setProcessingProgress(90);
      
      // 5단계: 결과 저장 (90-100%)
      setProcessingStage('saving');
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(100);
      
      setLoadingStage('complete');
      setLoadingMessage('검진 설계가 완료되었습니다.');
      
      // 모달 닫기 전 짧은 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowProcessingModal(false);
      
      // 결과 페이지로 이동 (병합된 데이터 사용)
      const queryString = location.search;
      navigate(`/checkup-recommendations${queryString}`, { 
        state: { 
          checkupDesign: mergedData,
          selectedConcerns: selectedConcerns,
          surveyResponses: surveyResponses
        }
      });
    } catch (error) {
      console.error('❌ [검진설계] API 호출 실패:', error);
      setError('검진 설계 생성에 실패했습니다. 다시 시도해주세요.');
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
            {loadingStage === 'sending' && (
              <p className="loading-spinner__sub-message">서버로 전송 중입니다...</p>
            )}
            {loadingStage === 'processing' && (
              <p className="loading-spinner__sub-message">AI가 분석하고 있습니다...</p>
            )}
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
              const queryString = location.search;
              navigate(`/${queryString}`);
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
          <p>건강 데이터가 없습니다.</p>
          <button 
            onClick={() => {
              const queryString = location.search;
              navigate(`/${queryString}`);
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
