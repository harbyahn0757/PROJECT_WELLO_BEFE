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
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  // 약국 방문 추이 데이터
  const prescriptionChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    try {
      const yearlyData: { [year: string]: number } = {};
      
      prescriptionData.forEach((item: any) => {
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        if (!isPharmacy) return;
        
        const year = item.treatment_date ? item.treatment_date.split('-')[0] : '2024';
        
        if (yearlyData[year]) {
          yearlyData[year] += 1;
        } else {
          yearlyData[year] = 1;
        }
      });
      
      const chartData = [{
        id: 'pharmacy-visit-trend',
        name: '년도별 약국 방문 건수',
        yAxisLabel: '방문 건수',
        color: '#FFEAE2', // 주황/피치 계열
        data: Object.entries(yearlyData)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 10)
          .map(([year, count]) => {
            const finalValue = parseInt(count.toString());
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`,
              status: 'normal' as const
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      }];
      
      return chartData.filter(series => series.data.length > 0);
    } catch (error) {
      console.error('❌ [차트변환] 처방 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData]);

  // 병원 방문 추이 데이터
  const hospitalVisitChartData = useMemo(() => {
    if (prescriptionData.length === 0) {
      return [];
    }
    
    try {
      const yearlyData: { [year: string]: Set<string> } = {};
      
      prescriptionData.forEach((item: any) => {
        const treatmentType = item.treatment_type || item.JinRyoHyungTae || '';
        const hospitalName = item.hospital_name || item.ByungEuiwonYakGukMyung || '';
        const isPharmacy = treatmentType === '처방조제' || hospitalName.includes('약국');
        
        if (isPharmacy) return;
        
        let year = '2024';
        if (item.treatment_date) {
          year = item.treatment_date.substring(0, 4);
        } else if (item.TreatDate) {
          year = item.TreatDate.substring(0, 4);
        } else if (item.Year) {
          year = item.Year.replace('년', '');
        }
        
        const hospitalKey = hospitalName || 'Unknown';
        const dateKey = item.treatment_date || item.TreatDate || `${year}-01-01`;
        const visitKey = `${hospitalKey}_${dateKey}`;
        
        if (!yearlyData[year]) {
          yearlyData[year] = new Set();
        }
        yearlyData[year].add(visitKey);
      });
      
      const yearlyVisitCounts: { [year: string]: number } = {};
      Object.entries(yearlyData).forEach(([year, visitSet]) => {
        yearlyVisitCounts[year] = visitSet.size;
      });
      
      const chartData = [{
        id: 'hospital-visit-trend',
        name: '년도별 병원 방문 건수',
        yAxisLabel: '방문 건수',
        color: '#DDF2FF', // 하늘색 계열
        data: Object.entries(yearlyVisitCounts)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 10)
          .map(([year, count]) => {
            const finalValue = parseInt(count.toString());
            if (isNaN(finalValue) || !isFinite(finalValue) || finalValue < 0) {
              return null;
            }

            return {
              date: `${year}-01-01`,
              value: finalValue,
              label: `${year.slice(-2)}년`,
              status: 'normal' as const
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      }];
      
      return chartData.filter(series => series.data.length > 0);
    } catch (error) {
      console.error('❌ [차트변환] 병원 방문 차트 데이터 변환 실패:', error);
      return [];
    }
  }, [prescriptionData]);

  // 닷 인디케이터 스크롤 이벤트 처리
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const handleScroll = () => {
      const scrollLeft = slider.scrollLeft;
      const cardWidth = slider.querySelector('.visit-trend-card')?.clientWidth || 0;
      const currentIndex = Math.round(scrollLeft / (cardWidth + 16)); // 16px는 gap
      setActiveDotIndex(Math.min(currentIndex, 1)); // 최대 2개 카드
    };

    slider.addEventListener('scroll', handleScroll);
    handleScroll(); // 초기 상태 설정

    return () => {
      slider.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="visit-trends-wrapper">
      <div className="visit-trends-header">
        <h2 className="visit-trends-title">의료기관 방문 추이</h2>
      </div>
      <div className="visit-trends-container">
        <div className="visit-trends-slider" ref={sliderRef}>
            {/* 약국 방문 추이 */}
            <div className="visit-trend-card visit-trend-card--pharmacy">
              <div className="trend-header">
                <h3 className="trend-title">약국 방문 추이</h3>
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
                ) : prescriptionChartData.length > 0 && prescriptionChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={prescriptionChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 250) : 280}
                    height={170}
                    showValues={true}
                  />
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
                    <p className="loading-text">처방 데이터가 없습니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* 병원 방문 추이 */}
            <div className="visit-trend-card visit-trend-card--hospital">
              <div className="trend-header">
                <h3 className="trend-title">병원 방문 추이</h3>
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
                    <p className="loading-text">병원 방문 데이터 분석 중...</p>
                  </div>
                ) : hospitalVisitChartData.length > 0 && hospitalVisitChartData[0].data.length > 0 ? (
                  <BarChart 
                    series={hospitalVisitChartData}
                    width={window.innerWidth <= 768 ? Math.min(window.innerWidth * 0.8, 250) : 280}
                    height={170}
                    showValues={true}
                  />
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
                    <p className="loading-text">병원 방문 데이터가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
      
      {/* 닷 인디케이터 */}
      <div className="visit-trends-dots">
        <div 
          className={`dot ${activeDotIndex === 0 ? 'active' : ''}`} 
          onClick={() => {
            if (sliderRef.current) {
              sliderRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            }
          }}
        ></div>
        <div 
          className={`dot ${activeDotIndex === 1 ? 'active' : ''}`} 
          onClick={() => {
            if (sliderRef.current) {
              const card = sliderRef.current.querySelectorAll('.visit-trend-card')[1] as HTMLElement;
              if (card) {
                const cardOffsetLeft = card.offsetLeft;
                const sliderClientWidth = sliderRef.current.clientWidth;
                const cardWidth = card.offsetWidth;
                let targetScrollLeft = cardOffsetLeft - (sliderClientWidth - cardWidth) / 2;
                const maxScrollLeft = sliderRef.current.scrollWidth - sliderRef.current.clientWidth;
                targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
                sliderRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
              }
            }
          }}
        ></div>
      </div>
    </div>
  );
};

export default VisitTrendsChart;

