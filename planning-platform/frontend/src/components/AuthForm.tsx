import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthInput, AuthMethodSelect } from './auth/components';
import { AuthWaiting, DataCollecting } from './auth/screens';
import { useAuthFlow } from './auth/hooks';
import { useWebSocketAuth } from '../hooks/useWebSocketAuth';
import TermsAgreementModal from './terms/TermsAgreementModal';
import PasswordModal from './PasswordModal';
import { PasswordModalType } from './PasswordModal/types';
import DataDeletionWarningModal from './common/DataDeletionWarningModal';
import { STORAGE_KEYS, StorageManager } from '../constants/storage';
import { useWelnoData } from '../contexts/WelnoDataContext';
import { API_ENDPOINTS } from '../config/api';
import { PasswordService } from './PasswordModal/PasswordService';
import kakaoIcon from '../assets/images/kakao.png';
import naverIcon from '../assets/images/naver.png';
import passIcon from '../assets/images/pass.png';
import './AuthForm.scss';

interface AuthFormProps {
  onBack: () => void;
}

// 인증 방식 목록
  const AUTH_TYPES = [
    { value: '4', label: '통신사Pass', icon: passIcon, description: 'SKT/KT/LG U+ 통신사 인증' },
  { value: '6', label: '네이버', icon: naverIcon, description: '네이버 계정으로 인증' },
  { value: '0', label: '카카오톡', icon: kakaoIcon, description: '카카오톡 앱으로 인증 (준비중)', disabled: true }
];

/**
 * 새로운 AuthForm - 공용 컴포넌트로 구성
 * 
 * 기존 5,000줄 → 약 200줄로 축소
 */
const AuthForm: React.FC<AuthFormProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authFlow = useAuthFlow();
  const { actions } = useWelnoData();
  
  // 추가 UI 상태
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentConfirmationStep, setCurrentConfirmationStep] = useState<'name' | 'phone' | 'birthday' | 'auth_method'>('name');
  const [authRequested, setAuthRequested] = useState(false);
  const [descriptionMessage, setDescriptionMessage] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [isCheckingPatient, setIsCheckingPatient] = useState(false);
  const [isDataCompleted, setIsDataCompleted] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('initial');
  const [statusMessage, setStatusMessage] = useState('');
  const [wsError, setWsError] = useState<string | null>(null);
  const [lastCollectedRecord, setLastCollectedRecord] = useState<any | null>(null);
  
  // 비밀번호 설정 모달 상태
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [passwordSetupData, setPasswordSetupData] = useState<{uuid: string, hospital: string} | null>(null);
  const [showDataDeletionModal, setShowDataDeletionModal] = useState(false);

  // 비밀번호 설정 모달 핸들러
  const handlePasswordSetupSuccess = async (type: PasswordModalType) => {
    console.log('✅ [비밀번호] 설정 완료 - 데이터 업로드 시도');
    setShowPasswordSetupModal(false);
    
    // 1. 수집된 데이터가 있으면 서버로 업로드
    if (lastCollectedRecord && passwordSetupData?.uuid && passwordSetupData?.hospital) {
      const hasHealthData = lastCollectedRecord.healthData?.length > 0;
      const hasPrescriptionData = lastCollectedRecord.prescriptionData?.length > 0;
      
      if (hasHealthData || hasPrescriptionData) {
        try {
          // 환자 정보 추가 (비밀번호 저장 실패 방지)
          const uploadData = {
            ...lastCollectedRecord,
            // authFlow에서 사용자 정보 가져오기
            phone: authFlow.state.userInfo.phone,
            birthday: authFlow.state.userInfo.birthday,
            gender: 'M' // 기본값 (authMethod에서 추론 가능하지만 일단 기본값 사용)
          };
          
          console.log('📤 [데이터업로드] 서버로 수집 데이터 전송 시작...', {
            건강검진: uploadData.healthData?.length || 0,
            처방전: uploadData.prescriptionData?.length || 0,
            환자정보포함: !!uploadData.phone && !!uploadData.birthday
          });
          
          const response = await fetch(`/welno-api/v1/welno/upload-health-data?uuid=${passwordSetupData.uuid}&hospital_id=${passwordSetupData.hospital}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(uploadData)
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ [데이터업로드] 서버 저장 완료:', result);
            
            // 업로드 완료 후 잠시 대기 (DB 커밋 대기)
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            const errorText = await response.text();
            console.error('❌ [데이터업로드] 서버 저장 실패:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
          }
        } catch (e) {
          console.error('❌ [데이터업로드] 통신 오류:', e);
        }
      } else {
        console.warn('⚠️ [데이터업로드] 저장할 데이터가 없음 - 업로드 건너뜀', {
          healthData_길이: lastCollectedRecord.healthData?.length || 0,
          prescriptionData_길이: lastCollectedRecord.prescriptionData?.length || 0
        });
      }
    }

    // 2. 결과 페이지로 이동 (replace로 히스토리 교체 - 뒤로가기 시 메인으로)
    if (passwordSetupData?.uuid && passwordSetupData?.hospital) {
      // 원래 가려던 페이지 정보 확인
      const from = (location.state as any)?.from;
      let targetUrl = from || `/results-trend?uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      
      // targetUrl에 uuid/hospital이 없으면 추가
      if (targetUrl.startsWith('/') && !targetUrl.includes('uuid=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      }
      
      console.log('🚀 [비밀번호설정완료] 대상 페이지로 이동:', targetUrl);
      navigate(targetUrl, { replace: true });
    } else {
      console.warn('⚠️ [비밀번호설정완료] UUID/병원 정보 부족');
      navigate('/results-trend', { replace: true });
    }
  };

  const handlePasswordSetupCancel = () => {
    console.log('⏭️ [비밀번호] 설정 건너뛰기 - 결과 페이지로 이동');
    setShowPasswordSetupModal(false);
    
    if (passwordSetupData?.uuid && passwordSetupData?.hospital) {
      // 원래 가려던 페이지 정보 확인
      const from = (location.state as any)?.from;
      let targetUrl = from || `/results-trend?uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      
      // targetUrl에 uuid/hospital이 없으면 추가
      if (targetUrl.startsWith('/') && !targetUrl.includes('uuid=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      }
      
      console.log('🚀 [비밀번호건너뛰기] 대상 페이지로 이동:', targetUrl);
      navigate(targetUrl, { replace: true });
    } else {
      console.warn('⚠️ [비밀번호건너뛰기] UUID/병원 정보 부족');
      navigate('/results-trend', { replace: true });
    }
  };

  // 데이터 삭제 확인 핸들러
  const handleDataDeletionConfirm = async () => {
    if (!passwordSetupData?.uuid || !passwordSetupData?.hospital) {
      console.error('❌ [데이터삭제] UUID/병원 정보 없음');
      setShowDataDeletionModal(false);
      return;
    }

    try {
      console.log('🗑️ [데이터삭제] 서버 데이터 삭제 시작:', {
        uuid: passwordSetupData.uuid,
        hospital: passwordSetupData.hospital
      });

      // 서버 데이터 삭제 API 호출
      const deleteResponse = await fetch(
        API_ENDPOINTS.DELETE_HEALTH_DATA(passwordSetupData.uuid, passwordSetupData.hospital),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (deleteResponse.ok) {
        const deleteResult = await deleteResponse.json();
        console.log('✅ [데이터삭제] 서버 데이터 삭제 완료:', deleteResult);
        
        // 모달 닫기
        setShowDataDeletionModal(false);
        setPasswordSetupData(null);
        
        // Tilko 인증 플로우 진행 (인증수단 선택 단계로)
        setCurrentConfirmationStep('auth_method');
        setIsCheckingPatient(false);
      } else {
        const errorText = await deleteResponse.text();
        console.error('❌ [데이터삭제] 서버 데이터 삭제 실패:', {
          status: deleteResponse.status,
          error: errorText
        });
        alert('데이터 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('❌ [데이터삭제] 통신 오류:', error);
      alert('데이터 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleDataDeletionCancel = () => {
    setShowDataDeletionModal(false);
    setPasswordSetupData(null);
    // 취소 시 인증수단 선택 단계로
    setCurrentConfirmationStep('auth_method');
    setIsCheckingPatient(false);
  };
  
  // WebSocket 연결 (간단 버전)
  const ws = useWebSocketAuth({
    sessionId: authFlow.state.sessionId,
    onAuthCompleted: async (data) => {
      console.log('✅ [WS] 인증 완료:', data);
      
      // patient_uuid와 hospital_id를 localStorage에 저장
      if (data?.patient_uuid && data?.hospital_id) {
        console.log('💾 [WS] UUID & Hospital ID 저장:', {
          patient_uuid: data.patient_uuid,
          hospital_id: data.hospital_id
        });
        StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, data.patient_uuid);
        StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, data.hospital_id);
        
        // ✅ IndexedDB에 건강 데이터 저장
        // 🔍 데이터 구조 상세 로깅
        console.log('🔍 [IndexedDB 저장 전] 데이터 구조 확인:', {
          전체데이터키: Object.keys(data),
          health_data_존재: !!data.health_data,
          health_data_타입: typeof data.health_data,
          health_data_값: data.health_data,
          health_data_Status: data.health_data?.Status,
          ResultList_존재: !!data.health_data?.ResultList,
          ResultList_타입: Array.isArray(data.health_data?.ResultList) ? 'array' : typeof data.health_data?.ResultList,
          ResultList_길이: data.health_data?.ResultList?.length || 0,
          prescription_data_존재: !!data.prescription_data,
          prescription_data_타입: typeof data.prescription_data,
          prescription_data_값: data.prescription_data,
          prescription_data_Status: data.prescription_data?.Status,
          prescription_ResultList_길이: data.prescription_data?.ResultList?.length || 0,
          patient_uuid: data.patient_uuid,
          hospital_id: data.hospital_id,
          user_name: data.user_name,
          authFlow_userInfo_name: authFlow.state.userInfo.name
        });
        
        // ⚠️ 데이터가 null인 경우 명확히 체크
        const hasHealthData = data.health_data !== null && data.health_data !== undefined;
        const hasPrescriptionData = data.prescription_data !== null && data.prescription_data !== undefined;
        
        if (!hasHealthData && !hasPrescriptionData) {
          console.error('❌ [WS] 건강 데이터가 없습니다!', {
            health_data: data.health_data,
            prescription_data: data.prescription_data,
            메시지: '건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다. 인증을 다시 시도해주세요.'
          });
          setWsError('건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다. 인증을 다시 시도해주세요.');
          setIsCollecting(false);
          setCurrentStatus('error');
          return; // 데이터가 없으면 여기서 종료
        }
        
        const healthDataList = hasHealthData && data.health_data?.ResultList ? data.health_data.ResultList : [];
        const prescriptionDataList = hasPrescriptionData && data.prescription_data?.ResultList ? data.prescription_data.ResultList : [];
        
        if (healthDataList.length > 0 || prescriptionDataList.length > 0) {
          try {
            const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
            
            // 이름 우선순위: WebSocket user_name > auth_data.user_name > authFlow.state.userInfo.name > 기본값
            const patientName = data.user_name || 
                              (data.auth_data && data.auth_data.user_name) ||
                              (data.auth_data && data.auth_data.UserName) ||
                              authFlow.state.userInfo.name || 
                              '사용자';
            
            console.log('🔍 [IndexedDB 저장] 이름 확인:', {
              data_user_name: data.user_name,
              auth_data_user_name: data.auth_data?.user_name,
              auth_data_UserName: data.auth_data?.UserName,
              authFlow_name: authFlow.state.userInfo.name,
              최종이름: patientName
            });
            
            const healthRecord = {
              uuid: data.patient_uuid,
              patientName: patientName,
              hospitalId: data.hospital_id,
              birthday: authFlow.state.userInfo.birthday,
              healthData: healthDataList,
              prescriptionData: prescriptionDataList,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              dataSource: 'tilko' as const
            };
            
            await WelnoIndexedDB.saveHealthData(healthRecord, 'merge');
            setLastCollectedRecord(healthRecord); // 업로드 대기용 저장
            console.log('📂 [IndexedDB] 데이터 수집 완료 후 저장 성공:', {
              건강검진: healthRecord.healthData.length,
              처방전: healthRecord.prescriptionData.length
            });
          } catch (indexedDBError) {
            console.error('❌ [IndexedDB] 저장 실패:', indexedDBError);
          }
        } else {
          console.error('❌ [IndexedDB] Tilko 데이터가 비어있음 - 저장할 데이터 없음', {
            health_data_null: data.health_data === null,
            prescription_data_null: data.prescription_data === null,
            healthDataList_길이: healthDataList.length,
            prescriptionDataList_길이: prescriptionDataList.length
          });
          setWsError('건강검진 데이터와 처방전 데이터가 모두 비어있습니다. 인증을 다시 시도해주세요.');
          setIsCollecting(false);
          setCurrentStatus('error');
        }
      }
      
      setIsCollecting(true);
    },
    onDataCollectionProgress: (type, message) => {
      console.log('📊 [WS] 수집 진행:', type, message);
      setIsCollecting(true);
      setCurrentStatus(type);
      setStatusMessage(message); // ✅ 실제 메시지 저장
    },
    onStatusUpdate: (status, authCompleted) => {
      console.log('🔄 [onStatusUpdate] 상태:', status);
      setCurrentStatus(status);
      if (status === 'completed' || status === 'data_completed') {
        console.log('✅ [onStatusUpdate] 데이터 수집 완료 감지!');
        
        // ⚠️ 데이터가 실제로 있는지 확인
        const hasData = lastCollectedRecord && (
          (lastCollectedRecord.healthData && lastCollectedRecord.healthData.length > 0) ||
          (lastCollectedRecord.prescriptionData && lastCollectedRecord.prescriptionData.length > 0)
        );
        
        if (!hasData) {
          console.error('❌ [onStatusUpdate] 데이터 수집 완료되었지만 저장된 데이터가 없음!', {
            lastCollectedRecord: lastCollectedRecord,
            메시지: '건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다.'
          });
          setWsError('건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다. 인증을 다시 시도해주세요.');
          setIsCollecting(false);
          setCurrentStatus('error');
          return; // 데이터가 없으면 비밀번호 모달 표시하지 않음
        }
        
        setIsDataCompleted(true);
        setIsCollecting(false);
        
        // ✅ 데이터 수집 완료 시 바로 비밀번호 모달 표시 (수집 완료 모달 스킵)
        const uuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID);
        const hospital = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID);
        
        if (uuid && hospital) {
          console.log('🔐 [데이터수집완료→비밀번호] 바로 비밀번호 모달 표시:', { uuid, hospital });
          setPasswordSetupData({ uuid, hospital });
          setShowPasswordSetupModal(true);
        } else {
          console.warn('⚠️ [데이터수집완료] UUID/병원 정보 없음 - 대상 페이지로 이동');
          const from = (location.state as any)?.from;
          navigate(from || '/results-trend', { replace: true });
        }
      }
    },
    onError: (error) => {
      console.error('🚨 [WS] 에러:', error);
      setWsError(error);
      setIsCollecting(false);
                    setCurrentStatus('error');
    }
  });
  
  // 폴링: WebSocket 실패 시 백업
  useEffect(() => {
    if (!authFlow.state.sessionId || !isCollecting) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/welno-api/v1/tilko/session/${authFlow.state.sessionId}/status`);
        const data = await response.json();
        
        console.log('🔄 [폴링] 세션 상태:', data.status);
        
        if (data.status === 'completed') {
          console.log('✅ [폴링] 데이터 수집 완료 감지!');
          clearInterval(pollInterval);
          
          // ✅ 폴링에서 감지했을 때도 바로 비밀번호 모달 표시
          const uuid = data.patient_uuid || StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID);
          const hospital = data.hospital_id || StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID);
          
          if (uuid && hospital) {
            // UUID/Hospital ID 저장 (없는 경우)
            if (!StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
              StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, uuid);
            }
            if (!StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID)) {
              StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, hospital);
            }
            
            // ✅ IndexedDB에 건강 데이터 저장 (폴링에서도)
            // 🔍 데이터 구조 상세 로깅
            console.log('🔍 [폴링→IndexedDB 저장 전] 데이터 구조 확인:', {
              전체데이터키: Object.keys(data),
              health_data_존재: !!data.health_data,
              health_data_타입: typeof data.health_data,
              health_data_값: data.health_data,
              health_data_Status: data.health_data?.Status,
              ResultList_존재: !!data.health_data?.ResultList,
              ResultList_타입: Array.isArray(data.health_data?.ResultList) ? 'array' : typeof data.health_data?.ResultList,
              ResultList_길이: data.health_data?.ResultList?.length || 0,
              prescription_data_존재: !!data.prescription_data,
              prescription_data_타입: typeof data.prescription_data,
              prescription_data_값: data.prescription_data,
              prescription_data_Status: data.prescription_data?.Status,
              prescription_ResultList_길이: data.prescription_data?.ResultList?.length || 0
            });
            
            // ⚠️ 데이터가 null인 경우 명확히 체크
            const hasHealthData = data.health_data !== null && data.health_data !== undefined;
            const hasPrescriptionData = data.prescription_data !== null && data.prescription_data !== undefined;
            
            if (!hasHealthData && !hasPrescriptionData) {
              console.error('❌ [폴링] 건강 데이터가 없습니다!', {
                health_data: data.health_data,
                prescription_data: data.prescription_data,
                메시지: '건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다. 인증을 다시 시도해주세요.'
              });
              setWsError('건강검진 데이터와 처방전 데이터가 모두 수집되지 않았습니다. 인증을 다시 시도해주세요.');
              setIsCollecting(false);
              setCurrentStatus('error');
              return; // 데이터가 없으면 여기서 종료
            }
            
            const healthDataList = hasHealthData && data.health_data?.ResultList ? data.health_data.ResultList : [];
            const prescriptionDataList = hasPrescriptionData && data.prescription_data?.ResultList ? data.prescription_data.ResultList : [];
            
            if (healthDataList.length > 0 || prescriptionDataList.length > 0) {
              try {
                const { WelnoIndexedDB } = await import('../services/WelnoIndexedDB');
                
                const healthRecord = {
                  uuid: uuid,
                  patientName: data.user_name || 
                               (data.auth_data && data.auth_data.user_name) ||
                               (data.auth_data && data.auth_data.UserName) ||
                               authFlow.state.userInfo.name || 
                               '사용자',
                  hospitalId: hospital,
                  birthday: authFlow.state.userInfo.birthday,
                  healthData: healthDataList,
                  prescriptionData: prescriptionDataList,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  dataSource: 'tilko' as const
                };
                
                await WelnoIndexedDB.saveHealthData(healthRecord, 'merge');
                setLastCollectedRecord(healthRecord); // 업로드 대기용 저장
                console.log('📂 [폴링→IndexedDB] 데이터 저장 성공:', {
                  건강검진: healthRecord.healthData.length,
                  처방전: healthRecord.prescriptionData.length
                });
                
                setIsDataCompleted(true);
                setIsCollecting(false);
                
                console.log('🔐 [폴링→비밀번호] 바로 비밀번호 모달 표시');
                setPasswordSetupData({ uuid, hospital });
                setShowPasswordSetupModal(true);
              } catch (indexedDBError) {
                console.error('❌ [폴링→IndexedDB] 저장 실패:', indexedDBError);
                setWsError('데이터 저장 중 오류가 발생했습니다.');
                setIsCollecting(false);
                setCurrentStatus('error');
              }
            } else {
              console.error('❌ [폴링→IndexedDB] Tilko 데이터가 비어있음 - 저장할 데이터 없음', {
                health_data_null: data.health_data === null,
                prescription_data_null: data.prescription_data === null,
                healthDataList_길이: healthDataList.length,
                prescriptionDataList_길이: prescriptionDataList.length
              });
              setWsError('건강검진 데이터와 처방전 데이터가 모두 비어있습니다. 인증을 다시 시도해주세요.');
              setIsCollecting(false);
              setCurrentStatus('error');
            }
            } else {
            console.warn('⚠️ [폴링] UUID/병원 정보 없음');
            setIsCollecting(false);
            setCurrentStatus('error');
          }
        } else if (data.status === 'error') {
          console.error('❌ [폴링] 에러 상태 감지');
          setIsCollecting(false);
          clearInterval(pollInterval);
        }
    } catch (error) {
        console.error('🚨 [폴링] 에러:', error);
      }
    }, 2000); // 2초마다 폴링
    
    return () => clearInterval(pollInterval);
  }, [authFlow.state.sessionId, authFlow.state.userInfo.name, isCollecting]);
  
  // 컴포넌트 마운트 시 세션 복구 및 약관 동의 여부 확인
  useEffect(() => {
    const initialize = async () => {
      await authFlow.actions.recoverSession();
      
      // 약관 동의 여부 확인
      const termsAgreed = StorageManager.getItem(STORAGE_KEYS.TILKO_TERMS_AGREED);
      if (termsAgreed === 'true') {
        console.log('[AuthForm] 약관 동의 이력 있음 - 약관 모달 스킵');
    setShowTermsModal(false);
      setShowConfirmation(true);
      } else {
        console.log('[AuthForm] 약관 동의 이력 없음 - 약관 모달 표시 대기');
      }
    };
    
    initialize();
  }, []);
  
  // 단계 이동 핸들러
  const handleNextStep = async () => {
    console.log('🔘 [단계진행] handleNextStep 호출:', currentConfirmationStep);
    console.log('🔘 [단계진행] 현재 입력 값:', authFlow.state.userInfo);
    
    if (currentConfirmationStep === 'name') {
      if (!authFlow.state.userInfo.name) {
        alert('이름을 입력해주세요.');
        return;
      }
      console.log('✅ [단계진행] 이름 확인 완료, 전화번호 단계로 이동');
      setCurrentConfirmationStep('phone');
    } else if (currentConfirmationStep === 'phone') {
      if (!authFlow.state.userInfo.phone) {
        alert('전화번호를 입력해주세요.');
        return;
      }
      setCurrentConfirmationStep('birthday');
    } else if (currentConfirmationStep === 'birthday') {
      if (!authFlow.state.userInfo.birthday) {
        alert('생년월일을 입력해주세요.');
        return;
      }

      // ✅ 기존 환자 사전 체크
      try {
        setIsCheckingPatient(true);
        console.log('🔍 [사전체크] 기존 환자 여부 확인 시작...');
        
        const response = await fetch(API_ENDPOINTS.FIND_PATIENT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: authFlow.state.userInfo.name,
            phone_number: authFlow.state.userInfo.phone,
            birth_date: authFlow.state.userInfo.birthday.replace(/-/g, '')
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const foundPatient = result.data;
            console.log('✅ [사전체크] 기존 환자 발견:', foundPatient.uuid);
            
            // 데이터가 있는 경우에만 로드 제안
            if (foundPatient.has_health_data || foundPatient.has_prescription_data) {
              // 비밀번호 존재 여부 확인
              try {
                const passwordCheckResponse = await fetch(
                  API_ENDPOINTS.PASSWORD.CHECK_PASSWORD(foundPatient.uuid, foundPatient.hospital_id)
                );
                
                if (passwordCheckResponse.ok) {
                  const passwordCheckResult = await passwordCheckResponse.json();
                  const hasPassword = passwordCheckResult.success && passwordCheckResult.data?.hasPassword;
                  
                  console.log('🔐 [사전체크] 비밀번호 확인:', { hasPassword });
                  
                  if (hasPassword) {
                    // 비밀번호가 있으면 PasswordModal로 비밀번호 입력받기
                    setPasswordSetupData({ 
                      uuid: foundPatient.uuid, 
                      hospital: foundPatient.hospital_id 
                    });
                    setShowPasswordSetupModal(true);
                    setIsCheckingPatient(false);
                    return;
                  } else {
                    // 비밀번호가 없으면 데이터 삭제 안내 모달 표시
                    setPasswordSetupData({ 
                      uuid: foundPatient.uuid, 
                      hospital: foundPatient.hospital_id 
                    });
                    setShowDataDeletionModal(true);
                    setIsCheckingPatient(false);
                    return;
                  }
                }
              } catch (error) {
                console.error('❌ [사전체크] 비밀번호 확인 실패:', error);
                // 비밀번호 확인 실패 시 기본 플로우 진행
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ [사전체크] 기존 환자 조회 실패 (일반 인증으로 속행):', error);
      } finally {
        setIsCheckingPatient(false);
      }

      setCurrentConfirmationStep('auth_method');
    } else if (currentConfirmationStep === 'auth_method') {
      if (!authFlow.state.userInfo.authMethod) {
        alert('인증 방식을 선택해주세요.');
        return;
      }
      // 인증 시작
      handleStartAuth();
    }
  };
  
  const handlePrevStep = () => {
    if (currentConfirmationStep === 'phone') {
      setCurrentConfirmationStep('name');
    } else if (currentConfirmationStep === 'birthday') {
      setCurrentConfirmationStep('phone');
    } else if (currentConfirmationStep === 'auth_method') {
      setCurrentConfirmationStep('birthday');
    }
  };
  
  const handleStartAuth = async () => {
    console.log('🚀 [인증시작] 인증 시작');
    setAuthRequested(true);
    
    try {
      await authFlow.actions.startAuth();
    } catch (error) {
      console.error('🚨 [인증시작] 인증 시작 실패:', error);
      alert('인증 시작 중 오류가 발생했습니다.');
      setAuthRequested(false);
    }
  };
  
  // showTermsModal 상태 디버깅
  useEffect(() => {
    console.log('[AuthForm] showTermsModal 상태 변경:', showTermsModal);
  }, [showTermsModal]);
  
  // 플로팅 버튼 클릭 이벤트 리스너
  useEffect(() => {
    const handleFloatingButtonClick = () => {
      console.log('🚀 [플로팅버튼] 클릭 감지 - 약관 동의 모달 오픈');
      setShowTermsModal(true);
      console.log('🚀 [플로팅버튼] setShowTermsModal(true) 실행 완료');
    };
    
    window.addEventListener('welno-start-auth', handleFloatingButtonClick);

    return () => {
      window.removeEventListener('welno-start-auth', handleFloatingButtonClick);
    };
  }, []);

  // 정보 확인 단계 진입 시 localStorage 설정
  useEffect(() => {
    if (showConfirmation && !authRequested) {
      console.log('[AuthForm] 정보 확인 단계 진입 - localStorage 설정');
      StorageManager.setItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
            window.dispatchEvent(new Event('localStorageChange'));
    } else if (!showConfirmation) {
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
        window.dispatchEvent(new Event('localStorageChange'));
    }
  }, [showConfirmation, authRequested]);
  
  // 플로팅 버튼 "확인 완료" 클릭 이벤트 리스너
  useEffect(() => {
    const handleInfoConfirmClick = async () => {
      console.log('[AuthForm] 플로팅 버튼 "확인 완료" 클릭 - 현재 단계:', currentConfirmationStep);
      
      // 단계별 처리
    if (currentConfirmationStep === 'name') {
        if (!authFlow.state.userInfo.name) {
          alert('이름을 입력해주세요.');
        return;
      }
        setCurrentConfirmationStep('phone');
    } else if (currentConfirmationStep === 'phone') {
        if (!authFlow.state.userInfo.phone) {
          alert('전화번호를 입력해주세요.');
        return;
      }
        setCurrentConfirmationStep('birthday');
    } else if (currentConfirmationStep === 'birthday') {
        if (!authFlow.state.userInfo.birthday) {
          alert('생년월일을 입력해주세요.');
        return;
        }

        // ✅ 기존 환자 사전 체크 (플로팅 버튼 클릭 시에도 동일하게 적용)
        try {
          setIsCheckingPatient(true);
          console.log('🔍 [사전체크] 기존 환자 여부 확인 시작...');
          
          const response = await fetch(API_ENDPOINTS.FIND_PATIENT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: authFlow.state.userInfo.name,
              phone_number: authFlow.state.userInfo.phone,
              birth_date: authFlow.state.userInfo.birthday.replace(/-/g, '')
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const foundPatient = result.data;
              console.log('✅ [사전체크] 기존 환자 발견:', foundPatient.uuid);
              
              if (foundPatient.has_health_data || foundPatient.has_prescription_data) {
                // 비밀번호 존재 여부 확인
                try {
                  const passwordCheckResponse = await fetch(
                    API_ENDPOINTS.PASSWORD.CHECK_PASSWORD(foundPatient.uuid, foundPatient.hospital_id)
                  );
                  
                  if (passwordCheckResponse.ok) {
                    const passwordCheckResult = await passwordCheckResponse.json();
                    const hasPassword = passwordCheckResult.success && passwordCheckResult.data?.hasPassword;
                    
                    console.log('🔐 [사전체크] 비밀번호 확인:', { hasPassword });
                    
                    if (hasPassword) {
                      // 비밀번호가 있으면 PasswordModal로 비밀번호 입력받기
                      StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, foundPatient.uuid);
                      StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, foundPatient.hospital_id);
                      await actions.loadPatientData(foundPatient.uuid, foundPatient.hospital_id);
                      setPasswordSetupData({ 
                        uuid: foundPatient.uuid, 
                        hospital: foundPatient.hospital_id 
                      });
                      setShowPasswordSetupModal(true);
                      setIsCheckingPatient(false);
                      return;
                    } else {
                      // 비밀번호가 없으면 데이터 삭제 안내 모달 표시
                      setPasswordSetupData({ 
                        uuid: foundPatient.uuid, 
                        hospital: foundPatient.hospital_id 
                      });
                      setShowDataDeletionModal(true);
                      setIsCheckingPatient(false);
                      return;
                    }
                  }
                } catch (error) {
                  console.error('❌ [사전체크] 비밀번호 확인 실패:', error);
                  // 비밀번호 확인 실패 시 기본 플로우 진행
                }
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ [사전체크] 기존 환자 조회 실패:', error);
        } finally {
          setIsCheckingPatient(false);
        }

        setCurrentConfirmationStep('auth_method');
    } else if (currentConfirmationStep === 'auth_method') {
        if (!authFlow.state.userInfo.authMethod) {
          alert('인증 방식을 선택해주세요.');
          return;
        }
        // 인증 시작
        console.log('🚀 [AuthForm] 인증 시작 호출 - userInfo:', authFlow.state.userInfo);
        setAuthRequested(true);
        authFlow.actions.startAuth()
          .then(() => {
            console.log('✅ [AuthForm] 인증 시작 성공');
          })
          .catch((error) => {
            console.error('🚨 [AuthForm] 인증 시작 실패:', error);
            console.error('🚨 [AuthForm] 에러 상세:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
            alert('인증 시작 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
            setAuthRequested(false);
          });
      }
    };
    
    window.addEventListener('tilko-info-confirm-clicked', handleInfoConfirmClick);
    
    return () => {
      window.removeEventListener('tilko-info-confirm-clicked', handleInfoConfirmClick);
    };
  }, [currentConfirmationStep, authFlow.state.userInfo, authFlow.actions]);
  
  // 플로팅 버튼 "인증을 완료했어요" 클릭 이벤트 리스너
  useEffect(() => {
    const handleAuthCompleteClick = async () => {
      console.log('✅ [AuthForm] "인증을 완료했어요" 버튼 클릭 - 인증 완료 확인 및 데이터 수집 시작');
      
      if (!authFlow.state.sessionId) {
        console.error('🚨 세션 ID가 없습니다.');
        alert('세션 정보가 없습니다. 다시 시도해주세요.');
        return;
      }
      
      try {
        // 1단계: 인증 완료 상태로 변경
        console.log('[AuthForm] 1단계: 인증 완료 상태 업데이트');
        const authCompleteResponse = await fetch(`/welno-api/v1/tilko/session/${authFlow.state.sessionId}/manual-auth-complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const authCompleteResult = await authCompleteResponse.json();
        
        if (!authCompleteResponse.ok) {
          throw new Error(authCompleteResult.detail || '인증 완료 확인 실패');
        }
        
        console.log('✅ [AuthForm] 인증 완료 상태 업데이트 성공:', authCompleteResult);
        
        // 2단계: 데이터 수집 시작
        console.log('[AuthForm] 2단계: 데이터 수집 시작');
        const collectResponse = await fetch(`/welno-api/v1/tilko/session/${authFlow.state.sessionId}/collect-health-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
              const collectResult = await collectResponse.json();
        
        if (collectResponse.ok) {
          console.log('✅ [AuthForm] 데이터 수집 시작 성공:', collectResult);
          // 플로팅 버튼 상태 업데이트 및 수집 화면 표시
          StorageManager.removeItem('tilko_auth_waiting');
          StorageManager.setItem('tilko_manual_collect', 'true');
          setIsCollecting(true);
          window.dispatchEvent(new CustomEvent('tilko-status-change'));
              } else {
          throw new Error(collectResult.detail || '데이터 수집 시작 실패');
      }
    } catch (error) {
        console.error('🚨 [AuthForm] 처리 실패:', error);
        alert(`처리에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    };
    
    window.addEventListener('tilko-auth-complete-clicked', handleAuthCompleteClick);
    
    return () => {
      window.removeEventListener('tilko-auth-complete-clicked', handleAuthCompleteClick);
    };
  }, [authFlow.state.sessionId]);
  
  // authFlow 상태 변화 감지 (completed 세션 복구 시)
  useEffect(() => {
    if (authFlow.state.currentStep === 'completed' || authFlow.state.isCompleted) {
      console.log('✅ [AuthForm] 세션 복구: 이미 완료된 세션 감지 - 트렌드 페이지로 이동');
      
      const uuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID);
      const hospital = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID);
      
      if (uuid && hospital) {
        // 이미 완료된 세션은 바로 대상 페이지로 이동 (비밀번호는 이미 설정되었을 것)
        const from = (location.state as any)?.from;
        let targetUrl = from || `/results-trend?uuid=${uuid}&hospital=${hospital}`;
        
        // targetUrl에 uuid/hospital이 없으면 추가
        if (targetUrl.startsWith('/') && !targetUrl.includes('uuid=')) {
          const separator = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${separator}uuid=${uuid}&hospital=${hospital}`;
        }
        
        navigate(targetUrl, { replace: true });
      }
    }
  }, [authFlow.state.currentStep, authFlow.state.isCompleted, navigate]);
  
  // 비밀번호 설정 모달 (최우선)
  if (showPasswordSetupModal && passwordSetupData) {
    return (
      <div className="auth-form-container">
        <PasswordModal
          isOpen={showPasswordSetupModal}
          onClose={handlePasswordSetupCancel}
          onSuccess={async (type) => {
            // 비밀번호 확인 성공 시 데이터 다운로드
            if (passwordSetupData?.uuid && passwordSetupData?.hospital) {
              console.log('✅ [비밀번호확인] 비밀번호 일치 - 데이터 다운로드 시작');
              await actions.loadPatientData(passwordSetupData.uuid, passwordSetupData.hospital);
            }
            handlePasswordSetupSuccess(type);
          }}
          onCancel={handlePasswordSetupCancel}
          type="confirm"
          uuid={passwordSetupData.uuid}
          hospitalId={passwordSetupData.hospital}
          patientInfo={{
            name: authFlow.state.userInfo.name,
            phone: authFlow.state.userInfo.phone,
            birthday: authFlow.state.userInfo.birthday,
            gender: 'M'
          }}
          initialMessage="데이터 접근을 위해 비밀번호를 입력해주세요."
        />
        {/* 데이터 삭제 안내 모달 */}
        {showDataDeletionModal && (
          <DataDeletionWarningModal
            isOpen={showDataDeletionModal}
            onConfirm={handleDataDeletionConfirm}
            onCancel={handleDataDeletionCancel}
          />
        )}
      </div>
    );
  }
  
  // 약관 동의 단계
  if (showTermsModal) {
    console.log('[AuthForm] 약관 동의 모달 렌더링 시작');
    return (
      <div className="auth-form-container">
        <TermsAgreementModal
          isOpen={showTermsModal}
          onClose={() => {
            console.log('[AuthForm] 약관 동의 모달 닫기');
            setShowTermsModal(false);
          }}
          onConfirm={(agreedTerms) => {
            console.log('✅ 약관 동의:', agreedTerms);
            // 약관 동의 저장 (localStorage에 기록)
            authFlow.actions.agreeToTerms(agreedTerms);
            setShowTermsModal(false);
            setShowConfirmation(true);
            setCurrentConfirmationStep('name');
            setDescriptionMessage('정보를 확인해주세요');
          }}
        />
      </div>
    );
  }
  
  // 초기 화면 (플로팅 버튼 대기)
  if (!showConfirmation && !authRequested && !isCollecting) {
    return (
      <div className="auth-form-container">
        <div className="auth-form-content">
          <h2 className="auth-form-title">
            건강검진 데이터를 안전하게 불러와<br/>
            검진 추이를 안내하겠습니다.
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginTop: '20px',
            textAlign: 'center'
          }}>
            하단의 버튼을 클릭하여 시작하세요
          </p>
        </div>
      </div>
    );
  }

  // 정보 확인 단계
  if (showConfirmation && !authRequested) {
    return (
      <div className="auth-form-container">
        <div className="auth-form-content">
          {/* 타이틀 */}
          <h2 className="auth-form-title">
            {descriptionMessage || '정보를 확인해주세요'}
          </h2>
          
          {/* 이름 입력 */}
                {currentConfirmationStep === 'name' && (
            <AuthInput
              type="name"
              value={authFlow.state.userInfo.name}
              onChange={(value) => authFlow.actions.setName(value)}
              onComplete={handleNextStep}
              autoFocus={true}
            />
          )}
          
          {/* 전화번호 입력 */}
                {currentConfirmationStep === 'phone' && (
            <AuthInput
              type="phone"
              value={authFlow.state.userInfo.phone}
              onChange={(value) => authFlow.actions.setPhone(value)}
              onComplete={handleNextStep}
              autoFocus={true}
            />
          )}
          
          {/* 생년월일 입력 */}
                {currentConfirmationStep === 'birthday' && (
            <AuthInput
              type="birthday"
              value={authFlow.state.userInfo.birthday}
              onChange={(value) => authFlow.actions.setBirthday(value)}
              onComplete={handleNextStep}
              autoFocus={true}
            />
          )}
          
          {/* 인증 방식 선택 */}
                {currentConfirmationStep === 'auth_method' && (
            <AuthMethodSelect
              methods={AUTH_TYPES}
              selectedMethod={authFlow.state.userInfo.authMethod}
              onChange={(method: string) => {
                authFlow.actions.setAuthMethod(method);
              }}
            />
          )}
          
          {/* 하단 안내 메시지 (플로팅 버튼 사용 안내) */}
            <div style={{ 
            marginTop: '30px',
            textAlign: 'center'
          }}>
            {currentConfirmationStep !== 'name' && (
            <button
                onClick={handlePrevStep}
              style={{
                  background: 'none',
                border: 'none',
                  color: '#ff6b6b',
                cursor: 'pointer',
                  fontSize: '14px',
                  marginBottom: '15px',
                  textDecoration: 'underline'
              }}
            >
                ← 이전으로
            </button>
            )}
            <p style={{ 
              fontSize: '14px',
              color: '#666',
              margin: 0
            }}>
              하단의 "확인 완료" 버튼을 눌러주세요
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 인증 대기 단계
  if (authRequested && !isCollecting) {
    return (
      <div className="auth-form-container">
        <AuthWaiting
          authMethod={authFlow.state.userInfo.authMethod || '4'}
          userName={authFlow.state.userInfo.name}
          currentStatus={currentStatus}
        />
      </div>
    );
  }

  // 데이터 수집 단계
  if (isCollecting) {
  return (
      <div className="auth-form-container">
        <DataCollecting
          progress={0}
          currentStatus={currentStatus}
          statusMessage={statusMessage || '건강정보를 수집하고 있습니다...'}
            />
          </div>
    );
  }
  
  // 에러 발생
  if (currentStatus === 'error' && wsError) {
    return (
      <div className="auth-form-container">
        <div className="auth-error-container">
          <h2>오류가 발생했습니다</h2>
          <p>{wsError || '알 수 없는 오류가 발생했습니다.'}</p>
          <button onClick={() => {
            authFlow.actions.reset();
            setShowTermsModal(false);
            setShowConfirmation(false);
            setAuthRequested(false);
            setLastCollectedRecord(null);
          }}>
            처음부터 다시 시작
          </button>
          </div>
          </div>
  );
  }
  
  // 폴백: 모든 조건에 맞지 않으면 초기 화면
  return (
    <div className="auth-form-container">
      <div className="auth-form-content">
        <h2 className="auth-form-title">
          건강검진 데이터를 안전하게 불러와<br/>
          검진 추이를 안내하겠습니다.
        </h2>
              <p style={{
                    fontSize: '14px',
                    color: '#666',
          marginTop: '20px',
          textAlign: 'center'
        }}>
          하단의 버튼을 클릭하여 시작하세요
        </p>
            </div>
      
      {/* 데이터 삭제 안내 모달 */}
      {showDataDeletionModal && (
        <DataDeletionWarningModal
          isOpen={showDataDeletionModal}
          onConfirm={handleDataDeletionConfirm}
          onCancel={handleDataDeletionCancel}
        />
      )}
            </div>
  );
};

export default AuthForm;
