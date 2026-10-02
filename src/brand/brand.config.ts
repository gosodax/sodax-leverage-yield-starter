/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'Leverage Yield',
  tagline: 'Deposit from the network you already use. No manual bridging, no new wallet.',
  /** Small tag above the hero headline. */
  eyebrow: 'Universal deposits',
  /** Background for the hero's info icon: how a deposit reaches the vault. */
  howItWorks:
    'You sign one deposit intent on your network. SODAX routes it to solvers, who fill it by delivering vault shares to your own hub wallet on Sonic.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Vaults',
  logo: {
    /** Logo for light surfaces (header). */
    onLight: 'brand/logo-on-light.svg',
    /** Logo for dark / primary surfaces (hero, footer). */
    onDark: 'brand/logo-on-dark.svg',
    alt: 'SODAX',
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
