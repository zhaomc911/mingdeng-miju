import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Board } from './src/components/Board';
import {
  getIlluminationMap,
  isSolved,
  validateBulbConflicts,
  validateNumberedWalls,
} from './src/core/rules';
import { generateUniquePuzzle, GeneratedPuzzle, GeneratorDifficulty } from './src/core/generator/generator';
import { countSolutions, solve } from './src/core/solver/solver';
import { LEVELS } from './src/data/puzzles';
import { Board as BoardType, MarkState } from './src/types';

type ScreenMode = 'home' | 'campaign' | 'infinite' | 'game';
type ActiveGameKind = 'campaign' | 'infinite';

const CAMPAIGN_LEVEL_COUNT = 100;
const COMPLETED_LEVELS_STORAGE_KEY = 'mingdeng-miju.completed-level-ids';

function createEmptyMarks(board: BoardType): MarkState[][] {
  return board.map((row) => row.map(() => 'empty'));
}

function nextMarkState(mark: MarkState): MarkState {
  if (mark === 'empty') {
    return 'bulb';
  }
  if (mark === 'bulb') {
    return 'xmark';
  }
  return 'empty';
}

function loadCompletedLevelIds(): Set<number> {
  if (typeof globalThis.localStorage === 'undefined') {
    return new Set();
  }

  try {
    const raw = globalThis.localStorage.getItem(COMPLETED_LEVELS_STORAGE_KEY);
    if (raw === null) {
      return new Set();
    }

    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) {
      return new Set();
    }

    return new Set(ids.filter((id): id is number => Number.isInteger(id)));
  } catch {
    return new Set();
  }
}

function saveCompletedLevelIds(ids: Set<number>) {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  globalThis.localStorage.setItem(COMPLETED_LEVELS_STORAGE_KEY, JSON.stringify([...ids]));
}

function getLevelById(levelId: number) {
  return LEVELS.find((level) => level.id === levelId);
}

function isLevelUnlocked(levelId: number, completedLevelIds: Set<number>): boolean {
  if (levelId === 1) {
    return true;
  }

  const levelExists = getLevelById(levelId) !== undefined;
  return levelExists && completedLevelIds.has(levelId - 1);
}

function difficultyLabel(difficulty: GeneratorDifficulty): string {
  const labels: Record<GeneratorDifficulty, string> = {
    easy: '入门',
    medium: '进阶',
    hard: '高阶',
    expert: '宗师',
  };
  return labels[difficulty];
}

interface ModeCardProps {
  icon: string;
  title: string;
  caption: string;
  onPress: () => void;
  disabled?: boolean;
}

function ModeCard({ icon, title, caption, onPress, disabled }: ModeCardProps) {
  return (
    <Pressable style={[styles.modeCard, disabled ? styles.disabledCard : null]} onPress={onPress}>
      <View style={styles.modeSeal}>
        <Text style={styles.modeSealText}>{icon}</Text>
      </View>
      <View style={styles.modeCopy}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeCaption}>{caption}</Text>
      </View>
      <Text style={styles.modeArrow}>入</Text>
    </Pressable>
  );
}

interface ActionButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
  hint?: string;
  disabled?: boolean;
  variant?: 'primary' | 'dark' | 'danger';
}

function ActionButton({ label, icon, onPress, hint, disabled, variant = 'dark' }: ActionButtonProps) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === 'primary' ? styles.primaryAction : null,
        variant === 'dark' ? styles.darkAction : null,
        variant === 'danger' ? styles.dangerAction : null,
        disabled ? styles.disabledAction : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionCopy}>
        <Text style={styles.actionText}>{label}</Text>
        {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function App() {
  const [screenMode, setScreenMode] = useState<ScreenMode>('home');
  const [activeGameKind, setActiveGameKind] = useState<ActiveGameKind>('campaign');
  const [generatedPuzzle, setGeneratedPuzzle] = useState<GeneratedPuzzle | null>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [marks, setMarks] = useState<MarkState[][]>(() => createEmptyMarks(LEVELS[0].board));
  const [markHistory, setMarkHistory] = useState<MarkState[][][]>([]);
  const [completedLevelIds, setCompletedLevelIds] = useState<Set<number>>(() => loadCompletedLevelIds());
  const solutionCountCacheRef = useRef<Map<number, number>>(new Map());

  const currentLevel = LEVELS[levelIndex];
  const isInfiniteGame = activeGameKind === 'infinite' && generatedPuzzle !== null;
  const board = isInfiniteGame ? generatedPuzzle.board : currentLevel.board;

  const getLevelSolutionCount = (index: number) => {
    let solutionCount = solutionCountCacheRef.current.get(index);
    if (typeof solutionCount !== 'number') {
      solutionCount = countSolutions(LEVELS[index].board, 2);
      solutionCountCacheRef.current.set(index, solutionCount);
    }
    return solutionCount;
  };

  const illumination = useMemo(() => getIlluminationMap(board, marks), [board, marks]);
  const conflicts = useMemo(() => validateBulbConflicts(board, marks), [board, marks]);
  const wallValidations = useMemo(() => validateNumberedWalls(board, marks), [board, marks]);
  const solved = useMemo(() => isSolved(board, marks), [board, marks]);
  const currentSolutionCount = useMemo(
    () => (isInfiniteGame ? generatedPuzzle.solutionCount : getLevelSolutionCount(levelIndex)),
    [generatedPuzzle, isInfiniteGame, levelIndex]
  );
  const completedCount = completedLevelIds.size;

  useEffect(() => {
    saveCompletedLevelIds(completedLevelIds);
  }, [completedLevelIds]);

  useEffect(() => {
    if (!solved || isInfiniteGame) {
      return;
    }

    setCompletedLevelIds((prev) => {
      if (prev.has(currentLevel.id)) {
        return prev;
      }
      return new Set(prev).add(currentLevel.id);
    });
  }, [currentLevel.id, isInfiniteGame, solved]);

  const conflictSet = useMemo(() => {
    const set = new Set<string>();
    for (const pair of conflicts) {
      set.add(`${pair.a.row},${pair.a.col}`);
      set.add(`${pair.b.row},${pair.b.col}`);
    }
    return set;
  }, [conflicts]);

  const wallStatusMap = useMemo(() => {
    const map = new Map<string, 'ok' | 'over' | 'under'>();
    for (const wall of wallValidations) {
      map.set(`${wall.pos.row},${wall.pos.col}`, wall.status);
    }
    return map;
  }, [wallValidations]);

  const pushHistory = (snapshot: MarkState[][]) => {
    setMarkHistory((prev) => [...prev, snapshot.map((line) => [...line])]);
  };

  const handleWhiteCellPress = (row: number, col: number) => {
    if (board[row][col].kind !== 'white') {
      return;
    }

    setMarks((prev) => {
      pushHistory(prev);
      const next = prev.map((line) => [...line]);
      next[row][col] = nextMarkState(prev[row][col]);
      return next;
    });
  };

  const handleUndo = () => {
    if (markHistory.length === 0) {
      return;
    }

    const last = markHistory[markHistory.length - 1];
    setMarks(last.map((line) => [...line]));
    setMarkHistory((prev) => prev.slice(0, -1));
  };

  const handleReset = () => {
    pushHistory(marks);
    setMarks(createEmptyMarks(board));
  };

  const openLevel = (levelId: number) => {
    const level = getLevelById(levelId);
    if (level === undefined || !isLevelUnlocked(levelId, completedLevelIds)) {
      Alert.alert('Level Locked', '这一关还没有解锁。');
      return;
    }

    const nextIndex = LEVELS.findIndex((item) => item.id === levelId);
    const solutionCount = getLevelSolutionCount(nextIndex);
    if (solutionCount !== 1) {
      Alert.alert('Level Locked', '这一关不是唯一解题面，已阻止进入。');
      return;
    }

    setActiveGameKind('campaign');
    setLevelIndex(nextIndex);
    setMarks(createEmptyMarks(level.board));
    setMarkHistory([]);
    setScreenMode('game');
  };

  const handleGenerateInfinitePuzzle = (difficulty: GeneratorDifficulty) => {
    const puzzle = generateUniquePuzzle({ difficulty, maxAttempts: 300 });
    if (puzzle === null) {
      Alert.alert('无限模式', '生成失败，请再试一次。');
      return;
    }

    setGeneratedPuzzle(puzzle);
    setActiveGameKind('infinite');
    setMarks(createEmptyMarks(puzzle.board));
    setMarkHistory([]);
    setScreenMode('game');
  };

  const handleRegenerateInfinitePuzzle = () => {
    if (generatedPuzzle === null) {
      return;
    }

    handleGenerateInfinitePuzzle(generatedPuzzle.difficulty);
  };

  const handleShowSolution = () => {
    const result = solve(board);

    if (result.status === 'UNSOLVABLE') {
      Alert.alert('Show Solution', 'This puzzle has no solution.');
      return;
    }

    if (result.solution === null) {
      Alert.alert('Show Solution', 'No solution could be displayed.');
      return;
    }

    pushHistory(marks);
    setMarks(result.solution);

    if (result.status === 'MULTIPLE') {
      Alert.alert('Show Solution', 'This puzzle has multiple solutions. Showing one valid solution.');
    }
  };

  const handleNextLevel = () => {
    const nextLevel = LEVELS[levelIndex + 1];
    if (nextLevel === undefined) {
      Alert.alert('闯关模式', '已经是最后一关。');
      return;
    }

    if (!isLevelUnlocked(nextLevel.id, completedLevelIds)) {
      Alert.alert('下一关尚未开启', '先完成当前关，下一卷就会解封。');
      return;
    }

    setActiveGameKind('campaign');
    setLevelIndex(levelIndex + 1);
    setMarks(createEmptyMarks(nextLevel.board));
    setMarkHistory([]);
  };

  const handleResetProgress = () => {
    setCompletedLevelIds(new Set());
    setActiveGameKind('campaign');
    setLevelIndex(0);
    setMarks(createEmptyMarks(LEVELS[0].board));
    setMarkHistory([]);
  };

  const renderBrand = (subtitle: string) => (
    <View style={styles.brandBlock}>
      <Text style={styles.brandKicker}>灯谱一卷 · 照破迷局</Text>
      <Text style={styles.title}>明灯迷局</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.centerPanel}>
      {renderBrand('择一卷题谱，点一盏明灯。')}
      <View style={styles.cardStack}>
        <ModeCard icon="关" title="闯关模式" caption="固定百题，从初灯到长夜。" onPress={() => setScreenMode('campaign')} />
        <ModeCard icon="∞" title="无限模式" caption="即时生成唯一解灯谜。" onPress={() => setScreenMode('infinite')} />
        <ModeCard icon="弈" title="对决模式" caption="好友同题竞速，稍后开放。" onPress={() => Alert.alert('对决模式', 'Coming soon')} disabled />
      </View>
    </ScrollView>
  );

  const renderCampaign = () => (
    <ScrollView contentContainerStyle={styles.pagePanel}>
      <View style={styles.topBar}>
        <ActionButton label="返回" icon="回" onPress={() => setScreenMode('home')} />
        <ActionButton label="重置进度" icon="封" onPress={handleResetProgress} variant="danger" />
      </View>
      {renderBrand('闯关模式')}
      <View style={styles.progressPill}>
        <Text style={styles.progressPillText}>已通关 {completedCount} / {LEVELS.length}</Text>
      </View>
      <View style={styles.levelGrid}>
        {Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, index) => {
          const levelId = index + 1;
          const level = getLevelById(levelId);
          const isUnlocked = isLevelUnlocked(levelId, completedLevelIds);
          const isCompleted = completedLevelIds.has(levelId);
          const isPlayable = level !== undefined && isUnlocked;

          return (
            <Pressable
              key={levelId}
              style={[
                styles.levelButton,
                isPlayable ? styles.unlockedLevelButton : styles.lockedLevelButton,
                isCompleted ? styles.completedLevelButton : null,
              ]}
              onPress={() => openLevel(levelId)}
            >
              <Text style={[styles.levelButtonText, !isPlayable ? styles.lockedLevelText : null]}>{levelId}</Text>
              {!isPlayable ? <Text style={styles.lockedHint}>未启</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderInfinite = () => {
    const difficulties: Array<{ difficulty: GeneratorDifficulty; title: string; caption: string; seal: string }> = [
      { difficulty: 'easy', title: 'Easy · 5x5', caption: '随机生成唯一解短卷，适合热手。', seal: '初' },
      { difficulty: 'medium', title: 'Medium · 10x10', caption: '随机生成中卷，线索开始交错。', seal: '中' },
      { difficulty: 'hard', title: 'Hard · 15x15', caption: '随机生成长卷，视线牵制明显。', seal: '难' },
      { difficulty: 'expert', title: 'Expert · 25x25 实验', caption: '随机生成大幅灯谱，给硬核解谜者。', seal: '宗' },
    ];

    return (
      <ScrollView contentContainerStyle={styles.pagePanel}>
        <View style={styles.topBar}>
          <ActionButton label="返回" icon="回" onPress={() => setScreenMode('home')} />
        </View>
        {renderBrand('无限模式')}
        <View style={styles.cardStack}>
          {difficulties.map((item) => (
            <ModeCard
              key={item.difficulty}
              icon={item.seal}
              title={item.title}
              caption={item.caption}
              onPress={() => handleGenerateInfinitePuzzle(item.difficulty)}
            />
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderGame = () => {
    const title = isInfiniteGame ? '无限模式' : '闯关模式';
    const levelLabel = isInfiniteGame ? '随机生成题' : `第 ${currentLevel.id} / ${CAMPAIGN_LEVEL_COUNT} 关`;
    const levelTitle = isInfiniteGame
      ? `${difficultyLabel(generatedPuzzle.difficulty)} · ${generatedPuzzle.size} · 第 ${generatedPuzzle.attempts} 次成题`
      : `${currentLevel.title} · ${currentLevel.size} · ${currentLevel.difficulty}`;

    return (
      <ScrollView contentContainerStyle={styles.gamePanel}>
        <View style={styles.gameHeader}>
          <Text style={styles.brandKicker}>灯谱开卷</Text>
          <Text style={styles.gameTitle}>{title}</Text>
          <Text style={styles.levelLabel}>{levelLabel}</Text>
          <Text style={styles.levelTitle}>{levelTitle}</Text>
          {!isInfiniteGame ? <Text style={styles.progressLabel}>已通关 {completedCount} / {LEVELS.length}</Text> : null}
          {solved ? <Text style={styles.solvedBanner}>已解 · 明灯俱燃</Text> : null}
          <Text style={[styles.solutionBadge, currentSolutionCount === 1 ? styles.uniqueBadge : styles.invalidBadge]}>
            {currentSolutionCount === 1 ? '唯一解' : currentSolutionCount === 0 ? '无解' : '多解'}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <ActionButton
            label={isInfiniteGame ? '换卷' : '关卡'}
            hint={isInfiniteGame ? '重新选难度' : '返回关卡列表'}
            icon="卷"
            onPress={() => setScreenMode(isInfiniteGame ? 'infinite' : 'campaign')}
            variant="primary"
          />
          {isInfiniteGame ? (
            <ActionButton label="新卷" hint="同难度随机" icon="新" onPress={handleRegenerateInfinitePuzzle} variant="primary" />
          ) : (
            <ActionButton label="续卷" hint="进入下一关" icon="次" onPress={handleNextLevel} disabled={!solved} variant="primary" />
          )}
          <ActionButton label="回溯" hint="撤销一步" icon="返" onPress={handleUndo} disabled={markHistory.length === 0} />
          <ActionButton label="拂去" hint="清空标记" icon="拂" onPress={handleReset} />
          <ActionButton label="显影" hint="显示答案" icon="解" onPress={handleShowSolution} />
        </View>

        <Board
          board={board}
          marks={marks}
          illumination={illumination}
          conflictBulbSet={conflictSet}
          wallStatusMap={wallStatusMap}
          onWhiteCellPress={({ row, col }) => handleWhiteCellPress(row, col)}
        />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.paperGlow} />
      <View style={styles.inkWash} />
      {screenMode === 'home' ? renderHome() : null}
      {screenMode === 'campaign' ? renderCampaign() : null}
      {screenMode === 'infinite' ? renderInfinite() : null}
      {screenMode === 'game' ? renderGame() : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4ead7',
  },
  paperGlow: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#f8d889',
    opacity: 0.28,
  },
  inkWash: {
    position: 'absolute',
    bottom: -160,
    left: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: '#6f1d1b',
    opacity: 0.08,
  },
  centerPanel: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 44,
  },
  pagePanel: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 44,
  },
  gamePanel: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 48,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandKicker: {
    color: '#9a3412',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#231815',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b4f3f',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 18,
  },
  cardStack: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 920,
    width: '100%',
  },
  modeCard: {
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    borderColor: '#8a4b25',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#3f1f14',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  disabledCard: {
    opacity: 0.62,
  },
  modeSeal: {
    alignItems: 'center',
    backgroundColor: '#9f1d16',
    borderColor: '#f3c15d',
    borderRadius: 16,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  modeSealText: {
    color: '#fff3d1',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 24,
    fontWeight: '900',
  },
  modeCopy: {
    flex: 1,
  },
  modeTitle: {
    color: '#24130f',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 23,
    fontWeight: '900',
  },
  modeCaption: {
    color: '#7a5848',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  modeArrow: {
    color: '#a0441d',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 18,
    fontWeight: '900',
  },
  progressPill: {
    alignSelf: 'center',
    backgroundColor: '#2c1812',
    borderColor: '#d8a339',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  progressPillText: {
    color: '#ffe6a3',
    fontSize: 13,
    fontWeight: '800',
  },
  levelGrid: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,247,230,0.72)',
    borderColor: '#c99a52',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: 760,
    padding: 16,
  },
  levelButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  unlockedLevelButton: {
    backgroundColor: '#fff2cf',
    borderColor: '#b7791f',
  },
  completedLevelButton: {
    backgroundColor: '#e7c66b',
    borderColor: '#7c2d12',
  },
  lockedLevelButton: {
    backgroundColor: '#d9c9ad',
    borderColor: '#b6a284',
  },
  levelButtonText: {
    color: '#24130f',
    fontSize: 16,
    fontWeight: '900',
  },
  lockedLevelText: {
    color: '#8b7a64',
  },
  lockedHint: {
    color: '#8b7a64',
    fontSize: 9,
    fontWeight: '800',
  },
  gameHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  gameTitle: {
    color: '#231815',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  levelLabel: {
    color: '#7c2d12',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  levelTitle: {
    color: '#6b4f3f',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  progressLabel: {
    color: '#6b4f3f',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  analysisPanel: {
    backgroundColor: 'rgba(255,247,230,0.78)',
    borderColor: '#d4a54f',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  analysisLabel: {
    color: '#6f1d1b',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  solvedBanner: {
    alignSelf: 'center',
    backgroundColor: '#f6e6ad',
    borderColor: '#9f1d16',
    borderRadius: 999,
    borderWidth: 1,
    color: '#7c2d12',
    fontWeight: '900',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  solutionBadge: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  uniqueBadge: {
    backgroundColor: '#2c1812',
    borderColor: '#d8a339',
    color: '#ffe6a3',
  },
  invalidBadge: {
    backgroundColor: '#f4d7cf',
    borderColor: '#9f1d16',
    color: '#7f1d1d',
  },
  buttonRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 18,
    maxWidth: 940,
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 126,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#2a160f',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryAction: {
    backgroundColor: '#a0441d',
    borderColor: '#f1c15d',
  },
  darkAction: {
    backgroundColor: '#2c1812',
    borderColor: '#8a4b25',
  },
  dangerAction: {
    backgroundColor: '#7f1d1d',
    borderColor: '#f1c15d',
  },
  disabledAction: {
    opacity: 0.45,
  },
  actionIcon: {
    color: '#ffe6a3',
    fontFamily: 'Songti SC, STSong, serif',
    fontSize: 16,
    fontWeight: '900',
  },
  actionCopy: {
    alignItems: 'center',
  },
  actionText: {
    color: '#fff7e6',
    fontSize: 14,
    fontWeight: '900',
  },
  actionHint: {
    color: '#f6d99d',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
});
