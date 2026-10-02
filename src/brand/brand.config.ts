/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'StableCorp',
  tagline:
    'Deposit from the network you already use. Independent solvers route it into pooled vaults earning leveraged staking yield.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Yield',
  logo: {
    /** Logo for light surfaces (header). */
    onLight: 'brand/logo-on-light.svg',
    /** Logo for dark / primary surfaces (hero, footer). */
    onDark: 'brand/logo-on-dark.svg',
    alt: 'StableCorp',
  },
  /** Off: the footer credit renders this brand's logo file under a SODAX label. */
  poweredBySodax: false,
  links: {
    docs: 'https://docs.sodax.com',
    website: 'https://sodax.com',
  },
} as const;

/** Resolve a public asset path against Vite's base URL (works under a sub-path deploy too). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
