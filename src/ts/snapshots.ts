import {
  collection, onSnapshot, doc, addDoc, deleteDoc,
  query, orderBy, serverTimestamp, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { QuadrantKey, Snapshot } from './types';

const EMPTY_COUNTS: Record<QuadrantKey, number> = { now: 0, build: 0, gap: 0, trim: 0 };

function toSnapshot(id: string, data: DocumentData): Snapshot {
  const rawCounts = (data.quadrantCounts ?? {}) as DocumentData;
  const quadrantCounts: Record<QuadrantKey, number> = { ...EMPTY_COUNTS };
  (Object.keys(EMPTY_COUNTS) as QuadrantKey[]).forEach((k) => {
    const v = Number(rawCounts[k]);
    if (Number.isFinite(v)) quadrantCounts[k] = v;
  });
  return {
    id,
    avgLeverage: Number(data.avgLeverage) || 0,
    itemCount: Number(data.itemCount) || 0,
    quadrantCounts,
    createdAt: data.createdAt ?? null,
  };
}

export interface SnapshotInput {
  avgLeverage: number;
  itemCount: number;
  quadrantCounts: Record<QuadrantKey, number>;
}

export function subscribeSnapshots(uid: string, callback: (snaps: Snapshot[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'snapshots'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => toSnapshot(d.id, d.data())));
  });
}

export function createSnapshot(uid: string, input: SnapshotInput): Promise<string> {
  return addDoc(collection(db, 'users', uid, 'snapshots'), {
    avgLeverage: input.avgLeverage,
    itemCount: input.itemCount,
    quadrantCounts: input.quadrantCounts,
    createdAt: serverTimestamp(),
  }).then((ref) => ref.id);
}

export function deleteSnapshot(uid: string, snapshotId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'snapshots', snapshotId));
}
