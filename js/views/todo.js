import * as store from '../store.js';
import { h, esc, refs, toast, haptic } from '../ui.js';
import { icons } from '../icons.js';
import { confirmSheet } from '../sheet.js';
import { openTodoEditor, dueLabel, isOverdue, hasDueTime } from '../todos.js';
import { openAlarmSheet, calDirty } from '../alarm.js';
import { dayKey } from '../date.js';

const GAP = 8; // 行と行のすきま（CSS の margin-bottom と同じ）
const DONE_DELAY = 420; // チェックが付くのを見せてから下へ送る

export function createTodo() {
  const el = h(`
    <section class="view view-todo">
      <header class="head">
        <div class="head-title">
          <p class="eyebrow" data-ref="count"></p>
          <h1>やること</h1>
        </div>
        <div class="head-actions">
          <button class="round-btn glass" data-act="alarm" aria-label="通知とアラーム">${icons.bell}<i class="badge" data-ref="badge" hidden></i></button>
        </div>
      </header>
      <div class="scroller todo-scroll" data-ref="scroll">
        <div class="todo-list" data-ref="list"></div>
        <p class="todo-hint" data-ref="hint"></p>
        <div data-ref="done"></div>
      </div>
    </section>`);
  const r = refs(el);
  let showDone = false;
  const checking = new Set(); // 完了アニメーション中

  function row(t, i) {
    const due = dueLabel(t);
    const late = isOverdue(t);
    const notify = hasDueTime(t) && t.notify !== false;
    return `<div class="todo ${i === 0 ? 'is-first' : ''}" data-id="${t.id}">
      <span class="todo-rank">${i + 1}</span>
      <button class="todo-check" data-act="check" aria-label="「${esc(t.title)}」を完了にする"><i>${icons.check}</i></button>
      <button class="todo-main" data-act="edit">
        <b>${esc(t.title)}</b>
        ${due || t.memo ? `<small class="${late ? 'is-late' : ''}">${due ? `${notify ? icons.bellSmall : ''}${due}${late ? '・期限切れ' : ''}` : ''}${t.memo ? `<span>${due ? '・' : ''}${esc(t.memo)}</span>` : ''}</small>` : ''}
      </button>
      <span class="todo-grip" data-grip aria-label="ドラッグして順番を変える">${icons.grip}</span>
    </div>`;
  }

  function refresh() {
    if (drag) return;
    const active = store.activeTodos();
    const done = store.doneTodos();
    r.count.textContent = active.length ? `優先順に ${active.length} 件` : '優先順に';
    const dirty = calDirty();
    r.badge.hidden = !dirty;
    r.badge.textContent = 1;

    r.list.innerHTML = active.length
      ? active.map(row).join('')
      : `<div class="empty">
          <svg viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="24" y="14" width="64" height="72" rx="10"/><path d="M40 36h34M40 50h26M40 64h18"/>
            <path d="M84 58l8 8 16-17" class="accent"/>
          </svg>
          <b>${done.length ? 'ぜんぶ終わりました' : 'やることはまだありません'}</b>
          <p>${done.length ? 'おつかれさまでした。' : '思いついたら右下の＋から入れておきましょう。<br>上にあるものほど優先です。'}</p>
        </div>`;
    r.hint.hidden = active.length < 2;
    r.hint.innerHTML = `右の${icons.grip}をドラッグすると、順番を入れ替えられます`;

    r.done.innerHTML = done.length
      ? `<button class="todo-done-head" data-act="toggleDone">
           <span>完了<b>${done.length}</b></span>${icons.chevronR}
         </button>
         ${showDone ? `<div class="todo-done-list">${done
           .map(
             (t) => `<div class="todo is-done" data-id="${t.id}">
               <button class="todo-check" data-act="uncheck" aria-label="「${esc(t.title)}」を未完了に戻す"><i>${icons.check}</i></button>
               <button class="todo-main" data-act="edit"><b>${esc(t.title)}</b></button>
             </div>`
           )
           .join('')}
           <button class="btn is-plain" data-act="clearDone">完了したものを消す</button>
         </div>` : ''}`
      : '';
    r.done.classList.toggle('is-open', showDone);
  }

  /* ---------- つまみをドラッグして並べ替え ---------- */

  let drag = null;

  function beginDrag(rowEl, e) {
    const rows = [...r.list.querySelectorAll('.todo')];
    const from = rows.indexOf(rowEl);
    drag = {
      rowEl,
      rows,
      from,
      to: from,
      tops: rows.map((x) => x.offsetTop),
      heights: rows.map((x) => x.offsetHeight),
      step: rowEl.offsetHeight + GAP,
      startY: e.clientY,
      lastY: e.clientY,
      startScroll: r.scroll.scrollTop,
      id: rowEl.dataset.id,
    };
    rowEl.classList.add('is-dragging');
    r.list.classList.add('is-sorting');
    navigator.vibrate?.(10);
    requestAnimationFrame(autoScroll);
  }

  function applyDrag() {
    const d = drag;
    const dy = d.lastY - d.startY + (r.scroll.scrollTop - d.startScroll);
    const minDy = -d.tops[d.from];
    const maxDy = d.tops[d.rows.length - 1] + d.heights[d.rows.length - 1] - d.tops[d.from] - d.heights[d.from];
    const y = Math.min(Math.max(dy, minDy - 12), maxDy + 12);
    d.rowEl.style.transform = `translateY(${y}px) scale(1.02)`;

    // 持っている行の中心が、ほかの行の中心をこえたら入れ替える
    const center = d.tops[d.from] + y + d.heights[d.from] / 2;
    let to = 0;
    d.rows.forEach((_, i) => {
      if (i !== d.from && d.tops[i] + d.heights[i] / 2 < center) to++;
    });
    if (to !== d.to) {
      d.to = to;
      haptic();
    }
    // 番号は場所に付いたまま。動いた行は新しい番号に変わる
    d.rows.forEach((x, i) => {
      let pos = i;
      let shift = 0;
      if (i === d.from) pos = to;
      else if (d.from < to && i > d.from && i <= to) (pos = i - 1), (shift = -d.step);
      else if (to < d.from && i >= to && i < d.from) (pos = i + 1), (shift = d.step);
      if (i !== d.from) x.style.transform = shift ? `translateY(${shift}px)` : '';
      x.querySelector('.todo-rank').textContent = pos + 1;
      x.classList.toggle('is-first', pos === 0);
    });
  }

  function autoScroll() {
    if (!drag) return;
    const rect = r.scroll.getBoundingClientRect();
    const y = drag.lastY;
    let v = 0;
    if (y < rect.top + 60) v = -Math.min(12, (rect.top + 60 - y) / 4 + 2);
    else if (y > rect.bottom - 140) v = Math.min(12, (y - (rect.bottom - 140)) / 4 + 2);
    if (v) {
      const before = r.scroll.scrollTop;
      r.scroll.scrollTop += v;
      if (r.scroll.scrollTop !== before) applyDrag();
    }
    requestAnimationFrame(autoScroll);
  }

  r.list.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const grip = e.target.closest('[data-grip]');
    if (!grip) return;
    e.preventDefault();
    beginDrag(grip.closest('.todo'), e);
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.lastY = e.clientY;
    applyDrag();
  });

  function endDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    r.list.classList.remove('is-sorting');
    d.rowEl.classList.remove('is-dragging');
    d.rows.forEach((x) => (x.style.transform = ''));
    if (d.to !== d.from) store.moveTodo(d.id, d.to);
    else refresh();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  r.scroll.addEventListener('touchmove', (e) => {
    if (drag) e.preventDefault();
  }, { passive: false });

  /* ---------- タップ ---------- */

  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const id = e.target.closest('[data-id]')?.dataset.id;
    const todo = id && store.todos().find((t) => t.id === id);

    if (act === 'alarm') return openAlarmSheet(dayKey());
    if (act === 'toggleDone') {
      showDone = !showDone;
      return refresh();
    }
    if (act === 'clearDone') {
      const n = store.doneTodos().length;
      const ok = await confirmSheet({ title: '完了したものを消す', message: `完了した ${n} 件を一覧から消します。`, okLabel: '消す', danger: true });
      if (ok) store.clearDoneTodos();
      return;
    }
    if (!todo) return;
    if (act === 'edit') return openTodoEditor(todo);
    if (act === 'check') {
      if (checking.has(id)) return;
      checking.add(id);
      e.target.closest('.todo').classList.add('is-checking');
      haptic();
      setTimeout(() => {
        checking.delete(id);
        store.setTodoDone(id, true);
        toast(`「${todo.title.length > 14 ? todo.title.slice(0, 13) + '…' : todo.title}」を完了しました`);
      }, DONE_DELAY);
      return;
    }
    if (act === 'uncheck') {
      store.setTodoDone(id, false);
      toast('未完了に戻しました');
    }
  });

  return {
    el,
    refresh,
    add() {
      openTodoEditor(null);
    },
  };
}
