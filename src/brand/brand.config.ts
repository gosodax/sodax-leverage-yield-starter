/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'Longside',
  tagline:
    'Level up your staking yield. Drop in from Base, Arbitrum or Sonic, and a solver routes it into a leveraged vault.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Arcade',
  logo: {
    /** Logo for the header surface (dark in this theme). */
    onLight: 'brand/longside-logo.svg',
    /** Logo for the hero / primary surfaces. */
    onDark: 'brand/longside-logo.svg',
    alt: 'Longside',
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
