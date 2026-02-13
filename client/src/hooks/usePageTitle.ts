'use client';
import { useEffect } from 'react';

const BASE_TITLE = 'D&D Session Scheduler';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
    return () => { document.title = BASE_TITLE; };
  }, [title]);
}
