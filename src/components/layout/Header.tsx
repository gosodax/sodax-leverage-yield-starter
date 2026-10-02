import { assetUrl, brand } from '@/brand/brand.config';
import { ConnectButton, WalletModal } from '@/wallet';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={import.meta.env.BASE_URL} className="flex items-center gap-3">
          <img src={assetUrl(brand.logo.onLight)} alt="" className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Balanced</span>
          {brand.productLabel && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
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
