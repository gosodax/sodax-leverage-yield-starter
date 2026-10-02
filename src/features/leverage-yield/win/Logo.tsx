import { cn } from '@/lib/utils';

/**
 * HazyVault2000 flag: four waving panes with a trail of pixels, in the spirit of the 2000-era boot screen,
 * coloured from the theme's flag tokens.
 */
export function Flag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={cn('shrink-0', className)} aria-hidden="true">
      {/* pixel trail */}
      <g opacity="0.95">
        <rect x="2" y="6" width="4" height="4" fill="var(--flag-red)" opacity="0.35" />
        <rect x="8" y="8" width="5" height="5" fill="var(--flag-red)" opacity="0.6" />
        <rect x="4" y="15" width="3" height="3" fill="var(--flag-red)" opacity="0.3" />
        <rect x="11" y="16" width="4" height="4" fill="var(--flag-red)" opacity="0.8" />
        <rect x="3" y="27" width="4" height="4" fill="var(--flag-blue)" opacity="0.35" />
        <rect x="9" y="25" width="5" height="5" fill="var(--flag-blue)" opacity="0.65" />
        <rect x="5" y="35" width="3" height="3" fill="var(--flag-blue)" opacity="0.3" />
        <rect x="12" y="33" width="4" height="4" fill="var(--flag-blue)" opacity="0.85" />
      </g>
      {/* panes: each a gently waving quad */}
      <path d="M18 8 C24 5 30 6 38 9 L36 23 C29 20 23 20 17 22 Z" fill="var(--flag-red)" />
      <path d="M40 9.5 C46 12 52 12 60 9 L58 23 C51 26 45 25 38 23.5 Z" fill="var(--flag-green)" />
      <path d="M16.6 24.5 C23 22.5 29 22.5 35.8 25.5 L33.8 39.5 C27 36.5 21 36.5 15 39 Z" fill="var(--flag-blue)" />
      <path d="M37.8 26 C45 28 51 28.5 57.6 25.5 L55.6 39.5 C49 42.5 43 42 35.8 40 Z" fill="var(--flag-yellow)" />
      {/* bottle-cap sheen across the flag */}
      <path
        d="M19 10 C25 7.5 30 8 36 10.5"
        fill="none"
        stroke="var(--win-highlight)"
        strokeOpacity="0.55"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Full wordmark: "HazyVault 2000 Professional — Built on SODAX Technology". */
export function Wordmark({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const fg = tone === 'light' ? 'text-[var(--win-highlight)]' : 'text-[var(--win-text)]';
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Flag className="h-12 w-16" />
      <div className={cn('flex flex-col leading-none', fg)} style={{ fontFamily: 'var(--font-display)' }}>
        <span className="text-[10px] tracking-wide opacity-80">hazy2go</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold tracking-tight">HazyVault</span>
          <span className="text-[26px] font-light">2000</span>
        </span>
        <span className="mt-0.5 text-[13px] tracking-wide">Professional</span>
      </div>
    </div>
  );
}

export function BuiltOn({ className }: { className?: string }) {
  return (
    <p className={cn('text-[10px] tracking-wide', className)} style={{ fontFamily: 'var(--font-display)' }}>
      Built on SODAX Technology
    </p>
  );
}
