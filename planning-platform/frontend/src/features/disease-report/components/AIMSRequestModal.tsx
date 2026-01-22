import React, { useState } from 'react';
import xogIcon from '../assets/images/xog_icon.png';
import { getMktUuidFromUrl } from '../utils/legacyCompat';
import '../styles/aims-request-modal.scss';

interface AIMSRequestModalProps {
  isOpen: boolean;
  requestBody: any;
  onClose: () => void;
  onSendSuccess?: (responseData: any) => void;
}

export const AIMSRequestModal: React.FC<AIMSRequestModalProps> = ({
  isOpen,
  requestBody,
  onClose,
  onSendSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  // 실제 전송 전문 생성 (백엔드에서 이미 전화번호를 빈 문자열로 보내므로 변경 불필요)
  const getActualRequestBody = () => {
    // 백엔드에서 이미 phoneNumber를 빈 문자열('')로 설정하므로 그대로 사용
    return requestBody;
  };

  // 테스트 모드 감지 함수 (전화번호가 없으면 테스트 모드)
  const isTestMode = () => {
    // userInfo에 phoneNumber가 없거나 빈 문자열이면 테스트 모드
    const userInfo = requestBody?.users?.[0]?.userInfo;
    return !userInfo?.phoneNumber || userInfo.phoneNumber === '';
  };

  // 닫기 핸들러 (테스트 모드면 리포트 페이지로 이동)
  const handleClose = () => {
    if (isTestMode()) {
      // 테스트 모드인 경우 리포트 페이지로 이동
      const mktUuid = getMktUuidFromUrl();
      if (mktUuid) {
        const currentUrl = new URL(window.location.href);
        // uid 파라미터를 명시적으로 설정하여 유지
        currentUrl.searchParams.set('uid', mktUuid);
        currentUrl.searchParams.set('page', 'report');
        window.location.href = currentUrl.toString();
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleCopy = () => {
    const actualBody = getActualRequestBody();
    const jsonString = JSON.stringify(actualBody, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSend = async () => {
    const mktUuid = getMktUuidFromUrl();
    if (!mktUuid) {
      alert('mkt_uuid를 찾을 수 없습니다.');
      return;
    }

    setIsSending(true);
    setSendStatus('idle');
    setErrorMessage('');

    try {
      // 실제 전송 전문 (전화번호만 변경, userInfo.mktUuid만 유지)
      const finalRequestBody = getActualRequestBody();

      const response = await fetch('/api/partner-marketing/send-to-aims-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_body: finalRequestBody,
          mkt_uuid: mktUuid,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSendStatus('success');
        
        // 테스트 모드인 경우 목업 데이터로 리포트 페이지로 이동
        if (isTestMode()) {
          // 리포트 페이지로 이동
          const currentUrl = new URL(window.location.href);
          // uid 파라미터를 명시적으로 설정하여 유지
          currentUrl.searchParams.set('uid', mktUuid);
          currentUrl.searchParams.set('page', 'report');
          window.location.href = currentUrl.toString();
        } else if (onSendSuccess && result.response_data) {
          // 실제 모드인 경우 응답 데이터 전달
          onSendSuccess(result.response_data);
          // 2초 후 모달 닫기
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          // 응답 데이터가 없는 경우에도 모달 닫기
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } else {
        setSendStatus('error');
        setErrorMessage(result.error || '전송 실패');
      }
    } catch (error) {
      setSendStatus('error');
      setErrorMessage('전송 중 오류가 발생했습니다.');
      console.error('AIMS API 전송 오류:', error);
    } finally {
      setIsSending(false);
    }
  };

  // 실제 전송 전문으로 표시 (전화번호만 변경된 버전)
  const actualRequestBody = getActualRequestBody();
  const formattedJson = JSON.stringify(actualRequestBody, null, 2);

  return (
    <div className="aims-request-modal-overlay" onClick={handleClose}>
      <div className="aims-request-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="aims-request-modal-header">
          <div className="aims-request-modal-title">
            <img src={xogIcon} alt="Xog" className="aims-request-modal-icon" />
            <h3>AIMS API Request Body</h3>
          </div>
          <button className="aims-request-modal-close" onClick={handleClose}>
            ×
          </button>
        </div>
        
        <div className="aims-request-modal-body">
          <pre className="aims-request-modal-json">{formattedJson}</pre>
        </div>
        
        <div className="aims-request-modal-footer">
          <button 
            className="aims-request-modal-copy" 
            onClick={handleCopy}
            disabled={isSending}
          >
            {copied ? '복사 완료!' : '복사하기'}
          </button>
          <button 
            className="aims-request-modal-send" 
            onClick={handleSend}
            disabled={isSending || sendStatus === 'success'}
          >
            {isSending ? '전송 중...' : sendStatus === 'success' ? '전송 완료!' : '전송하기'}
          </button>
          {sendStatus === 'error' && (
            <div className="aims-request-modal-error">
              {errorMessage}
            </div>
          )}
          <button 
            className="aims-request-modal-close-btn" 
            onClick={handleClose}
            disabled={isSending}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

