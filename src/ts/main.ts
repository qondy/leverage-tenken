import { onAuthChange, loginWithGoogle, logout } from './auth';
import {
  showToast, openOverlay, closeOverlay, textEl, formatDay,
} from './ui';
import { submitFeedback } from './feedback';
import {
  AXES, DEFAULT_SCORES, axisLabel, leverageScore, leveragePercent,
  quadrantOf, quadrantDef, improvementHints, QUADRANTS,
} from './leverage';
import {
  subscribeItems, createItem, updateItem, deleteItem, ItemInput,
} from './items';
import {
  subscribeSnapshots, createSnapshot, deleteSnapshot,
} from './snapshots';
import { renderMatrix, renderTrend } from './charts';
import { AxisKey, AxisScores, Item, QuadrantKey, Snapshot } from './types';

// ============================================================
// DOM refs
// ============================================================
const loginScreen = document.getElementById('login-screen') as HTMLElement;
const appEl = document.getElementById('app') as HTMLElement;
const userInfo = document.getElementById('user-info') as HTMLElement;
const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;
const userName = document.getElementById('user-name') as HTMLElement;
const btnGoogleLogin = document.getElementById('btn-google-login') as HTMLButtonElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

const itemForm = document.getElementById('item-form') as HTMLFormElement;
const inputTitle = document.getElementById('input-title') as HTMLInputElement;
const inputEffort = document.getElementById('input-effort') as HTMLInputElement;
const effortValue = document.getElementById('effort-value') as HTMLElement;
const axisSliders = document.getElementById('axis-sliders') as HTMLElement;
const inputNote = document.getElementById('input-note') as HTMLTextAreaElement;
const liveVerdict = document.getElementById('live-verdict') as HTMLElement;
const btnItemSubmit = document.getElementById('btn-item-submit') as HTMLButtonElement;
const btnItemCancelEdit = document.getElementById('btn-item-cancel-edit') as HTMLButtonElement;
const formTitleEl = document.getElementById('form-title') as HTMLElement;

const matrixMount = document.getElementById('matrix-mount') as HTMLElement;
const matrixEmpty = document.getElementById('matrix-empty') as HTMLElement;
const quadrantLegend = document.getElementById('quadrant-legend') as HTMLElement;

const itemListEl = document.getElementById('item-list') as HTMLElement;
const itemEmpty = document.getElementById('item-empty') as HTMLElement;
const archivedItemListEl = document.getElementById('archived-item-list') as HTMLElement;
const archivedCountEl = document.getElementById('archived-count') as HTMLElement;

const statAvg = document.getElementById('stat-avg') as HTMLElement;
const statActive = document.getElementById('stat-active') as HTMLElement;
const btnSnapshot = document.getElementById('btn-snapshot') as HTMLButtonElement;
const trendMount = document.getElementById('trend-mount') as HTMLElement;
const trendEmpty = document.getElementById('trend-empty') as HTMLElement;
const snapshotListEl = document.getElementById('snapshot-list') as HTMLElement;

const confirmDialogTitle = document.getElementById('confirm-dialog-title') as HTMLElement;
const confirmOverlay = document.getElementById('confirm-dialog-overlay') as HTMLElement;
const btnConfirmCancel = document.getElementById('btn-confirm-cancel') as HTMLButtonElement;
const btnConfirmDelete = document.getElementById('btn-confirm-delete') as HTMLButtonElement;

const feedbackBtn = document.getElementById('feedback-btn') as HTMLButtonElement;
const feedbackOverlay = document.getElementById('feedback-modal-overlay') as HTMLElement;
const inputFeedbackMessage = document.getElementById('input-feedback-message') as HTMLTextAreaElement;
const btnFeedbackClose = document.getElementById('btn-feedback-close') as HTMLButtonElement;
const btnFeedbackSend = document.getElementById('btn-feedback-send') as HTMLButtonElement;

// ============================================================
// State
// ============================================================
let currentUid: string | null = null;
let unsubscribeItems: (() => void) | null = null;
let unsubscribeSnapshots: (() => void) | null = null;
let allItems: Item[] = [];
let allSnapshots: Snapshot[] = [];
let editingId: string | null = null;
let freshItemId: string | null = null;

const axisInputs = {} as Record<AxisKey, HTMLInputElement>;

type PendingDelete =
  | { type: 'item'; id: string; label: string }
  | { type: 'snapshot'; id: string; label: string };
let pendingDelete: PendingDelete | null = null;

const EFFORT_LABELS = ['', 'ごく軽い', '軽い', 'そこそこ', '重い', 'かなり重い'];
const SCORE_LABELS = ['', '低い', 'やや低い', 'ふつう', 'やや高い', '高い'];

// ============================================================
// スライダーの生成
// ============================================================
function buildAxisSliders(): void {
  AXES.forEach((axis) => {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const head = document.createElement('div');
    head.className = 'slider-row__head';
    const label = document.createElement('label');
    label.className = 'slider-row__label';
    label.setAttribute('for', `axis-${axis.key}`);
    label.textContent = axis.label;
    const bubble = textEl('span', 'slider-row__value', SCORE_LABELS[DEFAULT_SCORES[axis.key]]);
    bubble.id = `axis-${axis.key}-value`;
    head.append(label, bubble);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '1';
    input.max = '5';
    input.step = '1';
    input.value = String(DEFAULT_SCORES[axis.key]);
    input.id = `axis-${axis.key}`;
    input.className = 'slider';

    const hint = textEl('p', 'slider-row__hint', axis.hint);

    input.addEventListener('input', () => {
      bubble.textContent = SCORE_LABELS[Number(input.value)];
      updateLiveVerdict();
    });

    row.append(head, input, hint);
    axisSliders.append(row);
    axisInputs[axis.key] = input;
  });
}

function readScoresFromForm(): AxisScores {
  const out = { ...DEFAULT_SCORES };
  AXES.forEach((a) => { out[a.key] = Number(axisInputs[a.key].value); });
  return out;
}

function updateLiveVerdict(): void {
  const scores = readScoresFromForm();
  const effort = Number(inputEffort.value);
  const pct = leveragePercent(scores);
  const q = quadrantDef(quadrantOf({ effort, scores }));
  liveVerdict.innerHTML = '';
  liveVerdict.append(
    textEl('span', 'live-verdict__pct', `レバレッジ度 ${pct}%`),
    textEl('span', `live-verdict__quad live-verdict__quad--${q.tone}`, `${q.icon} ${q.label}`),
  );
}

// ============================================================
// フォーム初期化 / 編集モード
// ============================================================
function resetForm(): void {
  editingId = null;
  itemForm.reset();
  inputEffort.value = '3';
  effortValue.textContent = EFFORT_LABELS[3];
  AXES.forEach((a) => {
    axisInputs[a.key].value = String(DEFAULT_SCORES[a.key]);
    const b = document.getElementById(`axis-${a.key}-value`);
    if (b) b.textContent = SCORE_LABELS[DEFAULT_SCORES[a.key]];
  });
  formTitleEl.textContent = '取り組みを点検する';
  btnItemSubmit.textContent = '点検して登録';
  btnItemCancelEdit.classList.add('hidden');
  updateLiveVerdict();
}

function startEdit(item: Item): void {
  editingId = item.id;
  inputTitle.value = item.title;
  inputEffort.value = String(item.effort);
  effortValue.textContent = EFFORT_LABELS[item.effort];
  inputNote.value = item.note;
  AXES.forEach((a) => {
    axisInputs[a.key].value = String(item.scores[a.key]);
    const b = document.getElementById(`axis-${a.key}-value`);
    if (b) b.textContent = SCORE_LABELS[item.scores[a.key]];
  });
  formTitleEl.textContent = '診断を見直す';
  btnItemSubmit.textContent = '更新する';
  btnItemCancelEdit.classList.remove('hidden');
  updateLiveVerdict();
  itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

inputEffort.addEventListener('input', () => {
  effortValue.textContent = EFFORT_LABELS[Number(inputEffort.value)];
  updateLiveVerdict();
});

btnItemCancelEdit.addEventListener('click', () => resetForm());

itemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUid || btnItemSubmit.disabled) return;
  const title = inputTitle.value.trim();
  if (!title) return;

  const input: ItemInput = {
    title,
    effort: Number(inputEffort.value),
    scores: readScoresFromForm(),
    note: inputNote.value.trim(),
  };

  btnItemSubmit.disabled = true;
  const uid = currentUid;
  const task = editingId
    ? updateItem(uid, editingId, input).then(() => editingId as string)
    : createItem(uid, input);

  task
    .then((id) => {
      freshItemId = id;
      showToast(editingId ? '更新しました' : '点検結果を登録しました');
      resetForm();
      window.setTimeout(() => {
        document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    })
    .catch((err: Error) => showToast('保存に失敗しました: ' + err.message))
    .finally(() => { btnItemSubmit.disabled = false; });
});

// ============================================================
// Auth
// ============================================================
onAuthChange((user) => {
  if (unsubscribeItems) { unsubscribeItems(); unsubscribeItems = null; }
  if (unsubscribeSnapshots) { unsubscribeSnapshots(); unsubscribeSnapshots = null; }

  if (user) {
    currentUid = user.uid;
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userAvatar.src = user.photoURL || '';
    userAvatar.alt = '';
    userName.textContent = user.displayName || user.email || '';

    unsubscribeItems = subscribeItems(currentUid, (items) => {
      allItems = items;
      renderMatrixSection();
      renderItems();
      renderReview();
    });
    unsubscribeSnapshots = subscribeSnapshots(currentUid, (snaps) => {
      allSnapshots = snaps;
      renderReview();
    });
  } else {
    currentUid = null;
    allItems = [];
    allSnapshots = [];
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    userInfo.classList.add('hidden');
  }
});

btnGoogleLogin.addEventListener('click', () => {
  loginWithGoogle().catch((e: Error) => showToast('ログインに失敗しました: ' + e.message));
});

btnLogout.addEventListener('click', () => { logout(); });

// ============================================================
// マトリクス
// ============================================================
function activeItems(): Item[] {
  return allItems.filter((it) => !it.archived);
}

function renderMatrixSection(): void {
  const active = activeItems();
  matrixMount.innerHTML = '';
  matrixEmpty.classList.toggle('hidden', active.length > 0);
  if (active.length > 0) {
    matrixMount.append(renderMatrix(allItems, (item) => startEdit(item)));
  }

  const counts = countByQuadrant(active);
  quadrantLegend.innerHTML = '';
  QUADRANTS.forEach((q) => {
    const row = document.createElement('div');
    row.className = `quad-chip quad-chip--${q.tone}`;
    row.append(
      textEl('span', 'quad-chip__icon', q.icon),
      textEl('span', 'quad-chip__label', q.label),
      textEl('span', 'quad-chip__count', String(counts[q.key])),
    );
    quadrantLegend.append(row);
  });
}

function countByQuadrant(items: Item[]): Record<QuadrantKey, number> {
  const counts: Record<QuadrantKey, number> = { now: 0, build: 0, gap: 0, trim: 0 };
  items.forEach((it) => { counts[quadrantOf(it)] += 1; });
  return counts;
}

// ============================================================
// 取り組み一覧
// ============================================================
function renderItems(): void {
  itemListEl.innerHTML = '';
  archivedItemListEl.innerHTML = '';

  const active = allItems.filter((it) => !it.archived);
  const archived = allItems.filter((it) => it.archived);

  itemEmpty.classList.toggle('hidden', active.length > 0);
  active.forEach((it) => itemListEl.append(renderItemCard(it)));
  archived.forEach((it) => archivedItemListEl.append(renderItemCard(it)));
  archivedCountEl.textContent = String(archived.length);
}

function renderItemCard(item: Item): HTMLElement {
  const q = quadrantDef(quadrantOf(item));
  const card = document.createElement('div');
  card.className = 'item-card' + (item.archived ? ' is-archived' : '');
  card.id = `item-${item.id}`;
  if (item.id === freshItemId) card.classList.add('is-fresh');

  // head
  const head = document.createElement('div');
  head.className = 'item-card__head';
  head.append(textEl('span', 'item-card__title', item.title));
  head.append(textEl('span', `item-card__quad item-card__quad--${q.tone}`, `${q.icon} ${q.label}`));
  card.append(head);

  // meters
  const pct = leveragePercent(item.scores);
  const meta = document.createElement('div');
  meta.className = 'item-card__meta';
  meta.append(textEl('span', 'item-card__lev', `レバレッジ度 ${pct}%`));
  meta.append(textEl('span', 'item-card__effort', `労力 ${EFFORT_LABELS[item.effort]}`));
  card.append(meta);

  // axis bars
  const bars = document.createElement('div');
  bars.className = 'axis-bars';
  AXES.forEach((a) => {
    const s = item.scores[a.key];
    const b = document.createElement('div');
    b.className = 'axis-bar';
    b.append(textEl('span', 'axis-bar__label', a.label));
    const track = document.createElement('span');
    track.className = 'axis-bar__track';
    const fill = document.createElement('span');
    fill.className = 'axis-bar__fill' + (s <= 2 ? ' is-weak' : '');
    fill.style.width = `${((s - 1) / 4) * 100}%`;
    track.append(fill);
    b.append(track);
    b.append(textEl('span', 'axis-bar__num', String(s)));
    bars.append(b);
  });
  card.append(bars);

  // note
  if (item.note) card.append(textEl('div', 'item-card__note', item.note));

  // quadrant advice
  card.append(textEl('div', 'item-card__advice', q.advice));

  // improvement hints
  const hints = improvementHints(item.scores);
  if (hints.length > 0) {
    const box = document.createElement('div');
    box.className = 'hint-box';
    box.append(textEl('div', 'hint-box__head', '💡 効かせるための問いかけ'));
    hints.forEach((h) => {
      const row = document.createElement('div');
      row.className = 'hint-box__row';
      row.append(textEl('div', 'hint-box__axis', `${axisLabel(h.axis)}（${h.score}）`));
      row.append(textEl('div', 'hint-box__q', h.question));
      row.append(textEl('div', 'hint-box__tip', h.tip));
      box.append(row);
    });
    card.append(box);
  }

  // footer actions
  const footer = document.createElement('div');
  footer.className = 'item-card__footer';

  const editBtn = textEl('button', 'btn btn--ghost btn--sm', '✏️ 見直す');
  editBtn.setAttribute('type', 'button');
  editBtn.addEventListener('click', () => startEdit(item));

  const archiveBtn = textEl('button', 'btn btn--ghost btn--sm', item.archived ? '↩ 戻す' : '📦 アーカイブ');
  archiveBtn.setAttribute('type', 'button');
  archiveBtn.addEventListener('click', () => {
    if (!currentUid) return;
    updateItem(currentUid, item.id, { archived: !item.archived })
      .catch(() => showToast('更新に失敗しました'));
  });

  const delBtn = textEl('button', 'btn btn--ghost btn--sm is-danger', '🗑 削除');
  delBtn.setAttribute('type', 'button');
  delBtn.addEventListener('click', () => {
    pendingDelete = { type: 'item', id: item.id, label: item.title };
    confirmDialogTitle.textContent = `「${item.title}」を削除しますか？`;
    openOverlay(confirmOverlay);
  });

  footer.append(editBtn, archiveBtn, delBtn);
  card.append(footer);

  return card;
}

// ============================================================
// 週次ふりかえり
// ============================================================
function currentAvgLeverage(items: Item[]): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((s, it) => s + leverageScore(it.scores), 0);
  return sum / items.length;
}

function renderReview(): void {
  const active = activeItems();
  const avg = currentAvgLeverage(active);
  statAvg.textContent = active.length > 0 ? avg.toFixed(1) : '—';
  statActive.textContent = String(active.length);

  // trend
  trendMount.innerHTML = '';
  trendEmpty.classList.toggle('hidden', allSnapshots.length > 0);
  if (allSnapshots.length > 0) {
    trendMount.append(renderTrend(allSnapshots));
  }

  // snapshot list
  snapshotListEl.innerHTML = '';
  [...allSnapshots].reverse().forEach((snap) => {
    const row = document.createElement('div');
    row.className = 'snap-row';
    const when = snap.createdAt ? formatDay(snap.createdAt.toDate()) : '—';
    row.append(textEl('span', 'snap-row__date', when));
    row.append(textEl('span', 'snap-row__avg', `平均 ${snap.avgLeverage.toFixed(1)}`));
    row.append(textEl('span', 'snap-row__count', `${snap.itemCount}件`));
    const trim = snap.quadrantCounts.trim;
    row.append(textEl('span', 'snap-row__trim', `やめる候補 ${trim}`));
    const del = textEl('button', 'icon-btn is-danger', '🗑');
    del.setAttribute('type', 'button');
    del.setAttribute('aria-label', '記録を削除');
    del.addEventListener('click', () => {
      pendingDelete = { type: 'snapshot', id: snap.id, label: `${when} の記録` };
      confirmDialogTitle.textContent = `${when} のふりかえり記録を削除しますか？`;
      openOverlay(confirmOverlay);
    });
    row.append(del);
    snapshotListEl.append(row);
  });
}

btnSnapshot.addEventListener('click', () => {
  if (!currentUid || btnSnapshot.disabled) return;
  const active = activeItems();
  if (active.length === 0) {
    showToast('取り組みを登録してから記録できます');
    return;
  }
  btnSnapshot.disabled = true;
  createSnapshot(currentUid, {
    avgLeverage: currentAvgLeverage(active),
    itemCount: active.length,
    quadrantCounts: countByQuadrant(active),
  })
    .then(() => showToast('今週のふりかえりを記録しました'))
    .catch((err: Error) => showToast('記録に失敗しました: ' + err.message))
    .finally(() => { btnSnapshot.disabled = false; });
});

// ============================================================
// 削除確認ダイアログ（共通）
// ============================================================
btnConfirmCancel.addEventListener('click', () => {
  pendingDelete = null;
  closeOverlay(confirmOverlay);
});

btnConfirmDelete.addEventListener('click', () => {
  if (!currentUid || !pendingDelete || btnConfirmDelete.disabled) return;
  btnConfirmDelete.disabled = true;
  const uid = currentUid;
  const target = pendingDelete;

  const task = target.type === 'item'
    ? deleteItem(uid, target.id)
    : deleteSnapshot(uid, target.id);

  task
    .then(() => {
      showToast('削除しました');
      if (target.type === 'item' && editingId === target.id) resetForm();
    })
    .catch((err: Error) => showToast('削除に失敗しました: ' + err.message))
    .finally(() => {
      btnConfirmDelete.disabled = false;
      pendingDelete = null;
      closeOverlay(confirmOverlay);
    });
});

// ============================================================
// 要望送信モーダル
// ============================================================
feedbackBtn.addEventListener('click', () => {
  inputFeedbackMessage.value = '';
  openOverlay(feedbackOverlay);
});

btnFeedbackClose.addEventListener('click', () => closeOverlay(feedbackOverlay));

btnFeedbackSend.addEventListener('click', () => {
  const message = inputFeedbackMessage.value.trim();
  if (!message || btnFeedbackSend.disabled) return;
  btnFeedbackSend.disabled = true;
  submitFeedback(message)
    .then((ok) => {
      showToast(ok ? '送信しました。ありがとうございます！' : '送信に失敗しました');
      if (ok) closeOverlay(feedbackOverlay);
    })
    .finally(() => { btnFeedbackSend.disabled = false; });
});

// ============================================================
// init
// ============================================================
buildAxisSliders();
resetForm();
