import type { Metadata, Viewport } from 'next';
import { MedievalSharp, Crimson_Text, Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const medievalSharp = MedievalSharp({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const crimsonText = Crimson_Text({
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

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
    <html lang="en" className={`${medievalSharp.variable} ${crimsonText.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
