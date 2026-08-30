// ============================================================
// レバレッジ点検 — 診断ロジック（内蔵ルールのみ。外部AIは使わない）
// ============================================================
import { AxisKey, AxisScores, Item, QuadrantKey } from './types';

export interface AxisDef {
  key: AxisKey;
  label: string;
  /** スライダー下の補足 */
  hint: string;
  /** スコアが低い（1〜2）ときに出す問いかけ */
  lowQuestion: string;
  /** スコアが低いときの改善のヒント */
  lowTip: string;
}

export const AXES: AxisDef[] = [
  {
    key: 'reproducibility',
    label: '再現性',
    hint: '一度やると、次から速く・楽にできるようになるか',
    lowQuestion: 'この作業、次に同じことをするときも「またゼロから」やっていませんか？',
    lowTip: '手順をテンプレート・チェックリスト・スニペットにして、2回目以降の時間を半分にできないか考える。',
  },
  {
    key: 'systemize',
    label: '仕組み化・委任',
    hint: 'ツール・自動化・他の人に渡せるか',
    lowQuestion: 'これは自分がやる必要がありますか？ ツールや他の人に渡せませんか？',
    lowTip: '判断が要らない定型部分を自動化・マクロに寄せる。人に任せられる境界を1つ決める。',
  },
  {
    key: 'compounding',
    label: '積み上がり',
    hint: 'やった分が資産・スキル・信頼として残るか',
    lowQuestion: 'やった分が積み上がる実感がありますか？ 終わったら消えてしまう作業ではありませんか？',
    lowTip: '成果物をドキュメント・コンテンツ・スキル・関係など「後から効く形」で残せないか考える。',
  },
  {
    key: 'roi',
    label: '労力対効果',
    hint: 'かけた労力に対して返ってくる成果が釣り合っているか',
    lowQuestion: 'かけている労力に対して、返ってくる成果は釣り合っていますか？',
    lowTip: '8割の成果を2割の労力で出せるやり方に削る。「そもそも着手しない」も選択肢に入れる。',
  },
  {
    key: 'rootcause',
    label: '根本解決',
    hint: '問題の根っこに効くか（対症療法の繰り返しになっていないか）',
    lowQuestion: 'これは問題の「根っこ」に効いていますか？ 同じ火消しを繰り返していませんか？',
    lowTip: 'なぜこの作業が発生するのか原因を1つ特定し、その発生自体を減らす手を1つ決める。',
  },
];

export function axisLabel(key: AxisKey): string {
  return AXES.find((a) => a.key === key)?.label ?? key;
}

export const DEFAULT_SCORES: AxisScores = {
  reproducibility: 3,
  systemize: 3,
  compounding: 3,
  roi: 3,
  rootcause: 3,
};

/** 中央値（1〜5スケールの真ん中）。これ以上で「高い」と判定 */
export const HIGH_THRESHOLD = 3;

/** 取り組みの平均レバレッジスコア（1〜5） */
export function leverageScore(scores: AxisScores): number {
  const vals = AXES.map((a) => scores[a.key]);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** 0〜100 に正規化した「レバレッジ度」 */
export function leveragePercent(scores: AxisScores): number {
  return Math.round(((leverageScore(scores) - 1) / 4) * 100);
}

export interface QuadrantDef {
  key: QuadrantKey;
  label: string;
  icon: string;
  /** そのマスに入ったときの方針 */
  advice: string;
  /** 強調色クラス（scss側） */
  tone: 'go' | 'build' | 'gap' | 'trim';
}

export const QUADRANTS: QuadrantDef[] = [
  {
    key: 'now',
    label: '今すぐやる',
    icon: '🚀',
    advice: '高レバレッジで労力も軽い。最優先。今日のうちに着手する。',
    tone: 'go',
  },
  {
    key: 'build',
    label: '仕組み化して取り組む',
    icon: '🏗',
    advice: '効くが重い。まとまった時間を確保する価値あり。小さく分解し、再現できる形（テンプレ・自動化）を作りながら進める。',
    tone: 'build',
  },
  {
    key: 'gap',
    label: 'スキマ時間で',
    icon: '☕',
    advice: 'たいして効かないが軽い。まとまった時間は使わない。移動中や待ち時間にまとめて片づける。',
    tone: 'gap',
  },
  {
    key: 'trim',
    label: 'やめる・減らす・任せる',
    icon: '✂️',
    advice: '労力が重いのに効いていない。最大の改善余地。やめる／頻度を下げる／人やツールに渡す、のどれかを決める。',
    tone: 'trim',
  },
];

export function quadrantOf(item: Pick<Item, 'effort' | 'scores'>): QuadrantKey {
  const highLeverage = leverageScore(item.scores) >= HIGH_THRESHOLD;
  const highEffort = item.effort >= HIGH_THRESHOLD;
  if (highLeverage && !highEffort) return 'now';
  if (highLeverage && highEffort) return 'build';
  if (!highLeverage && !highEffort) return 'gap';
  return 'trim';
}

export function quadrantDef(key: QuadrantKey): QuadrantDef {
  return QUADRANTS.find((q) => q.key === key) as QuadrantDef;
}

export interface ImprovementHint {
  axis: AxisKey;
  score: number;
  question: string;
  tip: string;
}

/**
 * 取り組みの弱い観点（スコアが低い順）から改善ヒントを返す。
 * - スコア 2 以下の観点を優先。無ければ最も低い観点を1つだけ。
 */
export function improvementHints(scores: AxisScores, max = 2): ImprovementHint[] {
  const ranked = [...AXES]
    .map((a) => ({ def: a, score: scores[a.key] }))
    .sort((x, y) => x.score - y.score);

  let picks = ranked.filter((r) => r.score <= 2);
  if (picks.length === 0) picks = ranked.slice(0, 1);

  return picks.slice(0, max).map((r) => ({
    axis: r.def.key,
    score: r.score,
    question: r.def.lowQuestion,
    tip: r.def.lowTip,
  }));
}
