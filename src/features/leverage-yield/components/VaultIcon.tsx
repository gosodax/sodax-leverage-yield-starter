import type { LeverageYieldVault } from '@sodax/types';
import { cn } from '@/lib/utils';
import { vaultBrand } from '../lib/brands';

/** The vault's icon on its palette wash: 40px on cards, 24px inline. */
export function VaultIcon({ vault, size = 40 }: { vault: LeverageYieldVault; size?: 24 | 40 }) {
  const { icon: Icon, wash } = vaultBrand(vault);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-foreground',
        size === 40 ? 'size-10 rounded-lg' : 'size-6 rounded-sm',
        wash,
      )}
    >
      <Icon weight="duotone" className={size === 40 ? 'size-5' : 'size-3.5'} />
    </span>
  );
}
