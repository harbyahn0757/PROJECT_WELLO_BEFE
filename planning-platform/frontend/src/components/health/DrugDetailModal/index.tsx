/**
 * 약품 상세정보 모달 컴포넌트
 * 처방전에서 약품 클릭 시 상세 정보를 표시
 */
import React, { useState } from 'react';
import './styles.scss';

interface DrugDetailInfo {
  DrugCode: string;
  MediPrdcNm: string;
  DrugImage?: string;
  EfftEftCnte?: string;
  UsagCpctCnte?: string;
  UseAtntMttCnte?: string;
  CmnTmdcGdncCnte?: string;
  MdctPathXplnCnte?: string;
  MohwClsfNoXplnCnte?: string;
  UpsoName?: string;
  CmpnInfo?: string;
  AtcInfo?: string;
  FomlCdXplnCnte?: string;
  TmsgGnlSpcd?: string;
}

interface DrugDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  drugInfo: DrugDetailInfo | null;
  medicationData?: {
    ChoBangYakPumMyung?: string;
    ChoBangYakPumHyoneung?: string;
    TuyakIlSoo?: string;
    OnceIlHoiTuyakRyang?: string;
    OneDayTuyakHoiSoo?: string;
    ChongTuyakRyang?: string;
  };
}

const DrugDetailModal: React.FC<DrugDetailModalProps> = ({
  isOpen,
  onClose,
  drugInfo,
  medicationData
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'usage' | 'caution' | 'component'>('basic');

  if (!isOpen || !drugInfo) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="tab-content">
            <div className="drug-image-section">
              {drugInfo.DrugImage && (
                <div className="drug-image-container">
                  <img 
                    src={`data:image/jpeg;base64,${drugInfo.DrugImage}`}
                    alt={drugInfo.MediPrdcNm}
                    className="drug-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="basic-info">
              <div className="info-row">
                <span className="info-label">제품명</span>
                <span className="info-value">{drugInfo.MediPrdcNm}</span>
              </div>
              
              {drugInfo.UpsoName && (
                <div className="info-row">
                  <span className="info-label">제조회사</span>
                  <span className="info-value">{drugInfo.UpsoName}</span>
                </div>
              )}
              
              {drugInfo.MohwClsfNoXplnCnte && (
                <div className="info-row">
                  <span className="info-label">분류</span>
                  <span className="info-value">{drugInfo.MohwClsfNoXplnCnte}</span>
                </div>
              )}
              
              {drugInfo.FomlCdXplnCnte && (
                <div className="info-row">
                  <span className="info-label">제형</span>
                  <span className="info-value">{drugInfo.FomlCdXplnCnte}</span>
                </div>
              )}
              
              {drugInfo.MdctPathXplnCnte && (
                <div className="info-row">
                  <span className="info-label">복용경로</span>
                  <span className="info-value">{drugInfo.MdctPathXplnCnte}</span>
                </div>
              )}
              
              {drugInfo.EfftEftCnte && (
                <div className="info-section">
                  <h4 className="section-title">효능·효과</h4>
                  <p className="section-content">{drugInfo.EfftEftCnte}</p>
                </div>
              )}
              
              {medicationData && (
                <div className="prescription-info">
                  <h4 className="section-title">처방 정보</h4>
                  {medicationData.TuyakIlSoo && (
                    <div className="info-row">
                      <span className="info-label">투약일수</span>
                      <span className="info-value">{medicationData.TuyakIlSoo}일</span>
                    </div>
                  )}
                  {medicationData.OnceIlHoiTuyakRyang && (
                    <div className="info-row">
                      <span className="info-label">1회 투약량</span>
                      <span className="info-value">{medicationData.OnceIlHoiTuyakRyang}</span>
                    </div>
                  )}
                  {medicationData.OneDayTuyakHoiSoo && (
                    <div className="info-row">
                      <span className="info-label">1일 투약횟수</span>
                      <span className="info-value">{medicationData.OneDayTuyakHoiSoo}회</span>
                    </div>
                  )}
                  {medicationData.ChongTuyakRyang && (
                    <div className="info-row">
                      <span className="info-label">총 투약량</span>
                      <span className="info-value">{medicationData.ChongTuyakRyang}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'usage':
        return (
          <div className="tab-content">
            {drugInfo.UsagCpctCnte && (
              <div className="usage-content">
                <h4 className="section-title">용법·용량</h4>
                <div className="content-text">{drugInfo.UsagCpctCnte}</div>
              </div>
            )}
            
            {drugInfo.CmnTmdcGdncCnte && (
              <div className="guidance-content">
                <h4 className="section-title">복용 가이드</h4>
                <div className="content-text guidance-text">{drugInfo.CmnTmdcGdncCnte}</div>
              </div>
            )}
          </div>
        );
        
      case 'caution':
        return (
          <div className="tab-content">
            {drugInfo.UseAtntMttCnte && (
              <div className="caution-content">
                <h4 className="section-title">사용상 주의사항</h4>
                <div className="content-text caution-text">{drugInfo.UseAtntMttCnte}</div>
              </div>
            )}
          </div>
        );
        
      case 'component':
        return (
          <div className="tab-content">
            {drugInfo.CmpnInfo && (
              <div className="component-content">
                <h4 className="section-title">성분정보</h4>
                <div className="content-text">{drugInfo.CmpnInfo}</div>
              </div>
            )}
            
            {drugInfo.AtcInfo && (
              <div className="atc-content">
                <h4 className="section-title">ATC 분류</h4>
                <div className="content-text">{drugInfo.AtcInfo}</div>
              </div>
            )}
            
            {drugInfo.DrugCode && (
              <div className="code-content">
                <h4 className="section-title">약품코드</h4>
                <div className="content-text code-text">{drugInfo.DrugCode}</div>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="drug-detail-modal-overlay" onClick={onClose}>
      <div className="drug-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{drugInfo.MediPrdcNm}</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-tabs">
          <button 
            className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            기본정보
          </button>
          <button 
            className={`tab-button ${activeTab === 'usage' ? 'active' : ''}`}
            onClick={() => setActiveTab('usage')}
          >
            용법·용량
          </button>
          <button 
            className={`tab-button ${activeTab === 'caution' ? 'active' : ''}`}
            onClick={() => setActiveTab('caution')}
          >
            주의사항
          </button>
          <button 
            className={`tab-button ${activeTab === 'component' ? 'active' : ''}`}
            onClick={() => setActiveTab('component')}
          >
            성분정보
          </button>
        </div>
        
        <div className="modal-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default DrugDetailModal;
