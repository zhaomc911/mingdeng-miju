export type CellKind = 'white' | 'black';

export type BlackClue = 0 | 1 | 2 | 3 | 4;

export interface Coord {
  row: number;
  col: number;
}

export interface WhiteCell {
  kind: 'white';
}

export interface BlackCell {
  kind: 'black';
  clue?: BlackClue;
}

export type Cell = WhiteCell | BlackCell;

export type Board = Cell[][];

export type MarkState = 'empty' | 'bulb' | 'xmark';
