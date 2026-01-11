/**
 * useSavedFilters - 저장된 필터 관리 훅
 * localStorage를 사용한 필터 저장, 로드, 삭제, 즐겨찾기 기능
 */
import { useState, useEffect, useCallback } from 'react';
import { FilterState } from '../types/health';
import { SavedFilter } from '../components/search/AdvancedSearch';

const STORAGE_KEY = 'welno_saved_filters';

export const useSavedFilters = () => {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // localStorage에서 저장된 필터 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const filters = JSON.parse(stored);
        setSavedFilters(filters);
      }
    } catch (error) {
      console.error('저장된 필터 로드 실패:', error);
    }
  }, []);

  // localStorage에 필터 저장
  const saveToStorage = useCallback((filters: SavedFilter[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('필터 저장 실패:', error);
    }
  }, []);

  // 새 필터 저장
  const saveFilter = useCallback((name: string, filters: FilterState) => {
    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      filters,
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    setSavedFilters(prev => {
      const updated = [...prev, newFilter];
      saveToStorage(updated);
      return updated;
    });

    return newFilter;
  }, [saveToStorage]);

  // 필터 삭제
  const deleteFilter = useCallback((filterId: string) => {
    setSavedFilters(prev => {
      const updated = prev.filter(filter => filter.id !== filterId);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback((filterId: string) => {
    setSavedFilters(prev => {
      const updated = prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, isFavorite: !filter.isFavorite }
          : filter
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 필터 사용 시간 업데이트
  const updateLastUsed = useCallback((filterId: string) => {
    setSavedFilters(prev => {
      const updated = prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, lastUsed: new Date().toISOString() }
          : filter
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 필터 로드 (사용 시간 업데이트 포함)
  const loadFilter = useCallback((savedFilter: SavedFilter) => {
    updateLastUsed(savedFilter.id);
    return savedFilter.filters;
  }, [updateLastUsed]);

  // 즐겨찾기 필터만 가져오기
  const favoriteFilters = savedFilters.filter(filter => filter.isFavorite);

  // 최근 사용한 필터 가져오기
  const recentFilters = savedFilters
    .filter(filter => filter.lastUsed)
    .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
    .slice(0, 5);

  return {
    savedFilters,
    favoriteFilters,
    recentFilters,
    saveFilter,
    deleteFilter,
    toggleFavorite,
    loadFilter
  };
};
