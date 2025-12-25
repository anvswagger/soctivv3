import { useState, useEffect, useMemo } from 'react';

export type HeatLevel = 'gold' | 'warm' | 'cold';

interface LeadTimerResult {
  heatLevel: HeatLevel;
  timeElapsed: number;
  timeRemaining: number;
  formattedTime: string;
  isGoldExpiring: boolean;
}

const GOLD_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const WARM_THRESHOLD = 15 * 60 * 1000; // 15 minutes
const EXPIRY_WARNING = 30 * 1000; // 30 seconds before gold expires

export function useLeadTimer(createdAt: string, firstContactAt?: string | null): LeadTimerResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    // If already contacted, show cold (already handled)
    if (firstContactAt) {
      return {
        heatLevel: 'cold' as HeatLevel,
        timeElapsed: 0,
        timeRemaining: 0,
        formattedTime: '--:--',
        isGoldExpiring: false,
      };
    }

    const createdTime = new Date(createdAt).getTime();
    const timeElapsed = now - createdTime;
    const timeRemaining = Math.max(0, GOLD_THRESHOLD - timeElapsed);

    let heatLevel: HeatLevel = 'cold';
    if (timeElapsed < GOLD_THRESHOLD) {
      heatLevel = 'gold';
    } else if (timeElapsed < WARM_THRESHOLD) {
      heatLevel = 'warm';
    }

    const isGoldExpiring = heatLevel === 'gold' && timeRemaining <= EXPIRY_WARNING;

    // Format remaining time for gold, elapsed for others
    const timeToFormat = heatLevel === 'gold' ? timeRemaining : timeElapsed;
    const totalSeconds = Math.floor(timeToFormat / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      heatLevel,
      timeElapsed,
      timeRemaining,
      formattedTime,
      isGoldExpiring,
    };
  }, [createdAt, firstContactAt, now]);
}

export function getHeatLevelFromTimestamp(createdAt: string, firstContactAt?: string | null): HeatLevel {
  if (firstContactAt) return 'cold';
  
  const timeElapsed = Date.now() - new Date(createdAt).getTime();
  
  if (timeElapsed < GOLD_THRESHOLD) return 'gold';
  if (timeElapsed < WARM_THRESHOLD) return 'warm';
  return 'cold';
}
