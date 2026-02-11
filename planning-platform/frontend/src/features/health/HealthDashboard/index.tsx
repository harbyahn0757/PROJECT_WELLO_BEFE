/**
 * HealthDashboard - 건강 대시보드 메인 페이지
 * 위젯 기반 모듈화된 대시보드
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalSessionDetection from '../../../hooks/useGlobalSessionDetection';
import LineChart from '../../../components/charts/LineChart';
import BarChart from '../../../components/charts/BarChart';
import PieChart from '../../../components/charts/PieChart';
import { 
  transformHealthDataForLineChart,
  transformHealthDataForBarChart,
  transformHealthDataByHospital,
  getHealthStatusDistribution
} from '../../../utils/healthDataTransformers';
import { TilkoHealthCheckupRaw } from '../../../types/health';
import './styles.scss';

interface DashboardStats {
  totalCheckups: number;
  latestCheckup?: {
    date: string;
    location: string;
    status: string;
  };
  healthTrends: {
    improving: number;
    stable: number;
    concerning: number;
  };
}

const HealthDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<TilkoHealthCheckupRaw[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // 전역 세션 감지 (진행 중인 인증/수집 세션이 있으면 적절한 화면으로 리다이렉트)
  useGlobalSessionDetection({ enabled: true });

  // 데이터 로드
  useEffect(() => {
    const loadHealthData = () => {
      try {
        // localStorage에서 건강 데이터 로드
        const storedData = localStorage.getItem('welno_health_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          const healthCheckups = parsedData.health_data?.ResultList || [];
          
          setHealthData(healthCheckups);
          
          // 통계 계산
          const totalCheckups = healthCheckups.length;
          const latestCheckup = healthCheckups.length > 0 ? {
            date: `${healthCheckups[0].Year} ${healthCheckups[0].CheckUpDate}`,
            location: healthCheckups[0].Location,
            status: healthCheckups[0].Code
          } : undefined;

          // 건강 추이 분석 (간단한 예시)
          const statusDistribution = getHealthStatusDistribution(healthCheckups);
          const healthTrends = {
            improving: statusDistribution.find(s => s.label === '정상')?.value || 0,
            stable: statusDistribution.find(s => s.label === '주의')?.value || 0,
            concerning: statusDistribution.find(s => s.label === '위험')?.value || 0
          };

          setStats({
            totalCheckups,
            latestCheckup,
            healthTrends
          });
        }
      } catch (error) {
        console.error('건강 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, []);

  // 차트 데이터 생성
  const lineChartData = healthData.length > 0 ? transformHealthDataForLineChart(healthData) : [];
  const barChartData = healthData.length > 0 ? transformHealthDataForBarChart(healthData, ['공복혈당', '총콜레스테롤', '혈압(최고/최저)']) : [];
  const pieChartData = healthData.length > 0 ? getHealthStatusDistribution(healthData) : [];

  if (loading) {
    return (
      <div className="health-dashboard health-dashboard--loading">
        <div className="health-dashboard__loading">
          <div className="loading-spinner" />
          <p>건강 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!healthData.length) {
    return (
      <div className="health-dashboard health-dashboard--empty">
        <div className="health-dashboard__empty">
          <div className="empty-icon"></div>
          <h2>건강 데이터가 없습니다</h2>
          <p>먼저 건강검진 데이터를 연동해주세요.</p>
          <button 
            className="welno-button welno-button-primary"
            onClick={() => navigate('/login')}
          >
            건강정보 연동하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="health-dashboard">
      {/* 헤더 */}
      <div className="health-dashboard__header">
        <div className="health-dashboard__title">
          <h1>건강 대시보드</h1>
          <p>나의 건강 상태를 한눈에 확인하세요</p>
        </div>
        <div className="health-dashboard__actions">
          <button 
            className="welno-button welno-button-secondary"
            onClick={() => navigate('/results-trend')}
          >
            상세 보기
          </button>
        </div>
      </div>

      {/* 통계 위젯 */}
      {stats && (
        <div className="health-dashboard__stats">
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--checkups"></div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.totalCheckups}</div>
              <div className="stat-card__label">총 검진 횟수</div>
            </div>
          </div>

          {stats.latestCheckup && (
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--latest"></div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.latestCheckup.date}</div>
                <div className="stat-card__label">최근 검진</div>
                <div className="stat-card__meta">{stats.latestCheckup.location}</div>
              </div>
            </div>
          )}

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--trends"></div>
            <div className="stat-card__content">
              <div className="stat-card__trends">
                <div className="trend-item trend-item--improving">
                  <span className="trend-value">{stats.healthTrends.improving}</span>
                  <span className="trend-label">정상</span>
                </div>
                <div className="trend-item trend-item--stable">
                  <span className="trend-value">{stats.healthTrends.stable}</span>
                  <span className="trend-label">주의</span>
                </div>
                <div className="trend-item trend-item--concerning">
                  <span className="trend-value">{stats.healthTrends.concerning}</span>
                  <span className="trend-label">위험</span>
                </div>
              </div>
              <div className="stat-card__label">건강 상태 분포</div>
            </div>
          </div>
        </div>
      )}

      {/* 차트 위젯 */}
      <div className="health-dashboard__charts">
        {/* 건강 상태 분포 파이 차트 */}
        {pieChartData.length > 0 && (
          <div className="chart-widget chart-widget--pie">
            <PieChart
              title="건강 상태 분포"
              subtitle="검진 결과별 비율"
              data={pieChartData}
              innerRadius={0.4}
              height={300}
              showLegend={true}
              onSliceClick={(slice: any) => {
                console.log('파이 차트 클릭:', slice);
              }}
            />
          </div>
        )}

        {/* 주요 수치 추이 라인 차트 */}
        {lineChartData.length > 0 && (
          <div className="chart-widget chart-widget--line">
            <LineChart
              title="주요 건강 수치 추이"
              subtitle="시간에 따른 변화"
              series={lineChartData.slice(0, 3)} // 상위 3개 지표만 표시
              height={300}
              showGrid={true}
              showReferenceLines={true}
              xAxisLabel="검진 날짜"
              yAxisLabel="수치"
              onPointHover={(point: any, series: any) => {
                console.log('라인 차트 포인트 호버:', point, series);
              }}
            />
          </div>
        )}

        {/* 주요 지표 비교 바 차트 */}
        {barChartData.length > 0 && (
          <div className="chart-widget chart-widget--bar">
            <BarChart
              title="주요 지표 비교"
              subtitle="연도별 수치 변화"
              series={barChartData}
              height={300}
              orientation="vertical"
              showValues={true}
              showReferenceLines={true}
              xAxisLabel="연도"
              yAxisLabel="수치"
              onBarClick={(point: any, series: any) => {
                console.log('바 차트 클릭:', point, series);
              }}
            />
          </div>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="health-dashboard__actions-panel">
        <h3>빠른 액션</h3>
        <div className="action-grid">
          <button 
            className="action-card"
            onClick={() => navigate('/results-trend')}
          >
            <div className="action-card__icon action-card__icon--trends"></div>
            <div className="action-card__content">
              <div className="action-card__title">건강 추이 분석</div>
              <div className="action-card__description">시계열 데이터 기반 상세 분석</div>
            </div>
          </button>

          <button 
            className="action-card"
            onClick={() => navigate('/results-trend')}
          >
            <div className="action-card__icon action-card__icon--history"></div>
            <div className="action-card__content">
              <div className="action-card__title">검진 이력</div>
              <div className="action-card__description">전체 검진 기록 보기</div>
            </div>
          </button>

          <button 
            className="action-card"
            onClick={() => {
              // 데이터 새로고침 로직
              window.location.reload();
            }}
          >
            <div className="action-card__icon action-card__icon--refresh"></div>
            <div className="action-card__content">
              <div className="action-card__title">데이터 새로고침</div>
              <div className="action-card__description">최신 건강정보 업데이트</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HealthDashboard;
