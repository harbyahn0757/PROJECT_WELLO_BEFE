import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCampaignSkin } from '../hooks/useCampaignSkin';
import { useUnifiedStatus } from '../hooks/useUnifiedStatus';
import { useMatrixAutoRedirect } from './DiseaseReportPage/hooks/useMatrixAutoRedirect';
import { useFloatingButton } from './DiseaseReportPage/hooks/useFloatingButton';
import { calculateCurrentAge, compareAges } from '../utils/ageCalculator';
import { DebugDeleteModal } from '../components/DebugDeleteModal';
import { trackReportPage } from '../utils/gtm';
import '../styles/aims-report.scss';
import '../styles/campaign-fixed.scss';
import '../styles/debug-delete-modal.scss';
import type { AIMSReportApiResponse, AIMSResponse, AIMSDataItem } from '../types/aimsReport';
import { API_ENDPOINTS } from '../../../config/api';
import { STORAGE_KEYS, StorageManager } from '../../../constants/storage';
import { useWebSocketAuth } from '../../../hooks/useWebSocketAuth';
import { checkQuestionnaireStatus } from '../utils/legacyCompat';
import HealthAgeSection from '../../../components/health/HealthAgeSection';
import EmailInputModal from '../../../components/common/EmailInputModal';
import { useWelnoData } from '../../../contexts/WelnoDataContext';

// 테스트 전화번호 목록
const TEST_PHONE_NUMBERS = ['01056180757', '01090736617', '01093576240', '01087582656', '01029959533'];

// 로컬호스트 체크 함수
const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
};

// 테스트 모드 체크 함수 (전화번호 또는 로컬호스트)
const isTestPhoneNumber = (phoneNumber: string | null | undefined): boolean => {
  if (!phoneNumber) return false;
  return TEST_PHONE_NUMBERS.includes(phoneNumber);
};

// 테스트 모드 체크 (전화번호 또는 로컬호스트)
const checkTestMode = (phoneNumber: string | null | undefined): boolean => {
  // 로컬호스트에서 실행 중이면 항상 테스트 모드
  if (isLocalhost()) {
    return true;
  }
  // 전화번호가 테스트 전화번호 목록에 있으면 테스트 모드
  return isTestPhoneNumber(phoneNumber);
};

const DiseaseReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { skinType, skinConfig, changeSkin } = useCampaignSkin();
  const { actions } = useWelnoData();
  // 기본값을 브라운 모드로 설정 (기존 skinType이 'Br'이 아니면 브라운으로 초기화)
  const [isBrownMode, setIsBrownMode] = useState(skinType === 'Br' || skinType !== 'G');

  // 색상 모드 변경 핸들러
  const handleSkinChange = useCallback((newMode: 'default' | 'brown') => {
    const newSkinType = newMode === 'brown' ? 'Br' : 'G'; // 기본 모드는 G (Green)
    changeSkin(newSkinType);
    setIsBrownMode(newMode === 'brown');
  }, [changeSkin]);

  // 컴포넌트 마운트 시 기본값을 브라운으로 설정
  useEffect(() => {
    if (skinType !== 'Br') {
      changeSkin('Br');
      setIsBrownMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 마운트 시에만 실행
  
  // ⭐ URL 파라미터에서 uuid, hospital, sessionId, oid 가져오기
  const uuid = searchParams.get('uuid') || StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || '';
  const hospitalId = searchParams.get('hospital') || StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || '';
  const sessionId = searchParams.get('sessionId') || null;
  const shouldGenerate = searchParams.get('generate') === 'true';
  const oid = searchParams.get('oid') || null;  // 파트너 결제 주문번호
  const partnerId = searchParams.get('partner') || null;  // 파트너 ID
  
  // ⭐ BNR 레거시 코드 호환성: mktUuid → uuid 매핑
  const mktUuid = uuid;
  
  // ⭐⭐⭐ 매트릭스 통합: 통합 상태 관리 (백엔드 기반)
  const { status: unifiedStatus, loading: statusLoading, error: statusError } = useUnifiedStatus(
    uuid, 
    hospitalId, 
    partnerId
  );
  
  // ⭐⭐⭐ 매트릭스 통합: 자동 리다이렉트 (약관, 결제, 데이터 수집)
  useMatrixAutoRedirect(unifiedStatus, uuid, partnerId);
  
  // ⭐⭐⭐ 매트릭스 통합: 플로팅 버튼 제어
  useFloatingButton(unifiedStatus, uuid, partnerId);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<AIMSResponse | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null); // 리포트 PDF URL
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerBirthday, setCustomerBirthday] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [ageComparison, setAgeComparison] = useState<{ ageDifference: number; isHealthier: boolean } | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [dataSource, setDataSource] = useState<'db' | 'delayed' | null>(null); // 데이터 출처 추적 (항상 DB에서 조회)
  const [showEmailModal, setShowEmailModal] = useState(false); // 이메일 모달 표시 여부
  const [emailLoading, setEmailLoading] = useState(false); // 이메일 전송 로딩 상태
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownStarted, setCountdownStarted] = useState(false); // 카운트다운 시작 여부 (재시작 방지)
  const [showKakaoMessage, setShowKakaoMessage] = useState(false); // 카카오톡 발송 메시지 표시 여부 // 패널 닫기 카운트다운
  const [showRankTooltip, setShowRankTooltip] = useState(false); // 등수 설명 툴팁 표시 여부
  const [showPanel, setShowPanel] = useState(false); // 패널 표시 여부
  const [showAgeCardGlow, setShowAgeCardGlow] = useState(false); // 나이 카드 반짝임 효과
  const [showAbnormalCardsGlow, setShowAbnormalCardsGlow] = useState(false); // 비정상 카드 반짝임 효과
  const [cancerLabelFilter, setCancerLabelFilter] = useState<'ALL' | 'NORMAL' | 'BOUNDARY' | 'ABNORMAL'>('ALL'); // 암 필터
  const [diseaseLabelFilter, setDiseaseLabelFilter] = useState<'ALL' | 'NORMAL' | 'BOUNDARY' | 'ABNORMAL'>('ALL'); // 질병 필터
  const [cancerSliderIndex, setCancerSliderIndex] = useState(0); // 암 카드 슬라이드 인덱스
  const [diseaseSliderIndex, setDiseaseSliderIndex] = useState(0); // 질병 카드 슬라이드 인덱스
  const cancerSliderContainerRef = useRef<HTMLDivElement>(null);
  const diseaseSliderContainerRef = useRef<HTMLDivElement>(null);
  const generationRequestedRef = useRef(false); // 리포트 생성 중복 요청 방지용
  
  // 디버그 모달 관련 상태
  const [showDebugModal, setShowDebugModal] = useState(false);
  const ageClickCountRef = useRef(0);
  const ageClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 스와이프 제스처 상태 (암 슬라이더)
  const [cancerTouchStartX, setCancerTouchStartX] = useState<number | null>(null);
  const [cancerTouchEndX, setCancerTouchEndX] = useState<number | null>(null);
  
  // 스와이프 제스처 상태 (질병 슬라이더)
  const [diseaseTouchStartX, setDiseaseTouchStartX] = useState<number | null>(null);
  const [diseaseTouchEndX, setDiseaseTouchEndX] = useState<number | null>(null);
  
  // 최소 스와이프 거리
  const minSwipeDistance = 50;
  
  // 나이 박스 클릭 핸들러 (디버그 모달용)
  const handleAgeBoxClick = useCallback(() => {
    ageClickCountRef.current += 1;
    
    // 타이머 리셋
    if (ageClickTimerRef.current) {
      clearTimeout(ageClickTimerRef.current);
    }
    
    // 3번 연속 클릭 시 모달 표시
    if (ageClickCountRef.current >= 3) {
      setShowDebugModal(true);
      ageClickCountRef.current = 0;
    } else {
      // 2초 내에 다시 클릭하지 않으면 카운트 리셋
      ageClickTimerRef.current = setTimeout(() => {
        ageClickCountRef.current = 0;
      }, 2000);
    }
  }, []);
  
  // 디버그 삭제 핸들러
  const handleDebugDelete = useCallback(async (deleteQuestionnaire: boolean, deleteReport: boolean) => {
    if (!mktUuid) {
      throw new Error('mkt_uuid가 없습니다.');
    }
    
    const response = await fetch('/api/partner-marketing/debug-delete-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mkt_uuid: mktUuid,
        delete_questionnaire: deleteQuestionnaire,
        delete_report: deleteReport,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '삭제 실패');
    }
    
    const result = await response.json();
    
    // 삭제 후 페이지 새로고침
    if (deleteReport) {
      window.location.reload();
    } else if (deleteQuestionnaire) {
      // 문진만 삭제한 경우 리포트는 유지
      window.location.reload();
    }
    
    return result;
  }, [mktUuid]);
  
  // 슬라이더 transform 계산 함수 (컨테이너 너비 기준)
  const getSliderTransform = (index: number, containerRef: React.RefObject<HTMLDivElement | null>): string => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const cardWidth = containerWidth / 1.5; // 한 화면에 1.5개 보이도록
      const translateX = index * cardWidth;
      return `translateX(-${translateX}px)`;
    }
    // fallback: 퍼센트 계산
    return `translateX(-${index * (100 / 1.5)}%)`;
  };
  
  // 암 슬라이더 스와이프 핸들러
  const handleCancerTouchStart = (e: React.TouchEvent) => {
    setCancerTouchEndX(null);
    setCancerTouchStartX(e.targetTouches[0].clientX);
  };
  
  const handleCancerTouchMove = (e: React.TouchEvent) => {
    setCancerTouchEndX(e.targetTouches[0].clientX);
  };
  
  const handleCancerTouchEnd = () => {
    if (!cancerTouchStartX || !cancerTouchEndX) return;
    
    const distance = cancerTouchStartX - cancerTouchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && cancerSliderIndex < filteredCancerData.length - 1) {
      // 왼쪽으로 스와이프 (다음)
      const newIndex = Math.min(cancerSliderIndex + 1, filteredCancerData.length - 1);
      setCancerSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'cancer',
        direction: 'next',
        card_index: newIndex,
        total_cards: filteredCancerData.length
      });
    } else if (isRightSwipe && cancerSliderIndex > 0) {
      // 오른쪽으로 스와이프 (이전)
      const newIndex = Math.max(cancerSliderIndex - 1, 0);
      setCancerSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'cancer',
        direction: 'prev',
        card_index: newIndex,
        total_cards: filteredCancerData.length
      });
    }
  };
  
  // 질병 슬라이더 스와이프 핸들러
  const handleDiseaseTouchStart = (e: React.TouchEvent) => {
    setDiseaseTouchEndX(null);
    setDiseaseTouchStartX(e.targetTouches[0].clientX);
  };
  
  const handleDiseaseTouchMove = (e: React.TouchEvent) => {
    setDiseaseTouchEndX(e.targetTouches[0].clientX);
  };
  
  const handleDiseaseTouchEnd = () => {
    if (!diseaseTouchStartX || !diseaseTouchEndX) return;
    
    const distance = diseaseTouchStartX - diseaseTouchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && diseaseSliderIndex < filteredDiseaseData.length - 1) {
      // 왼쪽으로 스와이프 (다음)
      const newIndex = Math.min(diseaseSliderIndex + 1, filteredDiseaseData.length - 1);
      setDiseaseSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'disease',
        direction: 'next',
        card_index: newIndex,
        total_cards: filteredDiseaseData.length
      });
    } else if (isRightSwipe && diseaseSliderIndex > 0) {
      // 오른쪽으로 스와이프 (이전)
      const newIndex = Math.max(diseaseSliderIndex - 1, 0);
      setDiseaseSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'disease',
        direction: 'prev',
        card_index: newIndex,
        total_cards: filteredDiseaseData.length
      });
    }
  };
  
  // 마우스 이벤트 핸들러 (데스크톱 지원)
  const handleCancerMouseDown = (e: React.MouseEvent) => {
    setCancerTouchEndX(null);
    setCancerTouchStartX(e.clientX);
  };
  
  const handleCancerMouseMove = (e: React.MouseEvent) => {
    if (cancerTouchStartX !== null) {
      setCancerTouchEndX(e.clientX);
    }
  };
  
  const handleCancerMouseUp = () => {
    if (!cancerTouchStartX || !cancerTouchEndX) return;
    
    const distance = cancerTouchStartX - cancerTouchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && cancerSliderIndex < filteredCancerData.length - 1) {
      const newIndex = Math.min(cancerSliderIndex + 1, filteredCancerData.length - 1);
      setCancerSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'cancer',
        direction: 'next',
        card_index: newIndex,
        total_cards: filteredCancerData.length,
        input_method: 'mouse'
      });
    } else if (isRightSwipe && cancerSliderIndex > 0) {
      const newIndex = Math.max(cancerSliderIndex - 1, 0);
      setCancerSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'cancer',
        direction: 'prev',
        card_index: newIndex,
        total_cards: filteredCancerData.length,
        input_method: 'mouse'
      });
    }
    
    setCancerTouchStartX(null);
    setCancerTouchEndX(null);
  };
  
  const handleDiseaseMouseDown = (e: React.MouseEvent) => {
    setDiseaseTouchEndX(null);
    setDiseaseTouchStartX(e.clientX);
  };
  
  const handleDiseaseMouseMove = (e: React.MouseEvent) => {
    if (diseaseTouchStartX !== null) {
      setDiseaseTouchEndX(e.clientX);
    }
  };
  
  const handleDiseaseMouseUp = () => {
    if (!diseaseTouchStartX || !diseaseTouchEndX) return;
    
    const distance = diseaseTouchStartX - diseaseTouchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && diseaseSliderIndex < filteredDiseaseData.length - 1) {
      const newIndex = Math.min(diseaseSliderIndex + 1, filteredDiseaseData.length - 1);
      setDiseaseSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'disease',
        direction: 'next',
        card_index: newIndex,
        total_cards: filteredDiseaseData.length,
        input_method: 'mouse'
      });
    } else if (isRightSwipe && diseaseSliderIndex > 0) {
      const newIndex = Math.max(diseaseSliderIndex - 1, 0);
      setDiseaseSliderIndex(newIndex);
      trackReportPage('card_swipe', {
        mkt_uuid: mktUuid || null,
        card_type: 'disease',
        direction: 'prev',
        card_index: newIndex,
        total_cards: filteredDiseaseData.length,
        input_method: 'mouse'
      });
    }
    
    setDiseaseTouchStartX(null);
    setDiseaseTouchEndX(null);
  };
  const [reportUpdatedAt, setReportUpdatedAt] = useState<string | null>(null); // 리포트 업데이트 시간

  // ⭐ BNR 레거시: 고객 정보 조회 - Mediarc에서는 Storage에서 가져옴
  useEffect(() => {
    // Mediarc에서는 Patient 정보를 이미 가지고 있음
    const patientName = StorageManager.getItem(STORAGE_KEYS.PATIENT_NAME) || null;
    const patientBirthday = StorageManager.getItem(STORAGE_KEYS.PATIENT_BIRTH_DATE) || null;
    
    if (patientName) setCustomerName(patientName);
    if (patientBirthday) setCustomerBirthday(patientBirthday);
    
    // 테스트 모드 체크
    const isTest = checkTestMode(null);
    setIsTestMode(isTest);
    console.log(`[DiseaseReportPage] 환자 정보: ${patientName}, 테스트 모드: ${isTest}`);
  }, []);

  // 리포트 데이터 설정 함수
  const setReportDataWithInfo = useCallback((data: AIMSResponse, source: 'db' | 'delayed', customerInfo?: { name?: string; birthday?: string }) => {
    setReportData(data);
    setDataSource(source);
    if (customerInfo?.name) setCustomerName(customerInfo.name);
    if (customerInfo?.birthday) setCustomerBirthday(customerInfo.birthday);
    
    // 리포트 페이지 뷰 추적
    const cancerData = data?.data?.filter(item => item.type === 'cancer') || [];
    const diseaseData = data?.data?.filter(item => item.type === 'disease') || [];
    trackReportPage('page_view', {
      mkt_uuid: mktUuid || null,
      data_source: source,
      has_cancer_data: cancerData.length > 0,
      has_disease_data: diseaseData.length > 0,
      bodyage: data?.bodyage || null
    });
    
    // 나이 계산
    const birthday = customerInfo?.birthday || customerBirthday;
    let age: number | null = null;
    if (birthday) {
      age = calculateCurrentAge(birthday);
    }
    
    if (age === null && data) {
      age = Math.round(data.bodyage + 2);
      console.log(`생년월일 없음: 건강나이(${data.bodyage}세) 기준으로 ${age}세 추정`);
    }
    
    setCurrentAge(age);
    if (age !== null && data) {
      const comparison = compareAges(data.bodyage, age);
      if (comparison) {
        setAgeComparison({
          ageDifference: comparison.ageDifference,
          isHealthier: comparison.isHealthier,
        });
      }
    }
    setLoading(false);
    
    // 패널을 뿌연 상태로 올라오게 함
    setTimeout(() => {
      setShowPanel(true);
      // 패널이 올라온 후 스피너를 더 보여주고, 그 다음 뿌연 상태 제거 및 반짝임 효과
      setTimeout(() => {
        // 뿌연 상태 제거 (showAgeCardGlow가 true가 되면 오버레이가 사라짐)
        setShowAgeCardGlow(true);
        // 반짝임 효과는 조금 더 늦게 시작
        setTimeout(() => {
          // 반짝임 효과는 이미 showAgeCardGlow로 트리거됨
        }, 300);
      }, 1200); // 1.2초 더 스피너 표시
    }, 800); // 0.8초 후 패널 표시
  }, [customerBirthday]);

  // 리포트 조회 함수 (3초 간격으로 3번만 호출)
  // ⭐ 신규: Mediarc 리포트 조회 함수 (WELNO 또는 파트너)
  const fetchReport = useCallback(async () => {
    // 파트너 케이스: oid로 조회
    if (oid) {
      try {
        console.log(`[리포트 조회] 파트너 케이스 - oid: ${oid}`);
        
        // tb_campaign_payments에서 리포트 조회
        const response = await fetch(`/api/v1/campaigns/disease-prediction/report?oid=${oid}`);
        const data = await response.json();
        
        if (data.success && data.report_url) {
          console.log('[리포트 조회] 파트너 리포트 발견! URL:', data.report_url.substring(0, 100) + '...');
          
          // 리포트 URL 저장 (백엔드에서 이미 URL 만료 확인을 했으므로 바로 사용)
          setReportUrl(data.report_url);
          
          // Mediarc 응답 파싱 (API 레벨에서 이미 data 필드 추출됨)
          const medarcResponse = data.mediarc_response || {};
          const diseaseData = medarcResponse.disease_data || [];
          const cancerData = medarcResponse.cancer_data || [];
          const combinedData = [...diseaseData, ...cancerData];
          
          const aimsData: AIMSResponse = {
            bodyage: medarcResponse.bodyage || 0,
            rank: medarcResponse.rank || 0,
            data: combinedData
          };
          
          setReportDataWithInfo(
            aimsData,
            'db',
            {
              name: data.user_name,
              birthday: ''  // 파트너 데이터에는 없을 수 있음
            }
          );
          setLoading(false);
          setDataSource('db');
          return;
        } else {
          setError('리포트를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('[리포트 조회] 파트너 오류:', err);
        setError('리포트 조회 중 오류가 발생했습니다.');
        setLoading(false);
        return;
      }
    }
    
    // WELNO 케이스: uuid + hospital_id로 조회
    if (!uuid || !hospitalId) {
      setError('환자 정보가 없습니다.');
      setLoading(false);
      return;
    }

    try {
      console.log(`[리포트 조회] WELNO 케이스 - uuid: ${uuid}, hospital: ${hospitalId}`);
      
      // Mediarc 리포트 조회
      const response = await fetch(`/api/v1/welno/mediarc-report?uuid=${uuid}&hospital_id=${hospitalId}`);
      const data = await response.json();
      
      console.log('[리포트 조회] 응답:', {
        success: data.success,
        has_report: data.has_report
      });

      if (data.success && data.has_report && data.data) {
        console.log('[리포트 조회] 리포트 발견! - bodyage:', data.data.bodyage, 'rank:', data.data.rank);
        
        // 리포트 URL 저장 (백엔드에서 이미 URL 만료 확인을 했으므로 바로 사용)
        if (data.data.report_url) {
          console.log('[리포트 조회] WELNO 리포트 URL:', data.data.report_url.substring(0, 100) + '...');
          setReportUrl(data.data.report_url);
        }
        
        // 업데이트 시간 설정
        const updateDate = data.data.updated_at ? new Date(data.data.updated_at) : new Date();
        setReportUpdatedAt(updateDate.toLocaleString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }));
        
        // Mediarc 데이터 → AIMS 포맷 변환
        const diseaseData = data.data.disease_data || [];
        const cancerData = data.data.cancer_data || [];
        const combinedData = [...diseaseData, ...cancerData];
        
        const aimsData: AIMSResponse = {
          bodyage: data.data.bodyage || 0,
          rank: data.data.rank || 0,
          data: combinedData  // disease와 cancer를 하나의 data 배열로 통합
        };
        
        // 환자 정보 가져오기
        const patientName = StorageManager.getItem(STORAGE_KEYS.PATIENT_NAME) || '사용자';
        const patientBirthday = StorageManager.getItem(STORAGE_KEYS.PATIENT_BIRTH_DATE) || '';
        
        setReportDataWithInfo(
          aimsData,
          'db',
          {
            name: patientName,
            birthday: patientBirthday
          }
        );
        setLoading(false);
        setDataSource('db');
      } else if (shouldGenerate && !generationRequestedRef.current) {
        // generate=true인데 리포트 없음 → 생성 요청 (중복 방지 체크 추가)
        console.log('[리포트 조회] 리포트 없음 → Mediarc 생성 요청 시작');
        generationRequestedRef.current = true;
        
        try {
          // ✅ [Phase 4] session_id를 API에 전달 (WebSocket 알림용)
          const apiUrl = `/api/v1/welno/mediarc-report/generate?uuid=${uuid}&hospital_id=${hospitalId}${sessionId ? `&session_id=${sessionId}` : ''}`;
          console.log(`📡 [DiseaseReportPage] 리포트 생성 API 호출 (session_id=${sessionId || '없음'})`);
          
          const generateRes = await fetch(apiUrl, {
            method: 'POST'
          });
          const generateData = await generateRes.json();
          
          console.log('[리포트 생성] 응답:', generateData);
          
          if (generateData.success && generateData.generating) {
            if (generateData.has_websocket) {
              console.log('[리포트 생성] 백그라운드 생성 시작 → WebSocket 대기');
            } else {
              console.log('[리포트 생성] 백그라운드 생성 시작 → 폴링 대기 (session_id 없음)');
            }
            setLoading(true);
            // WebSocket이 완료 이벤트를 받으면 자동으로 재조회됩니다
          } else {
            console.log('[리포트 생성] 생성 실패:', generateData.message);
            setError(generateData.message || '리포트 생성을 시작할 수 없습니다.');
            setLoading(false);
            generationRequestedRef.current = false; // 실패 시 재시도 가능하도록 초기화
          }
        } catch (genError) {
          console.error('[리포트 생성] 에러:', genError);
          setError('리포트 생성 요청 중 오류가 발생했습니다.');
          setLoading(false);
          generationRequestedRef.current = false; // 에러 시 재시도 가능하도록 초기화
        }
      } else if (shouldGenerate && generationRequestedRef.current) {
        console.log('[리포트 조회] 리포트 생성 대기 중 (중복 요청 방지)');
        setLoading(true);
      } else {
        // 리포트 없음
        setError('질병예측 리포트가 없습니다. 먼저 건강검진 데이터를 수집해주세요.');
        setLoading(false);
      }
    } catch (err) {
      console.error('[리포트 조회] 오류:', err);
      setError('리포트 조회 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }, [uuid, hospitalId, oid, shouldGenerate, setReportDataWithInfo]);

  // 카운트다운 시작 함수
  const startCountdown = useCallback(() => {
    // 이미 시작되었으면 재시작 방지
    if (countdownStarted) {
      return;
    }
    
    setCountdownStarted(true);
    let remaining = 5; // 5초 카운트다운
    setCountdown(remaining);
    
    const countdownInterval = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        setCountdown(null);
        
        // 페이드 아웃 효과 후 페이지 전환
        const pageElement = document.querySelector('.aims-report-page');
        if (pageElement) {
          pageElement.classList.add('fade-out');
          setTimeout(() => {
        // 리포트 페이지에서 event-fixed 페이지로 이동
        const currentUrl = new URL(window.location.href);
        // page 파라미터를 event-fixed로 설정하고 나머지 파라미터(uid, skin 등)는 유지
            currentUrl.searchParams.set('page', 'event-fixed');
            window.location.href = currentUrl.toString();
          }, 500); // 0.5초 페이드 아웃
        } else {
          // 페이드 아웃 효과 없이 바로 전환
          const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('page', 'event-fixed');
        window.location.href = currentUrl.toString();
        }
      }
    }, 1000);
  }, [countdownStarted]);

  // ⭐ WebSocket으로 Mediarc 완료 이벤트 수신
  // ✅ [Phase 4] sessionId가 있으면 WebSocket 연결, 없으면 skip
  useWebSocketAuth({
    sessionId,
    onDataCollectionProgress: (type, message, data) => {
      console.log(`📨 [DiseaseReportPage WebSocket] 이벤트: ${type}, sessionId=${sessionId || '없음'}`);
      
      if (type === 'mediarc_report_completed') {
        console.log('🎉 [DiseaseReportPage] Mediarc 완료 → 리포트 재조회');
        // 리포트 재조회
        fetchReport();
        // 반짝임 효과 트리거
        setShowAgeCardGlow(true);
        setShowAbnormalCardsGlow(true);
        setTimeout(() => {
          setShowAgeCardGlow(false);
          setShowAbnormalCardsGlow(false);
        }, 2500); // 2.5초 후 끄기
      }
    },
    onError: (error) => {
      console.error('❌ [DiseaseReportPage WebSocket] 에러:', error);
    }
  });

  // ⭐ 리포트 조회 useEffect
  useEffect(() => {
    // 캠페인 케이스: oid만 있는 경우 허용
    if (oid && !uuid && !hospitalId) {
      console.log('[DiseaseReportPage] 캠페인 모드 (oid 기반 조회)');
      fetchReport();
      return;
    }

    // 일반 WELNO 케이스: uuid와 hospitalId 필수
    if (!uuid || !hospitalId) {
      setError('환자 정보가 없습니다.');
      setLoading(false);
      return;
    }

    // 리포트 조회
    fetchReport();
  }, [uuid, hospitalId, oid, fetchReport]);

  // 카카오톡 메시지 표시 시 카운트다운 시작 (한 번만)
  useEffect(() => {
    if (showKakaoMessage && countdown === null && !countdownStarted) {
      startCountdown();
    }
  }, [showKakaoMessage, countdown, countdownStarted, startCountdown]);

  // skinType 변경 시 isBrownMode 동기화
  useEffect(() => {
    setIsBrownMode(skinType === 'Br');
  }, [skinType]);

  // 이메일 모달 이벤트 리스너
  useEffect(() => {
    const handleEmailModalOpen = () => {
      console.log('[DiseaseReportPage] 이메일 모달 열기 이벤트 수신');
      setShowEmailModal(true);
    };

    window.addEventListener('welno-email-modal-open', handleEmailModalOpen);

    return () => {
      window.removeEventListener('welno-email-modal-open', handleEmailModalOpen);
    };
  }, []);

  // 이메일 전송 핸들러
  const handleEmailSubmit = useCallback(async (email: string) => {
    setEmailLoading(true);
    try {
      const requestBody: any = { email };
      
      // oid가 있으면 oid 사용, 없으면 uuid + hospitalId 사용
      if (oid) {
        requestBody.oid = oid;
      } else if (uuid && hospitalId) {
        requestBody.uuid = uuid;
        requestBody.hospital_id = hospitalId;
      } else {
        throw new Error('리포트 정보가 없습니다.');
      }

      const response = await fetch(API_ENDPOINTS.UPDATE_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (data.success) {
        alert('리포트 발송 요청이 완료되었습니다.');
        setShowEmailModal(false);
      } else {
        alert('오류가 발생했습니다: ' + (data.error || data.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Email update failed:', error);
      alert('서버 통신 오류가 발생했습니다.');
    } finally {
      setEmailLoading(false);
    }
  }, [oid, uuid, hospitalId]);

  // 모바일 감지 함수
  const isMobile = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768);
  }, []);

  // 리포트 URL 재조회 (만료된 URL 대응)
  const refreshReportUrl = useCallback(async () => {
    try {
      if (oid) {
        console.log('[URL 재조회] 파트너 케이스 - oid:', oid);
        const response = await fetch(`/api/v1/campaigns/disease-prediction/report?oid=${oid}`);
        if (!response.ok) {
          console.error('[URL 재조회] HTTP 오류:', response.status, response.statusText);
          return null;
        }
        const data = await response.json();
        console.log('[URL 재조회] 응답 데이터:', { success: data.success, has_url: !!data.report_url });
        if (data.success && data.report_url) {
          console.log('[URL 재조회] 성공 - URL:', data.report_url.substring(0, 100) + '...');
          setReportUrl(data.report_url);
          return data.report_url;
        } else {
          console.warn('[URL 재조회] 리포트 URL이 없음:', data);
        }
      } else if (uuid && hospitalId) {
        console.log('[URL 재조회] WELNO 케이스 - uuid:', uuid, 'hospital:', hospitalId);
        const response = await fetch(`/api/v1/welno/mediarc-report?uuid=${uuid}&hospital_id=${hospitalId}`);
        if (!response.ok) {
          console.error('[URL 재조회] HTTP 오류:', response.status, response.statusText);
          return null;
        }
        const data = await response.json();
        console.log('[URL 재조회] 응답 데이터:', { success: data.success, has_report: data.has_report, has_url: !!data.data?.report_url });
        if (data.success && data.has_report && data.data?.report_url) {
          console.log('[URL 재조회] 성공 - URL:', data.data.report_url.substring(0, 100) + '...');
          setReportUrl(data.data.report_url);
          return data.data.report_url;
        } else {
          console.warn('[URL 재조회] 리포트 URL이 없음:', data);
        }
      } else {
        console.warn('[URL 재조회] 필요한 파라미터가 없음 - oid:', oid, 'uuid:', uuid, 'hospitalId:', hospitalId);
      }
    } catch (error) {
      console.error('[URL 재조회] 예외 발생:', error);
    }
    return null;
  }, [oid, uuid, hospitalId]);

  // 다운로드 핸들러
  const handleDownload = useCallback(async () => {
    if (!reportUrl) {
      actions.addNotification({
        type: 'warning',
        title: '다운로드 불가',
        message: '리포트 PDF가 아직 준비되지 않았습니다.',
        priority: 'high',
        autoClose: true,
        duration: 3000
      });
      return;
    }

    // URL 정합성 확인: 최신 URL 재조회
    let currentUrl = reportUrl;
    console.log('[다운로드] 시작 - 현재 URL:', currentUrl?.substring(0, 100) + '...');
    try {
      const refreshedUrl = await refreshReportUrl();
      if (refreshedUrl) {
        currentUrl = refreshedUrl;
        if (refreshedUrl !== reportUrl) {
          console.log('[다운로드] URL 갱신됨:', refreshedUrl.substring(0, 100) + '...');
          setReportUrl(refreshedUrl);
          actions.addNotification({
            type: 'info',
            title: 'URL 갱신 완료',
            message: '최신 리포트 URL로 다운로드를 시작합니다.',
            autoClose: true,
            duration: 2000,
            priority: 'high'
          });
        } else {
          console.log('[다운로드] URL 유효함, 다운로드 진행');
        }
      } else {
        // URL 재조회 실패 - 만료된 URL일 가능성
        console.error('[다운로드] URL 재조회 실패 - 만료된 URL일 수 있음');
        actions.addNotification({
          type: 'error',
          title: '다운로드 불가',
          message: '리포트 URL을 가져올 수 없습니다. 리포트가 만료되었을 수 있습니다. 페이지를 새로고침해주세요.',
          autoClose: true,
          duration: 5000,
          priority: 'high'
        });
        return; // 다운로드 중단
      }
    } catch (urlError) {
      console.error('[다운로드] URL 갱신 중 예외 발생:', urlError);
      actions.addNotification({
        type: 'error',
        title: '다운로드 불가',
        message: '리포트 URL 확인 중 오류가 발생했습니다. 페이지를 새로고침해주세요.',
        autoClose: true,
        duration: 5000,
        priority: 'high'
      });
      return; // 다운로드 중단
    }

    if (!currentUrl) {
      actions.addNotification({
        type: 'error',
        title: '다운로드 불가',
        message: '리포트 URL을 가져올 수 없습니다. 페이지를 새로고침해주세요.',
        autoClose: true,
        duration: 5000,
        priority: 'high'
      });
      return;
    }

    const fileName = `질병예측리포트_${customerName || '사용자'}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // ============================================
    // 방법 1: 백엔드 프록시 API 사용 (권장 방법)
    // 접근 제어, CORS 해결, URL 만료 처리 등 모든 기능 포함
    // ============================================
    
    // 1-1. 파트너 케이스 (oid)
    if (oid) {
      try {
        console.log('[다운로드] ✅ 백엔드 프록시 API 사용 (파트너 케이스)');
        const proxyUrl = `/api/v1/campaigns/disease-prediction/report/download?oid=${oid}`;
        
        const response = await fetch(proxyUrl);
        
        // HTTP 에러 처리
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('리포트 접근 권한이 없습니다.');
          } else if (response.status === 404) {
            throw new Error('리포트를 찾을 수 없습니다.');
          } else if (response.status === 410) {
            throw new Error('리포트 URL이 만료되었습니다.');
          } else {
            throw new Error(`서버 오류 (${response.status}): ${response.statusText}`);
          }
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
        
        console.log('[다운로드] ✅ 성공: 백엔드 프록시 (파트너)');
        
        trackReportPage('download_click', {
          mkt_uuid: mktUuid || null,
          report_url: currentUrl,
          method: 'partner_proxy'
        });
        
        actions.addNotification({
          type: 'success',
          title: '다운로드 시작',
          message: '리포트 다운로드를 시작합니다.',
          autoClose: true,
          duration: 2000,
          priority: 'high' // 다운로드 관련 토스트 우선순위 높음
        });
        
        return; // 성공 시 종료
      } catch (proxyError: any) {
        console.error('[다운로드] ❌ 백엔드 프록시 실패:', proxyError);
        
        // 프록시 실패 시 사용자에게 명확한 메시지
        const errorMessage = proxyError.message || '다운로드에 실패했습니다.';
        actions.addNotification({
          type: 'error',
          title: '다운로드 실패',
          message: errorMessage + ' 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.',
          autoClose: true,
          duration: 5000,
          priority: 'high' // 다운로드 관련 토스트 우선순위 높음
        });
        
        // 프록시가 실패하면 다른 방법으로 fallback하지 않고 종료
        // (보안상 프록시를 통한 다운로드가 권장되므로)
        return;
      }
    }
    
    // 1-2. WELNO 케이스 (uuid + hospital_id)
    if (uuid && hospitalId) {
      try {
        console.log('[다운로드] ✅ 백엔드 프록시 API 사용 (WELNO 케이스)');
        const proxyUrl = `/api/v1/welno/mediarc-report/download?uuid=${uuid}&hospital_id=${hospitalId}`;
        
        const response = await fetch(proxyUrl);
        
        // HTTP 에러 처리
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('리포트 접근 권한이 없습니다.');
          } else if (response.status === 404) {
            throw new Error('리포트를 찾을 수 없습니다.');
          } else if (response.status === 410) {
            throw new Error('리포트 URL이 만료되었습니다.');
          } else {
            throw new Error(`서버 오류 (${response.status}): ${response.statusText}`);
          }
        }
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
        
        console.log('[다운로드] ✅ 성공: 백엔드 프록시 (WELNO)');
        
        trackReportPage('download_click', {
          mkt_uuid: mktUuid || null,
          report_url: currentUrl,
          method: 'welno_proxy'
        });
        
        actions.addNotification({
          type: 'success',
          title: '다운로드 시작',
          message: '리포트 다운로드를 시작합니다.',
          autoClose: true,
          duration: 2000,
          priority: 'high' // 다운로드 관련 토스트 우선순위 높음
        });
        
        return; // 성공 시 종료
      } catch (proxyError: any) {
        console.error('[다운로드] ❌ 백엔드 프록시 실패:', proxyError);
        
        // 프록시 실패 시 사용자에게 명확한 메시지
        const errorMessage = proxyError.message || '다운로드에 실패했습니다.';
        actions.addNotification({
          type: 'error',
          title: '다운로드 실패',
          message: errorMessage + ' 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.',
          autoClose: true,
          duration: 5000,
          priority: 'high' // 다운로드 관련 토스트 우선순위 높음
        });
        
        // 프록시가 실패하면 다른 방법으로 fallback하지 않고 종료
        // (보안상 프록시를 통한 다운로드가 권장되므로)
        return;
      }
    }
    
    // 프록시를 사용할 수 없는 경우 (oid, uuid, hospitalId 모두 없음)
    console.warn('[다운로드] ⚠️ 프록시 사용 불가: 필요한 파라미터가 없습니다.');
    actions.addNotification({
      type: 'error',
      title: '다운로드 불가',
      message: '리포트 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.',
      autoClose: true,
      duration: 5000,
      priority: 'high' // 다운로드 관련 토스트 우선순위 높음
    });
  }, [reportUrl, customerName, mktUuid, refreshReportUrl, actions]);

  // URL 복사 헬퍼 함수 (iframe 내에서도 동작)
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    // 방법 1: Clipboard API 시도 (실제로 시도해봄)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        console.warn('Clipboard API failed:', e);
        // Clipboard API 실패 시 폴백 사용
      }
    }

    // 방법 2: 폴백 - 임시 textarea 사용 (iframe 내에서도 동작)
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      textarea.setAttribute('readonly', '');
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      
      // iOS Safari에서 select()가 작동하지 않을 수 있으므로 setSelectionRange 사용
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.select();
      }
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  }, []);

  // 공유 핸들러 (Web Share API)
  const handleShare = useCallback(async () => {
    if (!reportUrl) {
      alert('리포트 PDF가 아직 준비되지 않았습니다.');
      return;
    }

    // URL 정합성 확인: 최신 URL 재조회
    let currentUrl = reportUrl;
    try {
      const refreshedUrl = await refreshReportUrl();
      if (refreshedUrl) {
        currentUrl = refreshedUrl;
        if (refreshedUrl !== reportUrl) {
          console.log('[공유] URL 갱신됨:', refreshedUrl.substring(0, 100) + '...');
          setReportUrl(refreshedUrl);
        } else {
          console.log('[공유] URL 유효함, 공유 진행');
        }
      } else {
        // URL 재조회 실패 - 만료된 URL일 가능성
        console.error('[공유] URL 재조회 실패 - 만료된 URL일 수 있음');
        actions.addNotification({
          type: 'error',
          title: '공유 불가',
          message: '리포트 URL을 가져올 수 없습니다. 리포트가 만료되었을 수 있습니다. 페이지를 새로고침해주세요.',
          autoClose: true,
          duration: 5000
        });
        return; // 공유 중단
      }
    } catch (urlError) {
      console.error('[공유] URL 갱신 중 예외 발생:', urlError);
      actions.addNotification({
        type: 'error',
        title: '공유 불가',
        message: '리포트 URL 확인 중 오류가 발생했습니다. 페이지를 새로고침해주세요.',
        autoClose: true,
        duration: 5000
      });
      return; // 공유 중단
    }

    if (navigator.share) {
      // Web Share API 사용 (모바일)
      try {
        await navigator.share({
          title: '질병예측 리포트',
          text: `${customerName || '사용자'}님의 질병예측 리포트`,
          url: currentUrl
        });
        
        // GTM 추적
        trackReportPage('share_click', {
          mkt_uuid: mktUuid || null,
          report_url: currentUrl,
          share_method: 'web_share_api'
        });
      } catch (err: any) {
        // 사용자가 공유 취소한 경우 무시
        if (err.name !== 'AbortError') {
          console.error('Web Share API failed:', err);
          
          // Web Share API 실패 토스트 표시
          actions.addNotification({
            type: 'warning',
            title: '공유 기능 실패',
            message: 'Web Share API 공유에 실패했습니다. URL 복사를 시도합니다.',
            autoClose: true,
            duration: 3000
          });
          
          // 폴백: URL 복사
          const copied = await copyToClipboard(currentUrl);
          if (copied) {
            actions.addNotification({
              type: 'success',
              title: '복사 완료',
              message: '리포트 URL이 클립보드에 복사되었습니다.',
              autoClose: true,
              duration: 3000
            });
          } else {
            // Clipboard API 복사 실패 시 토스트 메시지 표시
            actions.addNotification({
              type: 'error',
              title: '공유 기능 사용 불가',
              message: 'Web Share API와 클립보드 복사 모두 실패했습니다. 현재 환경에서는 공유기능을 사용할 수 없어요',
              autoClose: true,
              duration: 5000
            });
          }
        }
      }
    } else {
      // Web Share API가 없는 경우 (데스크톱)
      // PC에서는 PDF를 새 창에서 열기
      try {
        console.log('[공유] PC 환경 - PDF 새 창에서 열기:', currentUrl.substring(0, 100) + '...');
        const newWindow = window.open(currentUrl, '_blank', 'noopener,noreferrer');
        
        // 새 창이 열렸는지 확인 (팝업 차단 여부)
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          throw new Error('팝업이 차단되었습니다');
        }
        
        // 새 창이 로드될 때까지 잠시 대기 후 에러 확인
        setTimeout(() => {
          try {
            // 새 창이 차단되었거나 에러가 발생했는지 확인
            if (newWindow.closed) {
              console.warn('[공유] 새 창이 즉시 닫혔습니다 - URL 만료 가능성');
              actions.addNotification({
                type: 'error',
                title: '리포트 열기 실패',
                message: '리포트를 열 수 없습니다. 리포트가 만료되었을 수 있습니다. 페이지를 새로고침해주세요.',
                autoClose: true,
                duration: 5000
              });
            }
          } catch (e) {
            // cross-origin 에러는 무시 (정상적인 경우)
            console.log('[공유] 새 창 상태 확인 완료');
          }
        }, 1000);
        
        actions.addNotification({
          type: 'success',
          title: '리포트 열기',
          message: '리포트를 새 창에서 엽니다.',
          autoClose: true,
          duration: 3000
        });
        
        // GTM 추적
        trackReportPage('share_click', {
          mkt_uuid: mktUuid || null,
          report_url: currentUrl,
          share_method: 'open_new_window'
        });
      } catch (error) {
        console.error('[공유] 새 창 열기 실패:', error);
        actions.addNotification({
          type: 'error',
          title: '리포트 열기 실패',
          message: '리포트를 열 수 없습니다. 리포트가 만료되었을 수 있습니다. 페이지를 새로고침해주세요.',
          autoClose: true,
          duration: 5000
        });
      }
    }
  }, [reportUrl, customerName, mktUuid, copyToClipboard, actions, refreshReportUrl]);

  // 플로팅 버튼 클릭 이벤트 리스너 (PDF 뷰어/다운로드/공유)
  useEffect(() => {
    const handleOpenPdfViewer = async () => {
      console.log('[DiseaseReportPage] 플로팅 버튼 클릭 이벤트 수신');
      
      if (!reportUrl) {
        actions.addNotification({
          type: 'warning',
          title: '리포트 준비 중',
          message: '리포트 PDF가 아직 준비되지 않았습니다.',
          priority: 'high',
          autoClose: true,
          duration: 3000
        });
        return;
      }

      // 모바일 감지
      const mobile = isMobile();

      if (mobile) {
        // 모바일: 공유 기능 사용 (Web Share API 또는 URL 복사)
        console.log('[DiseaseReportPage] 모바일 - 공유 기능 호출');
        handleShare();
      } else {
        // 데스크톱: 다운로드 기능 사용
        console.log('[DiseaseReportPage] 데스크톱 - 다운로드 기능 호출');
        handleDownload();
      }
    };

    window.addEventListener('welno-open-pdf-viewer', handleOpenPdfViewer);

    return () => {
      window.removeEventListener('welno-open-pdf-viewer', handleOpenPdfViewer);
    };
  }, [reportUrl, isMobile, handleShare, handleDownload, actions]);

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'NORMAL':
      case '정상':
        return 'var(--success)';
      case 'BOUNDARY':
      case '경계':
      case '이상':
        return 'var(--warning)';
      case 'ABNORMAL':
      case '위험':
        return 'var(--danger)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getLabelText = (label: string) => {
    switch (label) {
      case 'NORMAL':
      case '정상':
        return '정상';
      case 'BOUNDARY':
      case '경계':
        return '경계';
      case '이상':
        return '이상';
      case 'ABNORMAL':
      case '위험':
        return '위험';
      default:
        return label;
    }
  };

  const getTypeText = (type: string) => {
    return type === 'disease' ? '질병' : '암';
  };

  // Label 정규화 함수 (한글/영어 모두 지원)
  const normalizeLabel = (label: string): 'NORMAL' | 'BOUNDARY' | 'ABNORMAL' | string => {
    const labelMap: Record<string, string> = {
      '정상': 'NORMAL',
      'NORMAL': 'NORMAL',
      '경계': 'BOUNDARY',
      'BOUNDARY': 'BOUNDARY',
      '이상': 'BOUNDARY',
      '위험': 'ABNORMAL',
      'ABNORMAL': 'ABNORMAL'
    };
    return labelMap[label] || label;
  };

  // 비정상 항목 판단 함수 (위험, 주의, 관찰)
  const isAbnormal = (label: string): boolean => {
    const normalizedLabel = normalizeLabel(label);
    // 정상이 아닌 모든 항목 (위험, 주의, 관찰 포함)
    return normalizedLabel !== 'NORMAL';
  };

  // 암 데이터 필터링 및 정렬
  const filteredCancerData = reportData?.data
    ? [...reportData.data]
        .filter((item) => {
          if (item.type !== 'cancer') return false;
          if (cancerLabelFilter !== 'ALL' && normalizeLabel(item.label) !== cancerLabelFilter) return false;
          return true;
        })
        .sort((a, b) => {
          const labelOrder: Record<string, number> = { 'ABNORMAL': 3, 'BOUNDARY': 2, 'NORMAL': 1 };
          const orderDiff = (labelOrder[normalizeLabel(b.label)] || 0) - (labelOrder[normalizeLabel(a.label)] || 0);
          if (orderDiff !== 0) return orderDiff;
          return b.rank - a.rank;
        })
    : [];

  // 질병 데이터 필터링 및 정렬
  const filteredDiseaseData = reportData?.data
    ? [...reportData.data]
        .filter((item) => {
          if (item.type !== 'disease') return false;
          if (diseaseLabelFilter !== 'ALL' && normalizeLabel(item.label) !== diseaseLabelFilter) return false;
          return true;
        })
        .sort((a, b) => {
          const labelOrder: Record<string, number> = { 'ABNORMAL': 3, 'BOUNDARY': 2, 'NORMAL': 1 };
          const orderDiff = (labelOrder[normalizeLabel(b.label)] || 0) - (labelOrder[normalizeLabel(a.label)] || 0);
          if (orderDiff !== 0) return orderDiff;
          return b.rank - a.rank;
        })
    : [];

  // 기존 sortedData는 호환성을 위해 유지 (다른 섹션에서 사용)
  const sortedData = reportData?.data
    ? [...reportData.data].sort((a, b) => {
        // ABNORMAL > BOUNDARY > NORMAL 순서
        const labelOrder: Record<string, number> = { 'ABNORMAL': 3, 'BOUNDARY': 2, 'NORMAL': 1 };
        const orderDiff = (labelOrder[normalizeLabel(b.label)] || 0) - (labelOrder[normalizeLabel(a.label)] || 0);
        if (orderDiff !== 0) return orderDiff;
        // 같은 레이블이면 rank 높은 순
        return b.rank - a.rank;
      })
    : [];

  // 카운트다운 중인 경우 메시지 표시
  if (countdown !== null) {
    return (
      <div className="aims-report-page loading">
        <div className="loading-spinner">
          <div key={countdown} className="countdown-number">{countdown}</div>
          {showKakaoMessage ? (
            <>
              <p>잠시 후 발송됩니다</p>
            </>
          ) : (
            <>
              <p>잠시 후에 레포트가 발송됩니다.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ⭐⭐⭐ 매트릭스 통합: 통합 로딩 상태 (statusLoading + 기존 loading)
  if (statusLoading || loading || !reportData) {
    // 매트릭스 상태 확인 중
    if (statusLoading) {
      return (
        <div className="aims-report-page loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>상태를 확인하는 중...</p>
          </div>
        </div>
      );
    }
    
    // 리포트 생성 중 (REPORT_PENDING)
    if (unifiedStatus?.status === 'REPORT_PENDING') {
      return (
        <div className="aims-report-page loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>질병예측 리포트를 생성하는 중입니다...</p>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
              리포트 생성에는 약 2-3분이 소요됩니다.
            </p>
          </div>
        </div>
      );
    }
    
    // 기존 로딩 로직 (리포트 데이터 불러오는 중)
    return (
      <div className="aims-report-page loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>{loading ? '리포트를 불러오는 중...' : '잠시 후 질병예측 리포트가 카카오톡을 통하여 발송됩니다.'}</p>
        </div>
      </div>
    );
  }

  // ⭐⭐⭐ 매트릭스 통합: 에러 처리 (statusError + 기존 error)
  if (statusError || error) {
    const errorMessage = statusError || error;
    
    // 리포트 만료 상태
    if (unifiedStatus?.status === 'REPORT_EXPIRED') {
      return (
        <div className="aims-report-page error">
          <div className="error-message">
            <h2>⚠️ 리포트가 만료되었습니다</h2>
            <p>리포트 URL이 만료되었습니다. 다시 분석을 요청해주세요.</p>
          </div>
        </div>
      );
    }
    
    // 데이터 부족 상태
    if (unifiedStatus?.status === 'ACTION_REQUIRED' || unifiedStatus?.status === 'ACTION_REQUIRED_PAID') {
      return (
        <div className="aims-report-page error">
          <div className="error-message">
            <h2>건강검진 데이터가 필요합니다</h2>
            <p>질병예측 리포트를 생성하기 위해서는 건강검진 데이터가 필요합니다.</p>
            <p style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
              데이터 출처: {unifiedStatus?.primary_source || '없음'}<br />
              지표 개수: {unifiedStatus?.metric_count || 0}개 (최소 5개 필요)
            </p>
          </div>
        </div>
      );
    }
    
    // 일반 에러
    return (
      <div className="aims-report-page error">
        <div className="error-message">
          <h2>리포트를 불러올 수 없습니다</h2>
          <p>{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`aims-report-page skin-${skinType.toLowerCase()}`}>
      {/* 초기 스피너 (패널이 올라오기 전과 올라온 후 모두 표시) */}
      {!showAgeCardGlow && (
        <div className={`initial-loading-spinner ${showPanel ? 'on-panel' : ''}`}>
          <div className="spinner"></div>
          <p>리포트를 불러오는 중...</p>
        </div>
      )}
      <div className={`report-panel ${showPanel ? 'show' : 'hide'} ${showPanel && !showAgeCardGlow ? 'blurred' : ''}`}>
        {/* 뿌연 오버레이 (패널이 올라온 후) */}
        {showPanel && !showAgeCardGlow && (
          <div className="panel-overlay"></div>
        )}
        {/* 헤더 */}
        <header className="report-header">
          <div className="report-header-top">
            <button
              className="report-back-button"
              onClick={() => {
                // 페이드 아웃 효과 추가
                const pageElement = document.querySelector('.aims-report-page');
                if (pageElement) {
                  pageElement.classList.add('fade-out');
                  setTimeout(() => {
                    // UUID와 hospital_id 유지하면서 메인 페이지로 이동
                    if (uuid && hospitalId) {
                      navigate(`/?uuid=${uuid}&hospital=${hospitalId}`);
                    } else {
                      navigate('/');
                    }
                  }, 400); // 0.4초 페이드 아웃
                } else {
                  // 페이드 아웃 효과 없이 바로 메인으로 이동
                  if (uuid && hospitalId) {
                    navigate(`/?uuid=${uuid}&hospital=${hospitalId}`);
                  } else {
                    navigate('/');
                  }
                }
              }}
              aria-label="뒤로가기"
            >
              ←
            </button>
            <div className="report-title-wrapper">
              <h1 className="report-title">질병예측 리포트</h1>
              {/* 색상 모드 토글 버튼 */}
              <div className="report-skin-toggle">
                <button
                  className={`skin-toggle-button ${!isBrownMode ? 'active' : ''}`}
                  onClick={() => handleSkinChange('default')}
                  type="button"
                  aria-label="기본 모드"
                >
                  기본
                </button>
                <button
                  className={`skin-toggle-button ${isBrownMode ? 'active' : ''}`}
                  onClick={() => handleSkinChange('brown')}
                  type="button"
                  aria-label="브라운 모드"
                >
                  브라운
                </button>
              </div>
            </div>
            {/* 다운로드/공유 버튼 */}
            {reportUrl && (
              <div className="report-action-buttons">
                {isMobile() ? (
                  <button
                    className="report-action-button share-button"
                    onClick={handleShare}
                    type="button"
                    aria-label="공유하기"
                    title="공유하기"
                  >
                    📤 공유
                  </button>
                ) : (
                  <button
                    className="report-action-button download-button"
                    onClick={handleDownload}
                    type="button"
                    aria-label="다운로드"
                    title="PDF 다운로드"
                  >
                    ⬇️ 다운로드
                  </button>
                )}
              </div>
            )}
            {reportUpdatedAt && (
              <div className="report-update-info">
                <span className="update-icon">ⓘ</span>
                <span className="update-text">마지막 업데이트: {reportUpdatedAt}</span>
              </div>
            )}
          </div>
          <div className="report-header-content">
            <div className="report-header-left">
              {customerName && (
                <p className="customer-name">{customerName}님의 건강 분석 결과</p>
              )}
            </div>
            <div className="report-header-badges">
              {isTestMode && (
                <span className="report-badge report-badge-test">TEST MODE</span>
              )}
              {dataSource && (
                <span className={`report-badge report-badge-source report-badge-${dataSource}`}>
                  {dataSource === 'db' ? 'DB' : '지연조회'}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 건강나이 vs 실제나이 비교 */}
        {reportData && (
          <HealthAgeSection
            healthAge={reportData.bodyage}
            actualAge={currentAge}
            variant="card"
            showGlowEffect={showAgeCardGlow}
            onAgeClick={handleAgeBoxClick}
          />
        )}

        {/* 동일 연령 대비 건강 등수 */}
        <section className="rank-section">
          <h2 className="section-title">
            <span className="title-icon">🏆</span>
            동일 연령 대비(100명) 건강 등수
            <button
              className="info-icon-button"
              onClick={() => setShowRankTooltip(!showRankTooltip)}
              aria-label="등수 설명 보기"
            >
              <span className="info-icon">?</span>
            </button>
          </h2>
          {showRankTooltip && (
            <div className="rank-tooltip">
              <div className="tooltip-content">
                <p className="tooltip-text">
                  <strong>등수 계산 로직:</strong>
                  <br />
                  • 내 건강나이 등수를 기준으로 비교합니다.
                  <br />
                  • 내 등수보다 낮은 항목은 좋은 것으로 분류됩니다.
                  <br />
                  • 내 등수보다 높은 항목은 나쁜 것으로 분류됩니다.
                  <br />
                  • 등수가 낮을수록 건강하다는 의미이며, 1등을 목표로 노력해보아요.
                </p>
                <button
                  className="tooltip-close"
                  onClick={() => setShowRankTooltip(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <p className="rank-explanation">
            등수가 낮을수록 건강하다는 의미입니다.
            <br />
            1등을 목표로 노력해보아요
          </p>
          <div className="rank-list">
            <div className="rank-item main-rank">
              <div className="rank-icon">
                {(() => {
                  const rank = reportData.rank;
                  if (rank <= 10) return '😊';      // 10등 안쪽: 웃음
                  if (rank <= 50) return '😊';      // 50등까지: 웃음
                  if (rank <= 60) return '😢';      // 60등: 울음
                  return '😢';                       // 61등 이상: 울음
                })()}
              </div>
              <div className="rank-info">
                <span className="rank-label">내 건강나이 등수</span>
                <span className="rank-value">{reportData.rank}등</span>
              </div>
            </div>
            {/* 건강나이 등수와 긍정적인 것 사이 구분선 */}
            <div className="rank-divider"></div>
            {/* 좋은 것 2개: 50등 이하가 있으면 보여주기 */}
            {(() => {
              const goodItems = sortedData
                .filter(item => item.rank < reportData.rank && item.rank <= 50) // 내 등수보다 낮고 50등 이하
                .sort((a, b) => a.rank - b.rank) // 등수가 낮은 순으로 정렬
                .slice(0, 2); // 상위 2개만

              if (goodItems.length > 0) {
                return goodItems.map((item, idx) => (
                  <div key={item.code} className="rank-item rank-item-good">
                    <div className="rank-icon">{idx === 0 ? '🥇' : '🥈'}</div>
                    <div className="rank-info">
                      <span className="rank-label">{item.name}</span>
                      <span className="rank-value">{item.rank}등</span>
                    </div>
                  </div>
                ));
              } else {
                // 50등보다 좋은 점수가 없을 때
                const hasBadItems = sortedData.some(item => item.rank > 50);
                if (hasBadItems) {
                  return (
                    <div className="rank-item rank-item-empty">
                      <div className="rank-icon">😢</div>
                      <div className="rank-info">
                        <span className="rank-label">50등보다 좋은 점수가 없어요</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }
            })()}
            {/* 긍정/부정 구분선 */}
            <div className="rank-divider"></div>
            {/* 나쁜 것 2개: 내 건강나이 등수(56등)보다 높은 것 중 등수가 가장 낮은 2개 */}
            {sortedData
              .filter(item => item.rank > reportData.rank) // 내 등수보다 높은 것만
              .sort((a, b) => a.rank - b.rank) // 등수가 낮은 순으로 정렬 (나쁜 것 중에서도 덜 나쁜 것부터)
              .slice(0, 2) // 상위 2개만
              .map((item, idx) => (
                <div key={item.code} className="rank-item rank-item-bad">
                  <div className="rank-icon">⚠️</div>
                  <div className="rank-info">
                    <span className="rank-label">{item.name}</span>
                    <span className="rank-value">{item.rank}등</span>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* 주요질환 발병확률 */}
        <section className="probability-section">
          <h2 className="section-title">주요질환 발병확률</h2>
          <div className="probability-summary">
            {sortedData.length > 0 && (
              <p className="probability-message">
                고객님은 최근 건강검진에서
                <br />
                <span className="disease-tags">
                  {sortedData.slice(0, 3).map((item, idx) => (
                    <React.Fragment key={item.code}>
                      <span className="disease-tag">#{item.name}</span>
                      {idx < Math.min(2, sortedData.length - 1) && ' '}
                    </React.Fragment>
                  ))}
                  {sortedData.length > 3 && (
                    <span className="disease-count"> 외 {sortedData.length - 3}건</span>
                  )}
                </span>
                <br />
                발병확률이 다른 확률보다 높게 나왔어요.
              </p>
            )}
          </div>
          <div className="probability-charts">
            {/* 2x2 그리드 레이아웃 */}
            <div className="probability-charts-grid">
              {sortedData.slice(0, 4).map((item) => {
                const percentage = Math.min(item.rate, 100);
                return (
                  <div key={item.code} className="probability-chart">
                    <div className="chart-circle">
                      <svg className="chart-svg" viewBox="0 0 100 100">
                        <circle
                          className="chart-background"
                          cx="50"
                          cy="50"
                          r="45"
                        />
                        <circle
                          className="chart-progress"
                          cx="50"
                          cy="50"
                          r="45"
                          strokeDasharray={`${2 * Math.PI * 45}`}
                          strokeDashoffset={`${2 * Math.PI * 45 * (1 - percentage / 100)}`}
                          style={{
                            stroke: getLabelColor(item.label),
                          }}
                        />
                      </svg>
                      <div className="chart-text">
                        <span className="chart-percentage">{percentage}%</span>
                        <span className="chart-label">{getLabelText(item.label)}</span>
                      </div>
                    </div>
                    <p className="chart-disease-name">{item.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 질병/암 리스트 */}
        <section className="diseases-section">
          {/* 암 섹션 */}
          <div className="disease-type-section">
            <div className="disease-type-header">
              <h3 className="disease-type-title">암</h3>
              <div className="disease-label-filters">
                <button
                  className={`label-filter ${cancerLabelFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setCancerLabelFilter('ALL');
                    setCancerSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'cancer',
                      filter_value: 'ALL'
                    });
                  }}
                >
                  전체
                </button>
                <button
                  className={`label-filter ${cancerLabelFilter === 'NORMAL' ? 'active' : ''}`}
                  onClick={() => {
                    setCancerLabelFilter('NORMAL');
                    setCancerSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'cancer',
                      filter_value: 'NORMAL'
                    });
                  }}
                >
                  정상
                </button>
                <button
                  className={`label-filter ${cancerLabelFilter === 'BOUNDARY' ? 'active' : ''}`}
                  onClick={() => {
                    setCancerLabelFilter('BOUNDARY');
                    setCancerSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'cancer',
                      filter_value: 'BOUNDARY'
                    });
                  }}
                >
                  경계
                </button>
                <button
                  className={`label-filter ${cancerLabelFilter === 'ABNORMAL' ? 'active' : ''}`}
                  onClick={() => {
                    setCancerLabelFilter('ABNORMAL');
                    setCancerSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'cancer',
                      filter_value: 'ABNORMAL'
                    });
                  }}
                >
                  주의
                </button>
              </div>
            </div>
            
            {filteredCancerData.length === 0 ? (
              <div className="diseases-empty">
                <p>선택한 조건에 해당하는 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="diseases-slider-container" ref={cancerSliderContainerRef}>
                <div 
                  className="diseases-slider"
                  style={{
                    transform: getSliderTransform(cancerSliderIndex, cancerSliderContainerRef)
                  }}
                  onTouchStart={handleCancerTouchStart}
                  onTouchMove={handleCancerTouchMove}
                  onTouchEnd={handleCancerTouchEnd}
                  onMouseDown={handleCancerMouseDown}
                  onMouseMove={handleCancerMouseMove}
                  onMouseUp={handleCancerMouseUp}
                  onMouseLeave={handleCancerMouseUp}
                >
                  {filteredCancerData.map((item: AIMSDataItem, index: number) => (
                    <div 
                      key={`cancer-${item.code}-${index}`} 
                      className={`disease-card-slide ${
                        isAbnormal(item.label) && showAbnormalCardsGlow ? 'glow-effect' : ''
                      }`}
                    >
                      <div className="disease-card">
                        {/* 뱃지 - 우상단 고정 */}
                        <div 
                          className="disease-label"
                          style={{ backgroundColor: getLabelColor(item.label) }}
                        >
                          {getLabelText(item.label)}
                        </div>
                        
                        <div className="disease-header">
                          <div className="disease-info">
                            <h3 className="disease-name">{item.name}</h3>
                            <div className="disease-meta">
                              <span className="disease-type">{getTypeText(item.type)}</span>
                              <span className="disease-rank">위험도 순위: {item.rank}위</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="disease-stats">
                          <div className="stat-item">
                            <span className="stat-label">평균 발병률</span>
                            <span className="stat-value">{item.average}%</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">예상 발병률</span>
                            <span className="stat-value">{item.rate}%</span>
                          </div>
                        </div>

                        {item.influence && item.influence.length > 0 && (
                          <div className="disease-influence">
                            <h4 className="influence-title">영향 요인</h4>
                            <div className="influence-list">
                              {item.influence.map((inf) => (
                                <div key={`${item.code}-influence-${inf.code}`} className="influence-item">
                                  <span className="influence-name">{inf.name}</span>
                                  {inf.label && (
                                    <span className="influence-label">{inf.label}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 슬라이드 도트 인디케이터 */}
                {filteredCancerData.length > 1 && (
                  <div className="diseases-slider-dots">
                    {filteredCancerData.map((_, idx) => (
                      <button
                        key={idx}
                        className={`slider-dot ${cancerSliderIndex === idx ? 'active' : ''}`}
                        onClick={() => setCancerSliderIndex(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="disease-section-divider"></div>

          {/* 질병 섹션 */}
          <div className="disease-type-section">
            <div className="disease-type-header">
              <h3 className="disease-type-title">질병</h3>
              <div className="disease-label-filters">
                <button
                  className={`label-filter ${diseaseLabelFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setDiseaseLabelFilter('ALL');
                    setDiseaseSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'disease',
                      filter_value: 'ALL'
                    });
                  }}
                >
                  전체
                </button>
                <button
                  className={`label-filter ${diseaseLabelFilter === 'NORMAL' ? 'active' : ''}`}
                  onClick={() => {
                    setDiseaseLabelFilter('NORMAL');
                    setDiseaseSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'disease',
                      filter_value: 'NORMAL'
                    });
                  }}
                >
                  정상
                </button>
                <button
                  className={`label-filter ${diseaseLabelFilter === 'BOUNDARY' ? 'active' : ''}`}
                  onClick={() => {
                    setDiseaseLabelFilter('BOUNDARY');
                    setDiseaseSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'disease',
                      filter_value: 'BOUNDARY'
                    });
                  }}
                >
                  경계
                </button>
                <button
                  className={`label-filter ${diseaseLabelFilter === 'ABNORMAL' ? 'active' : ''}`}
                  onClick={() => {
                    setDiseaseLabelFilter('ABNORMAL');
                    setDiseaseSliderIndex(0);
                    trackReportPage('filter_change', {
                      mkt_uuid: mktUuid || null,
                      filter_type: 'disease',
                      filter_value: 'ABNORMAL'
                    });
                  }}
                >
                  주의
                </button>
              </div>
            </div>
            
            {filteredDiseaseData.length === 0 ? (
              <div className="diseases-empty">
                <p>선택한 조건에 해당하는 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="diseases-slider-container" ref={diseaseSliderContainerRef}>
                <div 
                  className="diseases-slider"
                  style={{
                    transform: getSliderTransform(diseaseSliderIndex, diseaseSliderContainerRef)
                  }}
                  onTouchStart={handleDiseaseTouchStart}
                  onTouchMove={handleDiseaseTouchMove}
                  onTouchEnd={handleDiseaseTouchEnd}
                  onMouseDown={handleDiseaseMouseDown}
                  onMouseMove={handleDiseaseMouseMove}
                  onMouseUp={handleDiseaseMouseUp}
                  onMouseLeave={handleDiseaseMouseUp}
                >
                  {filteredDiseaseData.map((item: AIMSDataItem, index: number) => (
                    <div 
                      key={`disease-${item.code}-${index}`} 
                      className={`disease-card-slide ${
                        isAbnormal(item.label) && showAbnormalCardsGlow ? 'glow-effect' : ''
                      }`}
                    >
                      <div className="disease-card">
                        {/* 뱃지 - 우상단 고정 */}
                        <div 
                          className="disease-label"
                          style={{ backgroundColor: getLabelColor(item.label) }}
                        >
                          {getLabelText(item.label)}
                        </div>
                        
                        <div className="disease-header">
                          <div className="disease-info">
                            <h3 className="disease-name">{item.name}</h3>
                            <div className="disease-meta">
                              <span className="disease-type">{getTypeText(item.type)}</span>
                              <span className="disease-rank">위험도 순위: {item.rank}위</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="disease-stats">
                          <div className="stat-item">
                            <span className="stat-label">평균 발병률</span>
                            <span className="stat-value">{item.average}%</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">예상 발병률</span>
                            <span className="stat-value">{item.rate}%</span>
                          </div>
                        </div>

                        {item.influence && item.influence.length > 0 && (
                          <div className="disease-influence">
                            <h4 className="influence-title">영향 요인</h4>
                            <div className="influence-list">
                              {item.influence.map((inf) => (
                                <div key={`${item.code}-influence-${inf.code}`} className="influence-item">
                                  <span className="influence-name">{inf.name}</span>
                                  {inf.label && (
                                    <span className="influence-label">{inf.label}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 슬라이드 도트 인디케이터 */}
                {filteredDiseaseData.length > 1 && (
                  <div className="diseases-slider-dots">
                    {filteredDiseaseData.map((_, idx) => (
                      <button
                        key={idx}
                        className={`slider-dot ${diseaseSliderIndex === idx ? 'active' : ''}`}
                        onClick={() => setDiseaseSliderIndex(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      
      {/* 디버그 삭제 모달 */}
      <DebugDeleteModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        onDelete={handleDebugDelete}
        mktUuid={mktUuid}
      />
      
      {/* 이메일 입력 모달 */}
      <EmailInputModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSubmit={handleEmailSubmit}
        loading={emailLoading}
      />
    </div>
  );
};

export default DiseaseReportPage;

