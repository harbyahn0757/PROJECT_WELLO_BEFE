/**
 * WebSocket을 통한 실시간 인증 상태 관리 훅
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  session_id?: string;
  message?: string;
  status?: string;
  auth_completed?: boolean;
  auth_data?: any;
  next_step?: string;
  progress_type?: string;
  timestamp?: string;
  // 스트리밍 관련 속성
  data?: any;
  extend_seconds?: number;
  // 페이로드 객체 (백엔드에서 payload로 감싸서 보내는 경우)
  payload?: {
    status?: string;
    message?: string;
    data?: any;
    extend_seconds?: number;
    auth_completed?: boolean;
    progressType?: string;
  };
}

interface UseWebSocketAuthProps {
  sessionId: string | null;
  onAuthCompleted?: (data: any) => void;
  onDataCollectionProgress?: (progressType: string, message: string, data?: any) => void;
  onError?: (error: string) => void;
  onStatusUpdate?: (status: string, authCompleted: boolean) => void;
  onAuthTimeout?: (message: string) => void;
  onTilkoKeyReceived?: (cxId: string) => void;
}

export const useWebSocketAuth = ({
  sessionId,
  onAuthCompleted,
  onDataCollectionProgress,
  onError,
  onStatusUpdate,
  onAuthTimeout,
  onTilkoKeyReceived
}: UseWebSocketAuthProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isDataCollectionCompleted, setIsDataCollectionCompleted] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const connect = useCallback(() => {
    if (!sessionId) {
      console.log('⚠️ [WebSocket] 세션 ID가 없어 연결하지 않음');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('⚠️ [WebSocket] 이미 연결됨');
      return;
    }
    
    try {
      // 개발환경: 직접 백엔드 연결 (브라우저 SSL 인증서 문제 회피)
    const isDev = (process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost' || 
                  (window.location.port === '9282' && window.location.hostname === 'localhost') || 
                  (window.location.port === '9283' && window.location.hostname === 'localhost')) &&
                  window.location.hostname !== 'welno.kindhabit.com';
    let wsUrl;
    
    if (isDev) {
      // 개발환경: React 프록시를 통한 WebSocket 연결
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // localhost:9282
      wsUrl = `${protocol}//${host}/api/v1/tilko/ws/${sessionId}`;
      console.log(`🔌 [WebSocket] 연결 시도 (개발-프록시): ${wsUrl}`);
    } else {
      // 운영환경: Nginx를 통한 WebSocket 연결 (wss:// 사용)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // welno.kindhabit.com
      wsUrl = `${protocol}//${host}/api/v1/tilko/ws/${sessionId}`;
      console.log(`🔌 [WebSocket] 연결 시도 (프로덕션): ${wsUrl}`);
    }
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('✅ [WebSocket] 연결 성공');
        setIsConnected(true);
        setConnectionError(null);
        
        // 연결 후 ping 시작 (30초마다)
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString()
            }));
          }
        }, 30000);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 [WebSocket] 메시지 수신:', message.type, message);
          
          setLastMessage(message);
          
          switch (message.type) {
            case 'connection_established':
              console.log('🎉 [WebSocket] 연결 확립됨');
              break;
              
            case 'session_status':
              console.log('📊 [WebSocket] 세션 상태 업데이트:', message.status);
              if (onStatusUpdate) {
                onStatusUpdate(message.status || 'unknown', message.auth_completed || false);
              }
              break;
              
            case 'auth_key_received':
              console.log('🔑 [WebSocket] 틸코 키 수신 알림!', message.data);
              if (onTilkoKeyReceived) {
                onTilkoKeyReceived(message.data?.cx_id || '');
              }
              break;
              
            case 'auth_completed':
              console.log('🎊 [WebSocket] 인증 완료 알림 수신!');
              if (onAuthCompleted) {
                onAuthCompleted(message.auth_data);
              }
              break;
              
            case 'data_collection_progress':
              console.log('📈 [WebSocket] 데이터 수집 진행:', message.progress_type, message.message);
              
              // 데이터 수집 완료 상태 체크
              if (message.progress_type === 'completed' || message.message?.includes('모든 데이터 수집이 완료')) {
                console.log('🎉 [WebSocket] 데이터 수집 완료 상태 설정');
                setIsDataCollectionCompleted(true);
              }
              
              if (onDataCollectionProgress) {
                onDataCollectionProgress(message.progress_type || '', message.message || '');
              }
              break;
              
            case 'auth_timeout':
              console.log('⏰ [WebSocket] 인증 타임아웃 알림 수신!');
              if (onAuthTimeout) {
                onAuthTimeout(message.message || '인증 시간이 초과되었습니다.');
              }
              break;
              
            case 'streaming_status':
              // 실시간 스트리밍 상태 처리
              const streamingStatus = message.status || message.payload?.status;
              const streamingMessage = message.message || message.payload?.message;
              const streamingData = message.data || message.payload?.data;
              
              console.log('🎬 [WebSocket] 스트리밍 상태:', streamingStatus, streamingMessage);
              
              // 상태별 처리
              if (streamingStatus === 'auth_key_received') {
                console.log('🔑 [WebSocket] 틸코 키값 수신됨 - onTilkoKeyReceived 호출');
                if (onTilkoKeyReceived && streamingData?.cx_id) {
                  onTilkoKeyReceived(streamingData.cx_id);
                }
                if (onStatusUpdate) {
                  onStatusUpdate('auth_key_received', false);
                }
              } else if (streamingStatus === 'auth_waiting') {
                console.log('⏳ [WebSocket] 인증 대기 중');
                if (onStatusUpdate) {
                  onStatusUpdate('auth_waiting', false);
                }
              } else if (streamingStatus === 'auth_pending') {
                console.log('⏳ [WebSocket] 인증 아직 완료되지 않음 (재시도 대기)');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('auth_pending', streamingMessage || '인증이 완료되지 않았습니다.');
                }
              } else if (streamingStatus === 'data_collecting') {
                console.log('📊 [WebSocket] 데이터 수집 중');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('data_collecting', streamingMessage || '');
                }
              } else if (streamingStatus === 'fetching_health_data') {
                console.log('🏥 [WebSocket] 건강검진 데이터 수집 중');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('fetching_health_data', streamingMessage || '');
                }
              } else if (streamingStatus === 'health_data_completed') {
                console.log('✅ [WebSocket] 건강검진 데이터 수집 완료');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('health_data_completed', streamingMessage || '', streamingData);
                }
              } else if (streamingStatus === 'fetching_prescription_data') {
                console.log('💊 [WebSocket] 처방전 데이터 수집 중');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('fetching_prescription_data', streamingMessage || '');
                }
              } else if (streamingStatus === 'prescription_data_failed') {
                console.log('❌ [WebSocket] 처방전 데이터 수집 실패');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('prescription_data_failed', streamingMessage || '', streamingData);
                }
              } else if (streamingStatus === 'health_data_failed') {
                console.log('❌ [WebSocket] 건강검진 데이터 수집 실패');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('health_data_failed', streamingMessage || '', streamingData);
                }
              } else if (streamingStatus === 'completed') {
                console.log('🎉 [WebSocket] 데이터 수집 완료 (streaming_status)!', streamingData);
                setIsDataCollectionCompleted(true);
                
                // 완료 데이터를 onDataCollectionProgress로 전달
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('completed', streamingMessage || '모든 데이터 수집이 완료되었습니다!', streamingData);
                }
                
                // 완료 데이터를 onAuthCompleted로도 전달 (기존 로직 호환)
                if (onAuthCompleted && streamingData) {
                  onAuthCompleted(streamingData);
                }
              } else if (streamingStatus === 'mediarc_generating') {
                console.log('🎨 [WebSocket] Mediarc 생성 시작');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('mediarc_generating', streamingMessage || '질병예측 리포트를 생성하고 있습니다...', streamingData);
                }
              } else if (streamingStatus === 'mediarc_completed_password_ready') {
                console.log('✅ [WebSocket] Mediarc 완료 - 비밀번호 모달 트리거');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('mediarc_completed_password_ready', streamingMessage || '리포트 생성 완료!', streamingData);
                }
              } else if (streamingStatus === 'mediarc_failed') {
                console.log('❌ [WebSocket] Mediarc 생성 실패');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('mediarc_failed', streamingMessage || '리포트 생성 실패', streamingData);
                }
              } else if (streamingStatus === 'prescription_completed') {
                console.log('💊 [WebSocket] 처방전 수집 완료');
                if (onDataCollectionProgress) {
                  onDataCollectionProgress('prescription_completed', streamingMessage || '처방전 데이터 수집 완료', streamingData);
                }
              }
              break;
              
            case 'session_extended':
              const extendSeconds = message.extend_seconds || message.payload?.extend_seconds;
              console.log('⏰ [WebSocket] 세션 연장:', extendSeconds, '초');
              break;
              
            case 'error':
              console.error('❌ [WebSocket] 에러 수신:', message.message);
              if (onError) {
                onError(message.message || '알 수 없는 오류');
              }
              break;
              
            case 'pong':
              // ping에 대한 응답 - 연결 상태 확인용
              break;
              
            default:
              console.log('❓ [WebSocket] 알 수 없는 메시지 타입:', message.type);
          }
        } catch (error) {
          console.error('❌ [WebSocket] 메시지 파싱 오류:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log('🔌 [WebSocket] 연결 종료:', event.code, event.reason);
        setIsConnected(false);
        
        // ping 중지
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // 비정상 종료인 경우 재연결 시도 (단, 데이터 수집 완료 상태가 아닌 경우에만)
        if (event.code !== 1000 && sessionId && !isDataCollectionCompleted) {
          console.log('🔄 [WebSocket] 5초 후 재연결 시도...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        } else if (isDataCollectionCompleted) {
          console.log('🛑 [WebSocket] 데이터 수집 완료로 인한 재연결 중단');
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('❌ [WebSocket] 연결 오류:', error);
        setConnectionError('WebSocket 연결 오류');
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('❌ [WebSocket] 연결 생성 실패:', error);
      setConnectionError('WebSocket 연결 생성 실패');
    }
  }, [sessionId, onAuthCompleted, onDataCollectionProgress, onError, onStatusUpdate]);
  
  const disconnect = useCallback(() => {
    console.log('🔌 [WebSocket] 연결 해제 요청');
    
    // 재연결 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // ping 타이머 정리
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // WebSocket 연결 종료
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionError(null);
  }, []);
  
  const requestStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'status_request',
        session_id: sessionId
      }));
      console.log('📤 [WebSocket] 상태 확인 요청 전송');
    }
  }, [sessionId]);
  
  // 세션 ID 변경 시 재연결
  // sessionId가 있을 때만 연결
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    
    console.log(`🔌 [WebSocket] useEffect - sessionId 변경: ${sessionId}`);
    connect();
    
    // cleanup: 언마운트 또는 sessionId 변경 시
    return () => {
      console.log(`🧹 [WebSocket] cleanup - sessionId: ${sessionId}`);
      disconnect();
    };
  }, [sessionId]); // connect, disconnect는 의존성에서 제거 (무한 루프 방지)
  
  // 페이지 새로고침/종료 시 WebSocket 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('🧹 [WebSocket] 페이지 새로고침/종료 - WebSocket 연결 정리');
      disconnect();
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🧹 [WebSocket] 페이지 숨김 - WebSocket 연결 정리');
        disconnect();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  return {
    isConnected,
    connectionError,
    lastMessage,
    connect,
    disconnect,
    requestStatus
  };
};
