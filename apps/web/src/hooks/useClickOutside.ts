'use client';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onClose` when a click occurs outside the referenced element.
 */
export function useClickOutside<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return ref;
}
