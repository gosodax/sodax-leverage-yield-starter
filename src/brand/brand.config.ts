/**
 * Whitelabel identity. Change these (plus src/brand/theme.css and the files in public/brand/) to rebrand.
 * Paths are relative to the site root and resolved against Vite's base URL.
 */
export const brand = {
  appName: 'Sugarloop',
  tagline:
    'One deposit from the network you already use. Solvers bake it into a pooled vault that loops your staking yield for an extra layer of sweetness.',
  /** Shown next to the logo in the header. Set to '' to hide. */
  productLabel: 'Yield Bakery',
  logo: {
    /** Logo for light surfaces (header). */
    onLight: 'brand/sugarloop-on-light.svg',
    /** Logo for dark / primary surfaces (hero, footer). */
    onDark: 'brand/sugarloop-on-dark.svg',
    alt: 'Sugarloop',
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
