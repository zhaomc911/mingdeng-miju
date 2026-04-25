import { countSolutions } from '../core/solver/solver';
import { LEVELS } from './puzzles';

describe('campaign levels', () => {
  test('all levels have exactly one solution', () => {
    const solutionCounts = LEVELS.map((level) => ({
      id: level.id,
      count: countSolutions(level.board, 2),
    }));

    expect(solutionCounts).toEqual(LEVELS.map((level) => ({ id: level.id, count: 1 })));
  });

  test('all levels are rectangular and match their declared size', () => {
    for (const level of LEVELS) {
      const [height, width] = level.size.split('x').map(Number);
      expect(level.layout).toHaveLength(height);
      expect(level.layout.every((row) => row.length === width)).toBe(true);
    }
  });
});
