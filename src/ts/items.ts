import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { AxisScores, Item } from './types';
import { AXES, DEFAULT_SCORES } from './leverage';

function toScores(raw: DocumentData | undefined): AxisScores {
  const out = { ...DEFAULT_SCORES };
  if (raw && typeof raw === 'object') {
    AXES.forEach((a) => {
      const v = Number(raw[a.key]);
      if (Number.isFinite(v)) out[a.key] = Math.min(5, Math.max(1, Math.round(v)));
    });
  }
  return out;
}

function toItem(id: string, data: DocumentData): Item {
  const effort = Number(data.effort);
  return {
    id,
    title: data.title ?? '',
    effort: Number.isFinite(effort) ? Math.min(5, Math.max(1, Math.round(effort))) : 3,
    scores: toScores(data.scores),
    note: data.note ?? '',
    archived: data.archived ?? false,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export interface ItemInput {
  title: string;
  effort: number;
  scores: AxisScores;
  note: string;
}

export function subscribeItems(uid: string, callback: (items: Item[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'items'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => toItem(d.id, d.data())));
  });
}

export function createItem(uid: string, input: ItemInput): Promise<string> {
  return addDoc(collection(db, 'users', uid, 'items'), {
    title: input.title,
    effort: input.effort,
    scores: input.scores,
    note: input.note,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then((ref) => ref.id);
}

export function updateItem(
  uid: string,
  itemId: string,
  patch: Partial<Pick<Item, 'title' | 'effort' | 'scores' | 'note' | 'archived'>>,
): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'items', itemId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export function deleteItem(uid: string, itemId: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'items', itemId));
}
