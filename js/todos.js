// やることの編集と、時刻の見せ方
import * as store from './store.js';
import { h, esc, refs, haptic } from './ui.js';
import { openSheet, confirmSheet } from './sheet.js';
import { icons } from './icons.js';
import { dayKey, nowMinutes, fmtTime, fmtTimeShort, parseTime, snap } from './date.js';

export const hasTime = (t) => t.time != null;

// 今日のもので、決めた時刻を過ぎている
export function isOverdue(t) {
  return !t.done && t.day === dayKey() && t.time != null && t.time <= nowMinutes();
}

export const timeLabel = (t) => (t.time != null ? `${fmtTimeShort(t.time)}まで` : '');

export function openTodoEditor(todo, { day = dayKey() } = {}) {
  const isNew = !todo;
  const t = todo ? { ...todo } : { id: store.uid(), title: '', day, time: null, notify: true, memo: '', done: false, doneAt: null };
  const defaultTime = () => (r.date.value === dayKey() ? Math.min(snap(nowMinutes() + 60), 23 * 60 + 30) : 9 * 60);

  const body = h(`
    <form class="form" autocomplete="off">
      <input class="title-input" data-ref="title" placeholder="やることを入力" maxlength="60" value="${esc(t.title)}">
      <div class="group">
        <label class="row"><span>日付</span><input type="date" data-ref="date" value="${t.day}" required></label>
        <label class="row"><span>時刻を決める</span><input type="checkbox" class="switch" data-ref="hasTime" ${t.time != null ? 'checked' : ''}></label>
        <label class="row" data-ref="timeRow"><span>時刻</span><input type="time" data-ref="time" value="${t.time != null ? fmtTime(t.time) : ''}"></label>
        <label class="row" data-ref="notifyRow">
          <span class="row-main"><b>通知</b><small>時刻の前にカレンダーから知らせる</small></span>
          <input type="checkbox" class="switch" data-ref="notify" ${t.notify !== false ? 'checked' : ''}>
        </label>
      </div>
      <div class="group">
        <textarea data-ref="memo" rows="3" placeholder="メモ">${esc(t.memo)}</textarea>
      </div>
      ${isNew ? '' : `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}このやることを削除</button>`}
    </form>`);
  const r = refs(body);

  const sync = () => (r.timeRow.hidden = r.notifyRow.hidden = !r.hasTime.checked);
  r.hasTime.addEventListener('change', () => {
    if (r.hasTime.checked && !r.time.value) r.time.value = fmtTime(defaultTime());
    sync();
  });
  sync();

  function save() {
    const title = r.title.value.trim();
    if (!title) {
      r.title.classList.remove('is-shake');
      void r.title.offsetWidth;
      r.title.classList.add('is-shake');
      r.title.focus();
      return false;
    }
    const time = r.hasTime.checked ? parseTime(r.time.value) : null;
    store.saveTodo({ ...t, title, day: r.date.value || t.day, time, notify: r.notify.checked, memo: r.memo.value.trim() });
    haptic();
  }

  body.addEventListener('submit', (e) => e.preventDefault());
  const sheet = openSheet({ title: isNew ? 'やることを追加' : 'やることを編集', body, confirm: { label: '保存', onConfirm: save } });
  r.del?.addEventListener('click', async () => {
    if (await confirmSheet({ title: 'やることを削除', message: `「${t.title}」を削除します。`, okLabel: '削除', danger: true })) {
      store.deleteTodo(t.id);
      sheet.close();
    }
  });
  if (isNew) r.title.focus();
}
