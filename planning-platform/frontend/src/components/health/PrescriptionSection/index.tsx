/**
 * 처방전 섹션 컴포넌트
 */
import React from 'react';
import { PrescriptionSectionProps } from '../../../types/health';
import { healthConnectService } from '../../../services/health/HealthConnectService';
import './styles.scss';

interface ExtendedPrescriptionSectionProps extends PrescriptionSectionProps {
  selectedPrescriptions?: string[];
  onSelectionChange?: (prescriptionId: string) => void;
}

const PrescriptionSection: React.FC<ExtendedPrescriptionSectionProps> = ({
  prescriptions,
  loading = false,
  onPrescriptionClick,
  selectedPrescriptions = [],
  onSelectionChange
}) => {
  /**
   * 비용 포맷팅
   */
  const formatCost = (cost?: number) => {
    if (!cost) return '-';
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(cost);
  };

  /**
   * 진료과별 색상 (단조로운 그레이 스케일 기반)
   */
  const getDepartmentColor = (department: string) => {
    // 해시 기반으로 일관된 색상 할당 (그레이 스케일 내에서)
    const hash = department.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const grayLevels = [
      'var(--color-gray-500)',
      'var(--color-gray-600)', 
      'var(--color-gray-700)',
      'var(--color-primary)',
      'var(--color-success)',
    ];
    
    return grayLevels[Math.abs(hash) % grayLevels.length];
  };

  if (loading) {
    return (
      <div className="prescription-section">
        <div className="prescription-section__loading">
          <div className="loading-skeleton">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-item">
                <div className="skeleton-line skeleton-line--title"></div>
                <div className="skeleton-line skeleton-line--subtitle"></div>
                <div className="skeleton-line skeleton-line--content"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="prescription-section">
        <div className="prescription-section__empty">
          <div className="empty-icon"></div>
          <h3>처방전이 없습니다</h3>
          <p>필터 조건을 변경하거나 새로운 데이터를 추가해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prescription-section">
      {/* 헤더 */}
      <div className="prescription-section__header">
        <h3 className="prescription-section__title">
          처방전 ({prescriptions.length}건)
        </h3>
      </div>

      {/* 처방전 목록 */}
      <div className="prescription-section__content">
        {prescriptions.map((prescription) => (
          <div
            key={prescription.id}
            className={`prescription-card ${selectedPrescriptions.includes(prescription.id) ? 'prescription-card--selected' : ''}`}
            onClick={() => onPrescriptionClick?.(prescription)}
          >
            {/* 선택 체크박스 */}
            {onSelectionChange && (
              <div className="prescription-card__checkbox">
                <input
                  type="checkbox"
                  checked={selectedPrescriptions.includes(prescription.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectionChange(prescription.id);
                  }}
                />
              </div>
            )}

            {/* 메인 정보 */}
            <div className="prescription-card__main">
              <div className="prescription-card__header">
                <div className="prescription-card__date">
                  {healthConnectService.formatDate(prescription.date)}
                </div>
                <div 
                  className="prescription-card__department"
                  style={{ 
                    backgroundColor: getDepartmentColor(prescription.department || ''),
                    color: 'white'
                  }}
                >
                  {prescription.department}
                </div>
              </div>

              <div className="prescription-card__info">
                <h4 className="prescription-card__hospital">
                  {prescription.hospitalName}
                </h4>
                <p className="prescription-card__doctor">
                  담당의: {prescription.doctorName}
                </p>
                {prescription.diagnosis && (
                  <p className="prescription-card__diagnosis">
                    진단: {prescription.diagnosis}
                  </p>
                )}
              </div>
            </div>

            {/* 처방 의약품 */}
            <div className="prescription-card__medications">
              <h5 className="medications-title">
                처방 의약품 ({prescription.medications.length}개)
              </h5>
              <div className="medications-list">
                {prescription.medications.slice(0, 3).map((medication, index) => (
                  <div key={index} className="medication-item">
                    <div className="medication-info">
                      <span className="medication-name">{medication.name}</span>
                      <span className="medication-dosage">
                        {medication.dosage} | {medication.frequency}
                      </span>
                      <span className="medication-duration">
                        {medication.duration}
                      </span>
                    </div>
                    {medication.totalAmount && (
                      <div className="medication-amount">
                        {medication.totalAmount}정
                      </div>
                    )}
                  </div>
                ))}
                {prescription.medications.length > 3 && (
                  <div className="medication-more">
                    +{prescription.medications.length - 3}개 더
                  </div>
                )}
              </div>
            </div>

            {/* 복용 지침 */}
            {prescription.medications.some(med => med.instructions) && (
              <div className="prescription-card__instructions">
                <h5>복용 지침</h5>
                <ul>
                  {prescription.medications
                    .filter(med => med.instructions)
                    .slice(0, 2)
                    .map((medication, index) => (
                      <li key={index}>
                        <strong>{medication.name}:</strong> {medication.instructions}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* 비용 정보 */}
            {(prescription.totalCost || prescription.insuranceCoverage) && (
              <div className="prescription-card__cost">
                <div className="cost-info">
                  {prescription.totalCost && (
                    <div className="cost-item">
                      <span className="cost-label">총 비용:</span>
                      <span className="cost-value">
                        {formatCost(prescription.totalCost)}
                      </span>
                    </div>
                  )}
                  {prescription.insuranceCoverage && (
                    <div className="cost-item">
                      <span className="cost-label">보험 적용:</span>
                      <span className="cost-value">
                        {formatCost(prescription.insuranceCoverage)}
                      </span>
                    </div>
                  )}
                  {prescription.totalCost && prescription.insuranceCoverage && (
                    <div className="cost-item cost-item--highlight">
                      <span className="cost-label">본인 부담:</span>
                      <span className="cost-value">
                        {formatCost(prescription.totalCost - prescription.insuranceCoverage)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="prescription-card__actions">
              <button className="action-button secondary">
                상세보기
              </button>
              <button className="action-button secondary">
                복용 일정
              </button>
              <button className="action-button secondary">
                공유하기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrescriptionSection;
