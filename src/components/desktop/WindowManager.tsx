import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type WindowStatus = 'open' | 'minimized' | 'closed';

export type WindowState = {
  title: string;
  status: WindowStatus;
  maximized: boolean;
  /** Stacking order: higher is in front. */
  z: number;
  /** Drag offset from the window's place in the page layout. */
  offset: { x: number; y: number };
};

type WindowManager = {
  windows: Record<string, WindowState>;
  /** Ids in registration order, for the taskbar and Start menu. */
  order: string[];
  focusedId: string | undefined;
  register: (id: string, title: string) => void;
  /** Forget a window whose page unmounted, so the taskbar only lists windows that exist. */
  unregister: (id: string) => void;
  focus: (id: string) => void;
  /** Open (or restore) a window and bring it to the front. */
  open: (id: string) => void;
  minimize: (id: string) => void;
  close: (id: string) => void;
  toggleMaximize: (id: string) => void;
  setOffset: (id: string, offset: { x: number; y: number }) => void;
  /** Put every window back where the page layout has it. */
  resetLayout: () => void;
};

const Context = createContext<WindowManager | undefined>(undefined);

const NEW_WINDOW = { status: 'open', maximized: false, offset: { x: 0, y: 0 } } as const;

/** A tiny Windows 95-style window manager: stacking, drag offsets, minimize / maximize / close. */
export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<Record<string, WindowState>>({});
  const [order, setOrder] = useState<string[]>([]);

  const patch = useCallback((id: string, change: (w: WindowState, topZ: number) => Partial<WindowState>) => {
    setWindows(all => {
      const current = all[id];
      if (!current) return all;
      const topZ = Math.max(0, ...Object.values(all).map(w => w.z));
      return { ...all, [id]: { ...current, ...change(current, topZ) } };
    });
  }, []);

  const register = useCallback((id: string, title: string) => {
    setWindows(all => {
      if (all[id]?.title === title) return all;
      const z = all[id]?.z ?? Object.keys(all).length + 1;
      return { ...all, [id]: { ...NEW_WINDOW, ...all[id], title, z } };
    });
    setOrder(ids => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const unregister = useCallback((id: string) => {
    setWindows(({ [id]: _removed, ...rest }) => rest);
    setOrder(ids => ids.filter(other => other !== id));
  }, []);

  const value = useMemo<WindowManager>(() => {
    const visible = Object.entries(windows).filter(([, w]) => w.status === 'open');
    const focusedId = visible.sort(([, a], [, b]) => b.z - a.z)[0]?.[0];
    return {
      windows,
      order,
      focusedId,
      register,
      unregister,
      focus: id => patch(id, (w, topZ) => (w.z === topZ ? {} : { z: topZ + 1 })),
      open: id => patch(id, (_, topZ) => ({ status: 'open', z: topZ + 1 })),
      minimize: id => patch(id, () => ({ status: 'minimized' })),
      close: id => patch(id, () => ({ status: 'closed', maximized: false, offset: { x: 0, y: 0 } })),
      toggleMaximize: id => patch(id, (w, topZ) => ({ maximized: !w.maximized, z: topZ + 1 })),
      setOffset: (id, offset) => patch(id, () => ({ offset })),
      resetLayout: () =>
        setWindows(all => Object.fromEntries(Object.entries(all).map(([id, w]) => [id, { ...w, ...NEW_WINDOW }]))),
    };
  }, [windows, order, register, unregister, patch]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWindowManager(): WindowManager {
  const manager = useContext(Context);
  if (!manager) throw new Error('useWindowManager must be used inside <WindowManagerProvider>');
  return manager;
}
