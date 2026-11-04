import { type CSSProperties, useId } from 'react';
import { cn } from '@/lib/utils';

const W = 100;
const BODY_TOP = 34;
const BODY_BOTTOM = 166;

function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A red aluminium soda can with the orange "Hazy" script logo. The fizz spraying out of the opened tab shows the
 * vault's APR (how high it sprays, relative to the best vault) and its leverage (how many bubbles). A negative APR
 * goes flat: no fizz.
 */
export function SodaCan({
  level,
  bubbles,
  color,
  label,
  sublabel,
  flat,
  loading,
  className,
}: {
  /** 0..1, fizz height */
  level: number;
  bubbles: number;
  /** Flavour accent ring. */
  color: string;
  colorDark?: string;
  label: string;
  sublabel?: string;
  flat?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const fizzHeight = 10 + Math.max(0, Math.min(1, level)) * 46;
  const count = flat || loading ? 0 : Math.max(0, Math.min(20, Math.round(bubbles)));

  return (
    <svg
      viewBox={`0 -60 ${W} 240`}
      className={cn('soda-bottle h-full w-auto overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`red-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--can-red-dark)" />
          <stop offset="0.14" stopColor="var(--can-red)" />
          <stop offset="0.3" stopColor="var(--can-red-light)" />
          <stop offset="0.36" stopColor="var(--can-red)" />
          <stop offset="0.78" stopColor="var(--can-red)" />
          <stop offset="1" stopColor="var(--can-red-dark)" />
        </linearGradient>
        <linearGradient id={`alu-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--can-silver-dark)" />
          <stop offset="0.25" stopColor="var(--can-silver)" />
          <stop offset="0.5" stopColor="var(--can-silver-mid)" />
          <stop offset="0.8" stopColor="var(--can-silver)" />
          <stop offset="1" stopColor="var(--can-silver-dark)" />
        </linearGradient>
        <radialGradient id={`lid-${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="var(--can-silver)" />
          <stop offset="0.7" stopColor="var(--can-silver-mid)" />
          <stop offset="1" stopColor="var(--can-silver-dark)" />
        </radialGradient>
        <linearGradient id={`logo-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--can-logo)" />
          <stop offset="1" stopColor="var(--can-logo-dark)" />
        </linearGradient>
        <clipPath id={`body-${id}`}>
          <rect x="10" y={BODY_TOP} width="80" height={BODY_BOTTOM - BODY_TOP} />
        </clipPath>
      </defs>

      {/* floor shadow */}
      <ellipse cx="50" cy="176" rx="40" ry="4" fill="var(--win-text)" opacity="0.3" />

      {/* fizz spraying from the tab opening */}
      <g>
        {Array.from({ length: count }, (_, i) => {
          const r = 1 + seeded(i, 2) * 2.4;
          const style = {
            '--rise': `${1.4 + seeded(i, 3) * 1.6}s`,
            '--delay': `${-seeded(i, 4) * 3}s`,
            '--travel': `${fizzHeight + seeded(i, 6) * 18}px`,
            '--wobble': `${(seeded(i, 5) - 0.5) * 22}px`,
            transformBox: 'fill-box',
          } as CSSProperties;
          return (
            <circle key={i} className="soda-bubble" cx={56 + (seeded(i, 1) - 0.5) * 6} cy="12" r={r} style={style} />
          );
        })}
      </g>

      {/* bottom dome */}
      <path d={`M14 ${BODY_BOTTOM} L20 172 Q50 178 80 172 L86 ${BODY_BOTTOM} Z`} fill={`url(#alu-${id})`} />
      {/* shoulder taper */}
      <path d={`M20 18 L10 ${BODY_TOP} L90 ${BODY_TOP} L80 18 Z`} fill={`url(#alu-${id})`} />
      {/* body */}
      <rect x="10" y={BODY_TOP} width="80" height={BODY_BOTTOM - BODY_TOP} fill={`url(#red-${id})`} />

      <g clipPath={`url(#body-${id})`}>
        {/* orange swoosh */}
        <path d="M-4 72 C24 56 60 92 104 66 L104 80 C60 106 24 70 -4 86 Z" fill={`url(#logo-${id})`} opacity="0.95" />
        <path
          d="M-4 86 C24 70 60 106 104 80"
          fill="none"
          stroke="var(--win-highlight)"
          strokeWidth="1.4"
          opacity="0.9"
        />
        {/* flavour ring */}
        <rect x="10" y="152" width="80" height="5" fill={color} />
        <rect x="10" y="157" width="80" height="1" fill="var(--win-highlight)" opacity="0.6" />
        {/* "Hazy" script logo */}
        <text
          x="50"
          y="66"
          textAnchor="middle"
          fontFamily="var(--font-accent)"
          fontSize="22"
          fill="var(--can-logo)"
          stroke="var(--win-highlight)"
          strokeWidth="1.6"
          paintOrder="stroke"
          transform="rotate(-8 50 60)"
        >
          Hazy
        </text>
        {/* token */}
        <text
          x="50"
          y="118"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize="17"
          fill="var(--win-highlight)"
        >
          {label}
        </text>
        {sublabel && (
          <text
            x="50"
            y="131"
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="7.4"
            fill="var(--can-logo)"
            fontWeight="700"
          >
            {sublabel.toUpperCase()}
          </text>
        )}
        <text
          x="50"
          y="146"
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize="5"
          fill="var(--win-highlight)"
          opacity="0.85"
        >
          LEVERAGED YIELD · 12 FL OZ
        </text>
        {/* vertical specular highlight + rim shading */}
        <rect
          x="27"
          y={BODY_TOP}
          width="5"
          height={BODY_BOTTOM - BODY_TOP}
          fill="var(--win-highlight)"
          opacity="0.32"
        />
        <rect
          x="34"
          y={BODY_TOP}
          width="1.5"
          height={BODY_BOTTOM - BODY_TOP}
          fill="var(--win-highlight)"
          opacity="0.25"
        />
        <rect x="10" y={BODY_TOP} width="80" height="3" fill="var(--can-red-dark)" opacity="0.5" />
        {/* condensation */}
        <circle cx="72" cy="96" r="1.3" fill="var(--win-highlight)" opacity="0.75" />
        <circle cx="78" cy="122" r="1.1" fill="var(--win-highlight)" opacity="0.6" />
        <circle cx="20" cy="140" r="1" fill="var(--win-highlight)" opacity="0.6" />
        <circle cx="66" cy="143" r="0.8" fill="var(--win-highlight)" opacity="0.7" />
        {loading && (
          <rect x="10" y={BODY_TOP} width="80" height={BODY_BOTTOM - BODY_TOP} fill="var(--win-face)" opacity="0.4">
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.4s" repeatCount="indefinite" />
          </rect>
        )}
      </g>

      {/* lid */}
      <ellipse
        cx="50"
        cy="18"
        rx="30"
        ry="6"
        fill={`url(#lid-${id})`}
        stroke="var(--can-silver-dark)"
        strokeWidth="1"
      />
      <ellipse
        cx="50"
        cy="18"
        rx="25"
        ry="4.4"
        fill="none"
        stroke="var(--can-silver-dark)"
        strokeWidth="0.6"
        opacity="0.7"
      />
      {/* opening + pull tab */}
      <path d="M52 13.5 Q57 12.6 61 14 Q60 17 54 17 Q51 16 52 13.5 Z" fill="var(--win-dark)" />
      <rect
        x="40"
        y="16"
        width="13"
        height="5"
        rx="2.4"
        fill="var(--can-silver)"
        stroke="var(--can-silver-dark)"
        strokeWidth="0.7"
      />
      <rect x="43" y="17.4" width="6" height="2" rx="1" fill="var(--can-silver-dark)" />
      {/* bottom rim */}
      <path d="M20 172 Q50 178 80 172" fill="none" stroke="var(--can-silver-dark)" strokeWidth="0.8" />
    </svg>
  );
}
