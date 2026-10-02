import { assetUrl, brand } from '@/brand/brand.config';
import { ConnectButton, WalletModal } from '@/wallet';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-primary bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={import.meta.env.BASE_URL} className="flex items-center gap-3">
          <img src={assetUrl(brand.logo.onLight)} alt={brand.logo.alt} className="h-6 w-auto" />
          {brand.productLabel && (
            <span className="hard-shadow rounded-full border-2 border-primary bg-secondary px-3 py-1 font-display text-[9px] uppercase text-secondary-foreground">
              {brand.productLabel}
            </span>
          )}
        </a>
        <ConnectButton />
      </div>
      <WalletModal />
    </header>
  );
}
