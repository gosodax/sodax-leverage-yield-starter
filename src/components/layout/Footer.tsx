import { SDK_VERSION } from '@sodax/sdk';
import { assetUrl, brand } from '@/brand/brand.config';

export function Footer() {
  return (
    <footer className="mt-auto border-t-[3px] border-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <span>
          © {new Date().getFullYear()} {brand.appName}. Vault deposits carry smart contract and market risk.
        </span>
        <div className="flex items-center gap-4">
          {/* The installed @sodax/sdk release: a quick check that nothing upgraded the pinned packages. */}
          <span className="text-xs text-subtle-foreground">SDK {SDK_VERSION}</span>
          {brand.poweredBySodax && (
            <a
              href={brand.links.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground"
            >
              Powered by
              <img src={assetUrl('brand/logo-on-light.svg')} alt="SODAX" className="h-4 w-auto" />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
