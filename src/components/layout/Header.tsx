import { assetUrl, brand } from '@/brand/brand.config';
import { ConnectButton, WalletModal } from '@/wallet';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-hero bg-gradient-to-b from-primary-light to-hero text-hero-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.4)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href={import.meta.env.BASE_URL} className="flex items-center gap-3">
          <img src={assetUrl(brand.logo.onDark)} alt={brand.logo.alt} className="h-6 w-auto" />
          {brand.productLabel && (
            <span className="rounded-sm border border-hero-foreground/30 bg-hero-foreground/10 px-2.5 py-0.5 text-xs font-medium text-hero-foreground">
              {brand.productLabel}
            </span>
          )}
        </a>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <div className="flex items-center gap-1" aria-hidden>
            <span className="flex size-5 items-center justify-center rounded-sm border border-hero-foreground/30 bg-hero-foreground/10 text-[10px] leading-none text-hero-foreground">
              _
            </span>
            <span className="flex size-5 items-center justify-center rounded-sm border border-hero-foreground/30 bg-hero-foreground/10 text-[10px] leading-none text-hero-foreground">
              □
            </span>
            <span className="flex size-5 items-center justify-center rounded-sm border border-destructive bg-destructive text-[10px] leading-none text-destructive-foreground">
              ✕
            </span>
          </div>
        </div>
      </div>
      <WalletModal />
    </header>
  );
}
