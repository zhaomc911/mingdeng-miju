import { isSolved } from '../rules';
import { countSolutions, solve } from './solver';
import { LEVELS } from '../../data/puzzles';
import { Board } from '../../types';

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

describe('Akari solver (Phase C MVP)', () => {
  test('countSolutions reaches the limit on a board with multiple solutions', () => {
    const board = parseBoard([
      '#####',
      '#..##',
      '#####',
      '##..#',
      '#####',
    ]);

    expect(countSolutions(board, 2)).toBe(2);
  });

  test('solve returns a valid solution for a uniquely solvable board', () => {
    const board = LEVELS[0].board;
    const result = solve(board);

    expect(result.status).toBe('SOLVED');
    expect(result.solution).not.toBeNull();
    expect(isSolved(board, result.solution!)).toBe(true);
  });

  test('solve returns UNSOLVABLE for an impossible board', () => {
    const unsolvableBoard = parseBoard([
      '4####',
      '#####',
      '#####',
      '#####',
      '#####',
    ]);

    expect(solve(unsolvableBoard)).toEqual({
      status: 'UNSOLVABLE',
      solution: null,
    });
  });
});
