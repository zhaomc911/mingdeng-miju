import {
  getIlluminationMap,
  isSolved,
  validateBulbConflicts,
  validateNumberedWalls,
} from './rules';
import { Board, MarkState } from '../types';

function parseBoard(layout: string[]): Board {
  return layout.map((row) =>
    row.split('').map((char) => {
      if (char === '.') {
        return { kind: 'white' } as const;
      }
      if (char === '#') {
        return { kind: 'black' } as const;
      }
      return { kind: 'black', clue: Number(char) as 0 | 1 | 2 | 3 | 4 } as const;
    })
  );
}

function createMarks(board: Board, bulbs: Array<[number, number]>): MarkState[][] {
  const marks: MarkState[][] = board.map((row) => row.map(() => 'empty'));
  for (const [row, col] of bulbs) {
    marks[row][col] = 'bulb';
  }
  return marks;
}

function getWallStatusMap(
  board: Board,
  marks: MarkState[][]
): Record<string, { adjacentBulbs: number; status: 'ok' | 'over' | 'under' }> {
  const map: Record<string, { adjacentBulbs: number; status: 'ok' | 'over' | 'under' }> = {};
  for (const item of validateNumberedWalls(board, marks)) {
    map[`${item.pos.row},${item.pos.col}`] = {
      adjacentBulbs: item.adjacentBulbs,
      status: item.status,
    };
  }
  return map;
}

describe('Akari rules', () => {
  const clueBoard = parseBoard([
    '.....',
    '.0.1.',
    '..2..',
    '.....',
    '.....',
  ]);

  test('light propagation is blocked by black cells', () => {
    const marks = createMarks(clueBoard, [[0, 2]]);
    const illumination = getIlluminationMap(clueBoard, marks);

    expect(illumination[0][2]).toBe(true);
    expect(illumination[1][2]).toBe(true);
    expect(illumination[2][2]).toBe(false);
    expect(illumination[3][2]).toBe(false);
  });

  test('detects bulb conflicts in the same column without blockers', () => {
    const marks = createMarks(clueBoard, [
      [0, 4],
      [4, 4],
    ]);

    const conflicts = validateBulbConflicts(clueBoard, marks);

    expect(conflicts).toEqual([
      {
        a: { row: 0, col: 4 },
        b: { row: 4, col: 4 },
      },
    ]);
  });

  test('numbered wall status over/under/ok for clues 0/1/2', () => {
    const mixedMarks = createMarks(clueBoard, [
      [1, 0],
      [2, 1],
      [1, 4],
    ]);

    const mixedStatus = getWallStatusMap(clueBoard, mixedMarks);
    expect(mixedStatus['1,1']).toEqual({ adjacentBulbs: 2, status: 'over' });
    expect(mixedStatus['1,3']).toEqual({ adjacentBulbs: 1, status: 'ok' });
    expect(mixedStatus['2,2']).toEqual({ adjacentBulbs: 1, status: 'under' });

    const clue0OkMarks = createMarks(clueBoard, [[4, 4]]);
    const clue1OkMarks = createMarks(clueBoard, [[1, 4]]);
    const clue2OkMarks = createMarks(clueBoard, [
      [3, 2],
      [2, 1],
    ]);

    expect(getWallStatusMap(clueBoard, clue0OkMarks)['1,1']).toEqual({
      adjacentBulbs: 0,
      status: 'ok',
    });
    expect(getWallStatusMap(clueBoard, clue1OkMarks)['1,3']).toEqual({
      adjacentBulbs: 1,
      status: 'ok',
    });
    expect(getWallStatusMap(clueBoard, clue2OkMarks)['2,2']).toEqual({
      adjacentBulbs: 2,
      status: 'ok',
    });
  });

  test('isSolved returns true only when all conditions are satisfied', () => {
    const whiteBoard = parseBoard([
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ]);

    const solvedMarks = createMarks(whiteBoard, [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);

    const unsolvedMarks = createMarks(whiteBoard, [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);

    expect(isSolved(whiteBoard, solvedMarks)).toBe(true);
    expect(isSolved(whiteBoard, unsolvedMarks)).toBe(false);
  });
});
