/**
 * 건강 데이터 상태 관리 훅
 */
import { useState, useMemo, useCallback } from 'react';
import { healthConnectService } from '../../services/health/HealthConnectService';
import {
  CheckupResult,
  Prescription,
  FilterState,
  PrescriptionFilter,
  ResultCategory
} from '../../types/health';

interface UseHealthDataStateOptions {
  initialYear?: number;
  initialCategory?: string;
}

export const useHealthDataState = (options: UseHealthDataStateOptions = {}) => {
  const {
    initialYear = new Date().getFullYear(),
    initialCategory = 'all'
  } = options;

  // 필터 상태
  const [filters, setFilters] = useState<FilterState>({
    year: initialYear,
    category: initialCategory,
    searchTerm: '',
    hospitalName: ''
  });

  // 처방전 필터 상태
  const [prescriptionFilters, setPrescriptionFilters] = useState<PrescriptionFilter>({
    startDate: '',
    endDate: '',
    department: '',
    hospitalName: ''
  });

  // 정렬 상태
  const [sortBy, setSortBy] = useState<'date' | 'hospital' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 선택된 항목들
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<string[]>([]);

  /**
   * 검진 결과 필터링
   */
  const filterCheckupResults = useCallback((results: CheckupResult[]) => {
    return healthConnectService.filterCheckupResults(results, filters);
  }, [filters]);

  /**
   * 처방전 필터링
   */
  const filterPrescriptions = useCallback((prescriptions: Prescription[]) => {
    return healthConnectService.filterPrescriptions(prescriptions, prescriptionFilters);
  }, [prescriptionFilters]);

  /**
   * 검진 결과 정렬
   */
  const sortCheckupResults = useCallback((results: CheckupResult[]) => {
    return [...results].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'hospital':
          comparison = (a.hospitalName || '').localeCompare(b.hospitalName || '');
          break;
        case 'status':
          comparison = (a.overallStatus || '').localeCompare(b.overallStatus || '');
          break;
        default:
          return 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [sortBy, sortOrder]);

  /**
   * 처방전 정렬
   */
  const sortPrescriptions = useCallback((prescriptions: Prescription[]) => {
    return [...prescriptions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'hospital':
          comparison = (a.hospitalName || a.hospital || '').localeCompare(b.hospitalName || b.hospital || '');
          break;
        default:
          return 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [sortBy, sortOrder]);

  /**
   * 필터 업데이트
   */
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * 처방전 필터 업데이트
   */
  const updatePrescriptionFilters = useCallback((newFilters: Partial<PrescriptionFilter>) => {
    setPrescriptionFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * 정렬 설정 업데이트
   */
  const updateSort = useCallback((newSortBy: typeof sortBy, newSortOrder?: typeof sortOrder) => {
    setSortBy(newSortBy);
    if (newSortOrder) {
      setSortOrder(newSortOrder);
    } else {
      // 같은 컬럼을 클릭하면 순서 토글
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    }
  }, []);

  /**
   * 검진 결과 선택/해제
   */
  const toggleResultSelection = useCallback((resultId: string) => {
    setSelectedResults(prev => 
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  }, []);

  /**
   * 처방전 선택/해제
   */
  const togglePrescriptionSelection = useCallback((prescriptionId: string) => {
    setSelectedPrescriptions(prev => 
      prev.includes(prescriptionId)
        ? prev.filter(id => id !== prescriptionId)
        : [...prev, prescriptionId]
    );
  }, []);

  /**
   * 모든 선택 해제
   */
  const clearSelections = useCallback(() => {
    setSelectedResults([]);
    setSelectedPrescriptions([]);
  }, []);

  /**
   * 필터 초기화
   */
  const resetFilters = useCallback(() => {
    setFilters({
      year: initialYear,
      category: initialCategory,
      searchTerm: '',
      hospitalName: ''
    });
    setPrescriptionFilters({
      startDate: '',
      endDate: '',
      department: '',
      hospitalName: ''
    });
  }, [initialYear, initialCategory]);

  /**
   * 검색 기능
   */
  const search = useCallback((searchTerm: string) => {
    updateFilters({ searchTerm });
  }, [updateFilters]);

  /**
   * 연도별 데이터 그룹화
   */
  const groupResultsByYear = useCallback((results: CheckupResult[]) => {
    return results.reduce((groups, result) => {
      const year = new Date(result.date).getFullYear();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(result);
      return groups;
    }, {} as Record<number, CheckupResult[]>);
  }, []);

  /**
   * 병원별 데이터 그룹화
   */
  const groupResultsByHospital = useCallback((results: CheckupResult[]) => {
    return results.reduce((groups, result) => {
      const hospital = result.hospitalName || '기타';
      if (!groups[hospital]) {
        groups[hospital] = [];
      }
      groups[hospital].push(result);
      return groups;
    }, {} as Record<string, CheckupResult[]>);
  }, []);

  /**
   * 통계 정보 계산
   */
  const calculateStats = useCallback((results: CheckupResult[], prescriptions: Prescription[]) => {
    return {
      totalCheckups: results.length,
      totalPrescriptions: prescriptions.length,
      normalResults: results.filter(r => r.overallStatus === '정상').length,
      abnormalResults: results.filter(r => r.overallStatus !== '정상').length,
      uniqueHospitals: new Set([
        ...results.map(r => r.hospitalName || '기타'),
        ...prescriptions.map(p => p.hospitalName || p.hospital || '기타')
      ]).size,
      latestCheckup: results.length > 0 
        ? results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null,
      latestPrescription: prescriptions.length > 0
        ? prescriptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null
    };
  }, []);

  return {
    // 상태
    filters,
    prescriptionFilters,
    sortBy,
    sortOrder,
    selectedResults,
    selectedPrescriptions,

    // 액션
    updateFilters,
    updatePrescriptionFilters,
    updateSort,
    toggleResultSelection,
    togglePrescriptionSelection,
    clearSelections,
    resetFilters,
    search,

    // 유틸리티 함수
    filterCheckupResults,
    filterPrescriptions,
    sortCheckupResults,
    sortPrescriptions,
    groupResultsByYear,
    groupResultsByHospital,
    calculateStats,

    // 계산된 상태
    hasActiveFilters: useMemo(() => 
      filters.searchTerm !== '' || 
      filters.category !== 'all' || 
      filters.hospitalName !== '' ||
      prescriptionFilters.startDate !== '' ||
      prescriptionFilters.endDate !== '' ||
      prescriptionFilters.department !== '' ||
      prescriptionFilters.hospitalName !== ''
    , [filters, prescriptionFilters]),

    hasSelections: useMemo(() => 
      selectedResults.length > 0 || selectedPrescriptions.length > 0
    , [selectedResults, selectedPrescriptions])
  };
};
