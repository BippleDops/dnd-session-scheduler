'use client';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/ui/Toast';
import TavernNav from '@/components/layout/TavernNav';
import Footer from '@/components/layout/Footer';

export default function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <TavernNav />
        <main className="container mx-auto px-5 py-6 flex-1 max-w-5xl">
          {children}
        </main>
        <Footer />
      </ToastProvider>
    </AuthContext.Provider>
  );
}

