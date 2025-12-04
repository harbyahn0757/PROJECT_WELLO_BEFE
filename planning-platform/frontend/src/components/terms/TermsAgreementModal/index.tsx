/**
 * TermsAgreementModal
 * 약관동의 모달 컴포넌트
 * AppointmentModal과 같은 패널 형태로 아래에서 올라오는 애니메이션
 */
import React, { useState, useEffect } from 'react';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import './styles.scss';

interface TermsAgreement {
  terms_service: boolean;
  terms_privacy: boolean;
  terms_sensitive: boolean;
  terms_marketing: boolean;
  agreed_at: string;
}

interface TermsAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agreedTerms: string[], termsAgreement?: TermsAgreement) => void | Promise<void>;
}

interface TermItem {
  id: string;
  title: string;
  required: boolean;
  content: string;
}

const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const [agreedTerms, setAgreedTerms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  // 약관 HTML 파일 로드
  useEffect(() => {
    const loadTerms = async () => {
      try {
        const termsList: TermItem[] = [
          {
            id: 'terms-service',
            title: '웰로 서비스 이용약관 (필수)',
            required: true,
            content: ''
          },
          {
            id: 'terms-privacy',
            title: '개인정보 수집, 이용 및 개인정보 처리 위탁 동의 (필수)',
            required: true,
            content: ''
          },
          {
            id: 'terms-sensitive',
            title: '민감정보 수집 및 이용 동의서 (필수)',
            required: true,
            content: ''
          },
          {
            id: 'terms-marketing',
            title: '웰로 서비스를 위한 마케팅 활용 및 개인정보 제3자 제공유상동의 (선택)',
            required: false,
            content: ''
          }
        ];

        // 약관 HTML 파일 로드
        const loadTermContent = async (index: number, filename: string): Promise<string> => {
          try {
            // 정적 파일 경로 시도 (프론트엔드 public 폴더 또는 백엔드 static 폴더)
            const paths = [
              `/wello/docs/html/${filename}`,
              `/docs/html/${filename}`,
              `/wello/static/docs/html/${filename}`
            ];
            
            for (const path of paths) {
              try {
                const response = await fetch(path);
                if (response.ok) {
                  const html = await response.text();
                  // HTML에서 body 내용만 추출
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(html, 'text/html');
                  const bodyContent = doc.body.innerHTML;
                  return bodyContent;
                }
              } catch (e) {
                // 다음 경로 시도
                continue;
              }
            }
            
            // 모든 경로 실패 시 기본 메시지 반환
            return '<p>약관 내용을 불러올 수 없습니다. 나중에 다시 시도해주세요.</p>';
          } catch (error) {
            console.warn(`약관 파일 로드 실패: ${filename}`, error);
            return '<p>약관 내용을 불러올 수 없습니다.</p>';
          }
        };

        const loadedTerms = await Promise.all([
          loadTermContent(0, '1. (웰로) 웰로 서비스 이용약관(필수)_251129.html'),
          loadTermContent(1, '2. (웰로) 개인정보 수집,이용 및 개인정보 처리 위탁 동의(필수)_251129.html'),
          loadTermContent(2, '3. (웰로) 민감정보 수집 및 이용 동의서(필수)_251129.html'),
          loadTermContent(3, '4. (웰로) 웰로 서비스를 위한 마케팅 활용 및 개인정보 제3자 제공유상동의 (선택)_251129.html')
        ]);

        termsList.forEach((term, index) => {
          term.content = loadedTerms[index];
        });

        setTerms(termsList);
      } catch (error) {
        console.error('약관 로드 실패:', error);
      }
    };

    if (isOpen) {
      loadTerms();
    }
  }, [isOpen]);

  // 모달 열기/닫기 애니메이션 처리
  useEffect(() => {
    if (isOpen) {
      // 패널이 열릴 때 배경 스크롤 방지
      document.body.style.overflow = 'hidden';
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        // 패널이 닫힐 때 배경 스크롤 복원
        document.body.style.overflow = '';
      }, 400);
      return () => {
        clearTimeout(timer);
        // 컴포넌트 언마운트 시에도 스크롤 복원
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // 오버레이 클릭 시 닫기
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 패널 내부 클릭 시 이벤트 전파 방지
  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  // 닫기 버튼 클릭 핸들러
  const handleCloseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClose();
  };

  // 약관 동의 체크박스 토글
  const toggleTermAgreement = (termId: string) => {
    if (agreedTerms.includes(termId)) {
      setAgreedTerms(agreedTerms.filter(id => id !== termId));
    } else {
      setAgreedTerms([...agreedTerms, termId]);
    }
  };

  // 전체 동의
  const handleSelectAll = () => {
    if (agreedTerms.length === terms.length) {
      setAgreedTerms([]);
    } else {
      setAgreedTerms(terms.map(term => term.id));
    }
  };

  // 약관 내용 확장/축소
  const toggleTermContent = (termId: string) => {
    if (expandedTerm === termId) {
      setExpandedTerm(null);
    } else {
      setExpandedTerm(termId);
    }
  };

  // 동의 확인
  const handleConfirm = async () => {
    // 약관이 로드되지 않았으면 대기
    if (terms.length === 0) {
      alert('약관을 불러오는 중입니다. 잠시만 기다려주세요.');
      return;
    }

    // 필수 약관 체크
    const requiredTerms = terms.filter(term => term.required).map(term => term.id);
    const allRequiredAgreed = requiredTerms.every(id => agreedTerms.includes(id));

    if (!allRequiredAgreed) {
      const missingTerms = requiredTerms.filter(id => !agreedTerms.includes(id));
      const missingTermNames = terms
        .filter(term => missingTerms.includes(term.id))
        .map(term => term.title)
        .join(', ');
      alert(`필수 약관에 동의해주세요.\n\n미동의 약관: ${missingTermNames}`);
      return;
    }

    setIsLoading(true);

    try {
      // 약관 동의 정보를 구분해서 전달
      const termsAgreement = {
        terms_service: agreedTerms.includes('terms-service'),
        terms_privacy: agreedTerms.includes('terms-privacy'),
        terms_sensitive: agreedTerms.includes('terms-sensitive'),
        terms_marketing: agreedTerms.includes('terms-marketing'),
        agreed_at: new Date().toISOString()
      };

      // onConfirm에 약관 동의 정보 전달 (비동기 완료 대기)
      const confirmResult = onConfirm(agreedTerms, termsAgreement);
      if (confirmResult && typeof confirmResult.then === 'function') {
        await confirmResult;
      }
      
      setIsLoading(false);
      // onConfirm 완료 후 모달 닫기
      onClose();
    } catch (error) {
      console.error('약관 동의 처리 실패:', error);
      alert('약관 동의 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 필수 약관 모두 동의했는지 확인
  const requiredTerms = terms.filter(term => term.required).map(term => term.id);
  const allRequiredAgreed = requiredTerms.every(id => agreedTerms.includes(id));
  const allAgreed = terms.length > 0 && agreedTerms.length === terms.length;

  if (!shouldRender) return null;

  return (
    <div 
      className={`terms-modal-overlay ${isAnimating ? 'terms-modal-overlay--open' : 'terms-modal-overlay--close'}`}
      onClick={handleOverlayClick}
    >
      <div 
        className={`terms-modal ${isAnimating ? 'terms-modal--open' : 'terms-modal--close'}`}
        onClick={handleModalClick}
      >
        {/* 헤더 */}
        <div className="terms-modal__header">
          <h2 className="terms-modal__title">약관 동의</h2>
          <button 
            className="terms-modal__close"
            onClick={handleCloseClick}
            aria-label="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="terms-modal__content">
          {/* 전체 동의 */}
          <div className="terms-modal__select-all">
            <label className="terms-modal__checkbox-label">
              <input
                type="checkbox"
                checked={allAgreed}
                onChange={handleSelectAll}
                className="terms-modal__checkbox"
              />
              <span className="terms-modal__checkbox-text">전체 선택</span>
            </label>
          </div>

          {/* 약관 목록 */}
          <div className="terms-modal__terms-list">
            {terms.map((term) => (
              <div key={term.id} className="terms-modal__term-item">
                <div className="terms-modal__term-header">
                  <label className="terms-modal__checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreedTerms.includes(term.id)}
                      onChange={() => toggleTermAgreement(term.id)}
                      className="terms-modal__checkbox"
                    />
                    <span className="terms-modal__checkbox-text">
                      {term.title}
                    </span>
                  </label>
                  <button
                    className="terms-modal__expand-button"
                    onClick={() => toggleTermContent(term.id)}
                    aria-label={expandedTerm === term.id ? '약관 내용 접기' : '약관 내용 보기'}
                  >
                    {expandedTerm === term.id ? '접기' : '>'}
                  </button>
                </div>
                {expandedTerm === term.id && term.content && (
                  <div className="terms-modal__term-content">
                    <div 
                      className="terms-modal__term-html"
                      dangerouslySetInnerHTML={{ __html: term.content }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="terms-modal__footer">
          <button
            className="terms-modal__button"
            onClick={handleConfirm}
            disabled={!allRequiredAgreed || isLoading}
          >
            {isLoading ? (
              <span className="terms-modal__button-loading">
                <img 
                  src={WELLO_LOGO_IMAGE}
                  alt="로딩 중" 
                  className="wello-icon-blink"
                />
                <span>처리 중...</span>
              </span>
            ) : (
              '동의하고 시작하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAgreementModal;

