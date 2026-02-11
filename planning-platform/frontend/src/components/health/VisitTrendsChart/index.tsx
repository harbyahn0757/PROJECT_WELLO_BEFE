/**
 * VisitTrendsChart - 병원/약국 방문 추이 그래프 컴포넌트
 * ComprehensiveAnalysisPage에서 추출한 방문 추이 차트
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import BarChart from '../../charts/BarChart';
import { TilkoPrescriptionRaw } from '../../../types/health';
import { WELNO_LOGO_IMAGE } from '../../../constants/images';
import '../../../features/health/ComprehensiveAnalysisPage/styles.scss';
import './styles.scss';

interface VisitTrendsChartProps {
  prescriptionData: TilkoPrescriptionRaw[];
  isLoading?: boolean;
}

const VisitTrendsChart: React.FC<VisitTrendsChartProps> = ({
  prescriptionData = [],
  isLoading = false
}) => {
  // 일자별 방문 히스토리 데이터 그룹화 (중복 제거)
  const visitHistoryByDate = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    const grouped: { [date: string]: Map<string, any> } = {};
    
    prescriptionData.forEach((item: any) => {
      const treatmentDate = item.treatment_date || item.TreatDate || item.JinRyoGaesiIl;
      if (treatmentDate) {
        // 날짜 형식 정규화 (YYYY-MM-DD)
        let dateKey = '';
        if (treatmentDate.includes('-')) {
          dateKey = treatmentDate.substring(0, 10); // YYYY-MM-DD
        } else if (treatmentDate.length >= 8) {
          // YYYYMMDD 형식
          const year = treatmentDate.substring(0, 4);
          const month = treatmentDate.substring(4, 6);
          const day = treatmentDate.substring(6, 8);
          dateKey = `${year}-${month}-${day}`;
        } else {
          return; // 유효하지 않은 날짜 형식
        }
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = new Map();
        }
        
        // 중복 제거: 병원명 + 날짜 + 처방전 정보로 고유 키 생성
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const uniqueKey = `${hospitalName}_${treatmentType}_${dateKey}`;
        
        // 이미 같은 키가 있으면 더 최신 데이터로 업데이트 (또는 병합)
        if (!grouped[dateKey].has(uniqueKey)) {
          grouped[dateKey].set(uniqueKey, item);
        } else {
          // 중복 발견 - 더 많은 정보가 있는 항목으로 교체
          const existing = grouped[dateKey].get(uniqueKey);
          const existingInfoCount = [
            existing.visit_count,
            existing.prescription_count,
            existing.medication_count
          ].filter(v => v > 0).length;
          const newInfoCount = [
            item.visit_count,
            item.prescription_count,
            item.medication_count
          ].filter(v => v > 0).length;
          
          if (newInfoCount > existingInfoCount) {
            grouped[dateKey].set(uniqueKey, item);
          }
        }
      }
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a)) // 최신 날짜 순
      .map(([date, itemsMap]) => ({ 
        date, 
        items: Array.from(itemsMap.values()) // Map을 배열로 변환
      }));
  }, [prescriptionData]);
  
  // 약국과 병원 데이터를 하나로 합친 차트 데이터
  const combinedChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    try {
      // 약국 데이터
      const pharmacyYearlyData: { [year: string]: number } = {};
      // 병원 데이터
      const hospitalYearlyData: { [year: string]: Set<string> } = {};
      
      prescriptionData.forEach((item: any) => {
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        // 년도 추출 (양쪽 필드명 지원)
        let year = '2024';
        const treatmentDate = item.treatment_date || item.TreatDate || item.JinRyoGaesiIl;
        if (treatmentDate) {
          // YYYY-MM-DD 형식 또는 YYYYMMDD 형식
          if (treatmentDate.includes('-')) {
            year = treatmentDate.substring(0, 4);
          } else if (treatmentDate.length >= 4) {
            year = treatmentDate.substring(0, 4);
          }
        } else if (item.Year) {
          year = item.Year.toString().replace('년', '');
        }
        
        if (isPharmacy) {
          // 약국 데이터
          if (pharmacyYearlyData[year]) {
            pharmacyYearlyData[year] += 1;
          } else {
            pharmacyYearlyData[year] = 1;
          }
        } else {
          // 병원 데이터
          const hospitalKey = hospitalName || 'Unknown';
          const dateKey = treatmentDate || `${year}-01-01`;
          const visitKey = `${hospitalKey}_${dateKey}`;
          
          if (!hospitalYearlyData[year]) {
            hospitalYearlyData[year] = new Set();
          }
          hospitalYearlyData[year].add(visitKey);
        }
      });
      
      // 병원 방문 건수로 변환
      const hospitalYearlyVisitCounts: { [year: string]: number } = {};
      Object.entries(hospitalYearlyData).forEach(([year, visitSet]) => {
        hospitalYearlyVisitCounts[year] = visitSet.size;
      });
      
      // 모든 연도 수집
      const allYears = Array.from(new Set([
        ...Object.keys(pharmacyYearlyData),
        ...Object.keys(hospitalYearlyVisitCounts)
      ])).sort((a, b) => b.localeCompare(a)).slice(0, 10);
      
      // 약국 시리즈
      const pharmacySeries = {
        id: 'pharmacy-visit-trend',
        name: '약국',
        yAxisLabel: '방문 건수',
        color: '#FFEAE2', // 주황/피치 계열
        data: allYears.map(year => {
          const count = pharmacyYearlyData[year] || 0;
          return {
            date: `${year}-01-01`,
            value: count,
            label: `${year.slice(-2)}년`,
            status: 'normal' as const
          };
        }).filter(item => item.value > 0)
      };
      
      // 병원 시리즈
      const hospitalSeries = {
        id: 'hospital-visit-trend',
        name: '병원',
        yAxisLabel: '방문 건수',
        color: '#DDF2FF', // 하늘색 계열
        data: allYears.map(year => {
          const count = hospitalYearlyVisitCounts[year] || 0;
          return {
            date: `${year}-01-01`,
            value: count,
            label: `${year.slice(-2)}년`,
            status: 'normal' as const
          };
        }).filter(item => item.value > 0)
      };
      
      return [pharmacySeries, hospitalSeries].filter(series => series.data.length > 0);
    } catch (error) {
      console.error('❌ [차트변환] 방문 추이 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData]);

  return (
    <div className="visit-trends-wrapper">
      <div className="visit-trends-header">
        <h2 className="visit-trends-title">의료기관 방문 추이</h2>
      </div>
      <div className="visit-trends-container">
        <div className="visit-trend-card visit-trend-card--combined">
          <div className="trend-header">
            <h3 className="trend-title">병원 및 약국 방문 건 수</h3>
          </div>
          <div className="trend-chart">
            {isLoading ? (
              <div className="chart-loading">
                <div className="loading-spinner">
                  <img 
                    src={WELNO_LOGO_IMAGE} 
                    alt="로딩 중" 
                    className="welno-icon-blink"
                  />
                </div>
                <p className="loading-text">처방 데이터 분석 중...</p>
              </div>
            ) : combinedChartData.length > 0 ? (
              <>
                <BarChart 
                  series={combinedChartData}
                  width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.9, 300) : 320}
                  height={180}
                  showValues={true}
                  groupBy="series"
                />
                {/* 범례 */}
                <div className="visit-trends-legend">
                  {combinedChartData.map((series) => (
                    <div key={series.id} className="legend-item">
                      <div 
                        className="legend-color" 
                        style={{ backgroundColor: series.color }}
                      ></div>
                      <span className="legend-label">{series.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="chart-loading">
                <div className="loading-spinner">
                  <img 
                    src={WELNO_LOGO_IMAGE} 
                    alt="데이터 없음" 
                    className="welno-icon-blink"
                    style={{ opacity: 0.5, animation: 'none' }}
                  />
                </div>
                <p className="loading-text">방문 데이터가 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="visit-history-header">
        <h3 className="visit-history-title">일자별 방문 히스토리</h3>
      </div>
      
      {/* 일자별 방문 히스토리 리스트 */}
      {visitHistoryByDate.length > 0 ? (
        <div className="visit-history-list">
          {visitHistoryByDate.map(({ date, items }) => {
            // 날짜별 통계 계산
            const pharmacyCount = items.filter((item: any) => {
              const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
              const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
              return treatmentType === '처방조제' || hospitalName.includes('약국');
            }).length;
            
            const hospitalCount = items.length - pharmacyCount;
            const totalVisitCount = items.reduce((sum: number, item: any) => {
              return sum + (item.visit_count || 0);
            }, 0);
            const totalPrescriptionCount = items.reduce((sum: number, item: any) => {
              return sum + (item.prescription_count || 0);
            }, 0);
            
            return (
              <div key={date} className="visit-history-item">
                <div className="visit-history-date">
                  {new Date(date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="visit-history-details">
                  {items.map((item: any, idx: number) => {
                    const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
                    const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
                    const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
                    
                    return (
                      <div key={idx} className={`visit-history-entry ${isPharmacy ? 'pharmacy' : 'hospital'}`}>
                        <div className="visit-entry-header">
                          <span className="visit-entry-type">{isPharmacy ? '약국' : '병원'}</span>
                          <span className="visit-entry-name">{hospitalName}</span>
                        </div>
                        <div className="visit-entry-stats">
                          {item.visit_count > 0 && (
                            <span className="visit-stat">방문 {item.visit_count}회</span>
                          )}
                          {item.prescription_count > 0 && (
                            <span className="visit-stat">처방 {item.prescription_count}회</span>
                          )}
                          {item.medication_count > 0 && (
                            <span className="visit-stat">투약 {item.medication_count}회</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="visit-history-summary">
                  {pharmacyCount > 0 && <span className="summary-item">약국 {pharmacyCount}건</span>}
                  {hospitalCount > 0 && <span className="summary-item">병원 {hospitalCount}건</span>}
                  {totalVisitCount > 0 && <span className="summary-item">총 방문 {totalVisitCount}회</span>}
                  {totalPrescriptionCount > 0 && <span className="summary-item">총 처방 {totalPrescriptionCount}회</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="visit-history-empty">
          <p>방문 기록이 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default VisitTrendsChart;

