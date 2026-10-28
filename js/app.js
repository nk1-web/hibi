import * as store from './store.js';
import { icons } from './icons.js';
import { dayKey } from './date.js';
import { createToday } from './views/today.js';
import { createCalendar } from './views/calendar.js';
import { createDiary } from './views/diary.js';
import { createSettings } from './views/settings.js';

const TABS = [
  { id: 'today', label: '今日', icon: icons.today },
  { id: 'calendar', label: 'カレンダー', icon: icons.calendar },
  { id: 'diary', label: '日記', icon: icons.diary },
  { id: 'settings', label: '設定', icon: icons.settings },
];

const ctx = {
  day: dayKey(),
  tab: 'today',
  openDay(key) {
    ctx.day = key;
    go('today');
  },
};

const viewsEl = document.getElementById('views');
const tabbar = document.getElementById('tabbar');
const indicator = tabbar.querySelector('.tab-indicator');
const fab = document.getElementById('fab');

const views = {
  today: createToday(ctx),
  calendar: createCalendar(ctx),
  diary: createDiary(ctx),
  settings: createSettings(ctx),
};
Object.values(views).forEach((v) => {
  v.el.hidden = true;
  viewsEl.append(v.el);
});

tabbar.insertAdjacentHTML(
  'beforeend',
  TABS.map((t) => `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${t.icon}<span>${t.label}</span></button>`).join('')
);
fab.innerHTML = icons.plus;

function moveIndicator() {
  const btn = tabbar.querySelector(`[data-tab="${ctx.tab}"]`);
  if (!btn) return;
  indicator.style.width = `${btn.offsetWidth}px`;
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function go(tab) {
  ctx.tab = tab;
  Object.entries(views).forEach(([id, v]) => (v.el.hidden = id !== tab));
  tabbar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  views[tab].onShow?.();
  views[tab].refresh();
  tabbar.classList.remove('is-compact');
  requestAnimationFrame(moveIndicator);
  history.replaceState(null, '', `#${tab}`);
}

tabbar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  if (b.dataset.tab === 'today' && ctx.tab === 'today') ctx.day = dayKey();
  go(b.dataset.tab);
});

fab.addEventListener('click', () => {
  if (ctx.tab !== 'today') go('today');
  views.today.add();
});

store.subscribe(() => views[ctx.tab].refresh());

// 下にスクロールしたらタブバーを小さくする（iOS 26 の挙動）
const lastY = new WeakMap();
viewsEl.addEventListener(
  'scroll',
  (e) => {
    const t = e.target;
    if (!t.classList?.contains('scroller')) return;
    const y = t.scrollTop;
    const prev = lastY.get(t) ?? y;
    if (Math.abs(y - prev) < 6) return;
    tabbar.classList.toggle('is-compact', y > prev && y > 40);
    lastY.set(t, y);
  },
  true
);

// 日付をまたいでアプリに戻ったら「今日」を更新
let lastToday = dayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = dayKey();
  if (now !== lastToday) {
    if (ctx.day === lastToday) ctx.day = now;
    lastToday = now;
  }
  views[ctx.tab].refresh();
});

window.addEventListener('resize', moveIndicator);

// 起動直後はインジケーターを滑らせずに置く
indicator.style.transition = 'none';
const initial = location.hash.slice(1);
go(TABS.some((t) => t.id === initial) ? initial : 'today');
requestAnimationFrame(() => requestAnimationFrame(() => (indicator.style.transition = '')));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
