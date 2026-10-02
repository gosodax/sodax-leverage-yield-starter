import { useSyncExternalStore } from 'react';

/** The app's two pages, addressed by hash (`#/` and `#/swap`) so it works on any static host or sub-path. */
export type Route = 'vaults' | 'swap';

export const ROUTE_HREF: Record<Route, string> = { vaults: '#/', swap: '#/swap' };

function readRoute(): Route {
  return window.location.hash.replace(/^#\/?/, '') === 'swap' ? 'swap' : 'vaults';
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, readRoute, () => 'vaults');
}
