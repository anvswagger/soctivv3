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

// Global state for shared timer tick
let globalNow = Date.now();
const listeners = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startGlobalTimer() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    globalNow = Date.now();
    listeners.forEach(listener => listener(globalNow));
  }, 1000);
}

function stopGlobalTimer() {
  if (listeners.size === 0 && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useLeadTimer(createdAt: string, firstContactAt?: string | null): LeadTimerResult {
  const [now, setNow] = useState(globalNow);

  useEffect(() => {
    // If already contacted, we don't need to listen to the ticker
    if (firstContactAt) return;

    const listener = (time: number) => setNow(time);
    listeners.add(listener);
    startGlobalTimer();

    return () => {
      listeners.delete(listener);
      stopGlobalTimer();
    };
  }, [firstContactAt]);

  return useMemo(() => {
    const createdTime = new Date(createdAt).getTime();
    // Use contact time if available, otherwise current time
    const referenceTime = firstContactAt ? new Date(firstContactAt).getTime() : now;

    const timeElapsed = referenceTime - createdTime;
    const timeRemaining = Math.max(0, GOLD_THRESHOLD - timeElapsed);

    let heatLevel: HeatLevel = 'cold';
    if (timeElapsed < GOLD_THRESHOLD) {
      heatLevel = 'gold';
    } else if (timeElapsed < WARM_THRESHOLD) {
      heatLevel = 'warm';
    }

    // Only expire if not contacted yet
    const isGoldExpiring = !firstContactAt && heatLevel === 'gold' && timeRemaining <= EXPIRY_WARNING;

    // Format remaining time for gold, elapsed for others
    const timeToFormat = heatLevel === 'gold' ? timeRemaining : timeElapsed;
    const totalSeconds = Math.floor(Math.abs(timeToFormat) / 1000);
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
  const createdTime = new Date(createdAt).getTime();
  const endTime = firstContactAt ? new Date(firstContactAt).getTime() : Date.now();
  const timeElapsed = endTime - createdTime;

  if (timeElapsed < GOLD_THRESHOLD) return 'gold';
  if (timeElapsed < WARM_THRESHOLD) return 'warm';
  return 'cold';
}
