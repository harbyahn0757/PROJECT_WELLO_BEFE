import React from 'react';

export interface ProcessingStep {
  label: string;
  done: boolean;
}

interface ProcessingModalProps {
  isOpen: boolean;
  title?: string;
  steps?: ProcessingStep[];
  progress?: number; // 0-100
}

/**
 * 백오피스 범용 처리 중 모달.
 * - 캠페인 발송 등 비동기 작업 진행 상태 표시.
 * - steps: 단계 목록 (done=true 시 체크 표시).
 * - progress: 0-100 프로그레스 바 (생략 가능).
 */
export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  title = '처리 중...',
  steps = [],
  progress,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-modal-title"
      aria-describedby="processing-modal-desc"
      className="processing-modal-bo"
    >
      <div className="processing-modal-bo__overlay" />
      <div className="processing-modal-bo__content">
        <h3 id="processing-modal-title" className="processing-modal-bo__title">
          {title}
        </h3>

        {steps.length > 0 && (
          <ul id="processing-modal-desc" className="processing-modal-bo__steps">
            {steps.map((step, i) => (
              <li
                key={i}
                className={`processing-modal-bo__step ${step.done ? 'processing-modal-bo__step--done' : ''}`}
              >
                <span className="processing-modal-bo__step-icon">
                  {step.done ? '✓' : '⟳'}
                </span>
                {step.label}
              </li>
            ))}
          </ul>
        )}

        {progress !== undefined && (
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="processing-modal-bo__progress"
          >
            <div
              className="processing-modal-bo__progress-fill"
              style={{ width: `${progress}%` }}
            />
            <span className="processing-modal-bo__progress-text">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingModal;
