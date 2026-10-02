import { Taskbar } from '@/components/desktop/Taskbar';
import { WindowManagerProvider } from '@/components/desktop/WindowManager';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Hero } from '@/components/layout/Hero';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeverageYieldPage } from '@/features/leverage-yield/LeverageYieldPage';
import { SwapPage } from '@/features/swap/SwapPage';
import { useRoute } from '@/lib/route';

export function App() {
  const route = useRoute();
  return (
    <TooltipProvider>
      <WindowManagerProvider>
        {/* Bottom padding keeps the footer clear of the fixed taskbar. */}
        <div className="flex min-h-screen flex-col pb-11">
          <Header />
          <main className="flex-1">
            {route === 'vaults' && <Hero />}
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
              {route === 'swap' ? <SwapPage /> : <LeverageYieldPage />}
            </div>
          </main>
          <Footer />
        </div>
        <Taskbar />
      </WindowManagerProvider>
    </TooltipProvider>
  );
}
