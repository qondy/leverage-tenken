export function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

export function openOverlay(overlay: HTMLElement): void {
  overlay.classList.add('is-open');
}

export function closeOverlay(overlay: HTMLElement): void {
  overlay.classList.remove('is-open');
}

/** ユーザー入力テキストを安全に表示するための要素を作る（innerHTML不使用） */
export function textEl(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/** 固定の(開発者定義の)線画アイコンSVG + ラベルテキストを表示する要素を作る。
 *  アイコンはコンパイル時定数のみを渡すこと(innerHTMLを使うのはアイコン部分のみで、labelは常にtextContent扱い)。 */
export function iconTextEl(tag: string, className: string, iconSvg: string, label: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  const iconSpan = document.createElement('span');
  iconSpan.className = 'inline-icon';
  iconSpan.innerHTML = iconSvg;
  el.append(iconSpan, document.createTextNode(` ${label}`));
  return el;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function formatDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}
