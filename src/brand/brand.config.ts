/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'Leverage Yield PL',
  tagline:
    'Deposit from the network you already use. Solvers route it into a pooled vault that earns leveraged staking yield.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Vaults · PL',
  logo: {
    /** Logo for light surfaces (header). */
    onLight: 'brand/wordmark-on-light.svg',
    /** Logo for dark / primary surfaces (hero, footer). */
    onDark: 'brand/wordmark-on-dark.svg',
    alt: 'Leverage Yield',
  },
  /** Small "Powered by SODAX" credit in the footer. Partners may keep or remove it. */
  poweredBySodax: true,
  links: {
    docs: 'https://docs.sodax.com',
    website: 'https://sodax.com',
  },
} as const;

/** Resolve a public asset path against Vite's base URL (works under a sub-path deploy too). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
