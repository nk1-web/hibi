import * as store from '../store.js';
import { h, refs } from '../ui.js';
import { icons } from '../icons.js';
import { WEEK, parseKey, isToday, pad } from '../date.js';

export function createCalendar(ctx) {
  const el = h(`
    <section class="view view-calendar">
      <header class="head">
        <div class="head-title">
          <p class="eyebrow" data-ref="year"></p>
          <h1 data-ref="month"></h1>
        </div>
        <div class="head-actions">
          <button class="round-btn glass" data-act="prev" aria-label="前の月">${icons.chevronL}</button>
          <button class="round-btn glass" data-act="next" aria-label="次の月">${icons.chevronR}</button>
        </div>
      </header>
      <div class="scroller">
        <div class="cal-week">${WEEK.map((w, i) => `<span class="${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}">${w}</span>`).join('')}</div>
        <div class="cal-grid" data-ref="grid"></div>
        <div class="cal-stats" data-ref="stats"></div>
      </div>
    </section>`);
  const r = refs(el);
  let cursor = null; // 表示中の月の 1 日

  function refresh() {
    if (!cursor) {
      const d = parseKey(ctx.day);
      cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    r.year.textContent = `${y}年`;
    r.month.textContent = `${m + 1}月`;

    const days = store.allDays();
    const lead = cursor.getDay();
    const count = new Date(y, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-cell is-blank"></span>';

    let recordedDays = 0;
    let diaries = 0;
    let plans = 0;
    let done = 0;
    for (let d = 1; d <= count; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const day = days[k];
      const s = day ? store.daySummary(day) : null;
      if (s && (s.actuals || s.plans)) recordedDays++;
      if (day?.diary) diaries++;
      if (s) {
        plans += s.plans;
        done += s.done;
      }
      const pct = s && s.plans ? Math.round((s.done / s.plans) * 100) : 0;
      const dow = (lead + d - 1) % 7;
      cells += `<button class="cal-cell ${isToday(k) ? 'is-today' : ''} ${k === ctx.day ? 'is-sel' : ''} ${dow === 0 ? 'is-sun' : dow === 6 ? 'is-sat' : ''}" data-key="${k}">
        <b>${d}</b>
        ${s && s.plans ? `<span class="cal-bar" style="--p:${pct}%"></span>` : '<span class="cal-bar is-none"></span>'}
        ${day?.diary ? '<i class="cal-diary"></i>' : ''}
      </button>`;
    }
    r.grid.innerHTML = cells;

    r.stats.innerHTML = `
      <div><b>${recordedDays}<small>日</small></b><span>記録した日</span></div>
      <div><b>${plans ? Math.round((done / plans) * 100) : 0}<small>%</small></b><span>予定の達成</span></div>
      <div><b>${diaries}<small>件</small></b><span>日記</span></div>`;
  }

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev' || act === 'next') {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (act === 'prev' ? -1 : 1), 1);
      return refresh();
    }
    const cell = e.target.closest('[data-key]');
    if (cell) ctx.openDay(cell.dataset.key);
  });

  return {
    el,
    refresh,
    onShow() {
      const d = parseKey(ctx.day);
      cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    },
  };
}
