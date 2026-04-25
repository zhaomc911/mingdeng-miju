import { BlackClue, Board, Coord, MarkState } from '../../types';
import { countSolutions, solve } from '../solver/solver';

export type GeneratorDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface GeneratePuzzleOptions {
  difficulty: GeneratorDifficulty;
  seed?: number;
  maxAttempts?: number;
}

export interface PuzzleDifficultyAnalysis {
  score: number;
  whiteCells: number;
  numberedWalls: number;
  blackWalls: number;
  solutionBulbs: number;
  density: number;
  forcedMoves: number;
  constraintStrength: number;
  averageSegmentLength: number;
  maxSegmentLength: number;
  visibilityPressure: number;
}

export interface GeneratedPuzzle {
  board: Board;
  difficulty: GeneratorDifficulty;
  size: string;
  attempts: number;
  solutionCount: number;
  analysis: PuzzleDifficultyAnalysis;
}

interface DifficultyPreset {
  size: number;
  blackDensity: number;
  targetNumberedWallRatio: number;
  maxClueRemovalPasses: number;
  minScore: number;
  minDensity: number;
  minMaxSegmentLength: number;
  minVisibilityPressure: number;
}

const PRESETS: Record<GeneratorDifficulty, DifficultyPreset> = {
  easy: {
    size: 5,
    blackDensity: 0.58,
    targetNumberedWallRatio: 0.75,
    maxClueRemovalPasses: 1,
    minScore: 0,
    minDensity: 0.25,
    minMaxSegmentLength: 1,
    minVisibilityPressure: 0,
  },
  medium: {
    size: 10,
    blackDensity: 0.34,
    targetNumberedWallRatio: 0.5,
    maxClueRemovalPasses: 3,
    minScore: 220,
    minDensity: 0.56,
    minMaxSegmentLength: 4,
    minVisibilityPressure: 0.9,
  },
  hard: {
    size: 15,
    blackDensity: 0.32,
    targetNumberedWallRatio: 0.62,
    maxClueRemovalPasses: 1,
    minScore: 430,
    minDensity: 0.62,
    minMaxSegmentLength: 6,
    minVisibilityPressure: 1.6,
  },
  expert: {
    size: 25,
    blackDensity: 0.3,
    targetNumberedWallRatio: 0.72,
    maxClueRemovalPasses: 1,
    minScore: 1250,
    minDensity: 0.66,
    minMaxSegmentLength: 8,
    minVisibilityPressure: 2.2,
  },
};

function createRandom(seed?: number): () => number {
  if (typeof seed !== 'number') {
    return Math.random;
  }

  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  return shuffled;
}

function getOrthogonalNeighbors(size: number, row: number, col: number): Coord[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((coord) => coord.row >= 0 && coord.row < size && coord.col >= 0 && coord.col < size);
}

function isWhite(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[row].length && board[row][col].kind === 'white';
}

function getWhiteNeighbors(board: Board, row: number, col: number): Coord[] {
  return getOrthogonalNeighbors(board.length, row, col).filter((coord) => isWhite(board, coord.row, coord.col));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function createWallLayout(preset: DifficultyPreset, random: () => number): Board {
  const size = preset.size;
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ kind: 'white' } as const))
  );

  const targetBlackCells = Math.round(size * size * preset.blackDensity);
  const coords = shuffle(
    Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), col: index % size })),
    random
  );

  let blackCells = 0;
  for (const { row, col } of coords) {
    if (blackCells >= targetBlackCells) {
      break;
    }

    board[row][col] = { kind: 'black' };
    blackCells += 1;
  }

  return board;
}

function hasUsableWhiteSpace(board: Board, preset: DifficultyPreset): boolean {
  const analysis = analyzePuzzleDifficulty(board, board.map((row) => row.map(() => 'empty' as MarkState)));
  return analysis.density >= preset.minDensity
    && analysis.maxSegmentLength >= preset.minMaxSegmentLength
    && analysis.visibilityPressure >= preset.minVisibilityPressure;
}

function countAdjacentSolutionBulbs(board: Board, solution: MarkState[][], row: number, col: number): BlackClue {
  const bulbs = getOrthogonalNeighbors(board.length, row, col).filter(
    (coord) => isWhite(board, coord.row, coord.col) && solution[coord.row][coord.col] === 'bulb'
  ).length;
  return Math.min(4, bulbs) as BlackClue;
}

function applyFullCluesFromSolution(board: Board, solution: MarkState[][]): Board {
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (cell.kind === 'white') {
        return { kind: 'white' } as const;
      }

      return {
        kind: 'black',
        clue: countAdjacentSolutionBulbs(board, solution, rowIndex, colIndex),
      } as const;
    })
  );
}

function getClueCoords(board: Board): Coord[] {
  const coords: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      if (cell.kind === 'black' && typeof cell.clue === 'number') {
        coords.push({ row, col });
      }
    }
  }
  return coords;
}

function removeRedundantClues(board: Board, preset: DifficultyPreset, random: () => number): Board {
  let current = cloneBoard(board);

  for (let pass = 0; pass < preset.maxClueRemovalPasses; pass += 1) {
    const clueCoords = getClueCoords(current);
    const targetClueCount = Math.ceil(clueCoords.length * preset.targetNumberedWallRatio);
    let currentClueCount = clueCoords.length;

    for (const { row, col } of shuffle(clueCoords, random)) {
      if (currentClueCount <= targetClueCount) {
        break;
      }

      const candidate = cloneBoard(current);
      candidate[row][col] = { kind: 'black' };

      if (countSolutions(candidate, 2) === 1) {
        current = candidate;
        currentClueCount -= 1;
      }
    }
  }

  return current;
}

function getWhiteSegments(board: Board): number[] {
  const segments: number[] = [];

  for (let row = 0; row < board.length; row += 1) {
    let segmentLength = 0;
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].kind === 'white') {
        segmentLength += 1;
      } else if (segmentLength > 0) {
        segments.push(segmentLength);
        segmentLength = 0;
      }
    }
    if (segmentLength > 0) {
      segments.push(segmentLength);
    }
  }

  const maxWidth = Math.max(...board.map((row) => row.length));
  for (let col = 0; col < maxWidth; col += 1) {
    let segmentLength = 0;
    for (let row = 0; row < board.length; row += 1) {
      if (isWhite(board, row, col)) {
        segmentLength += 1;
      } else if (segmentLength > 0) {
        segments.push(segmentLength);
        segmentLength = 0;
      }
    }
    if (segmentLength > 0) {
      segments.push(segmentLength);
    }
  }

  return segments;
}

function calculateVisibilityPressure(segments: number[]): number {
  if (segments.length === 0) {
    return 0;
  }

  const conflictPairs = segments.reduce((sum, length) => sum + (length * (length - 1)) / 2, 0);
  return Number((conflictPairs / segments.length).toFixed(2));
}

export function analyzePuzzleDifficulty(board: Board, solution: MarkState[][]): PuzzleDifficultyAnalysis {
  let whiteCells = 0;
  let numberedWalls = 0;
  let blackWalls = 0;
  let solutionBulbs = 0;
  let forcedMoves = 0;
  let constraintStrengthTotal = 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = board[row][col];
      if (cell.kind === 'white') {
        whiteCells += 1;
        if (solution[row][col] === 'bulb') {
          solutionBulbs += 1;
        }
      } else {
        blackWalls += 1;
        if (typeof cell.clue === 'number') {
          numberedWalls += 1;
          const whiteNeighbors = getWhiteNeighbors(board, row, col).length;
          if (cell.clue === 0 || cell.clue === whiteNeighbors) {
            forcedMoves += 1;
          }
          constraintStrengthTotal += whiteNeighbors === 0 ? 0 : cell.clue / whiteNeighbors;
        }
      }
    }
  }

  const area = board.reduce((sum, row) => sum + row.length, 0);
  const density = area === 0 ? 0 : whiteCells / area;
  const segments = getWhiteSegments(board);
  const averageSegmentLength = segments.length === 0
    ? 0
    : Number((segments.reduce((sum, length) => sum + length, 0) / segments.length).toFixed(2));
  const maxSegmentLength = segments.length === 0 ? 0 : Math.max(...segments);
  const visibilityPressure = calculateVisibilityPressure(segments);
  const constraintStrength = numberedWalls === 0
    ? 0
    : Number((constraintStrengthTotal / numberedWalls).toFixed(2));
  const score = Math.round(
    board.length * 3
      + whiteCells * 2
      + numberedWalls * 3
      + solutionBulbs * 4
      + forcedMoves * 2
      + constraintStrength * 12
      + averageSegmentLength * 4
      + maxSegmentLength * 3
      + visibilityPressure * 5
      + density * 20
  );

  return {
    score,
    whiteCells,
    numberedWalls,
    blackWalls,
    solutionBulbs,
    density,
    forcedMoves,
    constraintStrength,
    averageSegmentLength,
    maxSegmentLength,
    visibilityPressure,
  };
}

function passesDifficultyPreset(analysis: PuzzleDifficultyAnalysis, preset: DifficultyPreset): boolean {
  return analysis.score >= preset.minScore
    && analysis.density >= preset.minDensity
    && analysis.maxSegmentLength >= preset.minMaxSegmentLength
    && analysis.visibilityPressure >= preset.minVisibilityPressure;
}

export function generateUniquePuzzle(options: GeneratePuzzleOptions): GeneratedPuzzle | null {
  const preset = PRESETS[options.difficulty];
  const maxAttempts = options.maxAttempts ?? 100;
  const random = createRandom(options.seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const wallLayout = createWallLayout(preset, random);
    if (!hasUsableWhiteSpace(wallLayout, preset)) {
      continue;
    }

    const scaffoldSolution = solve(wallLayout).solution;
    if (scaffoldSolution === null) {
      continue;
    }

    const fullyCluedBoard = applyFullCluesFromSolution(wallLayout, scaffoldSolution);
    if (countSolutions(fullyCluedBoard, 2) !== 1) {
      continue;
    }

    const board = removeRedundantClues(fullyCluedBoard, preset, random);
    const solutionCount = countSolutions(board, 2);
    if (solutionCount !== 1) {
      continue;
    }

    const result = solve(board);
    if (result.solution === null) {
      continue;
    }

    const analysis = analyzePuzzleDifficulty(board, result.solution);
    if (!passesDifficultyPreset(analysis, preset)) {
      continue;
    }

    return {
      board,
      difficulty: options.difficulty,
      size: `${preset.size}x${preset.size}`,
      attempts: attempt,
      solutionCount,
      analysis,
    };
  }

  return null;
}
