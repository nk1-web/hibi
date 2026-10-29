// データはすべて端末内（localStorage）。サーバーには送らない。
const KEY = 'hibi:v1';

export const CATS = [
  { id: 'life', label: '生活' },
  { id: 'work', label: '仕事' },
  { id: 'study', label: '学び' },
  { id: 'move', label: '運動' },
  { id: 'rest', label: '休息' },
  { id: 'other', label: 'その他' },
];

const NO_LINK = { kind: 'none', value: '' };

// 最初から入っている「よく使う予定」。設定から消したり、予定から追加したりできる
const DEFAULT_PRESETS = [
  { title: '起床', cat: 'life', duration: 15, alarm: true },
  { title: '朝ごはん', cat: 'life', duration: 30 },
  { title: '朝ラン', cat: 'move', duration: 45, link: { kind: 'spotify', value: '' } },
  { title: '通勤', cat: 'life', duration: 45 },
  { title: '集中作業', cat: 'work', duration: 90 },
  { title: 'ミーティング', cat: 'work', duration: 60 },
  { title: '昼ごはん', cat: 'life', duration: 60 },
  { title: '勉強', cat: 'study', duration: 60 },
  { title: '筋トレ', cat: 'move', duration: 45 },
  { title: '夕ごはん', cat: 'life', duration: 60 },
  { title: 'お風呂', cat: 'life', duration: 30 },
  { title: '読書', cat: 'rest', duration: 30 },
  { title: '就寝', cat: 'rest', duration: 30 },
].map((p, i) => ({ id: `d${i}`, alarm: false, link: NO_LINK, ...p }));

const defaults = () => ({
  version: 1,
  days: {},
  presets: DEFAULT_PRESETS.map((p) => ({ ...p })),
  settings: { shortcutName: 'hibi アラーム', calShortcutName: 'hibi カレンダー', calSync: null, dayStartHour: 6 },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults(), ...parsed, settings: { ...defaults().settings, ...parsed.settings } };
    }
  } catch {}
  return defaults();
}

const notify = () => listeners.forEach((fn) => fn());

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const emptyDay = () => ({ plans: [], actuals: [], diary: null });

export function getDay(key) {
  return state.days[key] || emptyDay();
}

export function allDays() {
  return state.days;
}

function editDay(key, fn) {
  const day = state.days[key] || (state.days[key] = emptyDay());
  fn(day);
  if (!day.plans.length && !day.actuals.length && !day.diary) delete state.days[key];
  commit();
}

const byStart = (a, b) => a.start - b.start || a.end - b.end;

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
  list.sort(byStart);
}

export function savePlan(key, plan) {
  editDay(key, (d) => upsert(d.plans, plan));
}

export function deletePlan(key, id) {
  editDay(key, (d) => {
    d.plans = d.plans.filter((p) => p.id !== id);
    d.actuals.forEach((a) => {
      if (a.planId === id) a.planId = null;
    });
  });
}

export function saveActual(key, actual) {
  editDay(key, (d) => upsert(d.actuals, actual));
}

export function deleteActual(key, id) {
  editDay(key, (d) => {
    d.actuals = d.actuals.filter((a) => a.id !== id);
  });
}

// ドラッグで時間を動かしたとき
export function setTimes(key, type, id, start, end) {
  editDay(key, (d) => {
    const list = type === 'plan' ? d.plans : d.actuals;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    item.start = start;
    item.end = end;
    list.sort(byStart);
  });
}

export function findItem(key, type, id) {
  const d = getDay(key);
  return (type === 'plan' ? d.plans : d.actuals).find((x) => x.id === id);
}

/* ---------- コピーと貼り付け（アプリを開いている間だけ保持） ---------- */

let clip = null;

export const getClip = () => clip;

export function copyItem(key, type, id) {
  const item = findItem(key, type, id);
  if (!item) return;
  clip = { type, item: { ...item } };
  notify();
}

export function clearClip() {
  clip = null;
  notify();
}

// 同じ時刻に貼り付ける。実績は元の予定とのつながりを外す
export function pasteClip(key) {
  if (!clip) return null;
  const id = uid();
  const item = { ...clip.item, id };
  if (clip.type === 'plan') {
    item.skipped = false;
    item.alarmSent = null;
    savePlan(key, item);
  } else {
    item.planId = null;
    saveActual(key, item);
  }
  return { type: clip.type, id };
}

/* ---------- プリセット ---------- */

export const presets = () => state.presets;

export function addPreset(plan) {
  state.presets.push({
    id: uid(),
    title: plan.title,
    cat: plan.cat,
    duration: plan.end - plan.start,
    alarm: !!plan.alarm,
    link: plan.link || NO_LINK,
  });
  commit();
}

export function deletePreset(id) {
  state.presets = state.presets.filter((p) => p.id !== id);
  commit();
}

export function resetPresets() {
  state.presets = DEFAULT_PRESETS.map((p) => ({ ...p }));
  commit();
}

export function setDiary(key, diary) {
  editDay(key, (d) => {
    d.diary = diary && (diary.title.trim() || diary.body.trim()) ? diary : null;
  });
}

// 前日の予定を、実績やスキップを外してコピーする
export function copyPlans(fromKey, toKey) {
  const src = getDay(fromKey).plans;
  editDay(toKey, (d) => {
    src.forEach((p) => {
      d.plans.push({ ...p, id: uid(), skipped: false, alarmSent: null });
    });
    d.plans.sort(byStart);
  });
}

export function planStatus(day, plan) {
  if (day.actuals.some((a) => a.planId === plan.id)) return 'done';
  if (plan.skipped) return 'skipped';
  return 'todo';
}

export function daySummary(day) {
  let done = 0;
  let skipped = 0;
  day.plans.forEach((p) => {
    const s = planStatus(day, p);
    if (s === 'done') done++;
    else if (s === 'skipped') skipped++;
  });
  const recorded = day.actuals.reduce((sum, a) => sum + (a.end - a.start), 0);
  return { plans: day.plans.length, done, skipped, actuals: day.actuals.length, recorded };
}

export function settings() {
  return state.settings;
}

export function setSetting(k, v) {
  state.settings[k] = v;
  commit();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

// 設定は残して、予定・実績・日記だけを消す
export function wipe() {
  state.days = {};
  commit();
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.days !== 'object') throw new Error('hibi のバックアップではありません');
  state = { ...defaults(), ...parsed, settings: { ...defaults().settings, ...parsed.settings } };
  commit();
}
