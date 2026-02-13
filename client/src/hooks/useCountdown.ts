'use client';
import { useState, useEffect } from 'react';

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  label: string;
  isUrgent: boolean; // < 24 hours
  isNear: boolean; // < 7 days
  isPast: boolean;
}

/**
 * Live countdown to a date+time string.
 * Updates every minute (or every second when < 1 hour).
 */
export function useCountdown(dateStr: string, timeStr: string): CountdownResult | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!dateStr || !timeStr) return null;

  // Parse date and time (assume CT/local timezone)
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  const target = new Date(year, month - 1, day, hour, min).getTime();
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, label: 'Started', isPast: true, isUrgent: false, isNear: false };

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (days > 7) return null; // Only show for sessions within a week

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else label = `${minutes}m`;

  return {
    days, hours, minutes, label,
    isUrgent: days === 0 && hours < 24,
    isNear: days <= 7,
    isPast: false,
  };
}
