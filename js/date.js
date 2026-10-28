export const pad = (n) => String(n).padStart(2, '0');

export const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// 日曜はじまり
export function weekStart(key) {
  const d = parseKey(key);
  d.setDate(d.getDate() - d.getDay());
  return dayKey(d);
}

export const isToday = (key) => key === dayKey();
export const isTomorrow = (key) => key === addDays(dayKey(), 1);

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export const fmtTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// 時刻ラベル用。先頭の0を落とす（7:00）
export const fmtTimeShort = (m) => `${Math.floor(m / 60)}:${pad(m % 60)}`;

export function parseTime(s) {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function fmtDuration(m) {
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}時間${m % 60}分` : `${h}時間`;
}

export function fmtDateJa(key, { weekday = true } = {}) {
  const d = parseKey(key);
  const base = `${d.getMonth() + 1}月${d.getDate()}日`;
  return weekday ? `${base}（${WEEK[d.getDay()]}）` : base;
}

export const snap = (m, step = 30) => Math.max(0, Math.min(1440 - step, Math.floor(m / step) * step));
