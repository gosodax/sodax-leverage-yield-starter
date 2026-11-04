import type { ReactNode } from 'react';

/**
 * Pixel icons in the Win2k spirit, drawn on a 16-unit grid with crisp edges. Colours come from theme variables.
 */
function Px({ size = 16, children, title }: { size?: number; children: ReactNode; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className="shrink-0"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const K = 'var(--win-text)';
const W = 'var(--win-highlight)';
const G = 'var(--win-shadow)';
const F = 'var(--win-face)';

/** Red soda can with the orange logo stripe; `color` is the flavour ring. */
export function BottleIcon({ size, color = 'var(--soda-orange)' }: { size?: number; color?: string }) {
  return (
    <Px size={size}>
      <rect x="4" y="1" width="8" height="1" fill="var(--can-silver-dark)" />
      <rect x="3" y="2" width="10" height="1" fill="var(--can-silver)" />
      <rect x="3" y="3" width="10" height="11" fill="var(--can-red)" />
      <rect x="3" y="3" width="1" height="11" fill="var(--can-red-dark)" />
      <rect x="12" y="3" width="1" height="11" fill="var(--can-red-dark)" />
      <rect x="5" y="3" width="1" height="11" fill="var(--can-red-light)" />
      <rect x="3" y="6" width="10" height="2" fill="var(--can-logo)" />
      <rect x="4" y="8" width="8" height="1" fill={W} />
      <rect x="3" y="12" width="10" height="1" fill={color} />
      <rect x="3" y="14" width="10" height="1" fill="var(--can-silver)" />
      <rect x="4" y="15" width="8" height="1" fill="var(--can-silver-dark)" />
    </Px>
  );
}

export function CrateIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <rect x="1" y="7" width="14" height="8" fill="var(--soda-cola)" />
      <rect x="1" y="7" width="14" height="1" fill="var(--soda-orange)" />
      <rect x="1" y="11" width="14" height="1" fill="var(--soda-cola-dark)" />
      <rect x="2" y="2" width="3" height="5" fill="var(--soda-blue)" />
      <rect x="6" y="1" width="3" height="6" fill="var(--soda-lime)" />
      <rect x="10" y="2" width="3" height="5" fill="var(--soda-grape)" />
      <rect x="2" y="1" width="3" height="1" fill="var(--soda-cap)" />
      <rect x="6" y="0" width="3" height="1" fill="var(--soda-cap)" />
      <rect x="10" y="1" width="3" height="1" fill="var(--soda-cap)" />
      <rect x="0" y="7" width="1" height="9" fill={K} />
      <rect x="15" y="7" width="1" height="9" fill={K} />
      <rect x="0" y="15" width="16" height="1" fill={K} />
    </Px>
  );
}

export function GlobeIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <circle cx="8" cy="8" r="7" fill="var(--soda-blue)" stroke={K} strokeWidth="1" />
      <path d="M3 5h4v2H5v3H3zM9 3h3v3h2v3h-3V7H9zM7 10h3v3H8v2H6v-3h1z" fill="var(--soda-lime-dark)" />
      <rect x="4" y="3" width="2" height="1" fill={W} />
    </Px>
  );
}

export function WizardIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <path d="M8 0l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="var(--accent)" stroke={K} strokeWidth="0.6" />
      <rect x="2" y="13" width="12" height="2" fill="var(--soda-grape)" />
      <rect x="2" y="15" width="12" height="1" fill={K} />
    </Px>
  );
}

export function NotepadIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <rect x="2" y="1" width="11" height="14" fill={W} stroke={K} strokeWidth="1" />
      <rect x="2" y="1" width="11" height="2" fill="var(--soda-blue)" />
      <rect x="4" y="5" width="7" height="1" fill={G} />
      <rect x="4" y="7" width="7" height="1" fill={G} />
      <rect x="4" y="9" width="5" height="1" fill={G} />
      <rect x="4" y="11" width="7" height="1" fill={G} />
    </Px>
  );
}

export function KeyIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <circle cx="5" cy="8" r="3.5" fill="var(--accent)" stroke={K} strokeWidth="1" />
      <circle cx="5" cy="8" r="1.2" fill={F} />
      <rect x="8" y="7" width="7" height="2" fill="var(--accent)" stroke={K} strokeWidth="0.5" />
      <rect x="12" y="9" width="1" height="2" fill={K} />
      <rect x="14" y="9" width="1" height="3" fill={K} />
    </Px>
  );
}

export function PenIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <path d="M11 1l4 4-9 9-5 1 1-5z" fill="var(--soda-blue)" stroke={K} strokeWidth="1" />
      <path d="M2 10l4 4" stroke={K} strokeWidth="1" />
      <rect x="11" y="2" width="2" height="2" fill={W} />
    </Px>
  );
}

export function TruckIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <rect x="0" y="4" width="10" height="8" fill="var(--soda-cap)" stroke={K} strokeWidth="1" />
      <rect x="10" y="6" width="5" height="6" fill={F} stroke={K} strokeWidth="1" />
      <rect x="11" y="7" width="3" height="2" fill="var(--soda-blue)" />
      <circle cx="4" cy="13" r="2" fill={K} />
      <circle cx="12" cy="13" r="2" fill={K} />
      <rect x="2" y="6" width="6" height="1" fill={W} />
    </Px>
  );
}

export function FizzIcon({ size }: { size?: number }) {
  return (
    <Px size={size}>
      <circle cx="5" cy="11" r="3" fill="var(--soda-blue)" stroke={K} strokeWidth="1" />
      <circle cx="11" cy="7" r="2.5" fill="var(--soda-lime)" stroke={K} strokeWidth="1" />
      <circle cx="7" cy="3" r="2" fill="var(--soda-orange)" stroke={K} strokeWidth="1" />
      <rect x="4" y="9" width="1" height="1" fill={W} />
      <rect x="10" y="6" width="1" height="1" fill={W} />
    </Px>
  );
}

export function InfoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="14" fill="var(--win-highlight)" stroke="var(--win-progress)" strokeWidth="2" />
      <circle cx="16" cy="9" r="2.4" fill="var(--win-progress)" />
      <rect x="13.5" y="13" width="5" height="12" rx="1" fill="var(--win-progress)" />
    </svg>
  );
}

export function WarnIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M16 2L31 29H1z" fill="var(--accent)" stroke="var(--win-text)" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="14.5" y="10" width="3" height="11" fill="var(--win-text)" />
      <rect x="14.5" y="23" width="3" height="3" fill="var(--win-text)" />
    </svg>
  );
}

export function ErrorIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="14" fill="var(--destructive)" stroke="var(--win-dark)" strokeWidth="1.5" />
      <path d="M10 10l12 12M22 10L10 22" stroke="var(--win-highlight)" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  );
}

export function CheckMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden="true" className="shrink-0">
      <path d="M2 6.5l3 3 6-7" fill="none" stroke="var(--success)" strokeWidth="2.2" />
    </svg>
  );
}

export function Hourglass({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden="true" className="hourglass shrink-0">
      <path
        d="M2 1h9M2 12h9M3 1c0 4 3 4 3 5.5S3 8 3 12h7c0-4-3-4-3-5.5S10 5 10 1z"
        fill="var(--accent)"
        stroke="var(--win-text)"
      />
    </svg>
  );
}

export function Arrow({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden="true" className="shrink-0">
      <path d="M3 2l6 4.5L3 11z" fill="var(--win-text)" />
    </svg>
  );
}

export function CaptionGlyph({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' | 'help' }) {
  switch (kind) {
    case 'min':
      return (
        <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
          <rect x="1" y="5" width="6" height="2" fill="currentColor" />
        </svg>
      );
    case 'max':
      return (
        <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M0 0h8v7H0zM1 2v4h6V2z" fill="currentColor" fillRule="evenodd" />
        </svg>
      );
    case 'restore':
      return (
        <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M2 0h6v5H7V1H2zM0 2h6v5H0zM1 3v3h4V3z" fill="currentColor" fillRule="evenodd" />
        </svg>
      );
    case 'help':
      return (
        <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M2 0h4v1h1v2H6v1H5v1H3V3h1V2h1V1H3v1H1V1h1zM3 6h2v1H3z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
          <path
            d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"
            fill="currentColor"
          />
        </svg>
      );
  }
}
