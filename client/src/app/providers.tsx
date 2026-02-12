'use client';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import { SSEProvider } from '@/hooks/useSSEContext';
import { ToastProvider } from '@/components/ui/Toast';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import TavernNav from '@/components/layout/TavernNav';
import MobileNav from '@/components/layout/MobileNav';
import Footer from '@/components/layout/Footer';
import { DiceRoller } from '@/components/ui/DiceRoller';
import InstallPrompt from '@/components/ui/InstallPrompt';

export default function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <SSEProvider>
        <ToastProvider>
          <InstallPrompt />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--gold)] focus:text-[var(--wood-dark)] focus:rounded focus:font-semibold">
            Skip to main content
          </a>
          <TavernNav />
          <main id="main-content" className="container mx-auto px-5 py-6 flex-1 max-w-5xl page-enter">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
          <Footer />
          <MobileNav />
          <DiceRoller />
        </ToastProvider>
      </SSEProvider>
    </AuthContext.Provider>
  );
}

