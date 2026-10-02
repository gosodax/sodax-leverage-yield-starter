/**
 * A small unbranded flask bottle for the success dialog: it rocks like a toast, the drink sloshes and bubbles,
 * and sparkles twinkle around it. Pure SVG + CSS in theme colours; still when reduced motion is on.
 */
export function CheersBottle() {
  return (
    <svg viewBox="0 0 120 130" className="size-28" role="img" aria-label="A bottle raised in a toast">
      <title>A bottle raised in a toast</title>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .cb-rock { transform-origin: 60px 120px; animation: cb-rock 2.4s ease-in-out infinite; }
          .cb-slosh { transform-origin: 60px 110px; animation: cb-slosh 2.4s ease-in-out infinite; }
          .cb-bubble { animation: cb-bubble 2.6s ease-in infinite; }
          .cb-bubble.b { animation-delay: 0.9s; }
          .cb-bubble.c { animation-delay: 1.7s; }
          .cb-spark { transform-box: fill-box; transform-origin: center; animation: cb-spark 1.8s ease-in-out infinite; }
          .cb-spark.b { animation-delay: 0.6s; }
          .cb-spark.c { animation-delay: 1.2s; }
        }
        @keyframes cb-rock { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
        @keyframes cb-slosh { 0%, 100% { transform: skewX(6deg); } 50% { transform: skewX(-6deg); } }
        @keyframes cb-bubble { from { transform: translateY(14px); opacity: 0; } 25% { opacity: 0.9; } to { transform: translateY(-34px); opacity: 0; } }
        @keyframes cb-spark { 0%, 100% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }
      `}</style>

      <defs>
        <clipPath id="cb-body">
          <path d="M36 52c0-8 6-12 12-14h24c6 2 12 6 12 14v58a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10z" />
        </clipPath>
      </defs>

      <g className="cb-rock">
        {/* cap and neck */}
        <rect x="48" y="12" width="24" height="14" rx="3" className="fill-primary" />
        <rect x="52" y="26" width="16" height="14" className="fill-card stroke-primary" strokeWidth="3" />
        {/* drink */}
        <g clipPath="url(#cb-body)">
          <rect x="30" y="44" width="60" height="80" className="fill-accent" opacity="0.9" />
          <g className="cb-slosh">
            <rect x="30" y="44" width="60" height="6" className="fill-card" opacity="0.35" />
          </g>
          <circle className="cb-bubble fill-card" cx="48" cy="104" r="3" opacity="0.7" />
          <circle className="cb-bubble b fill-card" cx="70" cy="100" r="2.5" opacity="0.7" />
          <circle className="cb-bubble c fill-card" cx="58" cy="108" r="2" opacity="0.7" />
        </g>
        {/* label: white diamond with a red band, like a tiny flag */}
        <path
          d="M60 62l15 18-15 22-15-22z"
          className="fill-card stroke-primary"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M49 80h22l-11 16z" className="fill-primary" opacity="0.9" />
        {/* glass outline */}
        <path
          d="M36 52c0-8 6-12 12-14h24c6 2 12 6 12 14v58a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10z"
          className="fill-none stroke-primary"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </g>

      {/* sparkles */}
      <g className="fill-accent">
        <path className="cb-spark" d="M14 28l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="cb-spark b" d="M104 20l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
        <path className="cb-spark c" d="M106 74l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  );
}
