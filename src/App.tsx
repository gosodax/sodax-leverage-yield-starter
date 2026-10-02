import { TooltipProvider } from '@/components/ui/tooltip';
import { LeverageYieldPage } from '@/features/leverage-yield/LeverageYieldPage';
import { WalletModal } from '@/wallet';

export function App() {
  return (
    <TooltipProvider>
      <main className="min-h-screen">
        <LeverageYieldPage />
      </main>
      <WalletModal />
    </TooltipProvider>
  );
}
