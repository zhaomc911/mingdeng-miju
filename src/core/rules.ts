import { Board, Cell, Coord, MarkState } from '../types';

export interface BulbConflictPair {
  a: Coord;
  b: Coord;
}

export interface NumberedWallValidation {
  pos: Coord;
  clue: 0 | 1 | 2 | 3 | 4;
  adjacentBulbs: number;
  status: 'ok' | 'over' | 'under';
}

const ORTHOGONAL_DIRS: ReadonlyArray<Coord> = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[row].length;
}

function isWhiteCell(board: Board, row: number, col: number): boolean {
  return board[row][col].kind === 'white';
}

function isBulb(board: Board, marks: MarkState[][], row: number, col: number): boolean {
  return isWhiteCell(board, row, col) && marks[row]?.[col] === 'bulb';
}

export function isBlocker(cell: Cell): boolean {
  return cell.kind === 'black';
}

export function getIlluminationMap(board: Board, marks: MarkState[][]): boolean[][] {
  const illumination = board.map((row) => row.map(() => false));

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (!isBulb(board, marks, row, col)) {
        continue;
      }

      illumination[row][col] = true;

      for (const dir of ORTHOGONAL_DIRS) {
        let r = row + dir.row;
        let c = col + dir.col;

        while (inBounds(board, r, c) && !isBlocker(board[r][c])) {
          illumination[r][c] = true;
          r += dir.row;
          c += dir.col;
        }
      }
    }
  }

  return illumination;
}

export function validateBulbConflicts(board: Board, marks: MarkState[][]): BulbConflictPair[] {
  const conflicts: BulbConflictPair[] = [];

  const scanDirs: ReadonlyArray<Coord> = [
    { row: 1, col: 0 },
    { row: 0, col: 1 },
  ];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (!isBulb(board, marks, row, col)) {
        continue;
      }

      for (const dir of scanDirs) {
        let r = row + dir.row;
        let c = col + dir.col;

        while (inBounds(board, r, c) && !isBlocker(board[r][c])) {
          if (isBulb(board, marks, r, c)) {
            conflicts.push({
              a: { row, col },
              b: { row: r, col: c },
            });
          }

          r += dir.row;
          c += dir.col;
        }
      }
    }
  }

  return conflicts;
}

export function validateNumberedWalls(board: Board, marks: MarkState[][]): NumberedWallValidation[] {
  const results: NumberedWallValidation[] = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      if (cell.kind !== 'black' || typeof cell.clue !== 'number') {
        continue;
      }

      let adjacentBulbs = 0;
      for (const dir of ORTHOGONAL_DIRS) {
        const r = row + dir.row;
        const c = col + dir.col;
        if (!inBounds(board, r, c)) {
          continue;
        }
        if (isBulb(board, marks, r, c)) {
          adjacentBulbs += 1;
        }
      }

      let status: 'ok' | 'over' | 'under' = 'ok';
      if (adjacentBulbs > cell.clue) {
        status = 'over';
      } else if (adjacentBulbs < cell.clue) {
        status = 'under';
      }

      results.push({
        pos: { row, col },
        clue: cell.clue,
        adjacentBulbs,
        status,
      });
    }
  }

  return results;
}

export function isSolved(board: Board, marks: MarkState[][]): boolean {
  const illumination = getIlluminationMap(board, marks);

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].kind === 'white' && !illumination[row][col]) {
        return false;
      }
    }
  }

  if (validateBulbConflicts(board, marks).length > 0) {
    return false;
  }

  return validateNumberedWalls(board, marks).every((wall) => wall.status === 'ok');
}
