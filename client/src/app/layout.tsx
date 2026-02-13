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
  metadataBase: new URL('https://dndsignup.get-suss.com'),
  openGraph: {
    title: 'D&D Session Scheduler',
    description: 'Sign up for D&D sessions, manage characters, and track your adventures.',
    url: 'https://dndsignup.get-suss.com',
    siteName: 'D&D Session Scheduler',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'D&D Session Scheduler',
    description: 'Sign up for D&D sessions, manage characters, and track your adventures.',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'D&D Sessions',
  },
};

export const viewport: Viewport = {
  themeColor: '#8b0000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'D&D Session Scheduler',
  description: 'Sign up for D&D sessions, manage characters, and track your adventures.',
  url: 'https://dndsignup.get-suss.com',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${medievalSharp.variable} ${crimsonText.variable} ${inter.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
