import { useState, useEffect, useCallback } from 'react';

interface UseDemoModeReturn {
  isDemoActive: boolean;
  remainingSeconds: number;
  formattedRemaining: string;
  isExpired: boolean;
}

export function useDemoMode(durationMinutes: number = 10): UseDemoModeReturn {
  const totalSeconds = durationMinutes * 60;

  // On mount, always start fresh (re-entry = new session)
  const [startTime] = useState(() => {
    const now = Date.now();
    // Store in sessionStorage for potential reference, but always reset on mount
    sessionStorage.setItem('demo_start', String(now));
    return now;
  });

  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, totalSeconds]);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    isDemoActive: !isExpired,
    remainingSeconds,
    formattedRemaining: formatTime(remainingSeconds),
    isExpired,
  };
}
