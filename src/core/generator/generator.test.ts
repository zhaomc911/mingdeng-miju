import { isSolved } from '../rules';
import { countSolutions, solve } from '../solver/solver';
import { generateUniquePuzzle, GeneratorDifficulty } from './generator';

function expectGeneratedPuzzle(difficulty: GeneratorDifficulty, seed: number, expectedSize: string) {
  const puzzle = generateUniquePuzzle({ difficulty, seed, maxAttempts: 300 });

  expect(puzzle).not.toBeNull();
  expect(puzzle!.size).toBe(expectedSize);
  expect(puzzle!.solutionCount).toBe(1);
  expect(puzzle!.analysis.score).toBeGreaterThan(0);
  expect(puzzle!.analysis.whiteCells).toBeGreaterThan(0);
  expect(puzzle!.analysis.solutionBulbs).toBeGreaterThan(0);
  expect(puzzle!.analysis.density).toBeGreaterThan(0);
  expect(puzzle!.analysis.forcedMoves).toBeGreaterThanOrEqual(0);
  expect(puzzle!.analysis.constraintStrength).toBeGreaterThanOrEqual(0);
  expect(puzzle!.analysis.averageSegmentLength).toBeGreaterThan(0);
  expect(puzzle!.analysis.maxSegmentLength).toBeGreaterThan(0);
  expect(puzzle!.analysis.visibilityPressure).toBeGreaterThanOrEqual(0);
  expect(countSolutions(puzzle!.board, 2)).toBe(1);

  const result = solve(puzzle!.board);
  expect(result.status).toBe('SOLVED');
  expect(result.solution).not.toBeNull();
  expect(isSolved(puzzle!.board, result.solution!)).toBe(true);

  return puzzle!;
}

describe('generateUniquePuzzle', () => {
  test('generates a uniquely solvable easy puzzle', () => {
    expectGeneratedPuzzle('easy', 1001, '5x5');
  });

  test('generates a uniquely solvable medium puzzle', () => {
    const puzzle = expectGeneratedPuzzle('medium', 2002, '10x10');

    expect(puzzle.analysis.density).toBeGreaterThanOrEqual(0.56);
    expect(puzzle.analysis.maxSegmentLength).toBeGreaterThanOrEqual(4);
    expect(puzzle.analysis.visibilityPressure).toBeGreaterThanOrEqual(0.9);
  });

  test('generates a uniquely solvable hard puzzle', () => {
    const puzzle = expectGeneratedPuzzle('hard', 3003, '15x15');

    expect(puzzle.analysis.density).toBeGreaterThanOrEqual(0.62);
    expect(puzzle.analysis.maxSegmentLength).toBeGreaterThanOrEqual(6);
    expect(puzzle.analysis.visibilityPressure).toBeGreaterThanOrEqual(1.6);
  });

  test('generates a uniquely solvable expert puzzle', () => {
    const puzzle = expectGeneratedPuzzle('expert', 4004, '25x25');

    expect(puzzle.analysis.density).toBeGreaterThanOrEqual(0.66);
    expect(puzzle.analysis.maxSegmentLength).toBeGreaterThanOrEqual(8);
    expect(puzzle.analysis.visibilityPressure).toBeGreaterThanOrEqual(2.2);
  });

  test('difficulty score increases across the seeded presets', () => {
    const easy = expectGeneratedPuzzle('easy', 1001, '5x5');
    const medium = expectGeneratedPuzzle('medium', 2002, '10x10');
    const hard = expectGeneratedPuzzle('hard', 3003, '15x15');
    const expert = expectGeneratedPuzzle('expert', 4004, '25x25');

    expect(easy.analysis.score).toBeLessThan(medium.analysis.score);
    expect(medium.analysis.score).toBeLessThan(hard.analysis.score);
    expect(hard.analysis.score).toBeLessThan(expert.analysis.score);
  });
});
