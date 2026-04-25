import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cell as CellType, MarkState } from '../types';

type ClueStatus = 'ok' | 'over' | 'under';

interface CellProps {
  cell: CellType;
  mark: MarkState;
  illuminated: boolean;
  isConflictBulb: boolean;
  clueStatus?: ClueStatus;
  onPress: () => void;
}

function MarkGlyph({ mark }: { mark: MarkState }) {
  if (mark === 'bulb') {
    return (
      <View style={styles.lampGlyph}>
        <View style={styles.lampCore} />
      </View>
    );
  }

  if (mark === 'xmark') {
    return (
      <View style={styles.xMarkGlyph}>
        <View style={[styles.xStroke, styles.xStrokeForward]} />
        <View style={[styles.xStroke, styles.xStrokeBackward]} />
      </View>
    );
  }

  return null;
}

export function Cell({ cell, mark, illuminated, isConflictBulb, clueStatus, onPress }: CellProps) {
  if (cell.kind === 'black') {
    return (
      <View style={[styles.base, styles.blackCell]}>
        {typeof cell.clue === 'number' ? (
          <Text style={[styles.blackClue, clueStatus ? statusTextStyles[clueStatus] : styles.blackClueOk]}>
            {cell.clue}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.base,
        styles.whiteCell,
        illuminated ? styles.illuminatedCell : null,
        mark === 'bulb' ? styles.bulbCell : null,
        mark === 'bulb' && isConflictBulb ? styles.conflictBulbCell : null,
      ]}
      onPress={onPress}
    >
      <MarkGlyph mark={mark} />
    </Pressable>
  );
}

const statusTextStyles = StyleSheet.create({
  over: {
    color: '#ff6b4a',
  },
  under: {
    color: '#f4a51c',
  },
  ok: {
    color: '#55d17a',
  },
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    aspectRatio: 1,
    borderColor: '#2b211b',
    borderWidth: 0.75,
    flex: 1,
    justifyContent: 'center',
  },
  whiteCell: {
    backgroundColor: '#fff9e9',
  },
  illuminatedCell: {
    backgroundColor: '#ffe9a8',
  },
  bulbCell: {
    backgroundColor: '#ffd978',
  },
  conflictBulbCell: {
    backgroundColor: '#f7c4b9',
    borderColor: '#9f1d16',
  },
  blackCell: {
    backgroundColor: '#231815',
  },
  blackClue: {
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  blackClueOk: {
    color: '#f1c15d',
  },
  lampGlyph: {
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderColor: '#fff0b8',
    borderRadius: 999,
    borderWidth: 1.5,
    height: '62%',
    justifyContent: 'center',
    shadowColor: '#f4b63f',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    width: '62%',
  },
  lampCore: {
    backgroundColor: '#ffe9a8',
    borderRadius: 999,
    height: '42%',
    width: '42%',
  },
  xMarkGlyph: {
    alignItems: 'center',
    height: '58%',
    justifyContent: 'center',
    opacity: 0.95,
    width: '58%',
  },
  xStroke: {
    backgroundColor: '#8a3f1d',
    borderRadius: 999,
    height: 4,
    position: 'absolute',
    width: '86%',
  },
  xStrokeForward: {
    transform: [{ rotate: '45deg' }],
  },
  xStrokeBackward: {
    transform: [{ rotate: '-45deg' }],
  },
});
