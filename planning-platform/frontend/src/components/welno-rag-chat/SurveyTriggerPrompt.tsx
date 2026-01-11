import React from 'react';

interface SurveyTriggerPromptProps {
  onStart: () => void;
  onLater: () => void;
}

const SurveyTriggerPrompt: React.FC<SurveyTriggerPromptProps> = ({
  onStart,
  onLater
}) => {
  return (
    <div className="survey-trigger-prompt">
      <div className="prompt-content">
        <p>
          💡 더 정확한 건강 분석을 위해<br/>
          간단한 질문에 답해주시겠어요?
        </p>
        <div className="prompt-buttons">
          <button className="btn-start" onClick={onStart}>
            시작하기
          </button>
          <button className="btn-later" onClick={onLater}>
            나중에
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyTriggerPrompt;
