/**
 * Pure Minesweeper rules: board generation (first click always safe), reveal with flood fill, chording, flags and
 * win/loss detection. No React, no DOM: everything here is deterministic given the RNG, so it can be tested.
 */

export type CellMark = 'none' | 'flag' | 'question';

export type Cell = {
  mine: boolean;
  /** Adjacent mine count (0-8). */
  adjacent: number;
  revealed: boolean;
  mark: CellMark;
};

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export type Board = {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
  status: GameStatus;
  /** True once mines are placed (after the first reveal). */
  seeded: boolean;
  /** Index of the mine that was clicked on a loss. */
  exploded: number | null;
};

export type Level = 'beginner' | 'intermediate' | 'expert' | 'custom';

export const LEVELS: Record<Exclude<Level, 'custom'>, { rows: number; cols: number; mines: number }> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

/** Clamp custom dimensions like the original: 9-24 rows, 9-30 cols, 10..(r-1)(c-1) mines. */
export function clampCustom(rows: number, cols: number, mines: number) {
  const r = Math.max(9, Math.min(24, Math.round(Number.isFinite(rows) ? rows : 9)));
  const c = Math.max(9, Math.min(30, Math.round(Number.isFinite(cols) ? cols : 9)));
  const m = Math.max(10, Math.min((r - 1) * (c - 1), Math.round(Number.isFinite(mines) ? mines : 10)));
  return { rows: r, cols: c, mines: m };
}

export function createBoard(rows: number, cols: number, mines: number): Board {
  return {
    rows,
    cols,
    mines,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, revealed: false, mark: 'none' })),
    status: 'ready',
    seeded: false,
    exploded: null,
  };
}

export function neighbours(board: Pick<Board, 'rows' | 'cols'>, index: number): number[] {
  const r = Math.floor(index / board.cols);
  const c = index % board.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < board.rows && nc >= 0 && nc < board.cols) out.push(nr * board.cols + nc);
    }
  }
  return out;
}

/** mulberry32: small seeded RNG for tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Place mines avoiding `safe` and (when there is room) its neighbours, so the first click opens an area.
 * Mutates a copy and returns it.
 */
export function seedMines(board: Board, safe: number, rng: () => number = Math.random): Board {
  const cells = board.cells.map(cell => ({ ...cell, mine: false, adjacent: 0 }));
  const total = cells.length;
  const around = new Set([safe, ...neighbours(board, safe)]);
  // Exclude the neighbourhood only if enough cells remain for every mine.
  const exclude = total - around.size >= board.mines ? around : new Set([safe]);
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) if (!exclude.has(i)) candidates.push(i);
  // Partial Fisher-Yates.
  for (let i = 0; i < board.mines && i < candidates.length; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j] as number, candidates[i] as number];
    (cells[candidates[i] as number] as Cell).mine = true;
  }
  for (let i = 0; i < total; i++) {
    (cells[i] as Cell).adjacent = neighbours(board, i).filter(n => (cells[n] as Cell).mine).length;
  }
  return { ...board, cells, seeded: true, status: 'playing' };
}

/** Build a board from a fixed layout (for tests): '*' = mine, '.' = empty. */
export function boardFromLayout(layout: string[]): Board {
  const rows = layout.length;
  const cols = (layout[0] ?? '').length;
  const board = createBoard(rows, cols, 0);
  let mines = 0;
  layout.forEach((line, r) => {
    for (let c = 0; c < cols; c++) {
      if (line[c] === '*') {
        (board.cells[r * cols + c] as Cell).mine = true;
        mines++;
      }
    }
  });
  for (let i = 0; i < board.cells.length; i++) {
    (board.cells[i] as Cell).adjacent = neighbours(board, i).filter(n => (board.cells[n] as Cell).mine).length;
  }
  return { ...board, mines, seeded: true, status: 'playing' };
}

function cloneCells(board: Board): Cell[] {
  return board.cells.map(cell => ({ ...cell }));
}

/** Reveal `start` and flood-fill zeros. Returns the new cells (does not change status). */
function flood(board: Board, cells: Cell[], start: number) {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    const cell = cells[i] as Cell;
    if (cell.revealed || cell.mark === 'flag') continue;
    cell.revealed = true;
    cell.mark = 'none';
    if (cell.adjacent === 0 && !cell.mine) {
      for (const n of neighbours(board, i)) {
        const nc = cells[n] as Cell;
        if (!nc.revealed && nc.mark !== 'flag') stack.push(n);
      }
    }
  }
}

function finish(board: Board, cells: Cell[], exploded: number | null): Board {
  if (exploded !== null) {
    return { ...board, cells, status: 'lost', exploded };
  }
  if (isWon({ ...board, cells })) {
    // Auto-flag every mine on a win, like the original.
    for (const cell of cells) if (cell.mine) cell.mark = 'flag';
    return { ...board, cells, status: 'won' };
  }
  return { ...board, cells, status: 'playing' };
}

export function isWon(board: Board): boolean {
  return board.cells.every(cell => cell.mine || cell.revealed);
}

/** Left-click reveal. Seeds mines on the first click so it is always safe. */
export function reveal(board: Board, index: number, rng: () => number = Math.random): Board {
  if (board.status === 'won' || board.status === 'lost') return board;
  let b = board;
  if (!b.seeded) b = seedMines(b, index, rng);
  const target = b.cells[index] as Cell;
  if (target.revealed || target.mark === 'flag') return b;
  const cells = cloneCells(b);
  if (target.mine) {
    (cells[index] as Cell).revealed = true;
    return finish(b, cells, index);
  }
  flood(b, cells, index);
  return finish(b, cells, null);
}

/**
 * Chord on a revealed number: if adjacent flags equal its number, reveal every unflagged neighbour (which can
 * lose if a flag is wrong). Otherwise nothing happens.
 */
export function chord(board: Board, index: number): Board {
  if (board.status !== 'playing') return board;
  const cell = board.cells[index] as Cell;
  if (!cell.revealed || cell.adjacent === 0) return board;
  const around = neighbours(board, index);
  const flags = around.filter(n => (board.cells[n] as Cell).mark === 'flag').length;
  if (flags !== cell.adjacent) return board;
  const cells = cloneCells(board);
  let exploded: number | null = null;
  for (const n of around) {
    const nc = cells[n] as Cell;
    if (nc.revealed || nc.mark === 'flag') continue;
    if (nc.mine) {
      nc.revealed = true;
      if (exploded === null) exploded = n;
      continue;
    }
    flood(board, cells, n);
  }
  return finish(board, cells, exploded);
}

/** Right-click: none → flag → question (if marks on) → none. */
export function cycleMark(board: Board, index: number, marks: boolean): Board {
  if (board.status === 'won' || board.status === 'lost') return board;
  const cell = board.cells[index] as Cell;
  if (cell.revealed) return board;
  const next: CellMark = cell.mark === 'none' ? 'flag' : cell.mark === 'flag' ? (marks ? 'question' : 'none') : 'none';
  const cells = cloneCells(board);
  (cells[index] as Cell).mark = next;
  return { ...board, cells };
}

export function flagsPlaced(board: Board): number {
  return board.cells.filter(cell => cell.mark === 'flag').length;
}
