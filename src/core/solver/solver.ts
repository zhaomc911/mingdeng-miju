import { isSolved } from '../rules';
import { Board, Coord, MarkState } from '../../types';

export type SolverStatus = 'SOLVED' | 'UNSOLVABLE' | 'MULTIPLE';

export interface SolveResult {
  status: SolverStatus;
  solution: MarkState[][] | null;
}

interface NumberedWall {
  clue: 0 | 1 | 2 | 3 | 4;
  neighbors: number[];
}

interface SolverModel {
  board: Board;
  whiteCells: Coord[];
  whiteIndex: number[][];
  rowSegmentOf: number[];
  colSegmentOf: number[];
  rowSegments: number[][];
  colSegments: number[][];
  visibleFrom: number[][];
  walls: NumberedWall[];
  adjacentWallsOf: number[][];
}

interface SearchState {
  assignment: Int8Array; // -1 undecided, 0 no bulb, 1 bulb
  litCount: Int16Array;
  rowSegmentBulb: Int16Array;
  colSegmentBulb: Int16Array;
  wallBulbCount: Int8Array;
}

interface BranchChoice {
  type: 'candidates' | 'cell';
  candidates?: number[];
  cell?: number;
}

const DIRECTIONS: ReadonlyArray<Coord> = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[row].length;
}

function createEmptyMarks(board: Board): MarkState[][] {
  return board.map((row) => row.map(() => 'empty'));
}

function cloneState(state: SearchState): SearchState {
  return {
    assignment: new Int8Array(state.assignment),
    litCount: new Int16Array(state.litCount),
    rowSegmentBulb: new Int16Array(state.rowSegmentBulb),
    colSegmentBulb: new Int16Array(state.colSegmentBulb),
    wallBulbCount: new Int8Array(state.wallBulbCount),
  };
}

function collectWhiteCells(board: Board): { whiteCells: Coord[]; whiteIndex: number[][] } {
  const whiteCells: Coord[] = [];
  const whiteIndex = board.map((row) => row.map(() => -1));

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].kind === 'white') {
        whiteIndex[row][col] = whiteCells.length;
        whiteCells.push({ row, col });
      }
    }
  }

  return { whiteCells, whiteIndex };
}

function buildSegments(
  board: Board,
  whiteCells: Coord[],
  whiteIndex: number[][]
): Pick<SolverModel, 'rowSegmentOf' | 'colSegmentOf' | 'rowSegments' | 'colSegments'> {
  const rowSegmentOf = Array.from({ length: whiteCells.length }, () => -1);
  const colSegmentOf = Array.from({ length: whiteCells.length }, () => -1);
  const rowSegments: number[][] = [];
  const colSegments: number[][] = [];

  for (let row = 0; row < board.length; row += 1) {
    let col = 0;
    while (col < board[row].length) {
      if (board[row][col].kind !== 'white') {
        col += 1;
        continue;
      }

      const segment: number[] = [];
      while (col < board[row].length && board[row][col].kind === 'white') {
        const index = whiteIndex[row][col];
        rowSegmentOf[index] = rowSegments.length;
        segment.push(index);
        col += 1;
      }
      rowSegments.push(segment);
    }
  }

  const maxWidth = Math.max(...board.map((row) => row.length));
  for (let col = 0; col < maxWidth; col += 1) {
    let row = 0;
    while (row < board.length) {
      if (!inBounds(board, row, col) || board[row][col].kind !== 'white') {
        row += 1;
        continue;
      }

      const segment: number[] = [];
      while (inBounds(board, row, col) && board[row][col].kind === 'white') {
        const index = whiteIndex[row][col];
        colSegmentOf[index] = colSegments.length;
        segment.push(index);
        row += 1;
      }
      colSegments.push(segment);
    }
  }

  return { rowSegmentOf, colSegmentOf, rowSegments, colSegments };
}

function buildVisibleCells(
  whiteCellCount: number,
  rowSegmentOf: number[],
  colSegmentOf: number[],
  rowSegments: number[][],
  colSegments: number[][]
): number[][] {
  return Array.from({ length: whiteCellCount }, (_, index) => {
    const visible = new Set<number>();
    for (const cell of rowSegments[rowSegmentOf[index]]) {
      visible.add(cell);
    }
    for (const cell of colSegments[colSegmentOf[index]]) {
      visible.add(cell);
    }
    return [...visible];
  });
}

function buildWalls(board: Board, whiteIndex: number[][]): { walls: NumberedWall[]; adjacentWallsOf: number[][] } {
  const whiteCellCount = whiteIndex.reduce((sum, row) => sum + row.filter((index) => index >= 0).length, 0);
  const walls: NumberedWall[] = [];
  const adjacentWallsOf: number[][] = Array.from({ length: whiteCellCount }, () => []);

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      if (cell.kind !== 'black' || typeof cell.clue !== 'number') {
        continue;
      }

      const neighbors: number[] = [];
      for (const dir of DIRECTIONS) {
        const r = row + dir.row;
        const c = col + dir.col;
        if (inBounds(board, r, c) && whiteIndex[r][c] >= 0) {
          neighbors.push(whiteIndex[r][c]);
        }
      }

      const wallIndex = walls.length;
      walls.push({ clue: cell.clue, neighbors });
      for (const neighbor of neighbors) {
        adjacentWallsOf[neighbor].push(wallIndex);
      }
    }
  }

  return { walls, adjacentWallsOf };
}

function buildModel(board: Board): SolverModel {
  const { whiteCells, whiteIndex } = collectWhiteCells(board);
  const segments = buildSegments(board, whiteCells, whiteIndex);
  const visibleFrom = buildVisibleCells(
    whiteCells.length,
    segments.rowSegmentOf,
    segments.colSegmentOf,
    segments.rowSegments,
    segments.colSegments
  );
  const wallData = buildWalls(board, whiteIndex);

  return {
    board,
    whiteCells,
    whiteIndex,
    ...segments,
    visibleFrom,
    ...wallData,
  };
}

function createInitialState(model: SolverModel): SearchState {
  const rowSegmentBulb = new Int16Array(model.rowSegments.length);
  const colSegmentBulb = new Int16Array(model.colSegments.length);
  rowSegmentBulb.fill(-1);
  colSegmentBulb.fill(-1);

  const assignment = new Int8Array(model.whiteCells.length);
  assignment.fill(-1);

  return {
    assignment,
    litCount: new Int16Array(model.whiteCells.length),
    rowSegmentBulb,
    colSegmentBulb,
    wallBulbCount: new Int8Array(model.walls.length),
  };
}

function canPlaceBulb(model: SolverModel, state: SearchState, index: number): boolean {
  if (state.assignment[index] === 0) {
    return false;
  }

  const rowBulb = state.rowSegmentBulb[model.rowSegmentOf[index]];
  if (rowBulb >= 0 && rowBulb !== index) {
    return false;
  }

  const colBulb = state.colSegmentBulb[model.colSegmentOf[index]];
  if (colBulb >= 0 && colBulb !== index) {
    return false;
  }

  for (const wallIndex of model.adjacentWallsOf[index]) {
    if (state.assignment[index] !== 1 && state.wallBulbCount[wallIndex] + 1 > model.walls[wallIndex].clue) {
      return false;
    }
  }

  return true;
}

function setNoBulb(state: SearchState, index: number): boolean {
  if (state.assignment[index] === 1) {
    return false;
  }
  if (state.assignment[index] === 0) {
    return true;
  }

  state.assignment[index] = 0;
  return true;
}

function placeBulb(model: SolverModel, state: SearchState, index: number): boolean {
  if (state.assignment[index] === 1) {
    return true;
  }
  if (!canPlaceBulb(model, state, index)) {
    return false;
  }

  state.assignment[index] = 1;
  state.rowSegmentBulb[model.rowSegmentOf[index]] = index;
  state.colSegmentBulb[model.colSegmentOf[index]] = index;

  for (const litCell of model.visibleFrom[index]) {
    state.litCount[litCell] += 1;
  }

  for (const wallIndex of model.adjacentWallsOf[index]) {
    state.wallBulbCount[wallIndex] += 1;
  }

  for (const segmentCell of model.rowSegments[model.rowSegmentOf[index]]) {
    if (segmentCell !== index && !setNoBulb(state, segmentCell)) {
      return false;
    }
  }

  for (const segmentCell of model.colSegments[model.colSegmentOf[index]]) {
    if (segmentCell !== index && !setNoBulb(state, segmentCell)) {
      return false;
    }
  }

  return true;
}

function getPossibleWallNeighbors(model: SolverModel, state: SearchState, wall: NumberedWall): number[] {
  return wall.neighbors.filter((index) => state.assignment[index] === -1 && canPlaceBulb(model, state, index));
}

function getLightingCandidates(model: SolverModel, state: SearchState, index: number): number[] {
  return model.visibleFrom[index].filter((candidate) =>
    state.assignment[candidate] !== 0 && canPlaceBulb(model, state, candidate)
  );
}

function propagate(model: SolverModel, state: SearchState): boolean {
  let changed = true;

  while (changed) {
    changed = false;

    for (let wallIndex = 0; wallIndex < model.walls.length; wallIndex += 1) {
      const wall = model.walls[wallIndex];
      const current = state.wallBulbCount[wallIndex];
      if (current > wall.clue) {
        return false;
      }

      const possible = getPossibleWallNeighbors(model, state, wall);
      const needed = wall.clue - current;
      if (possible.length < needed) {
        return false;
      }

      if (needed === 0) {
        for (const neighbor of wall.neighbors) {
          if (state.assignment[neighbor] === -1) {
            if (!setNoBulb(state, neighbor)) {
              return false;
            }
            changed = true;
          }
        }
      } else if (possible.length === needed) {
        for (const neighbor of possible) {
          if (state.assignment[neighbor] !== 1) {
            if (!placeBulb(model, state, neighbor)) {
              return false;
            }
            changed = true;
          }
        }
      }
    }

    for (let index = 0; index < model.whiteCells.length; index += 1) {
      if (state.litCount[index] > 0) {
        continue;
      }

      const candidates = getLightingCandidates(model, state, index);
      if (candidates.length === 0) {
        return false;
      }

      if (candidates.length === 1) {
        if (!placeBulb(model, state, candidates[0])) {
          return false;
        }
        changed = true;
      }
    }
  }

  return true;
}

function chooseBranch(model: SolverModel, state: SearchState): BranchChoice | null {
  let bestCandidates: number[] | null = null;

  for (let wallIndex = 0; wallIndex < model.walls.length; wallIndex += 1) {
    const wall = model.walls[wallIndex];
    const needed = wall.clue - state.wallBulbCount[wallIndex];
    if (needed <= 0) {
      continue;
    }

    const candidates = getPossibleWallNeighbors(model, state, wall);
    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestCandidates = candidates;
    }
  }

  for (let index = 0; index < model.whiteCells.length; index += 1) {
    if (state.litCount[index] > 0) {
      continue;
    }

    const candidates = getLightingCandidates(model, state, index);
    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestCandidates = candidates;
    }
  }

  if (bestCandidates !== null) {
    return { type: 'candidates', candidates: bestCandidates };
  }

  let bestCell = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < model.whiteCells.length; index += 1) {
    if (state.assignment[index] !== -1) {
      continue;
    }

    const canPlace = canPlaceBulb(model, state, index);
    const visibilitySize = model.visibleFrom[index].length;
    const wallScore = model.adjacentWallsOf[index].length * 4;
    const score = (canPlace ? 0 : 1000) - wallScore + visibilitySize;
    if (score < bestScore) {
      bestScore = score;
      bestCell = index;
    }
  }

  return bestCell >= 0 ? { type: 'cell', cell: bestCell } : null;
}

function marksFromState(model: SolverModel, state: SearchState): MarkState[][] {
  const marks = createEmptyMarks(model.board);
  for (let index = 0; index < model.whiteCells.length; index += 1) {
    if (state.assignment[index] === 1) {
      const { row, col } = model.whiteCells[index];
      marks[row][col] = 'bulb';
    }
  }
  return marks;
}

function searchSolutions(board: Board, limit: number): { count: number; firstSolution: MarkState[][] | null } {
  if (limit <= 0) {
    return { count: 0, firstSolution: null };
  }

  const model = buildModel(board);
  const initialState = createInitialState(model);
  let solutionCount = 0;
  let firstSolution: MarkState[][] | null = null;

  const dfs = (state: SearchState): void => {
    if (solutionCount >= limit) {
      return;
    }

    if (!propagate(model, state)) {
      return;
    }

    const branch = chooseBranch(model, state);
    if (branch === null) {
      const marks = marksFromState(model, state);
      if (isSolved(board, marks)) {
        solutionCount += 1;
        if (firstSolution === null) {
          firstSolution = marks;
        }
      }
      return;
    }

    if (branch.type === 'candidates') {
      const candidates = branch.candidates ?? [];
      const cell = candidates[0];

      const withBulb = cloneState(state);
      if (placeBulb(model, withBulb, cell)) {
        dfs(withBulb);
      }

      if (solutionCount >= limit) {
        return;
      }

      const withoutBulb = cloneState(state);
      if (setNoBulb(withoutBulb, cell)) {
        dfs(withoutBulb);
      }
      return;
    }

    const cell = branch.cell ?? -1;
    if (cell < 0) {
      return;
    }

    if (canPlaceBulb(model, state, cell)) {
      const withBulb = cloneState(state);
      if (placeBulb(model, withBulb, cell)) {
        dfs(withBulb);
      }
    }

    if (solutionCount >= limit) {
      return;
    }

    const withoutBulb = cloneState(state);
    if (setNoBulb(withoutBulb, cell)) {
      dfs(withoutBulb);
    }
  };

  dfs(initialState);

  return {
    count: solutionCount,
    firstSolution,
  };
}

export function countSolutions(board: Board, limit = 2): number {
  return searchSolutions(board, limit).count;
}

export function solve(board: Board): SolveResult {
  const result = searchSolutions(board, 2);

  if (result.count === 0) {
    return {
      status: 'UNSOLVABLE',
      solution: null,
    };
  }

  if (result.count > 1) {
    return {
      status: 'MULTIPLE',
      solution: result.firstSolution,
    };
  }

  return {
    status: 'SOLVED',
    solution: result.firstSolution,
  };
}
