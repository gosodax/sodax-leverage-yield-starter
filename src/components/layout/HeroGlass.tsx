/**
 * Animated hero illustration: a glass that keeps filling (the yield) while coins and bubbles rise.
 * Pure SVG + CSS, theme colours only, and the motion is off for people who prefer reduced motion.
 */
export function HeroGlass() {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .pl-fill { animation: pl-fill 5s ease-in-out infinite alternate; transform-origin: bottom; }
          .pl-rise { animation: pl-rise 4s ease-in infinite; }
          .pl-rise.d2 { animation-delay: 1.3s; }
          .pl-rise.d3 { animation-delay: 2.6s; }
          .pl-float { animation: pl-float 6s ease-in-out infinite; }
          .pl-shine { animation: pl-shine 6s linear infinite; }
        }
        @keyframes pl-fill { from { transform: scaleY(0.45); } to { transform: scaleY(0.9); } }
        @keyframes pl-rise { from { transform: translateY(40px); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(-50px); opacity: 0; } }
        @keyframes pl-float { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
        @keyframes pl-shine { from { transform: translateX(-120%); } to { transform: translateX(260%); } }
      `}</style>
      <svg
        viewBox="0 0 160 140"
        className="hidden size-40 shrink-0 sm:block lg:size-52"
        role="img"
        aria-label="A glass filling up with yield"
      >
        <title>A glass filling up with yield</title>
        <defs>
          <clipPath id="pl-glass">
            <path d="M40 24h80l-8 92a10 10 0 0 1-10 9H58a10 10 0 0 1-10-9z" />
          </clipPath>
        </defs>
        {/* coins floating up */}
        <g className="fill-accent">
          <circle className="pl-rise" cx="30" cy="100" r="6" />
          <circle className="pl-rise d2" cx="132" cy="110" r="5" />
          <circle className="pl-rise d3" cx="146" cy="80" r="4" />
        </g>
        {/* liquid */}
        <g clipPath="url(#pl-glass)">
          <rect className="pl-fill fill-accent" x="30" y="24" width="100" height="101" opacity="0.9" />
          <g className="pl-float fill-card" opacity="0.5">
            <circle cx="70" cy="95" r="4" />
            <circle cx="95" cy="80" r="3" />
            <circle cx="82" cy="60" r="2.5" />
          </g>
          <rect
            className="pl-shine fill-card"
            x="30"
            y="24"
            width="14"
            height="101"
            opacity="0.25"
            transform="skewX(-15)"
          />
        </g>
        {/* glass outline */}
        <path
          d="M40 24h80l-8 92a10 10 0 0 1-10 9H58a10 10 0 0 1-10-9z"
          className="fill-none stroke-hero-foreground"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
