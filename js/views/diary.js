import * as store from '../store.js';
import { h, esc } from '../ui.js';
import { icons } from '../icons.js';
import { WEEK, parseKey, dayKey } from '../date.js';
import { openDiaryEditor } from '../editors.js';

export function createDiary() {
  const el = h(`
    <section class="view view-diary">
      <header class="head">
        <div class="head-title">
          <p class="eyebrow">ふり返り</p>
          <h1>日記</h1>
        </div>
      </header>
      <div class="scroller diary-list"></div>
    </section>`);
  const list = el.querySelector('.diary-list');

  function refresh() {
    const days = store.allDays();
    const keys = Object.keys(days)
      .filter((k) => days[k].diary)
      .sort()
      .reverse();

    if (!keys.length) {
      list.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 18h56a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8H22z"/><path d="M22 18v68M36 36h34M36 48h26M36 60h18"/>
            <path d="M92 30l10 10-26 26H66V56z" class="accent"/>
          </svg>
          <b>まだ日記がありません</b>
          <p>一日のおわりに、予定と実績を見ながら書いてみましょう。</p>
          <button class="btn is-primary" data-key="${dayKey()}">今日の日記を書く</button>
        </div>`;
      return;
    }

    let month = '';
    list.innerHTML = keys
      .map((k) => {
        const d = parseKey(k);
        const day = days[k];
        const s = store.daySummary(day);
        const ym = `${d.getFullYear()}年${d.getMonth() + 1}月`;
        const sep = ym !== month ? `<p class="diary-month">${ym}</p>` : '';
        month = ym;
        return `${sep}
          <button class="entry" data-key="${k}">
            <span class="entry-date"><b>${d.getDate()}</b><small>${WEEK[d.getDay()]}</small></span>
            <span class="entry-main">
              ${day.diary.title ? `<b>${esc(day.diary.title)}</b>` : ''}
              <p>${esc(day.diary.body)}</p>
              ${s.plans ? `<small>${icons.checkCircle}予定 ${s.plans} のうち ${s.done} 完了</small>` : ''}
            </span>
          </button>`;
      })
      .join('');
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) openDiaryEditor(b.dataset.key);
  });

  return { el, refresh };
}
