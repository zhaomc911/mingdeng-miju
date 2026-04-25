import { StyleSheet, View } from 'react-native';

import { Cell } from './Cell';
import { Board as BoardType, Coord, MarkState } from '../types';

interface BoardProps {
  board: BoardType;
  marks: MarkState[][];
  illumination: boolean[][];
  conflictBulbSet: Set<string>;
  wallStatusMap: Map<string, 'ok' | 'over' | 'under'>;
  onWhiteCellPress: (coord: Coord) => void;
}

export function Board({
  board,
  marks,
  illumination,
  conflictBulbSet,
  wallStatusMap,
  onWhiteCellPress,
}: BoardProps) {
  const size = board.length;
  const maxWidth = size >= 25 ? 760 : size >= 15 ? 620 : 520;

  return (
    <View style={styles.outerFrame}>
      <View style={[styles.container, { maxWidth }]}>
        {board.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, colIndex) => {
              const key = `${rowIndex},${colIndex}`;
              return (
                <Cell
                  key={key}
                  cell={cell}
                  mark={marks[rowIndex][colIndex]}
                  illuminated={illumination[rowIndex][colIndex]}
                  isConflictBulb={conflictBulbSet.has(key)}
                  clueStatus={wallStatusMap.get(key)}
                  onPress={() => onWhiteCellPress({ row: rowIndex, col: colIndex })}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    alignSelf: 'center',
    backgroundColor: '#fff7e6',
    borderColor: '#8a4b25',
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    shadowColor: '#2a160f',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    width: '100%',
  },
  container: {
    alignSelf: 'center',
    backgroundColor: '#2c1812',
    borderColor: '#231815',
    borderWidth: 2,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
});
