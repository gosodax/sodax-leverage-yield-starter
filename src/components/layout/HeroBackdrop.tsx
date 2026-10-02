/**
 * Animated hero backdrop: drifting glow blobs, rising bubbles, and a white wave along the bottom edge
 * (white over red like the flag, then the page). Pure CSS + SVG, theme colours only, still when reduced motion is on.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        .hero-bubble { position: absolute; bottom: -20px; border-radius: 9999px; background: var(--hero-accent); opacity: 0; }
        .hero-blob { position: absolute; border-radius: 9999px; filter: blur(60px); }
        .hero-wave { position: absolute; bottom: -1px; left: 0; width: 200%; height: 120px; }
        @media (prefers-reduced-motion: no-preference) {
          .hero-bubble { animation: hero-rise 8s ease-in infinite; }
          .hero-blob.a { animation: hero-blob-a 16s ease-in-out infinite alternate; }
          .hero-blob.b { animation: hero-blob-b 20s ease-in-out infinite alternate; }
          .hero-wave.white { animation: hero-wave 26s linear infinite reverse; }
          .hero-wave.red { animation: hero-wave 18s linear infinite; }
          .hero-wave.page { animation: hero-wave 12s linear infinite reverse; }
        }
        @keyframes hero-rise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: 0.7; } 100% { transform: translateY(-340px) scale(1.2); opacity: 0; } }
        @keyframes hero-blob-a { from { transform: translate(0, 0) scale(1); } to { transform: translate(120px, 40px) scale(1.25); } }
        @keyframes hero-blob-b { from { transform: translate(0, 0) scale(1.1); } to { transform: translate(-140px, -30px) scale(0.9); } }
        @keyframes hero-wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      <span className="hero-blob a -left-24 -top-24 size-96 bg-primary/30" />
      <span className="hero-blob b -bottom-32 right-1/4 size-[28rem] bg-hero-accent/25" />

      <span
        className="hero-bubble"
        style={{ left: '8%', width: 10, height: 10, animationDelay: '0s', animationDuration: '7s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '18%', width: 6, height: 6, animationDelay: '2.2s', animationDuration: '9s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '30%', width: 14, height: 14, animationDelay: '4s', animationDuration: '8s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '44%', width: 8, height: 8, animationDelay: '1s', animationDuration: '10s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '58%', width: 12, height: 12, animationDelay: '3.4s', animationDuration: '7.5s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '70%', width: 6, height: 6, animationDelay: '5.2s', animationDuration: '9.5s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '82%', width: 10, height: 10, animationDelay: '0.6s', animationDuration: '8.5s' }}
      />
      <span
        className="hero-bubble"
        style={{ left: '92%', width: 7, height: 7, animationDelay: '2.8s', animationDuration: '10s' }}
      />

      <svg className="hero-wave white fill-card" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0 40q90-30 180 0t180 0 180 0 180 0 180 0 180 0 180 0 180 0V120H0Z" />
      </svg>
      <svg className="hero-wave red fill-primary" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0 72q90-32 180 0t180 0 180 0 180 0 180 0 180 0 180 0 180 0V120H0Z" />
      </svg>
      <svg className="hero-wave page fill-background" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0 104q90-22 180 0t180 0 180 0 180 0 180 0 180 0 180 0 180 0V120H0Z" />
      </svg>
    </div>
  );
}
