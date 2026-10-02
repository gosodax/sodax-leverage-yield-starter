import { assetUrl, brand } from '@/brand/brand.config';
import { ROUTE_HREF, type Route, useRoute } from '@/lib/route';
import { cn } from '@/lib/utils';
import { ConnectButton, WalletModal } from '@/wallet';

const NAV: { route: Route; label: string }[] = [
  { route: 'vaults', label: 'Vaults' },
  { route: 'swap', label: 'Swap' },
];

export function Header() {
  const route = useRoute();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-primary bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <a href={ROUTE_HREF.vaults} className="shrink-0">
            <img src={assetUrl(brand.logo.onLight)} alt={brand.logo.alt} className="h-6 w-auto" />
          </a>
          <nav aria-label="Pages" className="flex gap-2">
            {NAV.map(item => (
              <a
                key={item.route}
                href={ROUTE_HREF[item.route]}
                aria-current={route === item.route ? 'page' : undefined}
                className={cn(
                  'hard-shadow rounded-full border-2 border-primary px-3 py-1 font-display text-[9px] uppercase',
                  route === item.route
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <ConnectButton />
      </div>
      <WalletModal />
    </header>
  );
}
