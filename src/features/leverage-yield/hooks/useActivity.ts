import { useCallback, useEffect, useState } from 'react';
import type { SourceChainKey } from '@/config/workshop';

/** A deposit or withdraw this browser sent: a per-viewer convenience, so the explorer links survive a reload. */
export type Activity = {
  id: string;
  kind: 'deposit' | 'withdraw';
  vaultName: string;
  /** e.g. "5 USDC on Base → ≈ 4.52 shares". */
  summary: string;
  chainKey: SourceChainKey;
  srcTxHash: string;
  at: number;
  status: 'pending' | 'filled' | 'failed';
};

const KEY = 'ly-activity-v1';
const MAX = 8;

function load(): Activity[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
}

function save(items: Activity[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked (private mode): the log just won't persist.
  }
}

export function useActivity(address: string | undefined) {
  const [items, setItems] = useState<Activity[]>([]);
  useEffect(() => setItems(load()), []);

  const upsert = useCallback((item: Activity) => {
    setItems(prev => {
      const next = [item, ...prev.filter(a => a.id !== item.id)].slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    save([]);
  }, []);

  // Activity is keyed by wallet so switching accounts doesn't show someone else's history.
  const mine = items.filter(item => !address || item.id.startsWith(address.toLowerCase()));
  return { items: mine, upsert, clear };
}
