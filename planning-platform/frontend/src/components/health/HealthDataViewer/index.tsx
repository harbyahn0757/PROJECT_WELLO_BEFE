/**
 * 건강 데이터 뷰어 컴포넌트 (실제 데이터 표시)
 * 통합 타임라인 형태로 건강검진과 처방전을 함께 표시
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HealthDataViewerProps } from '../../../types/health';
import UnifiedHealthTimeline from '../UnifiedHealthTimeline/index';
import TrendsSection from './TrendsSection';
import VisitTrendsChart from '../VisitTrendsChart';
import CategoryView from '../CategoryView';
import { useWelnoData } from '../../../contexts/WelnoDataContext';
import { API_ENDPOINTS } from '../../../config/api';
import { useNavigate } from 'react-router-dom';
import { WelnoIndexedDB, HealthDataRecord } from '../../../services/WelnoIndexedDB';
import usePasswordSessionGuard from '../../../hooks/usePasswordSessionGuard';
import { STORAGE_KEYS } from '../../../constants/storage';
import { WELNO_LOGO_IMAGE } from '../../../constants/images';
import AIAnalysisSection from '../AIAnalysisSection'; // AI 분석 섹션 컴포넌트
import ContentLayoutWithHeader from '../../../layouts/ContentLayoutWithHeader'; // 컨텐츠 레이아웃 (헤더 있음)
import { useWebSocketAuth } from '../../../hooks/useWebSocketAuth'; // ⭐ WebSocket 훅 추가
import './styles.scss';

import { simplifyDataForLog } from '../../../utils/debugUtils';
import { calculateCurrentAge } from '../../../features/disease-report/utils/ageCalculator';

const pillIconPath = `${process.env.PUBLIC_URL || ''}/free-icon-pill-5405585.png`;

const HealthDataViewer: React.FC<HealthDataViewerProps> = ({
  onBack,
  onError
}) => {
  const { state, actions } = useWelnoData(); // 환자 데이터 가져오기
  const navigate = useNavigate();
  
  // 이 페이지는 트렌드 상태만 처리 (질문 상태 없음)
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [prescriptionData, setPrescriptionData] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'checkup' | 'pharmacy' | 'treatment'>('all');
  const [categoryDepth, setCategoryDepth] = useState<number>(0); // CategoryView 뎁스 추적 (0: 그리드, 1: 상세, 2: 모달)
  const categoryViewBackRef = React.useRef<(() => void) | null>(null); // CategoryView의 handleBack 참조
  
  // 뷰 모드 상태 추가 (trends: 추이분석, timeline: 타임라인, category: 카테고리)
  const [viewMode, setViewMode] = useState<'trends' | 'timeline' | 'category'>(() => {
    // localStorage에서 저장된 viewMode 복원 (기본값: category)
    const savedViewMode = localStorage.getItem('welno_view_mode') as 'trends' | 'timeline' | 'category';
    return savedViewMode || 'category';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoadingTrends] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false); // AI 분석 섹션 표시 상태
  
  // ⭐ Mediarc 리포트 상태
  const [mediarcData, setMediarcData] = useState<any>(null); // Mediarc 리포트 데이터
  const [showMediarcSection, setShowMediarcSection] = useState(false); // Mediarc 섹션 표시 여부
  const [showMediarcGlow, setShowMediarcGlow] = useState(false); // 건강나이 반짝임 효과
  
  // Pull-to-refresh 관련 상태
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [pullCount, setPullCount] = useState(0);
  
  // 토스트 메시지 상태
  const [showToast, setShowToast] = useState(false);
  
  // 터치 이벤트 관련 ref
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  
  // 환자 이름 추출 (기본값: "사용자")
  const patientName = state.patient?.name || '사용자';
  
  // 🔍 생년월일 데이터 확인 로그
  useEffect(() => {
    if (state.patient) {
      console.log('[HealthDataViewer] 환자 데이터 확인:', {
        uuid: state.patient.uuid,
        name: state.patient.name,
        birthday: state.patient.birthday || '(없음)',
        birthday_존재: !!(state.patient.birthday && state.patient.birthday.trim()),
        birthday_길이: state.patient.birthday ? state.patient.birthday.length : 0,
        actualAge_계산값: state.patient.birthday ? calculateCurrentAge(state.patient.birthday) : null
      });
    } else {
      console.log('[HealthDataViewer] 환자 데이터 없음: state.patient =', state.patient);
    }
  }, [state.patient]);
  
  // ⭐ URL에서 sessionId 추출 (AuthForm에서 전달됨)
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('sessionId');
    if (sid) {
      setSessionId(sid);
      console.log(`🔌 [HealthDataViewer] sessionId 감지: ${sid}`);
    }
  }, []);
  
  // ⭐ WebSocket 연결 및 Mediarc 완료 이벤트 수신
  useWebSocketAuth({
    sessionId,
    onDataCollectionProgress: (type, message, data) => {
      console.log(`📨 [HealthDataViewer WebSocket] 이벤트: ${type}`);
      
      // Mediarc 리포트 완료 시
      if (type === 'mediarc_report_completed') {
        console.log('🎉 [HealthDataViewer] Mediarc 완료 → 건강 나이 섹션 표시');
        console.log('   - bodyage:', data?.bodyage);
        console.log('   - rank:', data?.rank);
        
        setMediarcData({
          bodyage: data?.bodyage,
          rank: data?.rank,
          mkt_uuid: data?.mkt_uuid,
          report_url: data?.report_url,
          has_questionnaire: data?.has_questionnaire
        });
        setShowMediarcSection(true);
        
        // 반짝임 효과 트리거
        setShowMediarcGlow(true);
        setTimeout(() => {
          setShowMediarcGlow(false);
        }, 2500); // 2.5초 후 끄기
        
        // 건강 나이 섹션으로 스크롤 (선택사항)
        setTimeout(() => {
          const mediarcSection = document.querySelector('.mediarc-section');
          if (mediarcSection) {
            mediarcSection.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }, 300);
      }
    },
    onError: (error) => {
      console.error('❌ [HealthDataViewer WebSocket] 에러:', error);
    }
  });

  // 페이지 타이틀 동적 변경 로직
  const getPageTitle = () => {
    if (viewMode === 'trends') {
      return `${patientName}님의 건강 추이 분석`;
    } else {
      // timeline 모드
      switch (filterMode) {
        case 'checkup':
          return `${patientName}님의 건강검진 기록`;
        case 'pharmacy':
          return `${patientName}님의 약국 방문 기록`;
        case 'treatment':
          return `${patientName}님의 진료 기록`;
        default:
          return `${patientName}님의 전체 건강 기록`;
      }
    }
  };

  // 비밀번호 세션 가드 - 직접 접속 시에는 체크하지 않음
  usePasswordSessionGuard({
    enabled: false, // 직접 접속 허용을 위해 비활성화
    checkInterval: 30000 // 30초마다 체크
  });

  // 플로팅 버튼 표시를 위한 비밀번호 모달 상태 정리
  useEffect(() => {
    // 결과 페이지 로드 시 비밀번호 모달 상태 정리
    localStorage.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
    window.dispatchEvent(new CustomEvent('password-modal-change'));
    console.log('[결과페이지] 비밀번호 모달 상태 정리 완료');
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // AI 분석 섹션 표시 이벤트 리스너
  useEffect(() => {
    const handleShowAIAnalysis = () => {
      console.log('[결과페이지] AI 분석 섹션 표시 요청 받음');
      setShowAIAnalysis(true);
      
      // 바로 AI 분석 시작 이벤트 발생
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('start-ai-analysis'));
        
        // AI 분석 섹션으로 스크롤
        const aiSection = document.querySelector('.ai-analysis-section');
        if (aiSection) {
          aiSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    };

    window.addEventListener('show-ai-analysis-section', handleShowAIAnalysis);
    
    return () => {
      window.removeEventListener('show-ai-analysis-section', handleShowAIAnalysis);
    };
  }, []);

  // 토글 버튼 핸들러 (분석 = 뷰 토글, 검진/약국/진료 = 필터)
  const handleToggleClick = async (mode: string) => {
    if (isTransitioning) return; // 전환 중이면 무시
    
    setIsTransitioning(true);
    console.log(`[토글] ${mode} 버튼 클릭 - 전환 시작`);
    
    // 짧은 로딩 애니메이션
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (mode === 'all') {
      // [분석] 버튼 - 뷰 모드 토글
      const newViewMode = viewMode === 'trends' ? 'timeline' : 'trends';
      setViewMode(newViewMode);
      setFilterMode('all');
      
      // localStorage에 viewMode 저장
      localStorage.setItem('welno_view_mode', newViewMode);
      
      // 플로팅 버튼 업데이트를 위한 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('welno-view-mode-change', {
        detail: { viewMode: newViewMode, filterMode: 'all' }
      }));
      
      console.log(`[토글] 뷰 모드 변경: ${viewMode} → ${newViewMode}`);
    } else {
      // [검진/약국/진료] 버튼 - 타임라인 + 필터
      setViewMode('timeline');
      setFilterMode(mode as 'checkup' | 'pharmacy' | 'treatment');
      
      // localStorage에 viewMode 저장
      localStorage.setItem('welno_view_mode', 'timeline');
      
      // 플로팅 버튼 업데이트를 위한 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('welno-view-mode-change', {
        detail: { viewMode: 'timeline', filterMode: mode }
      }));
      
      console.log(`[토글] 필터 모드: ${mode}, 뷰: timeline`);
    }
    
    setIsTransitioning(false);
  };

  useEffect(() => {
    // DB에서 저장된 데이터 로드 또는 localStorage에서 최근 수집된 데이터 로드
    const loadHealthData = async () => {
      try {
        // URL 파라미터에서 환자 정보 추출
        const urlParams = new URLSearchParams(window.location.search);
        const uuid = urlParams.get('uuid');
        const hospital = urlParams.get('hospital') || urlParams.get('hospitalId') || urlParams.get('hospital_id');

        if (uuid && hospital) {
          console.log('[결과페이지] DB에서 저장된 데이터 로드 시도:', { uuid, hospital });
          
          // DB에서 저장된 데이터 조회
          const response = await fetch(API_ENDPOINTS.HEALTH_DATA(uuid, hospital));
          
          if (response.ok) {
            const result = await response.json();
            // 디버깅용 간소화된 데이터 로그 (이미지 데이터는 키만 표시)
            const simplifiedResult = simplifyDataForLog(result);
            console.log('[결과페이지] DB 데이터 로드 성공:', simplifiedResult);
            
            if (result.success && result.data) {
              const { health_data, prescription_data } = result.data;
              
              // [프론트엔드 로그] API 응답 데이터 구조 확인
              console.log('[프론트엔드] API 응답 데이터 구조:');
              console.log(`  - result.data 타입: ${typeof result.data}`);
              console.log(`  - result.data 키: ${Object.keys(result.data || {})}`);
              console.log(`  - health_data 타입: ${typeof health_data}, 배열여부: ${Array.isArray(health_data)}`);
              console.log(`  - health_data 개수: ${health_data?.length || 0}`);
              console.log(`  - prescription_data 타입: ${typeof prescription_data}, 배열여부: ${Array.isArray(prescription_data)}`);
              console.log(`  - prescription_data 개수: ${prescription_data?.length || 0}`);
              
              // health_data가 배열이 아닌 경우 처리
              if (health_data && !Array.isArray(health_data)) {
                console.warn('⚠️ [프론트엔드] health_data가 배열이 아닙니다:', typeof health_data, health_data);
              }
              
              if (health_data && health_data.length > 0) {
                console.log('[프론트엔드] 첫 번째 health_data 샘플:');
                const firstItem = health_data[0];
                console.log(`  - year: ${firstItem.year}`);
                console.log(`  - checkup_date: ${firstItem.checkup_date}`);
                console.log(`  - location: ${firstItem.location}`);
                console.log(`  - raw_data 존재: ${!!firstItem.raw_data}`);
                console.log(`  - raw_data 타입: ${typeof firstItem.raw_data}`);
                
                if (firstItem.raw_data) {
                  const rawData = firstItem.raw_data;
                  console.log(`  - raw_data 키: ${Object.keys(rawData).slice(0, 10).join(', ')}`);
                  if (rawData.Inspections) {
                    const inspections = rawData.Inspections;
                    console.log(`  - Inspections 개수: ${Array.isArray(inspections) ? inspections.length : 0}`);
                    if (Array.isArray(inspections) && inspections.length > 0) {
                      const firstInspection = inspections[0];
                      if (firstInspection.Illnesses) {
                        const illnesses = firstInspection.Illnesses;
                        console.log(`  - 첫 번째 Inspection의 Illnesses 개수: ${Array.isArray(illnesses) ? illnesses.length : 0}`);
                        if (Array.isArray(illnesses) && illnesses.length > 0) {
                          const firstIllness = illnesses[0];
                          if (firstIllness.Items) {
                            const items = firstIllness.Items;
                            console.log(`  - 첫 번째 Illness의 Items 개수: ${Array.isArray(items) ? items.length : 0}`);
                            if (Array.isArray(items) && items.length > 0) {
                              for (let i = 0; i < Math.min(3, items.length); i++) {
                                const item = items[i];
                                console.log(`    - Item[${i}] Name: ${item.Name}, Value: ${item.Value}`);
                                if (item.ItemReferences) {
                                  const refs = item.ItemReferences;
                                  console.log(`      ItemReferences 개수: ${Array.isArray(refs) ? refs.length : 0}`);
                                  if (Array.isArray(refs) && refs.length > 0) {
                                    for (let j = 0; j < Math.min(2, refs.length); j++) {
                                      const ref = refs[j];
                                      console.log(`        - ${ref.Name}: ${ref.Value}`);
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              
              // 변수를 블록 밖에서 선언
              let healthDataFormatted = { ResultList: [] };
              let prescriptionDataFormatted = { ResultList: [] };
              
              // DB 데이터를 Tilko 형식으로 변환 (파싱된 필드들도 포함)
              if (health_data && health_data.length > 0) {
                // [프론트엔드 로그] 변환 전 데이터 확인
                console.log('[프론트엔드] DB→Tilko 형식 변환 시작');
                console.log(`  - 변환할 health_data 개수: ${health_data.length}`);
                
                healthDataFormatted = {
                  ResultList: health_data.map((item: any, index: number) => {
                    // [프론트엔드 로그] 각 항목 변환 과정
                    if (index === 0) {
                      console.log(`  - 첫 번째 항목 변환:`);
                      console.log(`    - 원본 year: ${item.year}`);
                      console.log(`    - 원본 checkup_date: ${item.checkup_date}`);
                      console.log(`    - 원본 raw_data 존재: ${!!item.raw_data}`);
                    }
                    
                    const transformed = {
                      ...item.raw_data,
                      // raw_data 필드 보존 (상태 판정에 필요)
                      raw_data: item.raw_data,
                      // DB에서 파싱된 필드들 추가
                      height: item.height,
                      weight: item.weight,
                      bmi: item.bmi,
                      waist_circumference: item.waist_circumference,
                      blood_pressure_high: item.blood_pressure_high,
                      blood_pressure_low: item.blood_pressure_low,
                      blood_sugar: item.blood_sugar,
                      cholesterol: item.cholesterol,
                      hdl_cholesterol: item.hdl_cholesterol,
                      ldl_cholesterol: item.ldl_cholesterol,
                      triglyceride: item.triglyceride,
                      hemoglobin: item.hemoglobin,
                      year: item.year,
                      checkup_date: item.checkup_date,
                      location: item.location,
                      code: item.code
                    };
                    
                    if (index === 0) {
                      console.log(`    - 변환 후 year: ${transformed.year}`);
                      console.log(`    - 변환 후 checkup_date: ${transformed.checkup_date}`);
                      console.log(`    - 변환 후 raw_data 존재: ${!!transformed.raw_data}`);
                      console.log(`    - 변환 후 height: ${transformed.height}`);
                      console.log(`    - 변환 후 weight: ${transformed.weight}`);
                    }
                    
                    return transformed;
                  })
                };
                
                // [프론트엔드 로그] 변환 완료 확인
                console.log(`[프론트엔드] 변환 완료: ${healthDataFormatted.ResultList.length}개 항목`);
                if (healthDataFormatted.ResultList.length > 0) {
                  const firstItem = healthDataFormatted.ResultList[0] as any;
                  console.log(`  - 첫 번째 변환된 항목의 year: ${firstItem?.year}`);
                  console.log(`  - 첫 번째 변환된 항목의 checkup_date: ${firstItem?.checkup_date}`);
                  console.log(`  - 첫 번째 변환된 항목의 raw_data 존재: ${!!firstItem?.raw_data}`);
                }
                
                setHealthData(healthDataFormatted);
                // 디버깅용 간소화된 데이터 로그
                const simplifiedHealthData = simplifyDataForLog(healthDataFormatted);
                console.log('[결과페이지] 건강검진 데이터 설정 완료:', simplifiedHealthData);
              }
              
              if (prescription_data && prescription_data.length > 0) {
                prescriptionDataFormatted = {
                  ResultList: prescription_data.map((item: any) => ({
                    ...item.raw_data,
                    // DB에서 파싱된 필드들 추가
                    hospital_name: item.hospital_name,
                    address: item.address,
                    treatment_date: item.treatment_date,
                    treatment_type: item.treatment_type,
                    visit_count: item.visit_count,
                    medication_count: item.medication_count,
                    prescription_count: item.prescription_count,
                    detail_records_count: item.detail_records_count
                  }))
                };
                setPrescriptionData(prescriptionDataFormatted);
                // 디버깅용 간소화된 데이터 로그
                const simplifiedPrescriptionData = simplifyDataForLog(prescriptionDataFormatted);
                console.log('[결과페이지] 처방전 데이터 설정 완료:', simplifiedPrescriptionData);
              }
              
              // API에 데이터가 있는 경우에만 저장 및 종료
              const hasHealthData = healthDataFormatted?.ResultList?.length > 0;
              const hasPrescriptionData = prescriptionDataFormatted?.ResultList?.length > 0;
              
              if (hasHealthData || hasPrescriptionData) {
                // 마지막 업데이트 시간 설정
                if (result.data.last_update) {
                  setLastUpdateTime(result.data.last_update);
                  // 토스트 메시지 표시
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000); // 3초 후 자동 숨김
                }
                
                // [IndexedDB] 건강 데이터 저장 (AI 종합 분석용)
                try {
                  const healthRecord: HealthDataRecord = {
                    uuid: uuid!,
                    patientName: state.patient?.name || '사용자',
                    hospitalId: hospital!,
                    healthData: healthDataFormatted?.ResultList || [],
                    prescriptionData: prescriptionDataFormatted?.ResultList || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    dataSource: 'api'
                  };

                  const saveSuccess = await WelnoIndexedDB.saveHealthData(healthRecord);
                  
                  if (saveSuccess) {
                    console.log('[IndexedDB] 건강 데이터 저장 성공:', {
                      uuid: uuid,
                      건강검진개수: healthDataFormatted?.ResultList?.length || 0,
                      처방전개수: prescriptionDataFormatted?.ResultList?.length || 0,
                      데이터크기: `${(JSON.stringify(healthRecord).length/1024).toFixed(1)}KB`
                    });

                    // localStorage에는 최소 플래그만 저장 (기존 호환성)
                    localStorage.setItem('tilko_collected_data', JSON.stringify({
                      health_data: { ResultList: [] }, // 빈 배열로 플래그만
                      prescription_data: { ResultList: [] }, // 빈 배열로 플래그만
                      collected_at: new Date().toISOString(),
                      source: 'indexeddb',
                      uuid: uuid,
                      dataSize: `${(JSON.stringify(healthRecord).length/1024).toFixed(1)}KB`
                    }));
                  } else {
                    throw new Error('IndexedDB 저장 실패');
                  }
                  
                } catch (error: any) {
                  console.error('[IndexedDB 저장 오류]', {
                    오류타입: error.name,
                    오류메시지: error.message,
                    건강검진개수: healthDataFormatted?.ResultList?.length || 0,
                    처방전개수: prescriptionDataFormatted?.ResultList?.length || 0
                  });
                  
                  // IndexedDB 실패 시 localStorage 폴백
                  try {
                    console.log('[폴백] localStorage로 최소 데이터 저장');
                    const minimalData = {
                      health_data: healthDataFormatted,
                      prescription_data: { ResultList: prescriptionDataFormatted?.ResultList?.slice(0, 10) || [] }, // 처방전 10개만
                      collected_at: new Date().toISOString(),
                      source: 'localStorage_fallback'
                    };
                    localStorage.setItem('tilko_collected_data', JSON.stringify(minimalData));
                    console.log('[폴백] localStorage 저장 완료');
                    
                  } catch (fallbackError: any) {
                    console.error('[폴백 실패]', fallbackError.message);
                    // 사용자에게 알림
                    setShowToast(true);
                    setLastUpdateTime('저장공간 부족으로 일부 기능 제한');
                    setTimeout(() => setShowToast(false), 5000);
                  }
                }
                
                // 플로팅 버튼 업데이트를 위한 이벤트 발생
                window.dispatchEvent(new Event('localStorageChange'));
                
                setLoading(false);
                return;
              } else {
                // API 응답은 성공했지만 데이터가 비어있는 경우 → IndexedDB 폴백
                console.log('[결과페이지] API 응답 성공 but 데이터 없음, IndexedDB 폴백');
              }
            } else {
              // result.success가 false이거나 result.data가 없는 경우
              console.warn('[결과페이지] API 응답 구조 오류, IndexedDB 폴백');
            }
          } else {
            // API 응답 실패
            console.warn('[결과페이지] DB 데이터 조회 실패, IndexedDB 폴백');
          }
        }

        // DB에서 데이터를 가져올 수 없는 경우 IndexedDB에서 로드
        if (uuid) {
          console.log('[결과페이지] IndexedDB에서 데이터 로드 시도:', uuid);
          
          try {
            const indexedDBRecord = await WelnoIndexedDB.getHealthData(uuid);
            
            if (indexedDBRecord) {
              console.log('[IndexedDB] 데이터 로드 성공:', indexedDBRecord);
              
              // IndexedDB 데이터를 서버 데이터와 동일한 구조로 변환
              const healthDataFormatted = {
                ResultList: indexedDBRecord.healthData.map((item: any) => {
                  // IndexedDB 데이터는 이미 양쪽 필드명이 모두 있지만,
                  // 서버 데이터와 동일한 구조로 변환 (일관성 유지)
                  const hasRawData = item.raw_data !== undefined;
                  const rawData = hasRawData ? item.raw_data : {
                    // raw_data가 없으면 원본에서 Tilko 형식 재구성
                    Year: item.Year || item.year,
                    CheckUpDate: item.CheckUpDate || item.checkup_date,
                    Location: item.Location || item.location,
                    Code: item.Code || item.code,
                    Description: item.Description || item.description || '',
                    Inspections: item.Inspections || []
                  };
                  
                  return {
                    ...rawData,  // Tilko 원본 필드들 스프레드 (Year, CheckUpDate 등)
                    // raw_data 필드 보존 (서버 데이터와 동일한 구조)
                    raw_data: rawData,
                    // 파싱된 필드들 추가 (서버 데이터와 동일)
                    height: item.height,
                    weight: item.weight,
                    bmi: item.bmi,
                    waist_circumference: item.waist_circumference,
                    blood_pressure_high: item.blood_pressure_high,
                    blood_pressure_low: item.blood_pressure_low,
                    blood_sugar: item.blood_sugar,
                    cholesterol: item.cholesterol,
                    hdl_cholesterol: item.hdl_cholesterol,
                    ldl_cholesterol: item.ldl_cholesterol,
                    triglyceride: item.triglyceride,
                    hemoglobin: item.hemoglobin,
                    // 필드명 통일 (양쪽 모두 지원 - 이미 있지만 명시적으로 보장)
                    year: item.year || item.Year,
                    checkup_date: item.checkup_date || item.CheckUpDate,
                    location: item.location || item.Location,
                    code: item.code || item.Code
                  };
                })
              };
              
              const prescriptionDataFormatted = {
                ResultList: indexedDBRecord.prescriptionData.map((item: any) => {
                  // 처방전 데이터도 서버 데이터와 동일한 구조로 변환
                  const hasRawData = item.raw_data !== undefined;
                  const rawData = hasRawData ? item.raw_data : item;
                  
                  return {
                    ...rawData,
                    raw_data: rawData,
                    // 파싱된 필드들 추가 (서버 데이터와 동일)
                    hospital_name: item.hospital_name || item.ByungEuiwonYakGukMyung,
                    address: item.address || item.Address,
                    treatment_date: item.treatment_date || item.TreatDate || item.JinRyoGaesiIl,
                    treatment_type: item.treatment_type || item.JinRyoHyungTae,
                    visit_count: item.visit_count || item.BangMoonIpWonIlsoo,
                    medication_count: item.medication_count || item.TuYakYoYangHoiSoo,
                    prescription_count: item.prescription_count || item.CheoBangHoiSoo,
                    detail_records_count: item.detail_records_count || 0
                  };
                })
              };
              
              setHealthData(healthDataFormatted);
              setPrescriptionData(prescriptionDataFormatted);
              setLastUpdateTime(indexedDBRecord.updatedAt);
              
              // 토스트 메시지 표시
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
              
            } else {
              // IndexedDB에 데이터가 없으면 localStorage 확인 (폴백)
              console.log('[IndexedDB] 데이터 없음, localStorage 확인');
              
              const collectedDataStr = localStorage.getItem('tilko_collected_data');
              if (collectedDataStr) {
                const collectedData = JSON.parse(collectedDataStr);
                console.log('[폴백] localStorage에서 데이터 로드:', collectedData);
                
                setHealthData(collectedData.health_data);
                setPrescriptionData(collectedData.prescription_data);
                
                if (collectedData.collected_at) {
                  setLastUpdateTime(collectedData.collected_at);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                } else {
                  const fallbackTime = new Date().toISOString();
                  setLastUpdateTime(fallbackTime);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                }
              } else {
                console.warn('[결과페이지] IndexedDB와 localStorage 모두에 저장된 데이터가 없습니다');
              }
            }
            
          } catch (error) {
            console.error('[IndexedDB] 데이터 로드 실패:', error);
            
            // IndexedDB 실패 시 localStorage 폴백
            const collectedDataStr = localStorage.getItem('tilko_collected_data');
            if (collectedDataStr) {
              const collectedData = JSON.parse(collectedDataStr);
              console.log('[폴백] localStorage에서 데이터 로드:', collectedData);
              
              setHealthData(collectedData.health_data);
              setPrescriptionData(collectedData.prescription_data);
              setLastUpdateTime(collectedData.collected_at || new Date().toISOString());
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }
          }
        } else {
          console.warn('[결과페이지] UUID가 없어 데이터를 로드할 수 없습니다');
        }
        
      } catch (err) {
        console.error('[결과페이지] 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    // 즉시 데이터 로드 (로딩 상태는 useState로 관리)
    loadHealthData();
  }, []);

  // ⭐ 건강검진 데이터 로드 후 Mediarc 리포트 조회
  useEffect(() => {
    const loadMediarcReport = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital') || urlParams.get('hospitalId') || urlParams.get('hospital_id');
      
      if (!uuid || !hospital || !healthData?.ResultList || healthData.ResultList.length === 0) {
        return; // 건강검진 데이터가 없으면 조회하지 않음
      }
      
      // 이미 로드된 경우 스킵
      if (mediarcData) {
        return;
      }
      
      try {
        console.log('[HealthDataViewer] Mediarc 리포트 조회 시작:', { uuid, hospital });
        const mediarcResponse = await fetch(`/welno-api/v1/welno/mediarc-report?uuid=${uuid}&hospital_id=${hospital}`);
        const mediarcResult = await mediarcResponse.json();
        
        console.log('[HealthDataViewer] Mediarc 리포트 응답:', {
          success: mediarcResult.success,
          has_report: mediarcResult.has_report,
          data: mediarcResult.data,
          message: mediarcResult.message
        });
        
        if (mediarcResult.success && mediarcResult.has_report && mediarcResult.data) {
          console.log('[HealthDataViewer] Mediarc 리포트 로드 성공:', {
            bodyage: mediarcResult.data.bodyage,
            rank: mediarcResult.data.rank,
            mkt_uuid: mediarcResult.data.mkt_uuid
          });
          setMediarcData({
            bodyage: mediarcResult.data.bodyage,
            rank: mediarcResult.data.rank,
            mkt_uuid: mediarcResult.data.mkt_uuid,
            report_url: mediarcResult.data.report_url,
            has_questionnaire: mediarcResult.data.has_questionnaire
          });
          setShowMediarcSection(true);
        } else {
          console.log('[HealthDataViewer] Mediarc 리포트 없음:', mediarcResult.message || '리포트가 없습니다');
          console.log('[HealthDataViewer] 응답 상세:', mediarcResult);
        }
      } catch (mediarcError) {
        console.error('[HealthDataViewer] Mediarc 리포트 조회 실패:', mediarcError);
      }
    };

    // 건강검진 데이터가 로드되고 로딩이 완료되었을 때만 조회
    if (healthData?.ResultList && healthData.ResultList.length > 0 && !loading && !mediarcData) {
      loadMediarcReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthData, loading]); // mediarcData는 의존성에서 제외 (무한 루프 방지)

  // Pull-to-refresh 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !containerRef.current) return;

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0 && containerRef.current.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(distance * 0.5, 100); // 최대 100px
      setPullDistance(pullDistance);
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;

    if (pullDistance > 60) {
      // 횟수 증가
      const newCount = pullCount + 1;
      setPullCount(newCount);
      
      // 3번째부터 모달 표시
      if (newCount >= 3) {
        setShowRefreshModal(true);
        setPullCount(0); // 리셋
      } else {
        console.log(`[Pull-to-refresh] ${newCount}/3회 - ${3 - newCount}번 더 당기면 새로고침`);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, pullCount]);

  // 새로고침 확인 모달 핸들러
  const handleRefreshConfirm = useCallback(async (withdraw: boolean = false) => {
    setShowRefreshModal(false);
    
    // 환자 정보 유지하면서 재인증 페이지로 이동
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
    
    if (!uuid || !hospital) {
      console.error('[새로고침] UUID 또는 병원 ID가 없습니다.');
      return;
    }
    
    try {
      // 1. 로컬 스토리지 데이터 삭제 (공통)
      localStorage.removeItem('tilko_collected_data');
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
      localStorage.removeItem('welno_health_data');
      localStorage.removeItem('welno_view_mode');
      
      // 2. 약관 동의 데이터 삭제 (UUID별로 구분된 키)
      const termsKey = `welno_terms_agreed_${uuid}`;
      const termsAtKey = `welno_terms_agreed_at_${uuid}`;
      const termsListKey = `welno_terms_agreed_list_${uuid}`;
      const termsAgreementKey = `welno_terms_agreement_${uuid}`;
      
      localStorage.removeItem(termsKey);
      localStorage.removeItem(termsAtKey);
      localStorage.removeItem(termsListKey);
      localStorage.removeItem(termsAgreementKey);
      
      // 기존 전역 약관 동의 키도 삭제 (하위 호환성)
      localStorage.removeItem('welno_terms_agreed');
      localStorage.removeItem('welno_terms_agreed_at');
      localStorage.removeItem('welno_terms_agreed_list');
      localStorage.removeItem('welno_terms_agreement');
      
      console.log('[새로고침] 약관 동의 데이터 삭제 완료:', uuid);
      
      // 3. IndexedDB 데이터 삭제
      await WelnoIndexedDB.clearAllData();
      console.log('[새로고침] IndexedDB 삭제 완료');
      
      // 4. WelnoDataContext 캐시 클리어
      if (actions.clearCache) {
        actions.clearCache();
      }
      
      // 5. 데이터베이스에서 건강정보 삭제
      if (withdraw) {
        // 탈퇴하기: 약관 동의 + 건강정보 모두 삭제 후 첫 화면으로
        console.log('[탈퇴하기] 데이터베이스에서 건강정보 삭제 시작');
        
        // 백엔드 API 호출하여 건강정보 삭제
        const deleteResponse = await fetch(
          API_ENDPOINTS.DELETE_HEALTH_DATA(uuid, hospital),
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('[탈퇴하기] 데이터베이스 건강정보 삭제 완료:', deleteResult);
        } else {
          console.error('[탈퇴하기] 데이터베이스 건강정보 삭제 실패:', deleteResponse.status);
        }
        
        // 약관 동의도 서버에서 삭제 (API가 있다면)
        // 현재는 로컬 스토리지만 삭제
        
        console.log('[탈퇴하기] 모든 데이터 삭제 완료 - 처음 랜딩 페이지로 이동');
        
        // 처음 랜딩 페이지로 이동 (URL 파라미터 완전 제거)
        // window.location.href를 사용하여 완전히 새로운 페이지 로드
        window.location.href = '/welno';
      } else {
        // 새로고침만: 건강정보만 삭제 후 재인증
        console.log('[새로고침] 데이터베이스에서 건강정보만 삭제 시작');
        
        // 백엔드 API 호출하여 건강정보 삭제
        const deleteResponse = await fetch(
          API_ENDPOINTS.DELETE_HEALTH_DATA(uuid, hospital),
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (deleteResponse.ok) {
          const deleteResult = await deleteResponse.json();
          console.log('[새로고침] 데이터베이스 건강정보 삭제 완료:', deleteResult);
        } else {
          console.error('[새로고침] 데이터베이스 건강정보 삭제 실패:', deleteResponse.status);
        }
        
        console.log('[새로고침] 로컬 데이터 삭제 완료 - 재인증 페이지로 이동');
        
        // 재인증 페이지로 이동 (환자 정보 유지)
        navigate(`/login?uuid=${uuid}&hospital=${hospital}`);
      }
    } catch (error) {
      console.error('[새로고침] 오류 발생:', error);
      // 오류 발생해도 이동은 진행
      if (withdraw) {
        // 탈퇴하기: 처음 랜딩 페이지로 이동 (URL 파라미터 완전 제거)
        window.location.href = '/welno';
      } else {
        navigate(`/login?uuid=${uuid}&hospital=${hospital}`);
      }
    }
  }, [navigate, actions]);

  const handleRefreshCancel = useCallback(() => {
    setShowRefreshModal(false);
  }, []);

  // 마지막 업데이트 시간 포맷팅
  const formatLastUpdateTime = useCallback((timeString: string | null) => {
    if (!timeString) return '알 수 없음';
    
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 7) return `${diffDays}일 전`;
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '알 수 없음';
    }
  }, []);

  const handleBack = () => {
    // 카테고리 모드이고 뎁스가 1 이상이면 CategoryView의 뒤로가기 호출
    if (viewMode === 'category' && categoryDepth > 0) {
      // CategoryView의 handleBack 호출
      if (categoryViewBackRef.current) {
        categoryViewBackRef.current();
      } else {
        // 이벤트로 전달
        window.dispatchEvent(new CustomEvent('categoryViewBack'));
      }
      return;
    }
    
    // 그 외의 경우 (카테고리 그리드, trends, timeline) → 메인 페이지로
    if (onBack) {
      onBack();
    } else {
      // URL 파라미터 유지하여 메인 페이지로 이동
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      if (uuid && hospital) {
        navigate(`/?uuid=${uuid}&hospital=${hospital}`);
      } else {
        navigate('/');
      }
    }
  };

  // 로딩 상태: ContentLayoutWithHeader 사용 (일관된 레이아웃)
  if (loading) {
    return (
      <div className="health-data-viewer">
        <ContentLayoutWithHeader
          onBack={handleBack}
          lastUpdateTime={undefined}
          patientName={patientName}
          showToggle={false}
        >
          <div className="health-data-viewer__loading">
            <div className="loading-spinner">
              <img 
                src={WELNO_LOGO_IMAGE}
                alt="로딩 중" 
                className="welno-icon-blink"
              />
              <p className="loading-spinner__message">{patientName}님의 건강 데이터를 불러오는 중...</p>
            </div>
          </div>
        </ContentLayoutWithHeader>
      </div>
    );
  }

  // 에러 상태: ContentLayoutWithHeader 사용 (일관된 레이아웃)
  if (error) {
    return (
      <div className="health-data-viewer">
        <ContentLayoutWithHeader
          onBack={handleBack}
          lastUpdateTime={undefined}
          patientName={patientName}
          showToggle={false}
        >
          <div className="health-data-viewer__error">
            <div className="error-message">
              <div className="error-message__icon">⚠️</div>
              <div className="error-message__title">데이터 조회 실패</div>
              <div className="error-message__text">{error}</div>
              <div className="error-message__actions">
                <button 
                  className="error-message__button error-message__button--primary"
                  onClick={() => window.location.reload()}
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        </ContentLayoutWithHeader>
      </div>
    );
  }

  // Pull-to-refresh 인디케이터
  const pullToRefreshIndicator = isPulling ? (
    <div 
      className="pull-to-refresh-indicator"
      style={{
        position: 'absolute',
        top: `-${Math.min(pullDistance, 60)}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: Math.min(pullDistance / 60, 1),
        transition: 'opacity 0.2s ease-out'
      }}
    >
      <div className="refresh-icon">
        {pullDistance > 60 ? '↻' : '↓'}
      </div>
      <div className="refresh-text">
        {pullDistance > 60 ? '놓으면 새로고침' : '아래로 당겨서 새로고침'}
      </div>
    </div>
  ) : null;

  return (
    <div className="health-data-viewer">
      <ContentLayoutWithHeader
        onBack={handleBack}
        lastUpdateTime={lastUpdateTime ?? undefined}
        patientName={patientName}
        onRefresh={(withdraw?: boolean) => handleRefreshConfirm(withdraw || false)}
        showToggle={true}
        activeTab={viewMode}
        onTabChange={(tab) => {
          setViewMode(tab);
          setFilterMode('all');
          // viewMode 변경을 localStorage에 저장
          localStorage.setItem('welno_view_mode', tab);
        }}
        containerRef={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        transform={isPulling ? `translateY(${pullDistance}px)` : 'translateY(0)'}
        transition={isPulling ? 'none' : 'transform 0.3s ease-out'}
        pullToRefreshIndicator={pullToRefreshIndicator}
      >
        {/* 조건부 렌더링: viewMode에 따라 TrendsSection, UnifiedHealthTimeline, CategoryView 표시 */}
        {isTransitioning ? (
          <div className="view-transition-loading">
            <div className="loading-spinner">
              <img 
                src={WELNO_LOGO_IMAGE}
                alt="전환 중" 
                className="welno-icon-blink"
              />
            </div>
            <p className="loading-text">화면을 전환하는 중...</p>
          </div>
        ) : viewMode === 'trends' ? (
          <TrendsSection 
            healthData={healthData?.ResultList || []}
            prescriptionData={prescriptionData?.ResultList || []}
            filterMode={filterMode}
            isLoading={isLoadingTrends}
          />
        ) : viewMode === 'category' ? (
          <>
            <CategoryView
              healthData={healthData?.ResultList || []}
              year={undefined}
              patientName={patientName}
              healthAge={mediarcData?.bodyage}
              actualAge={(() => {
                // birthday가 있으면 계산, 없으면 bodyage 기준으로 추정 (bodyage + 2세 정도)
                if (state.patient?.birthday) {
                  const calculated = calculateCurrentAge(state.patient.birthday);
                  if (calculated !== null) {
                    return calculated;
                  }
                }
                // birthday가 없으면 bodyage를 기준으로 추정 (일반적으로 건강나이보다 2-3세 높음)
                if (mediarcData?.bodyage) {
                  return Math.round(mediarcData.bodyage + 2);
                }
                return undefined;
              })()}
              showHealthAgeGlow={showMediarcGlow}
              onDepthChange={setCategoryDepth}
              onBackRequest={() => {
                // CategoryView의 handleBack을 ref로 저장
                categoryViewBackRef.current = () => {
                  window.dispatchEvent(new CustomEvent('categoryViewBack'));
                };
              }}
            />
          </>
        ) : (
          <>
            {/* 타임라인 위에 병원/약국 방문 추이 그래프 표시 */}
            <VisitTrendsChart 
              prescriptionData={prescriptionData?.ResultList || []}
              isLoading={loading}
            />
            <UnifiedHealthTimeline 
              healthData={healthData}
              prescriptionData={prescriptionData}
              loading={loading}
              filterMode={filterMode}
            />
          </>
        )}

        {/* AI 종합 분석 섹션 (조건부 표시) */}
        {showAIAnalysis && (
          <AIAnalysisSection 
            healthData={healthData?.ResultList || []}
            prescriptionData={prescriptionData?.ResultList || []}
            patientInfo={state.patient || undefined}
          />
        )}
      </ContentLayoutWithHeader>

      {/* 새로고침 확인 모달 */}
      {showRefreshModal && (
        <div className="refresh-modal-overlay">
          <div className="refresh-modal">
            <div className="refresh-modal-header">
              <h3>데이터 새로고침</h3>
            </div>
            <div className="refresh-modal-content">
              <div className="refresh-info">
                <div className="refresh-info-item">
                  <span className="info-label">현재 데이터 수집 시점:</span>
                  <span className="info-value">{formatLastUpdateTime(lastUpdateTime)}</span>
                </div>
              </div>
              <p className="refresh-description">
                새로운 건강정보를 수집하시겠어요?<br/>
                다시 인증 과정을 거쳐 최신 데이터를 가져옵니다.
              </p>
            </div>
            <div className="refresh-modal-actions">
              <button 
                className="refresh-btn refresh-btn-cancel"
                onClick={handleRefreshCancel}
              >
                취소
              </button>
              <button 
                className="refresh-btn refresh-btn-confirm"
                onClick={() => handleRefreshConfirm(false)}
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
        )}

        {/* 토스트 메시지 */}
        {showToast && lastUpdateTime && (
          <div className="toast-message">
            <div className="toast-content">
              <span className="toast-text">
                마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
              </span>
            </div>
          </div>
        )}

    </div>
  );
};

export { HealthDataViewer };