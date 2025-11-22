/**
 * VisitTrendsChart - 병원/약국 방문 추이 그래프 컴포넌트
 * ComprehensiveAnalysisPage에서 추출한 방문 추이 차트
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import BarChart from '../../charts/BarChart';
import { TilkoPrescriptionRaw } from '../../../types/health';
import { WELLO_LOGO_IMAGE } from '../../../constants/images';
import '../../../pages/ComprehensiveAnalysisPage/styles.scss';
import './styles.scss';

interface VisitTrendsChartProps {
  prescriptionData: TilkoPrescriptionRaw[];
  isLoading?: boolean;
}

const VisitTrendsChart: React.FC<VisitTrendsChartProps> = ({
  prescriptionData = [],
  isLoading = false
}) => {
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
        
        let year = '2024';
        if (item.treatment_date) {
          year = item.treatment_date.substring(0, 4);
        } else if (item.TreatDate) {
          year = item.TreatDate.substring(0, 4);
        } else if (item.Year) {
          year = item.Year.replace('년', '');
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
          const dateKey = item.treatment_date || item.TreatDate || `${year}-01-01`;
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
                    src={WELLO_LOGO_IMAGE} 
                    alt="로딩 중" 
                    className="wello-icon-blink"
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
                    src={WELLO_LOGO_IMAGE} 
                    alt="데이터 없음" 
                    className="wello-icon-blink"
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
    </div>
  );
};

export default VisitTrendsChart;

