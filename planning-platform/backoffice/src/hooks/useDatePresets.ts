import { useState, useCallback } from 'react';

export interface UseDatePresetsReturn {
  dateFrom: string;
  dateTo: string;
  activePreset: number;
  setPreset: (days: number) => void;
  setDateRange: (from: string, to: string) => void;
  resetDates: () => void;
}

export function useDatePresets(defaultPreset?: number): UseDatePresetsReturn {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState(defaultPreset ?? -1);

  const setPreset = useCallback((days: number) => {
    const to = new Date();
    const from = new Date();
    if (days > 0) {
      from.setDate(from.getDate() - days);
    }
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
    setActivePreset(days);
  }, []);

  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(-1);
  }, []);

  const resetDates = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setActivePreset(-1);
  }, []);

  return { dateFrom, dateTo, activePreset, setPreset, setDateRange, resetDates };
}
