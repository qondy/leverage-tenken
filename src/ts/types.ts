import { Timestamp } from 'firebase/firestore';

/** レバレッジ診断の5観点キー */
export type AxisKey = 'reproducibility' | 'systemize' | 'compounding' | 'roi' | 'rootcause';

/** 5観点のスコア（各 1〜5） */
export type AxisScores = Record<AxisKey, number>;

/** 労力 × レバレッジ の4象限キー */
export type QuadrantKey = 'now' | 'build' | 'gap' | 'trim';

export interface Item {
  id: string;
  title: string;
  /** かかる労力・時間の大きさ（1〜5） */
  effort: number;
  scores: AxisScores;
  note: string;
  archived: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** 週次ふりかえりのスナップショット */
export interface Snapshot {
  id: string;
  /** そのときの平均レバレッジスコア（1〜5） */
  avgLeverage: number;
  /** 対象にしていた取り組み数（アーカイブ除く） */
  itemCount: number;
  /** 象限ごとの件数 */
  quadrantCounts: Record<QuadrantKey, number>;
  createdAt: Timestamp | null;
}
