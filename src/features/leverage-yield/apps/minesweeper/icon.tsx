/** Pixel-art mine (16-grid, crisp edges). Tiny on purpose: loaded eagerly while the game is lazy. */
export function MinesweeperIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="7" y="1" width="2" height="14" fill="var(--win-text)" />
      <rect x="1" y="7" width="14" height="2" fill="var(--win-text)" />
      <rect x="3" y="3" width="2" height="2" fill="var(--win-text)" />
      <rect x="11" y="3" width="2" height="2" fill="var(--win-text)" />
      <rect x="3" y="11" width="2" height="2" fill="var(--win-text)" />
      <rect x="11" y="11" width="2" height="2" fill="var(--win-text)" />
      <rect x="4" y="4" width="8" height="8" fill="var(--win-text)" />
      <rect x="3" y="5" width="10" height="6" fill="var(--win-text)" />
      <rect x="5" y="3" width="6" height="10" fill="var(--win-text)" />
      <rect x="5" y="5" width="2" height="2" fill="var(--win-highlight)" />
    </svg>
  );
}
