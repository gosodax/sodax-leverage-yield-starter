import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import { MinesweeperIcon } from '../apps/minesweeper/icon';
import { PinballIcon } from '../apps/pinball/icon';

export type AppId = 'minesweeper' | 'pinball';

export type AppProps = { active: boolean; onClose: () => void };

export type AppDef = {
  title: string;
  Icon: ComponentType<{ size?: number }>;
  /** Lazy: games load only when opened, so they never weigh on the vault app. */
  Component: LazyExoticComponent<ComponentType<AppProps>>;
  /** Default position offset (staggered so windows don't stack exactly). */
  offset: { x: number; y: number };
  /** Fixed-size apps (like the original Minesweeper) have no maximize button. */
  fixedSize?: boolean;
};

export const APPS: Record<AppId, AppDef> = {
  minesweeper: {
    title: 'Minesweeper',
    Icon: MinesweeperIcon,
    Component: lazy(() => import('../apps/minesweeper/Minesweeper')),
    offset: { x: 140, y: 70 },
    fixedSize: true,
  },
  pinball: {
    title: 'Soda Cadet Pinball',
    Icon: PinballIcon,
    Component: lazy(() => import('../apps/pinball/Pinball')),
    offset: { x: 220, y: 30 },
  },
};

export const APP_IDS = Object.keys(APPS) as AppId[];
