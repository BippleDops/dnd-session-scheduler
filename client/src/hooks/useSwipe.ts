'use client';
import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Returns touch event handlers for detecting horizontal swipes.
 * Attach onTouchStart and onTouchEnd to the target element.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeHandlers, threshold = 50) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - startXRef.current;
    const deltaY = e.changedTouches[0].clientY - startYRef.current;

    // Only trigger if horizontal movement is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
      if (deltaX > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
