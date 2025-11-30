import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import ConcernSelection from '../components/checkup-design/ConcernSelection';
import checkupDesignService from '../services/checkupDesignService';
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
  // HealthDataViewer 형식: { ResultList: any[] }
  const [healthData, setHealthData] = useState<{ ResultList: any[] }>({ ResultList: [] });
  const [prescriptionData, setPrescriptionData] = useState<{ ResultList: any[] }>({ ResultList: [] });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 건강 데이터 로드 (HealthDataViewer 패턴 재사용 - 공용 로더 사용)
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
  }, [state.patient?.name]);

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
      
      // 1단계: 데이터 준비 (0-20%)
      await new Promise(resolve => setTimeout(resolve, 800));
      setProcessingProgress(20);
      
      // 2단계: 서버 전송 (20-40%)
      setProcessingStage('sending');
      await new Promise(resolve => setTimeout(resolve, 600));
      setProcessingProgress(40);
      
      // GPT API 호출하여 검진 설계 생성 (설문 응답 포함)
      // 주의: setLoading(true)를 호출하지 않음 - 모달이 가려지지 않도록
      setLoadingStage('sending');
      setLoadingMessage('데이터를 보내는 중...');
      
      // 3단계: AI 분석 (40-70%)
      setProcessingStage('analyzing');
      setProcessingProgress(50);
      
      const response = await checkupDesignService.createCheckupDesign({
        uuid,
        hospital_id: hospital,
        selected_concerns: selectedConcerns,
        survey_responses: surveyResponses
      });
      
      setProcessingProgress(70);
      
      // 4단계: 검진 설계 생성 (70-90%)
      setProcessingStage('designing');
      await new Promise(resolve => setTimeout(resolve, 500));
      setProcessingProgress(90);
      
      setLoadingStage('processing');
      setLoadingMessage('AI가 검진 설계를 생성하는 중...');
      
      console.log('✅ [검진설계] GPT 응답 수신:', response);
      
      // 5단계: 결과 저장 (90-100%)
      setProcessingStage('saving');
      await new Promise(resolve => setTimeout(resolve, 300));
      setProcessingProgress(100);
      
      setLoadingStage('complete');
      setLoadingMessage('검진 설계가 완료되었습니다.');
      
      // 모달 닫기 전 짧은 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowProcessingModal(false);
      
      // 결과 페이지로 이동
      const queryString = location.search;
      navigate(`/checkup-recommendations${queryString}`, { 
        state: { 
          checkupDesign: response.data,
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
      />
      <ConcernSelection
        healthData={healthData}
        prescriptionData={prescriptionData}
        onSelectionChange={handleSelectionChange}
        onNext={handleNext}
      />
    </>
  );
};

export default CheckupDesignPage;
