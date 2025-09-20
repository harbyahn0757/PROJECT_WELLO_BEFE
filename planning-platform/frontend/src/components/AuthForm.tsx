import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import splashIcon from '../assets/splash.png';

interface AuthFormProps {
  onBack: () => void;
}

// 입력 데이터 인터페이스
interface AuthInput {
  name: string;
  gender: string;
  phoneNo: string;
  birthday: string;
}

// 요청 파라미터 인터페이스
interface ReqParams {
  cxId: string;
  privateAuthType: string;
  reqTxId: string;
  token: string;
  txId: string;
  userName: string;
  birthday: string;
  phoneNo: string;
}

const AuthForm: React.FC<AuthFormProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useWelloData();
  const { patient, hospital, layoutConfig } = state;
  const privateAuthType = '0'; // 인증종류 0: 카카오톡
  
  // 로딩 중 순환 메시지
  const loadingMessages = [
    '국민건강보험공단으로부터 최근 10년간 건강검진 정보와 병원/약국 이용 이력을 연동해요.',
    '상황에 따라 최대 1분 정도 소요 될 수 있어요. 잠시만 기다려주세요.',
    '수집된 건강정보를 기반으로 올 해 받으실 검진에 대해서 설계해드려요',
    '소중한 건강정보를 안전하게 처리하고 있어요.',
    '건강정보 기반으로 맞춤형 추천 콘텐츠를 받으실 수 있어요.',
    '기다려 주셔서 감사해요. 얼마남지 않았어요.',
    '철저한 보안으로 소중한 건강정보를 지켜드릴게요.'
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'validation' | 'network' | 'server' | 'auth' | null>(null);
  const [authRequested, setAuthRequested] = useState(false);
  // progress 상태 제거됨 - currentStatus로 통합
  // layoutConfig는 Context에서 가져옴
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Array<{timestamp: string, type: string, message: string}>>([]);
  const [currentStatus, setCurrentStatus] = useState<string>('start');
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [typingText, setTypingText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  
  // 인증 입력 상태 (Context에서 가져온 사용자 데이터로 초기화)
  const [authInput, setAuthInput] = useState<AuthInput>({
    name: patient?.name || '',
    gender: patient?.gender?.toLowerCase() === 'male' ? 'M' : 'F',
    phoneNo: patient?.phone?.replace(/-/g, '') || '',
    birthday: patient?.birthday || ''
  });

  // 요청 파라미터 상태
  const [reqParams, setReqParams] = useState<ReqParams>({
    cxId: '',
    privateAuthType,
    reqTxId: '',
    token: '',
    txId: '',
    userName: '',
    birthday: '',
    phoneNo: ''
  });

  // Context에서 환자 데이터가 변경되면 authInput 업데이트
  useEffect(() => {
    if (patient) {
      console.log('📋 [인증페이지] Context에서 환자 데이터 로드:', patient.name);
      
      const newAuthInput = {
        name: patient.name,
        gender: patient.gender.toLowerCase() === 'male' ? 'M' : 'F',
        phoneNo: patient.phone.replace(/-/g, ''),
        birthday: patient.birthday
      };
      
      setAuthInput(newAuthInput);
      console.log('📋 [인증페이지] 인증 입력 데이터 설정 완료:', newAuthInput);
    }
  }, [patient]);

  useEffect(() => {
    checkExistingSession();
  }, []);

  // 기존 진행 중인 세션 확인
  const checkExistingSession = async () => {
    setIsRecovering(true);
    try {
      // 로컬 스토리지에서 세션 ID 확인
      const savedSessionId = localStorage.getItem('tilko_session_id');
      const savedSessionData = localStorage.getItem('tilko_session_data');
      
      if (savedSessionId && savedSessionData) {
        const sessionData = JSON.parse(savedSessionData);
        
        // 세션이 1시간 이내에 생성된 경우만 복구
        const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();
        const oneHour = 60 * 60 * 1000;
        
        if (sessionAge < oneHour) {
          console.log('🔄 [인증복구] 기존 세션 발견:', savedSessionId);
          
          // 서버에서 세션 상태 확인
          const response = await fetch(`http://localhost:8082/api/v1/tilko/session/status/${savedSessionId}`);
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.data.status !== 'error') {
              console.log('✅ [인증복구] 세션 복구 중:', result.data.status);
              
              // 상태 복구
              setSessionId(savedSessionId);
              setCurrentStatus(result.data.status);
              setAuthRequested(true);
              
              // 상태 메시지 가져오기
              try {
                const messageResponse = await fetch(`http://localhost:8082/api/v1/tilko/session/messages/${savedSessionId}`);
                if (messageResponse.ok) {
                  const messageResult = await messageResponse.json();
                  if (messageResult.success) {
                    setStatusMessages(messageResult.messages);
                  }
                }
              } catch (error) {
                console.error('메시지 로드 실패:', error);
              }
              
              // 사용자 정보 복구 (서버 데이터 우선, 로컬 데이터 백업)
              const userInfo = result.data.user_info || sessionData.user_info;
              if (userInfo) {
                setAuthInput({
                  name: userInfo.name,
                  gender: userInfo.gender || 'M',
                  phoneNo: userInfo.phone_no,
                  birthday: userInfo.birthdate
                });
              }
              
              // 입력 필드 비활성화
              setTimeout(() => {
                const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
                inputs.forEach(input => {
                  input.disabled = true;
                });
              }, 100);
              
              // 진행 상태에 따라 적절한 상태 설정
              if (result.data.status === 'completed') {
                setCurrentStatus('completed');
                setTimeout(() => {
                  navigate('/results-trend');
                }, 2000);
              } else if (result.data.status === 'auth_pending') {
                // 인증 대기 상태
                setCurrentStatus('auth_pending');
                console.log('🔄 [세션복구] 인증 대기 상태');
              } else {
                // 기타 상태 (인증 진행중, 데이터 수집중 등)
                setCurrentStatus(result.data.status);
                console.log('🔄 [세션복구] 진행 중인 세션:', result.data.status);
              }
              
              return; // 세션 복구 성공 시 리턴
            }
          }
        }
      }
      
      // 세션 복구 실패 또는 만료된 경우 정리
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
      
    } catch (error) {
      console.error('❌ [인증복구] 세션 복구 실패:', error);
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
    } finally {
      setIsRecovering(false);
    }
  };

  // 입력 검증 (레퍼런스와 동일)
  const checkRequired = useCallback(async (): Promise<boolean> => {
    if (authInput.name === '') {
      handleError('이름을 입력하여 주세요', 'validation');
      return false;
    }

    if (authInput.gender === '') {
      handleError('성별을 선택하여 주세요', 'validation');
      return false;
    }

    if (authInput.phoneNo === '') {
      handleError('전화번호를 입력하여 주세요', 'validation');
      return false;
    }

    const phoneRegex = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
    if (!phoneRegex.test(authInput.phoneNo)) {
      handleError('올바른 전화번호를 입력하여 주세요', 'validation');
      return false;
    }

    if (authInput.birthday === '' || authInput.birthday.length !== 8) {
      handleError('생년월일 8자리(예. 19801231)를 입력하여 주세요', 'validation');
      return false;
    }

    return true;
  }, [authInput]);

  // 입력 이벤트 처리 (레퍼런스와 동일)
  const handleInputEvent = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    const { target: { value = '', name = '' } } = evt;
    let inputKey: string;
    let inputVal: string;

    if (name === 'phoneNo') {
      inputKey = name;
      inputVal = value.replaceAll('-', '');
    } else if (name === 'gender_female') {
      inputKey = 'gender';
      inputVal = value;
    } else if (name === 'gender_male') {
      inputKey = 'gender';
      inputVal = value;
    } else {
      inputKey = name;
      inputVal = value.trim();
    }

    setAuthInput({
      ...authInput,
      [inputKey]: inputVal
    });
  }, [authInput]);

  // 에러 처리 헬퍼
  const handleError = useCallback((message: string, type: 'validation' | 'network' | 'server' | 'auth' = 'server') => {
    setError(message);
    setErrorType(type);
    console.error(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null);
    setErrorType(null);
  }, []);

  // 메시지 정리 (레퍼런스와 동일)
  const messageReplace = (message: string) => {
    return message
      .replace(/<(?:[^>=]|='[^']*'|="[^"]*"|=[^'"][^\s>]*)*>/g, ' ')
      .replace(/(&|#)?nbsp;|(&|#)nbsp/g, '')
      .replace('ERROR CODE', '')
      .replace('E422', ' [E422]')
      .replace('카카오고객센터: 바로가기', '')
      .replace(/[:|]/g, '')
      .replace(/\s+/g, ' ');
  };

  // 세션 상태 폴링
  // 폴링 로직 제거됨 - 동기적 처리로 변경

  // 새로운 카카오 간편인증 (세션 기반)
  const handleKakaoAuth = useCallback(async () => {
    if (await checkRequired()) {
      setLoading(true);
      clearError();
      
      try {
        // 기존 사용자 세션 정리
        console.log('🧹 [세션정리] 기존 세션 정리 시작');
        try {
          await fetch(`http://localhost:8082/api/v1/tilko/session/cleanup-user/${encodeURIComponent(authInput.name)}`, {
            method: 'POST'
          });
        } catch (cleanupError) {
          console.warn('⚠️ [세션정리] 실패 (계속 진행):', cleanupError);
        }
        // 1단계: 세션 시작
        const sessionResponse = await fetch('http://localhost:8082/api/v1/tilko/session/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            private_auth_type: privateAuthType,
            user_name: authInput.name,
            birthdate: authInput.birthday,
            phone_no: authInput.phoneNo,
            gender: authInput.gender
          })
        });

        if (!sessionResponse.ok) {
          throw new Error('세션 시작 실패');
        }

        const sessionResult = await sessionResponse.json();
        
        if (sessionResult.success) {
          const newSessionId = sessionResult.session_id;
          setSessionId(newSessionId);
          
          // 세션 정보를 로컬 스토리지에 저장
          const sessionDataToSave = {
            session_id: newSessionId,
            user_info: {
              name: authInput.name,
              gender: authInput.gender,
              phone_no: authInput.phoneNo,
              birthdate: authInput.birthday
            },
            created_at: new Date().toISOString()
          };
          localStorage.setItem('tilko_session_id', newSessionId);
          localStorage.setItem('tilko_session_data', JSON.stringify(sessionDataToSave));
          
          console.log('💾 [인증세션] 세션 정보 저장:', newSessionId);
          
          // 2단계: 간편인증 요청
          const authResponse = await fetch(`http://localhost:8082/api/v1/tilko/session/simple-auth?session_id=${newSessionId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!authResponse.ok) {
            throw new Error('인증 요청 실패');
          }

          const authResult = await authResponse.json();
          
          if (authResult.success) {
            setAuthRequested(true);
            clearError();
            setCurrentStatus('auth_pending');
            
            // 입력 필드 비활성화
            const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
            inputs.forEach(input => {
              input.disabled = true;
            });

            // 인증 요청 후에는 폴링하지 않음 - 사용자가 직접 확인 버튼을 눌러야 함
            console.log('🔄 [인증요청] 카카오톡 인증 대기 중 - 폴링 중단');
            
          } else {
            handleError(authResult.message || '인증 요청 실패', 'auth');
          }
        } else {
          handleError(sessionResult.message || '세션 시작 실패', 'server');
        }
      } catch (error) {
        console.error('카카오 간편인증 실패:', error);
        handleError('카카오 간편인증 요청 중 오류가 발생했습니다.', 'network');
      } finally {
        setLoading(false);
      }
    }
  }, [checkRequired, authInput, privateAuthType]);

  // 폴링 정리 로직 제거됨 
  
  // 카카오톡 인증 완료 확인
  const handleAuthCompleted = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      console.log('✅ [인증확인] 사용자 인증 완료 - 동기적 데이터 수집 시작');
      
      // 동기적으로 데이터 수집 완료까지 대기
      const response = await fetch(`http://localhost:8082/api/v1/tilko/session/confirm-auth-sync/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 완료 상태로 바로 전환
          setCurrentStatus('completed');
          console.log('🎉 [완료] 모든 데이터 수집 완료');
          
          // localStorage 정리
          localStorage.removeItem('tilko_session_id');
          localStorage.removeItem('tilko_session_data');
          
          // 2초 후 결과 페이지로 이동
          setTimeout(() => {
            navigate('/results-trend');
          }, 2000);
        } else {
          handleError(result.message || '데이터 수집 실패', 'server');
        }
      } else {
        handleError('서버 응답 오류', 'network');
      }
    } catch (error) {
      console.error('인증 확인 실패:', error);
      handleError('인증 확인 중 오류가 발생했습니다.', 'network');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // 현재 상태에 따른 메시지 표시
  const getCurrentStatusMessage = useCallback(() => {
    if (statusMessages.length > 0) {
      const latestMessage = statusMessages[statusMessages.length - 1];
      return latestMessage.message;
    }
    
    switch (currentStatus) {
      case 'auth_requesting':
        return '카카오 간편인증을 요청하고 있습니다...';
      case 'auth_pending':
        return '카카오톡에서 인증을 진행해주세요.';
      case 'authenticated':
        return '인증이 완료되었습니다. 건강정보를 가져오는 중입니다...';
      case 'fetching_health_data':
        return '건강검진 데이터를 가져오고 있습니다...';
      case 'fetching_prescription_data':
        return '처방전 데이터를 가져오고 있습니다...';
      case 'completed':
        return '모든 건강정보 동기화가 완료되었습니다!';
      default:
        return authRequested ? '카카오톡에서 인증을 진행해주세요.' : '';
    }
  }, [statusMessages, currentStatus, authRequested]);

  // 타이핑 효과 함수
  const typeMessage = useCallback((message: string, speed: number = 100, wordByWord: boolean = false) => {
    // 이미 타이핑 중이면 중단
    if (isTyping) {
      return;
    }
    
    setIsTyping(true);
    setTypingText('');
    
    if (wordByWord) {
      // 단어 단위 타이핑
      const words = message.split(' ');
      let wordIndex = 0;
      const timer = setInterval(() => {
        if (wordIndex < words.length) {
          const currentText = words.slice(0, wordIndex + 1).join(' ');
          setTypingText(currentText);
          wordIndex++;
        } else {
          clearInterval(timer);
          setIsTyping(false);
        }
      }, speed * 3); // 단어 단위는 더 느리게
    } else {
      // 글자 단위 타이핑
      let index = 0;
      const timer = setInterval(() => {
        if (index < message.length) {
          setTypingText(message.substring(0, index + 1));
          index++;
        } else {
          clearInterval(timer);
          setIsTyping(false);
        }
      }, speed);
    }
  }, [isTyping]);

  // 상태 변경 시 타이핑 효과 적용
  useEffect(() => {
    if (authRequested && !isTyping) { // isTyping 중에는 새로운 타이핑 시작 방지
      const message = getCurrentStatusMessage();
      if (message && message !== typingText) {
        // 메시지 길이와 상황에 따라 속도 조절
        let speed = 80; // 기본 속도
        let wordByWord = false; // 기본은 글자 단위
        
        if (message.length > 30) {
          speed = 60; // 긴 메시지는 더 빠르게
          wordByWord = true; // 긴 메시지는 단어 단위로
        } else if (currentStatus === 'auth_pending') {
          speed = 150; // 인증 대기 상태는 더 천천히
        } else if (currentStatus === 'completed') {
          speed = 200; // 완료 메시지는 매우 천천히
          wordByWord = true; // 완료 메시지는 단어 단위로
        }
        
        typeMessage(message, speed, wordByWord);
      }
    }
  }, [currentStatus, authRequested]); // typingText와 isTyping 의존성 제거

  // 로딩 메시지 순환 효과
  useEffect(() => {
    let messageInterval: NodeJS.Timeout;
    
    if (loading && authRequested) {
      // 초기 메시지 설정
      setLoadingMessage(loadingMessages[0]);
      setLoadingMessageIndex(0);
      
      // 5초마다 메시지 변경
      messageInterval = setInterval(() => {
        setLoadingMessageIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % loadingMessages.length;
          setLoadingMessage(loadingMessages[nextIndex]);
          return nextIndex;
        });
      }, 5000);
    }
    
    return () => {
      if (messageInterval) {
        clearInterval(messageInterval);
      }
    };
  }, [loading, authRequested, loadingMessages]);

  // loadLayoutConfig 함수 제거됨 - Context에서 레이아웃 정보 사용

  if (isRecovering) {
    return (
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p>{isRecovering ? '이전 인증 진행 상황을 확인하고 있습니다...' : '로딩 중...'}</p>
          <div style={{ marginTop: '20px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  const hospitalName = layoutConfig?.headerLogoTitle || '병원';

  // 데이터 수집 중 로딩 화면 (XOG 스타일)
  if (loading && authRequested) {
    return (
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          {/* 주요 상태 메시지 */}
          <h3 style={{ marginBottom: '20px', color: '#333' }}>
            건강정보를 연동하고 있습니다
          </h3>
          
          {/* 순환 메시지 */}
          <div style={{ 
            minHeight: '60px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '30px'
          }}>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.5', 
              color: '#666',
              textAlign: 'center',
              margin: 0
            }}>
              {loadingMessage}
            </p>
          </div>
          
          {/* 로딩 스피너 */}
          <div style={{ marginBottom: '20px' }}>
            <div className="loading-spinner"></div>
          </div>
          
          {/* 진행률 표시 */}
          <p style={{ fontSize: '14px', color: '#999' }}>
            {currentStatus === 'fetching_health_data' ? '건강검진 데이터 수집 중...' :
             currentStatus === 'fetching_prescription_data' ? '처방전 데이터 수집 중...' :
             '데이터를 수집하고 있습니다...'}
          </p>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (currentStatus === 'completed') {
    return (
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p>✅ 건강정보 동기화가 완료되었습니다!</p>
          <p>결과 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 뒤로가기 버튼 */}
      <div className="back-button-container">
        <button className="back-button" onClick={() => {
          console.log('🔙 [인증페이지] 뒤로가기 버튼 클릭');
          onBack && onBack();
        }}>
          ←
        </button>
      </div>
      
      <div className="auth__content" style={{ position: 'relative', minHeight: '100vh' }}>
        {/* 메인 타이틀 영역 */}
        <div className="auth__main-title" style={{ 
          marginTop: '120px', 
          marginBottom: '16px',
          paddingLeft: '24px',
          minHeight: '280px'
        }}>
          {/* 아이콘 - 타이핑 중일 때 위치 조정 */}
          <div style={{ 
            marginBottom: '8px', 
            marginLeft: '-16px',
            transform: isTyping ? 'translateY(10px)' : 'translateY(0)',
            transition: 'transform 0.3s ease'
          }}>
            <img 
              src={splashIcon} 
              alt="아이콘" 
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain' 
              }} 
            />
          </div>
          
          <div className="auth__main-title-text" style={{
            fontFamily: 'inherit',
            fontSize: '26px',
            lineHeight: '1.4',
            fontWeight: 'normal',
            color: '#535353',
            textAlign: 'left',
            animation: authRequested ? 'authPulse 2s ease-in-out infinite' : 'none'
          }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d1e1f', marginRight: '8px', marginLeft: '-16px' }}>{authInput.name}</span>
            <span style={{ fontSize: '18px', color: '#535353' }}>{authRequested ? '님!' : '님의'}</span><br />
            {authRequested ? (
              <>
                <div style={{ 
                  marginLeft: '-8px', 
                  display: 'inline-block',
                  minHeight: '60px',
                  lineHeight: '1.6'
                }}>
                  <span style={{ 
                    fontFamily: 'monospace',
                    fontSize: '18px'
                  }}>
                    {isTyping ? typingText : getCurrentStatusMessage()}
                    {isTyping && (
                      <span style={{ 
                        animation: 'blink 1s infinite',
                        marginLeft: '2px'
                      }}>|</span>
                    )}
                  </span>
                </div>
                <br />
                {currentStatus === 'auth_pending' && !isTyping && (
                  <>
                    <div style={{ marginTop: '20px', marginLeft: '-8px' }}>
                      <button 
                        onClick={handleAuthCompleted}
                        disabled={loading}
                        style={{
                          backgroundColor: '#fee500',
                          color: '#000',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '12px 24px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.7 : 1,
                          transform: 'translateY(-10px)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {loading ? '확인 중...' : '카카오톡 인증 완료했어요!'}
                      </button>
                    </div>
                  </>
                )}
                {(currentStatus === 'auth_requesting') && (
                  <span style={{ 
                    display: 'inline-block',
                    marginLeft: '4px',
                    animation: 'blink 1s infinite',
                    fontSize: '20px',
                    color: '#fee500'
                  }}>●</span>
                )}
              </>
            ) : (
              <>
                <span style={{ marginLeft: '-8px', display: 'inline-block' }}>검진정보를</span><br />
                <span style={{ marginLeft: '-8px', display: 'inline-block' }}>의료보험공단에서</span><br />
                <span style={{ marginLeft: '-8px', display: 'inline-block' }}>안전하게 불러와</span><br />
                <span style={{ marginLeft: '-8px', display: 'inline-block' }}>검진 정보 추이를 안내하겠습니다</span>
              </>
            )}
          </div>
          {authRequested && (
            <style>{`
              @keyframes authPulse {
                0%, 100% {
                  opacity: 0.6;
                }
                50% {
                  opacity: 1;
                }
              }
              @keyframes blink {
                0%, 50% {
                  opacity: 1;
                }
                51%, 100% {
                  opacity: 0;
                }
              }
            `}</style>
          )}
        </div>

        {/* 개선된 에러 메시지 */}
        {error && (
          <div style={{ 
            color: errorType === 'validation' ? '#d97706' : '#e74c3c',
            marginBottom: '20px', 
            padding: '12px', 
            background: errorType === 'validation' ? '#fef3cd' : '#fdf2f2',
            borderRadius: '8px',
            border: `1px solid ${errorType === 'validation' ? '#d97706' : '#e74c3c'}`,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ marginRight: '8px' }}>
              {errorType === 'validation' ? '⚠️' : 
               errorType === 'network' ? '🌐' : 
               errorType === 'auth' ? '🔐' : '❌'}
            </span>
            {error}
            {errorType === 'validation' && (
              <button 
                onClick={clearError}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#d97706',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

          {/* 인증 정보 표시 (초기 상태에서만) */}
          <div className="auth__content-input-area">
            {/* 카카오페이 인증 버튼 - 플로팅 버튼으로 이동됨 */}
            <div
              data-testid="kakao-auth-button"
              style={{ display: 'none' }}
              onClick={handleKakaoAuth}
            />
          </div>

        {/* 서브 안내 텍스트 영역 - 고정 위치 */}
        <div className="auth__sub-info" style={{
          position: 'absolute',
          bottom: '120px',
          left: '16px',
          right: '16px'
        }}>
          <div className="auth__sub-info-title" style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#666',
            marginBottom: '16px',
            textAlign: 'left'
          }}>
            * 건강정보 연동 후에도 내역이 보이지 않는 경우
          </div>
          
          <div className="auth__sub-info-content" style={{
            fontSize: '10px',
            color: '#888',
            lineHeight: '1.7',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '10px', paddingLeft: '4px' }}>
              - 건강검진내역은 검진기관에서 청구가 완료되어야 제공이 가능하며, 청구완료까지 통상 30일이 소요되요.
            </div>
            <div style={{ paddingLeft: '4px' }}>
              - 병원/약국 이용 이력은 병·의원약국에서 청구한 진료비/약제비 정보를 바탕으로 제공되므로 청구 되지 않은 최근의 진료내역은 조회되지 않을 수 있어요.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthForm;
