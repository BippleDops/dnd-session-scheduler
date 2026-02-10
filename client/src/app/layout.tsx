import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

import type { Viewport } from 'next';

export const metadata: Metadata = {
  title: 'D&D Session Scheduler',
  description: 'Sign up for D&D sessions, manage characters, and track your adventures.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#8b0000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
