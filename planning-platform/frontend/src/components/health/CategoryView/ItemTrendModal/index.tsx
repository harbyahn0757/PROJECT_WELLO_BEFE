/**
 * ItemTrendModal - 항목별 추이 차트 모달
 * 특정 항목의 연도별 추이를 LineChart로 표시
 */
import React, { useMemo } from 'react';
import { TilkoHealthCheckupRaw } from '../../../../types/health';
import LineChart from '../../../charts/LineChart';
import './styles.scss';

interface ItemTrendModalProps {
  itemName: string;
  healthData: TilkoHealthCheckupRaw[];
  onClose: () => void;
  patientName?: string;
  showRangeIndicator?: boolean;
}

const ItemTrendModal: React.FC<ItemTrendModalProps> = ({
  itemName,
  healthData,
  onClose,
  patientName,
  showRangeIndicator = true
}) => {
  // 항목별 단위 결정
  const getUnitForMetric = (metric: string): string => {
    const metricLower = metric.toLowerCase();
    if (metricLower.includes('신장')) return 'cm';
    if (metricLower.includes('체중')) return 'kg';
    if (metricLower.includes('bmi') || metricLower.includes('체질량')) return 'kg/m²';
    if (metricLower.includes('허리')) return 'cm';
    if (metricLower.includes('혈압')) return 'mmHg';
    if (metricLower.includes('혈당')) return 'mg/dL';
    if (metricLower.includes('콜레스테롤')) return 'mg/dL';
    if (metricLower.includes('중성지방')) return 'mg/dL';
    if (metricLower.includes('헤모글로빈')) return 'g/dL';
    return '';
  };
  
  // 차트 데이터 추출
  const chartData = useMemo(() => {
    const dataPoints: { date: string; value: number }[] = [];
    
    // 연도별 데이터 수집
    healthData.forEach(record => {
      let foundValue: number | null = null;
      
      // Inspections 순회
      if (record.Inspections && Array.isArray(record.Inspections)) {
        for (const inspection of record.Inspections) {
          if (inspection.Illnesses && Array.isArray(inspection.Illnesses)) {
            for (const illness of inspection.Illnesses) {
              if (illness.Items && Array.isArray(illness.Items)) {
                const item = illness.Items.find(i => i.Name === itemName);
                if (item) {
                  const value = parseFloat(item.Value);
                  if (!isNaN(value)) {
                    foundValue = value;
                    break;
                  }
                }
              }
            }
          }
          if (foundValue !== null) break;
        }
      }
      
      if (foundValue !== null) {
        dataPoints.push({
          date: record.Year.replace('년', ''),
          value: foundValue
        });
      }
    });
    
    // 연도 순으로 정렬 후 LineChart 형식으로 변환
    const sorted = dataPoints.sort((a, b) => parseInt(a.date) - parseInt(b.date));
    
    return [{
      id: itemName,
      name: itemName,
      data: sorted,
      showPoints: true,
      showArea: false
    }];
  }, [healthData, itemName]);
  
  const unit = getUnitForMetric(itemName);
  
  return (
    <div className="item-trend-modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">
            {patientName ? `${patientName}님의 ` : ''}
            {itemName} 추이
          </h3>
          <button 
            className="modal-close" 
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          {chartData.length > 0 && chartData[0].data.length > 0 ? (
            <>
              <LineChart 
                series={chartData}
              />
              
              {showRangeIndicator && (
                <div className="health-range-indicator">
                  <p className="range-note">
                    ※ 정상 범위는 연령, 성별에 따라 다를 수 있습니다.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="modal-empty">
              <p>추이 데이터가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemTrendModal;
