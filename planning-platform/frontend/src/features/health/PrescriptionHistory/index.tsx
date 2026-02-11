/**
 * PrescriptionHistory - 처방전 히스토리 관리 페이지
 * 병원별, 기간별 처방전 이력 관리 및 검색
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGlobalSessionDetection from '../../../hooks/useGlobalSessionDetection';
import AdvancedSearch from '../../../components/search/AdvancedSearch';
import BarChart from '../../../components/charts/BarChart';
import { useSavedFilters } from '../../../hooks/useSavedFilters';
import { 
  transformPrescriptionDataForBarChart 
} from '../../../utils/healthDataTransformers';
import { TilkoPrescriptionRaw, FilterState, PrescriptionFilter } from '../../../types/health';
import './styles.scss';

interface PrescriptionStats {
  totalPrescriptions: number;
  uniqueHospitals: number;
  totalMedications: number;
  recentPrescription?: {
    date: string;
    hospital: string;
    medicationCount: number;
  };
}

const PrescriptionHistory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  // 전역 세션 감지
  useGlobalSessionDetection({ enabled: true });
  const [prescriptionData, setPrescriptionData] = useState<TilkoPrescriptionRaw[]>([]);
  const [stats, setStats] = useState<PrescriptionStats | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    startDate: '',
    endDate: '',
    hospitalName: '',
    department: ''
  });
  const [selectedView, setSelectedView] = useState<'list' | 'chart' | 'timeline'>('list');

  const {
    savedFilters,
    saveFilter,
    deleteFilter,
    toggleFavorite,
    loadFilter
  } = useSavedFilters();

  // 데이터 로드
  useEffect(() => {
    const loadPrescriptionData = async () => {
      try {
        // 1. IndexedDB 우선 확인
        try {
          const { WelnoIndexedDB } = await import('../../../services/WelnoIndexedDB');
          const urlParams = new URLSearchParams(location.search);
          const uuid = urlParams.get('uuid') || 'default';
          const indexedData = await WelnoIndexedDB.getHealthData(uuid);
          
          if (indexedData && indexedData.prescriptionData && indexedData.prescriptionData.length > 0) {
            console.log('[PrescriptionHistory] IndexedDB에서 데이터 로드:', indexedData.prescriptionData.length, '건');
            processPrescriptions(indexedData.prescriptionData);
            setLoading(false);
            return;
          }
        } catch (dbError) {
          console.warn('[PrescriptionHistory] IndexedDB 조회 실패:', dbError);
        }

        // 2. 폴백으로 localStorage 확인
        const storedData = localStorage.getItem('welno_health_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          const prescriptions = parsedData.prescription_data?.ResultList || [];
          if (prescriptions.length > 0) {
            console.log('[PrescriptionHistory] localStorage에서 데이터 로드 (폴백):', prescriptions.length, '건');
            processPrescriptions(prescriptions);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('처방전 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    const processPrescriptions = (prescriptions: TilkoPrescriptionRaw[]) => {
      setPrescriptionData(prescriptions);
      
      // 통계 계산
      const totalPrescriptions = prescriptions.length;
      const uniqueHospitals = new Set(prescriptions.map((p: TilkoPrescriptionRaw) => p.ByungEuiwonYakGukMyung)).size;
      const totalMedications = prescriptions.reduce((sum: number, p: TilkoPrescriptionRaw) => {
        return sum + (p.RetrieveTreatmentInjectionInformationPersonDetailList?.length || 0);
      }, 0);

      const recentPrescription = prescriptions.length > 0 ? {
        date: prescriptions[0].JinRyoGaesiIl,
        hospital: prescriptions[0].ByungEuiwonYakGukMyung,
        medicationCount: prescriptions[0].RetrieveTreatmentInjectionInformationPersonDetailList?.length || 0
      } : undefined;

      setStats({
        totalPrescriptions,
        uniqueHospitals,
        totalMedications,
        recentPrescription
      });
    };

    loadPrescriptionData();
  }, [location.search]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return prescriptionData.filter(prescription => {
      // 검색어 필터
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const hospitalMatch = prescription.ByungEuiwonYakGukMyung.toLowerCase().includes(searchTerm);
        const addressMatch = prescription.Address?.toLowerCase().includes(searchTerm);
        const medicationMatch = prescription.RetrieveTreatmentInjectionInformationPersonDetailList?.some(
          (med: any) => med.ChoBangYakPumMyung?.toLowerCase().includes(searchTerm)
        );
        
        if (!hospitalMatch && !addressMatch && !medicationMatch) {
          return false;
        }
      }

      // 병원명 필터
      if (filters.hospitalName) {
        if (!prescription.ByungEuiwonYakGukMyung.toLowerCase().includes(filters.hospitalName.toLowerCase())) {
          return false;
        }
      }

      // 기간 필터
      if (filters.startDate || filters.endDate) {
        const prescriptionDate = new Date(prescription.JinRyoGaesiIl);
        
        if (filters.startDate && prescriptionDate < new Date(filters.startDate)) {
          return false;
        }
        
        if (filters.endDate && prescriptionDate > new Date(filters.endDate)) {
          return false;
        }
      }

      return true;
    });
  }, [prescriptionData, filters]);

  // 차트 데이터 생성
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];
    return transformPrescriptionDataForBarChart(filteredData);
  }, [filteredData]);

  // 병원별 그룹화
  const groupedByHospital = useMemo(() => {
    const groups: Record<string, TilkoPrescriptionRaw[]> = {};
    
    filteredData.forEach(prescription => {
      const hospital = prescription.ByungEuiwonYakGukMyung;
      if (!groups[hospital]) {
        groups[hospital] = [];
      }
      groups[hospital].push(prescription);
    });

    return Object.entries(groups)
      .map(([hospital, prescriptions]) => ({
        hospital,
        prescriptions,
        totalCount: prescriptions.length,
        totalMedications: prescriptions.reduce((sum, p) => 
          sum + (p.RetrieveTreatmentInjectionInformationPersonDetailList?.length || 0), 0
        ),
        latestDate: prescriptions.reduce((latest, p) => 
          p.JinRyoGaesiIl > latest ? p.JinRyoGaesiIl : latest, ''
        )
      }))
      .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  }, [filteredData]);

  // 검색 처리
  const handleSearch = (searchTerm: string) => {
    setFilters((prev: any) => ({ ...prev, searchTerm }));
  };

  // 필터 로드 처리
  const handleLoadFilter = (savedFilter: any) => {
    const loadedFilters = loadFilter(savedFilter);
    setFilters(loadedFilters);
  };

  if (loading) {
    return (
      <div className="prescription-history prescription-history--loading">
        <div className="prescription-history__loading">
          <div className="loading-spinner" />
          <p>처방전 이력을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!prescriptionData.length) {
    return (
      <div className="prescription-history prescription-history--empty">
        <div className="prescription-history__empty">
          <div className="empty-icon"></div>
          <h2>처방전 데이터가 없습니다</h2>
          <p>먼저 건강정보를 연동하여 처방전 데이터를 가져와주세요.</p>
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
    <div className="prescription-history">
      {/* 헤더 */}
      <div className="prescription-history__header">
        <div className="prescription-history__title">
          <button 
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← 뒤로
          </button>
          <h1>처방전 히스토리</h1>
          <p>병원별, 기간별 처방전 이력을 관리합니다</p>
        </div>

        <div className="view-selector">
          <button
            className={`view-button ${selectedView === 'list' ? 'active' : ''}`}
            onClick={() => setSelectedView('list')}
          >
            목록
          </button>
          <button
            className={`view-button ${selectedView === 'chart' ? 'active' : ''}`}
            onClick={() => setSelectedView('chart')}
          >
            차트
          </button>
          <button
            className={`view-button ${selectedView === 'timeline' ? 'active' : ''}`}
            onClick={() => setSelectedView('timeline')}
          >
            타임라인
          </button>
        </div>
      </div>

      {/* 통계 위젯 */}
      {stats && (
        <div className="prescription-history__stats">
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--prescriptions"></div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.totalPrescriptions}</div>
              <div className="stat-card__label">총 처방전 수</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--hospitals"></div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.uniqueHospitals}</div>
              <div className="stat-card__label">이용 병원 수</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--medications"></div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.totalMedications}</div>
              <div className="stat-card__label">총 처방 약품 수</div>
            </div>
          </div>

          {stats.recentPrescription && (
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--recent"></div>
              <div className="stat-card__content">
                <div className="stat-card__value">{stats.recentPrescription.date}</div>
                <div className="stat-card__label">최근 처방</div>
                <div className="stat-card__meta">{stats.recentPrescription.hospital}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="prescription-history__search">
        <AdvancedSearch
          filters={filters}
          onFilterChange={setFilters}
          onSearch={handleSearch}
          savedFilters={savedFilters}
          onSaveFilter={saveFilter}
          onLoadFilter={handleLoadFilter}
          onDeleteFilter={deleteFilter}
          onToggleFavorite={toggleFavorite}
          placeholder="병원명, 약품명으로 검색..."
          showQuickFilters={true}
        />
      </div>

      {/* 콘텐츠 영역 */}
      <div className="prescription-history__content">
        {selectedView === 'list' && (
          <div className="prescription-list">
            <div className="prescription-list__header">
              <h3>병원별 처방전 이력 ({filteredData.length}건)</h3>
            </div>
            
            <div className="hospital-groups">
              {groupedByHospital.map((group, index) => (
                <div key={index} className="hospital-group">
                  <div className="hospital-group__header">
                    <h4>{group.hospital}</h4>
                    <div className="hospital-group__stats">
                      <span className="stat">처방전 {group.totalCount}건</span>
                      <span className="stat">약품 {group.totalMedications}개</span>
                      <span className="stat">최근 {group.latestDate}</span>
                    </div>
                  </div>
                  
                  <div className="prescription-items">
                    {group.prescriptions.map((prescription, prescIndex) => (
                      <div key={prescIndex} className="prescription-item">
                        <div className="prescription-item__header">
                          <div className="prescription-date">{prescription.JinRyoGaesiIl}</div>
                          <div className="prescription-type">{prescription.JinRyoHyungTae}</div>
                        </div>
                        
                        <div className="prescription-item__details">
                          <div className="prescription-counts">
                            <span>방문 {prescription.BangMoonIpWonIlsoo}회</span>
                            <span>처방 {prescription.CheoBangHoiSoo}회</span>
                            <span>투약 {prescription.TuYakYoYangHoiSoo}회</span>
                          </div>
                          
                          {prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
                           prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0 && (
                            <div className="medication-list">
                              <div className="medication-list__header">처방 약품:</div>
                              <div className="medications">
                                {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.slice(0, 3).map((med: any, medIndex: number) => (
                                  <div key={medIndex} className="medication">
                                    <span className="medication-name">{med.ChoBangYakPumMyung}</span>
                                    {med.TuyakIlSoo && <span className="medication-days">{med.TuyakIlSoo}일분</span>}
                                  </div>
                                ))}
                                {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 3 && (
                                  <div className="medication more">
                                    +{prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length - 3}개 더
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedView === 'chart' && (
          <div className="prescription-chart">
            {chartData.length > 0 && (
              <BarChart
                title="병원별 처방 횟수"
                subtitle="처방전 발급 횟수 비교"
                series={chartData}
                height={400}
                orientation="vertical"
                showValues={true}
                xAxisLabel="병원"
                yAxisLabel="처방 횟수"
                onBarClick={(point: any, series: any) => {
                  console.log('병원별 처방 차트 클릭:', point, series);
                }}
              />
            )}
          </div>
        )}

        {selectedView === 'timeline' && (
          <div className="prescription-timeline">
            <div className="timeline-header">
              <h3>처방전 타임라인</h3>
            </div>
            
            <div className="timeline">
              {filteredData
                .sort((a, b) => new Date(b.JinRyoGaesiIl).getTime() - new Date(a.JinRyoGaesiIl).getTime())
                .map((prescription, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="timeline-date">{prescription.JinRyoGaesiIl}</div>
                      <div className="timeline-hospital">{prescription.ByungEuiwonYakGukMyung}</div>
                      <div className="timeline-details">
                        <span>{prescription.JinRyoHyungTae}</span>
                        {prescription.RetrieveTreatmentInjectionInformationPersonDetailList && (
                          <span>약품 {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length}개</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionHistory;
