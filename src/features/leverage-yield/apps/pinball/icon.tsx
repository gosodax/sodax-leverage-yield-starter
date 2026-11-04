/** 16-grid pixel icon: a pinball over two red flippers. Tiny on purpose: loaded eagerly, the game is lazy. */
export function PinballIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="1" y="1" width="14" height="14" fill="var(--pin-table)" />
      <rect x="2" y="3" width="1" height="1" fill="var(--pin-star)" />
      <rect x="12" y="2" width="1" height="1" fill="var(--pin-star)" />
      <rect x="13" y="6" width="1" height="1" fill="var(--pin-star)" />
      <rect x="6" y="3" width="4" height="4" fill="var(--pin-ball)" />
      <rect x="6" y="3" width="1" height="1" fill="var(--pin-table)" />
      <rect x="9" y="3" width="1" height="1" fill="var(--pin-table)" />
      <rect x="6" y="6" width="1" height="1" fill="var(--pin-table)" />
      <rect x="9" y="6" width="1" height="1" fill="var(--pin-table)" />
      <rect x="7" y="4" width="1" height="1" fill="var(--pin-silver)" />
      <rect x="3" y="11" width="4" height="2" fill="var(--pin-flipper)" />
      <rect x="2" y="10" width="2" height="2" fill="var(--pin-flipper)" />
      <rect x="9" y="11" width="4" height="2" fill="var(--pin-flipper)" />
      <rect x="12" y="10" width="2" height="2" fill="var(--pin-flipper)" />
      <rect x="11" y="8" width="2" height="2" fill="var(--pin-bumper)" />
      <rect x="0" y="0" width="16" height="1" fill="var(--pin-rail-dark)" />
      <rect x="0" y="15" width="16" height="1" fill="var(--pin-rail-dark)" />
      <rect x="0" y="0" width="1" height="16" fill="var(--pin-rail-dark)" />
      <rect x="15" y="0" width="1" height="16" fill="var(--pin-rail-dark)" />
    </svg>
  );
}
