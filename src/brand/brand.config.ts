/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'Balanced Yield',
  tagline: 'Put your assets to work in leveraged yield strategies, from the network and token you already use.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Yield vaults',
  logo: {
    /** Logo for light surfaces (header). */
    onLight: 'brand/logo-on-light.svg',
    /** Logo for dark / primary surfaces (hero, footer). */
    onDark: 'brand/logo-on-dark.svg',
    alt: 'Balanced',
  },
  /** Small "Powered by SODAX" credit in the footer. Partners may keep or remove it. */
  poweredBySodax: true,
  links: {
    docs: 'https://docs.sodax.com',
    website: 'https://balanced.network',
    sodax: 'https://sodax.com',
  },
} as const;

/** Resolve a public asset path against Vite's base URL (works under a sub-path deploy too). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
