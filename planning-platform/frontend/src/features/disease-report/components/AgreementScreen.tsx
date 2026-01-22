import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import welnoLogo from '../assets/images/welno_logo 2.png';
import { CustomCalendar } from './CustomCalendar';
import { BirthDate } from '../types';
import { checkQuestionnaireStatus, getMktUuidFromUrl } from '../utils/legacyCompat';
import { trackAgreementPanel } from '../utils/gtm';
import '../styles/agreement-screen.scss';

interface AgreementScreenProps {
  isOpen: boolean;
  isPeek?: boolean; // 스크롤 시 살짝만 보이는 상태
  onAgree: (agreementData: AgreementItem[], birthDate: BirthDate | null, isBirthDateConfirmed: boolean) => void;
  onClose?: () => void;
  onPeekTouch?: () => void; // peek 상태에서 터치 시 호출
  initialName?: string | null;
  initialBirthDate?: BirthDate | null;
}

interface AgreementItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
  agreedAt?: string; // 동의 시간 (YYYY-MM-DD HH:mm:ss)
}

interface TermsContent {
  id: string;
  title: string;
  content: string;
}

export const AgreementScreen: React.FC<AgreementScreenProps> = ({
  isOpen,
  isPeek = false,
  onAgree,
  onClose,
  onPeekTouch,
  initialName,
  initialBirthDate,
}) => {
  const [agreements, setAgreements] = useState<AgreementItem[]>([
    { id: 'service-info', label: '질병예측리포트 정보수신 동의', required: true, checked: false },
    { id: 'third-party', label: '질병예측리포트 마케팅 활용 및 개인정보 제3자 제공(유상) 동의', required: false, checked: false },
  ]);

  const [isAllChecked, setIsAllChecked] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState<TermsContent | null>(null);
  const [birthDate, setBirthDate] = useState<BirthDate | null>(null);
  const [hasCheckedBirthDate, setHasCheckedBirthDate] = useState(false);
  const [isBirthDateConfirmed, setIsBirthDateConfirmed] = useState(false);
  const [showBirthDateDropdown, setShowBirthDateDropdown] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [showNameUnmasked, setShowNameUnmasked] = useState(false);
  const [showBirthDateUnmasked, setShowBirthDateUnmasked] = useState(false);
  const [isLoadingCustomerInfo, setIsLoadingCustomerInfo] = useState(false); // 고객 정보 로딩 상태
  const [isDataReady, setIsDataReady] = useState(false); // 데이터 로드 완료 여부
  const [initialPanelHeight, setInitialPanelHeight] = useState<number | null>(null); // 초기 패널 높이
  const [panelLifted, setPanelLifted] = useState(false); // 패널이 위로 올라간 상태
  
  // 드래그 다운 제스처 상태
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  const [panelTransform, setPanelTransform] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // 최소 드래그 거리 (100px)
  const minDragDistance = 100;

  // 약관 내용 정의
  const termsContents: TermsContent[] = [
    {
      id: 'service-info',
      title: '질병예측리포트 정보수신 동의',
      content: `
질병예측리포트 정보수신 동의

주식회사 피어나인(이하 "회사")는 고객님께 질병예측리포트를 제공하기 위해 아래와 같이 개인정보를 활용하고 질병예측리포트를 전송하고자 합니다.

1. 수집 및 이용 목적
A. 질병예측리포트 제공

2. 수집항목
A. 질병예측리포트를 위한 문진 결과
B. 메디링스 서비스를 통해 수집된 건강검진 결과 정보

3. 보유 기간
A. 동의 철회 또는 서비스 종료 시까지

4. 동의 거부 권리
A. 귀하는 개인정보 수집, 이용에 대한 동의를 거부할 권리가 있습니다.

질병예측리포트 제공을 위한 정보수신에 동의합니다.
      `,
    },
    {
      id: 'third-party',
      title: '질병예측리포트 마케팅 활용 및 개인정보 제3자 제공(유상) 동의',
      content: `
질병예측리포트 마케팅 활용 및 개인정보 제3자 제공(유상) 동의

주식회사 에임스(이하 "회사")는 아래와 같이 귀하의 개인정보를 제3자에게 제공하고자 합니다.

본 동의는 선택 사항이나, 동의하지 않을 경우 제휴사가 제공하는 건강관련 콘텐츠, 이벤트, 프로모션, 건강리포트 해설, 보험 상담 서비스 이용이 제한될 수 있습니다.

내용.

1. 제공받는 자
A. 디비손해보험 주식회사

2. 제공 항목
A. 이름, 성별, 생년월일, 전화번호

3. 제공 목적
A. 건강 관리 솔루션 서비스 제공
B. 보장보험설계 상담

4. 보유 및 이용 기간
A. 동의 철회 또는 서비스 종료 시까지

5. 동의 거부 권리
A. 고객님은 동의를 거부하실 권리가 있습니다. 동의 거부 시에도 건강관련 콘텐츠, 이벤트 프로모션, 건강리포트 해설, 보험 상담 서비스 이용이 제한될 수 있습니다.
      `,
    },
  ];

  // 전체선택 처리
  const handleSelectAll = () => {
    const newChecked = !isAllChecked;
    setIsAllChecked(newChecked);
    const updatedAgreements = agreements.map(item => ({ ...item, checked: newChecked }));
    setAgreements(updatedAgreements);
    
    // GTM 추적
    trackAgreementPanel(newChecked ? 'all_check' : 'all_uncheck', {
      total_agreements: agreements.length,
      required_count: agreements.filter(a => a.required).length
    });
    
    // 전체선택 시 스크롤이 활성화된 경우 아래로 부드럽게 스크롤
    if (newChecked) {
      setTimeout(() => {
        const agreementTermsSection = document.querySelector('.agreement-terms-section') as HTMLElement;
        const agreementFooter = document.getElementById('agreement-footer') as HTMLElement;
        
        if (agreementTermsSection && agreementFooter) {
          // 약관 섹션에 스크롤이 있는지 확인
          const sectionHasScroll = agreementTermsSection.scrollHeight > agreementTermsSection.clientHeight;
          
          if (sectionHasScroll) {
            // 약관 섹션을 맨 아래로 부드럽게 스크롤
            const targetScrollTop = agreementTermsSection.scrollHeight - agreementTermsSection.clientHeight;
            const startScrollTop = agreementTermsSection.scrollTop;
            const distance = targetScrollTop - startScrollTop;
            const duration = 800; // 부드러운 스크롤을 위해 시간 증가
            const startTime = performance.now();
            
            const smoothScroll = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // easeOutCubic 이징 함수 (부드럽게 감속)
              const easeOutCubic = 1 - Math.pow(1 - progress, 3);
              
              agreementTermsSection.scrollTop = startScrollTop + (distance * easeOutCubic);
              
              if (progress < 1) {
                requestAnimationFrame(smoothScroll);
              }
            };
            
            requestAnimationFrame(smoothScroll);
          }
        }
      }, 100);
    }
  };

  // 개별 체크박스 처리
  const handleCheckboxChange = (id: string) => {
    setAgreements(prevAgreements => {
      const item = prevAgreements.find(a => a.id === id);
      const newChecked = !item?.checked;
      
      const newAgreements = prevAgreements.map(agreement =>
        agreement.id === id ? { ...agreement, checked: newChecked } : agreement
      );
      
      // 전체선택 상태 업데이트
      const allChecked = newAgreements.every(agreement => agreement.checked);
      setIsAllChecked(allChecked);
      
      // GTM 추적
      trackAgreementPanel(newChecked ? 'agreement_check' : 'agreement_uncheck', {
        agreement_id: id,
        agreement_label: item?.label,
        is_required: item?.required,
        all_checked: allChecked
      });
      
      return newAgreements;
    });
  };

  // 필수 항목 체크 여부 확인
  const isRequiredChecked = agreements
    .filter(item => item.required)
    .every(item => item.checked);

  // 생일 입력 완료 여부 확인
  const isBirthDateComplete = Boolean(
    birthDate?.year && 
    birthDate?.month && 
    birthDate?.day
  );

  // 생성하기 버튼 활성화 조건 (필수 동의 + 생일 입력 완료 + 생년월일 확인 체크)
  const canProceed = isRequiredChecked && isBirthDateComplete && isBirthDateConfirmed;

  // 생성하기 버튼 클릭
  const handleCreate = () => {
    if (canProceed) {
      // 동의하기 버튼 클릭 추적
      trackAgreementPanel('create_click', {
        mkt_uuid: getMktUuidFromUrl() || null,
        checked_agreements: agreements.filter(a => a.checked).map(a => a.id),
        has_birthdate: !!birthDate,
        birthdate_confirmed: isBirthDateConfirmed
      });
      
      // 동의 시간 추가 (다음 패널로 들어가는 시점의 시간)
      const agreedAt = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:mm:ss
      const agreementsWithTime = agreements.map(agreement => ({
        ...agreement,
        agreedAt: agreedAt
      }));
      
      onAgree(agreementsWithTime, birthDate, isBirthDateConfirmed);
    }
  };

  // 생년월일이 없으면 드롭다운 자동 표시
  useEffect(() => {
    if (!isBirthDateComplete) {
      setShowBirthDateDropdown(true);
    } else {
      setShowBirthDateDropdown(false);
    }
  }, [isBirthDateComplete]);

  // 이름 마스킹 함수 (중간 글자 * 처리)
  const maskName = (name: string | null): string => {
    if (!name || name.length === 0) return '';
    if (name.length === 1) return name;
    if (name.length === 2) return `${name[0]}*`;
    // 3글자 이상: 첫 글자 + 중간 * + 마지막 글자
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
  };

  // 생년월일 마스킹 함수 (년도 중간 두 글자 * 처리)
  const maskBirthDate = (birthDate: BirthDate | null): string => {
    if (!birthDate?.year || !birthDate?.month || !birthDate?.day) {
      return '생년월일을 선택해주세요';
    }
    
    const year = birthDate.year;
    let maskedYear = year;
    
    // 년도가 4자리인 경우 중간 두 글자 마스킹 (예: 1984 → 19**84)
    if (year.length === 4) {
      maskedYear = `${year.substring(0, 2)}**${year.substring(2)}`;
    } else if (year.length > 4) {
      // 4자리 이상인 경우 앞 2자리 + 중간 ** + 뒤 2자리
      maskedYear = `${year.substring(0, 2)}**${year.substring(year.length - 2)}`;
    }
    
    return `${maskedYear}년 ${birthDate.month}월 ${birthDate.day}일`;
  };

  // 약관 항목 높이 측정하여 패널 초기 높이 설정 (첫 번째 약관 전체 + 두 번째 약관 반 정도)
  useEffect(() => {
    if (isOpen && isDataReady) {
      // 약관 항목이 렌더링된 후 높이 측정
      const measureHeight = () => {
        const agreementList = document.getElementById('agreement-list');
        if (agreementList) {
          const agreementItems = agreementList.querySelectorAll('.agreement-item');
          if (agreementItems.length >= 2) {
            // 첫 번째 약관 전체 높이
            const firstItemHeight = agreementItems[0].getBoundingClientRect().height;
            // 두 번째 약관 높이
            const secondItemHeight = agreementItems[1].getBoundingClientRect().height;
            // 첫 번째 약관 전체 + 두 번째 약관 반 정도
            const targetAgreementHeight = firstItemHeight + (secondItemHeight / 2);
            
            // 헤더, 고객 정보 섹션, 약관 섹션 상단 여백을 고려 (플로팅 버튼은 패널 밖이므로 제외)
            const header = document.querySelector('.agreement-header');
            const birthdateSection = document.querySelector('.agreement-birthdate-top-section');
            const termsSection = document.querySelector('.agreement-terms-section');
            
            let totalHeight = 0;
            
            // 헤더 높이
            if (header) {
              totalHeight += header.getBoundingClientRect().height;
              totalHeight += 24; // margin-bottom
            }
            
            // 고객 정보 섹션 높이
            if (birthdateSection) {
              totalHeight += birthdateSection.getBoundingClientRect().height;
            }
            
            // 약관 섹션 상단 여백 + 약관 항목 높이
            if (termsSection) {
              const termsSectionTop = termsSection.getBoundingClientRect().top;
              const agreementListTop = agreementList.getBoundingClientRect().top;
              const sectionTopMargin = agreementListTop - termsSectionTop;
              totalHeight += sectionTopMargin;
              totalHeight += targetAgreementHeight;
            }
            
            // 패딩 고려 (상하 20px + 24px)
            totalHeight += 44;
            
            // 플로팅 버튼 높이를 고려하여 패널이 버튼 위에 위치하도록 조정
            const footer = document.querySelector('.agreement-footer');
            if (footer) {
              const footerHeight = footer.getBoundingClientRect().height;
              // 패널이 플로팅 버튼 위에 위치하도록 여백 추가
              totalHeight += 8; // 약간의 여백
            }
            
            // 최소 높이와 최대 높이 제한
            const minHeight = window.innerHeight * 0.4;
            const maxHeight = window.innerHeight * 0.85; // 더 위로 올라갈 수 있도록 최대 높이 증가
            const finalHeight = Math.max(minHeight, Math.min(maxHeight, totalHeight));
            
            setInitialPanelHeight(finalHeight);
          }
        }
      };
      
      // 약관 항목이 렌더링될 때까지 대기
      setTimeout(measureHeight, 150);
    }
  }, [isOpen, isDataReady, agreements]);

  // 패널이 열릴 때 배경 스크롤 막기 및 GTM 추적 (데이터 로드 완료 후)
  useEffect(() => {
    if (isOpen && isDataReady) {
      // 패널 열기 추적
      trackAgreementPanel('panel_open', {
        mkt_uuid: getMktUuidFromUrl() || null,
        has_initial_name: !!initialName,
        has_initial_birthdate: !!initialBirthDate
      });
      
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      console.log('📜 패널 열릴 때 스크롤 위치 저장:', scrollY);
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // 스크롤 위치를 data 속성에 저장 (복원 시 사용)
      document.body.setAttribute('data-saved-scroll-y', scrollY.toString());
      
      return () => {
        // 패널 닫기 추적
        trackAgreementPanel('panel_close', {
          mkt_uuid: getMktUuidFromUrl() || null
        });
        
        // 패널이 닫힐 때 스크롤 복원
        const savedScrollY = parseInt(document.body.getAttribute('data-saved-scroll-y') || '0');
        console.log('📜 패널 닫힐 때 스크롤 위치 복원:', savedScrollY);
        
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.removeAttribute('data-saved-scroll-y');
        
        // 스크롤 복원 (여러 프레임 대기하여 스타일 변경 완료 보장)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (savedScrollY > 0) {
              window.scrollTo(0, savedScrollY);
              console.log('📜 스크롤 복원 완료:', savedScrollY);
            }
            // 스크롤 복원 후 peek 상태 확인을 위해 이벤트 트리거
            setTimeout(() => {
              window.dispatchEvent(new Event('scroll'));
            }, 50);
          });
        });
      };
    }
  }, [isOpen, isDataReady, initialName, initialBirthDate]);

  // URL 파라미터에서 전달된 초기값 설정 (데이터 로드 전에 먼저 설정)
  useEffect(() => {
    if (isOpen && initialName && !customerName) {
      setCustomerName(initialName);
      console.log('✅ 초기 이름 설정:', initialName);
    }
    
    if (isOpen && initialBirthDate && !birthDate?.year) {
      setBirthDate(initialBirthDate);
      console.log('✅ 초기 생년월일 설정:', initialBirthDate);
    }
  }, [isOpen, initialName, initialBirthDate, customerName, birthDate]);

  // 패널이 열리기 전에 고객 정보 설정 (props로 받은 정보 사용, API 호출 없음)
  useEffect(() => {
    if (!isOpen) {
      setIsDataReady(false);
      return;
    }

    // 초기값이 있으면 즉시 설정하고 표시
    if (initialName && !customerName) {
      setCustomerName(initialName);
      console.log('✅ 초기 이름 설정:', initialName);
    }
    
    if (initialBirthDate && !birthDate?.year) {
      setBirthDate(initialBirthDate);
      console.log('✅ 초기 생년월일 설정:', initialBirthDate);
    }

    // 데이터가 준비되면 즉시 표시 (API 호출 없이 props로 받은 정보 사용)
    if ((initialName || customerName) && (initialBirthDate || birthDate?.year)) {
      setIsDataReady(true);
      setHasCheckedBirthDate(true);
      return;
    }

    // 초기값이 없으면 약간의 지연 후 표시 (사용자가 직접 입력해야 함)
    setIsLoadingCustomerInfo(false);
    setIsDataReady(true);
    setHasCheckedBirthDate(true);
  }, [isOpen, initialName, initialBirthDate]);

  // 약관 보기 (모달로 표시)
  const handleViewTerms = (id: string) => {
    const terms = termsContents.find(t => t.id === id);
    if (terms) {
      setSelectedTerms(terms);
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setSelectedTerms(null);
  };

  // 패널 닫기 핸들러
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // 백그라운드 클릭/터치 핸들러 - 오버레이 클릭 시 패널 닫기
  const handleOverlayClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); // 이벤트 전파 차단 (container의 onClick 방지)
    handleClose();
  };

  // 패널 터치 시 위로 올라가기
  const handlePanelTouch = () => {
    // peek 상태에서 터치하면 open 상태로 변경
    if (isPeek && onPeekTouch) {
      onPeekTouch();
      return;
    }
    
    if (!panelLifted) {
      setPanelLifted(true);
    }
  };

  // 터치 시작 (패널 헤더나 상단 영역에서만)
  const onPanelTouchStart = (e: React.TouchEvent) => {
    // peek 상태에서도 드래그 가능 (위로 드래그하면 패널 열기)
    setTouchEndY(null);
    setTouchStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  // 터치 이동
  const onPanelTouchMove = (e: React.TouchEvent) => {
    if (touchStartY !== null && isDragging) {
      const currentY = e.touches[0].clientY;
      setTouchEndY(currentY);
      const diff = currentY - touchStartY;
      
      if (isPeek) {
        // peek 상태에서 위로 드래그하면 (음수) 패널이 따라 올라오도록
        if (diff < 0) {
          // 위로 드래그하는 만큼 패널이 올라오도록 transform 적용 (음수이므로 절대값 사용)
          const dragUpAmount = Math.abs(diff);
          setPanelTransform(-dragUpAmount); // 음수로 설정하여 위로 올라가도록
        } else {
          // 아래로 드래그하면 원래 peek 위치로
          setPanelTransform(0);
        }
      } else {
        // 일반 상태에서 아래로 드래그하면 (양수) 패널 닫기
        if (diff > 0) {
          setPanelTransform(Math.min(diff, 300)); // 최대 300px까지
        }
      }
    }
  };

  // 터치 종료
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    // 패널 내부 터치인 경우 이벤트 전파 차단
    e.stopPropagation();
    
    if (isPeek) {
      // peek 상태에서 드래그 종료 처리
      if (isDragging && touchStartY !== null && touchEndY !== null) {
        const distance = touchStartY - touchEndY; // 위로 드래그한 거리 (양수)
        
        // 위로 충분히 드래그한 경우 (100px 이상) 패널 열기
        if (distance > 100) {
          if (onPeekTouch) {
            onPeekTouch();
          }
        } else {
          // 드래그 거리가 부족하면 원래 peek 위치로 복귀
          setPanelTransform(0);
        }
      } else {
        // 드래그 없이 터치만 한 경우 원래 peek 위치로
        setPanelTransform(0);
      }
    } else {
      // 일반 상태에서만 드래그로 닫기 처리
      if (isDragging && touchStartY !== null && touchEndY !== null) {
        const distance = touchEndY - touchStartY;
        
        // 아래로 충분히 드래그한 경우 패널 닫기
        if (distance > minDragDistance) {
          handleClose();
          return;
        }
      }
      
      // 드래그 거리가 부족하면 원래 위치로 복귀
      setPanelTransform(0);
    }
    
    setTouchStartY(null);
    setTouchEndY(null);
    setIsDragging(false);
  };

  // 패널이 닫힐 때 transform 및 lifted 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setPanelTransform(0);
      setIsDragging(false);
      setPanelLifted(false);
    }
  }, [isOpen]);

  return (
    <>
      {/* 백그라운드 오버레이 - 클릭/터치 시 패널 닫기 (패널 외부에 배치) */}
      {isOpen && isDataReady && (
        <div 
          className="agreement-overlay"
          onClick={(e) => handleOverlayClick(e)}
          onTouchStart={(e) => handleOverlayClick(e)}
        />
      )}
      
      {/* 플로팅 버튼 - 패널과 완전히 독립, 항상 화면 하단 고정 */}
      {isOpen && (
        <div 
          className="agreement-footer" 
          id="agreement-footer"
        >
          <button
            type="button"
            className="create-button"
            onClick={handleCreate}
            disabled={!canProceed}
          >
            동의하기
          </button>
        </div>
      )}
      
    <div 
      className={`agreement-screen ${isOpen && isDataReady ? 'open' : ''} ${isPeek ? 'peek' : ''} ${panelLifted ? 'lifted' : ''}`}
      style={{
        // peek 상태에서는 위로 드래그할 때 transform 적용 (음수), 일반 상태에서는 아래로 드래그할 때 (양수)
        // CSS의 !important를 덮어쓰기 위해 인라인 스타일 사용
        transform: isPeek 
          ? (panelTransform < 0 
              ? `translateY(calc(100% - 50px + ${panelTransform}px))` 
              : undefined)
          : (panelTransform > 0 ? `translateY(${panelTransform}px)` : undefined),
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation();
        // peek 상태에서 클릭 시 패널 열기
        if (isPeek && onPeekTouch) {
          onPeekTouch();
        }
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        onPanelTouchStart(e);
      }}
    >
      <div 
        className="agreement-content"
        style={{
          maxHeight: initialPanelHeight ? `${initialPanelHeight}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          e.stopPropagation();
          onPanelTouchStart(e);
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          onPanelTouchMove(e);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onPanelTouchEnd(e);
        }}
      >
        <div 
          className="agreement-header"
          onClick={(e) => {
            e.stopPropagation();
            // peek 상태에서 헤더 클릭 시 패널 열기
            if (isPeek && onPeekTouch) {
              onPeekTouch();
            }
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            // peek 상태에서 헤더 터치 시 패널 열기 (드래그 없이도)
            if (isPeek && onPeekTouch) {
              onPeekTouch();
            } else {
              // 일반 상태에서는 드래그 시작
              onPanelTouchStart(e);
            }
          }}
        >
          <img 
            src={welnoLogo} 
            alt="웰노 로고" 
            className={`xog-icon ${isPeek ? 'peek-shimmer' : ''}`}
          />
          <h2>{isPeek ? '질병예측리포트 생성하기' : '질병예측리포트를 위한 인증 및 동의'}</h2>
        </div>

        {/* 상단: 고객 정보 확인 섹션 */}
        <div className="agreement-birthdate-top-section">
          {/* 이름 표시 - 이름이 없어도 공간 유지 */}
          <div className="name-display-wrapper" style={{ display: customerName ? 'block' : 'none' }}>
            {customerName && (
              <div className="name-label-value">
                <span className="name-label">이름</span>
                <div 
                  className="name-display-clickable"
                  onMouseDown={() => setShowNameUnmasked(true)}
                  onMouseUp={() => setShowNameUnmasked(false)}
                  onMouseLeave={() => setShowNameUnmasked(false)}
                  onTouchStart={() => setShowNameUnmasked(true)}
                  onTouchEnd={() => setShowNameUnmasked(false)}
                >
                  <span className="name-text">
                    {showNameUnmasked ? customerName : maskName(customerName)}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* 생년월일 표시 */}
          <div className="birthdate-display-wrapper">
            <div className="birthdate-label-value">
              <span className="birthdate-label">생년월일</span>
              <div 
                className="birthdate-display-clickable"
                onClick={() => {
                  setShowBirthDateDropdown(!showBirthDateDropdown);
                }}
                onMouseDown={() => {
                  if (isBirthDateComplete) {
                    setShowBirthDateUnmasked(true);
                  }
                }}
                onMouseUp={() => setShowBirthDateUnmasked(false)}
                onMouseLeave={() => setShowBirthDateUnmasked(false)}
                onTouchStart={() => {
                  if (isBirthDateComplete) {
                    setShowBirthDateUnmasked(true);
                  }
                }}
                onTouchEnd={() => setShowBirthDateUnmasked(false)}
              >
                {isBirthDateComplete ? (
                  <span className="birthdate-text">
                    {showBirthDateUnmasked 
                      ? `${birthDate!.year}년 ${birthDate!.month}월 ${birthDate!.day}일`
                      : maskBirthDate(birthDate)
                    }
                  </span>
                ) : (
                  <span className="birthdate-placeholder">생년월일을 선택해주세요</span>
                )}
                <span className={`birthdate-arrow ${showBirthDateDropdown ? 'open' : ''}`}>▼</span>
              </div>
            </div>
            <div className="birthdate-usage-hint">
              <span className="desktop-text">이름과 생년월일을 길게 누르면 전체 정보를 확인할 수 있습니다</span>
              <span className="mobile-text">위 정보를 길게 누르시면 확인할 수 있습니다</span>
            </div>
            
            {(showBirthDateDropdown || !isBirthDateComplete) && (
              <div className="birthdate-dropdown-wrapper">
                <CustomCalendar
                  value={birthDate || undefined}
                  onChange={(date, isComplete) => {
                    if (isComplete) {
                      setBirthDate(date);
                      setShowBirthDateDropdown(false);
                    }
                  }}
                  displayMode="full"
                />
              </div>
            )}
          </div>
          
          {/* 본인 확인 체크박스 (오른쪽 정렬) */}
          <div className="agreement-item birthdate-confirm-item right-align">
            <label className="agreement-checkbox">
              <input
                type="checkbox"
                checked={isBirthDateConfirmed}
                onChange={(e) => setIsBirthDateConfirmed(e.target.checked)}
              />
              <span className="checkmark"></span>
              <span className="label-text">네 본인이 맞습니다.</span>
            </label>
          </div>
        </div>

        {/* 하단: 약관 동의 섹션 */}
        <div className="agreement-terms-section">
          {/* 개별 약관 항목 - 스크롤 영역 */}
          <div className="agreement-list" id="agreement-list">
            {agreements.map((item) => {
            return (
              <div key={item.id} className={`agreement-item ${item.id === 'third-party' ? 'third-party-item' : ''}`}>
                  <label className="agreement-checkbox">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleCheckboxChange(item.id)}
                    />
                    <span className="checkmark"></span>
                    <span className="label-text">
                      {item.label}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="view-terms-btn"
                    onClick={() => handleViewTerms(item.id)}
                  >
                    &gt;
                  </button>
                </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* 약관 모달 - React Portal로 body에 직접 렌더링 (최상위 모달) */}
      {selectedTerms && createPortal(
        <div className="terms-modal-overlay" onClick={handleCloseModal}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h3>{selectedTerms.title}</h3>
              <button
                type="button"
                className="terms-modal-close"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>
            <div className="terms-modal-body">
              <pre className="terms-text">{selectedTerms.content.trim()}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
    </>
  );
};

