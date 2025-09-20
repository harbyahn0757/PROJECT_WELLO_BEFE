import React from 'react';
import { ProgressInfo } from '../types';

interface ProgressBarProps {
  progressInfo: ProgressInfo;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progressInfo,
  className = '',
}) => {
  const { currentStep, totalSteps, percentage, stepText } = progressInfo;

  return (
    <div className={`progress-container ${className}`}>
      <div className="progress-info">
        <span className="progress-text">
          {stepText}
        </span>
        <span className="progress-percentage">
          {percentage}%
        </span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}; 