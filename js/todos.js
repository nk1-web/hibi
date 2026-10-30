// やることの編集と、期限の見せ方
import * as store from './store.js';
import { h, esc, refs, haptic } from './ui.js';
import { openSheet, confirmSheet } from './sheet.js';
import { icons } from './icons.js';
import { dayKey, addDays, isToday, isTomorrow, nowMinutes, fmtTime, fmtTimeShort, parseTime, fmtDateJa, snap } from './date.js';

export const hasDueTime = (t) => !!t.due && t.time != null;

export function isOverdue(t) {
  if (!t.due || t.done) return false;
  const today = dayKey();
  if (t.due < today) return true;
  return t.due === today && t.time != null && t.time <= nowMinutes();
}

export function dueLabel(t) {
  if (!t.due) return '';
  const day = isToday(t.due) ? '今日' : isTomorrow(t.due) ? '明日' : t.due === addDays(dayKey(), -1) ? '昨日' : fmtDateJa(t.due);
  return t.time != null ? `${day} ${fmtTimeShort(t.time)}` : `${day}まで`;
}

// 期限のクイック選択。日付を指定したときだけ日付の欄を出す
const DUE_CHIPS = [
  { id: 'none', label: '期限なし' },
  { id: 'today', label: '今日' },
  { id: 'tomorrow', label: '明日' },
  { id: 'pick', label: '日付を指定' },
];

function dueChip(due) {
  if (!due) return 'none';
  if (isToday(due)) return 'today';
  if (isTomorrow(due)) return 'tomorrow';
  return 'pick';
}

export function openTodoEditor(todo) {
  const isNew = !todo;
  const t = todo ? { ...todo } : { id: store.uid(), title: '', due: null, time: null, notify: true, memo: '', done: false, doneAt: null };
  const defaultTime = () => (r.date.value === dayKey() ? Math.min(snap(nowMinutes() + 60), 23 * 60 + 30) : 9 * 60);

  const body = h(`
    <form class="form" autocomplete="off">
      <input class="title-input" data-ref="title" placeholder="やることを入力" maxlength="60" value="${esc(t.title)}">
      <div class="chips" data-ref="dueChips">${DUE_CHIPS.map(
        (c) => `<button type="button" class="chip is-due ${c.id === dueChip(t.due) ? 'is-on' : ''}" data-due="${c.id}">${c.label}</button>`
      ).join('')}</div>
      <div class="group" data-ref="dueGroup">
        <label class="row" data-ref="dateRow"><span>日付</span><input type="date" data-ref="date" value="${t.due || ''}"></label>
        <label class="row"><span>時刻を決める</span><input type="checkbox" class="switch" data-ref="hasTime" ${t.time != null ? 'checked' : ''}></label>
        <label class="row" data-ref="timeRow"><span>時刻</span><input type="time" data-ref="time" value="${t.time != null ? fmtTime(t.time) : ''}"></label>
        <label class="row" data-ref="notifyRow">
          <span class="row-main"><b>通知</b><small>期限の前にカレンダーから知らせる</small></span>
          <input type="checkbox" class="switch" data-ref="notify" ${t.notify !== false ? 'checked' : ''}>
        </label>
      </div>
      <div class="group">
        <textarea data-ref="memo" rows="3" placeholder="メモ">${esc(t.memo)}</textarea>
      </div>
      ${isNew ? '' : `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}このやることを削除</button>`}
    </form>`);
  const r = refs(body);
  let chip = dueChip(t.due);

  function sync() {
    r.dueChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.due === chip));
    r.dueGroup.hidden = chip === 'none';
    r.dateRow.hidden = chip !== 'pick';
    r.timeRow.hidden = r.notifyRow.hidden = !r.hasTime.checked;
  }

  r.dueChips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-due]');
    if (!b) return;
    chip = b.dataset.due;
    if (chip === 'today') r.date.value = dayKey();
    else if (chip === 'tomorrow') r.date.value = addDays(dayKey(), 1);
    else if (chip === 'pick' && !r.date.value) r.date.value = addDays(dayKey(), 2);
    sync();
  });
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
    const due = chip === 'none' ? null : r.date.value || null;
    const time = due && r.hasTime.checked ? parseTime(r.time.value) : null;
    store.saveTodo({ ...t, title, due, time, notify: r.notify.checked, memo: r.memo.value.trim() });
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
