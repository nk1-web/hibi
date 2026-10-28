export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// data-ref="name" を集めて { name: el } にする
export function refs(root) {
  const out = {};
  root.querySelectorAll('[data-ref]').forEach((el) => (out[el.dataset.ref] = el));
  return out;
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
}

export function haptic() {
  if (navigator.vibrate) navigator.vibrate(8);
}
