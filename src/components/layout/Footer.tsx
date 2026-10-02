import { brand } from '@/brand/brand.config';

export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <span>© {new Date().getFullYear()} Balanced. Vault deposits carry smart contract and market risk.</span>
        {brand.poweredBySodax && (
          <a
            href={brand.links.sodax}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-subtle-foreground transition-colors hover:text-foreground"
          >
            Vault infrastructure by SODAX
          </a>
        )}
      </div>
    </footer>
  );
}
