import * as store from '../store.js';
import { h, esc, refs, toast } from '../ui.js';
import { icons } from '../icons.js';
import { confirmSheet } from '../sheet.js';
import { openPlanEditor, openPlanDetail, openActualEditor, openDiaryEditor } from '../editors.js';
import { openAlarmSheet, pendingCount } from '../alarm.js';
import { linkUrl } from '../links.js';
import {
  WEEK, parseKey, addDays, weekStart, dayKey, isToday, nowMinutes, fmtTimeShort, fmtDuration, fmtDateJa, snap,
} from '../date.js';

export const HOUR = 56;
// ブロックの最小の高さ（22px）にあたる分数。短い予定どうしが見た目で重ならないように使う
const MIN_SPAN = Math.ceil((22 / HOUR) * 60);
const DRAG_SNAP = 5;
const MIN_LEN = 10;
const LONG_PRESS = 380;

// 重なった予定を横に並べるためのレーン割り当て
function layout(items) {
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    cluster.forEach((it) => {
      let lane = lanes.findIndex((end) => end <= it.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = visEnd(it);
      out.push({ it, lane });
    });
    const n = lanes.length;
    out.slice(-cluster.length).forEach((o) => (o.lanes = n));
    cluster = [];
  };
  [...items].sort((a, b) => a.start - b.start).forEach((it) => {
    if (it.start >= clusterEnd && cluster.length) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, visEnd(it));
  });
  if (cluster.length) flush();
  return out;
}

const visEnd = (it) => Math.max(it.end, it.start + MIN_SPAN);
const blockTop = (m) => (m / 60) * HOUR;
const blockHeight = (s, e) => Math.max(((e - s) / 60) * HOUR - 2, 22);

function blockStyle({ it, lane, lanes }) {
  const w = 100 / lanes;
  return `top:${blockTop(it.start)}px;height:${blockHeight(it.start, it.end)}px;left:calc(${lane * w}% + ${lane ? 2 : 0}px);width:calc(${w}% - ${lanes > 1 ? 2 : 0}px);--c:var(--c-${it.cat})`;
}

export function createToday(ctx) {
  const el = h(`
    <section class="view view-today">
      <header class="head">
        <div class="head-title">
          <p class="eyebrow" data-ref="ym"></p>
          <h1 data-ref="date"></h1>
        </div>
        <div class="head-actions">
          <button class="pill-btn glass" data-act="today" hidden>今日</button>
          <button class="round-btn glass" data-act="diary" aria-label="日記">${icons.diary}</button>
          <button class="round-btn glass" data-act="alarm" aria-label="通知とアラーム">${icons.bell}<i class="badge" data-ref="badge" hidden></i></button>
        </div>
      </header>
      <div class="week" data-ref="week"></div>
      <div class="summary" data-ref="summary"></div>
      <div class="scroller tl-scroll" data-ref="scroll">
        <div class="tl-head"><span></span><span><i class="legend is-plan"></i>予定</span><span><i class="legend is-actual"></i>実績</span></div>
        <div class="tl" style="height:${24 * HOUR}px">
          <div class="tl-grid">${Array.from({ length: 25 }, (_, i) => `
            <div class="tl-hour" style="top:${i * HOUR}px"><span>${i < 24 ? i + ':00' : ''}</span></div>
            ${i < 24 ? `<div class="tl-half" style="top:${i * HOUR + HOUR / 2}px"></div>` : ''}`).join('')}
          </div>
          <div class="tl-cols">
            <div class="tl-col" data-col="plan" data-ref="plan"></div>
            <div class="tl-col" data-col="actual" data-ref="actual"></div>
          </div>
          <div class="tl-now" data-ref="now" hidden><span data-ref="nowLabel"></span></div>
        </div>
        <div class="tl-end" data-ref="diaryCard"></div>
      </div>
      <div class="clipbar glass" data-ref="clipbar" hidden></div>
    </section>`);
  const r = refs(el);
  let shownKey = null;
  let sel = null; // 長押しで持ち上げたブロック { type, id }

  /* ヘッダーと週 */
  function renderHead() {
    const d = parseKey(ctx.day);
    r.ym.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    r.date.innerHTML = `${d.getDate()}日<small>${WEEK[d.getDay()]}曜日</small>`;
    el.querySelector('[data-act="today"]').hidden = isToday(ctx.day);

    const start = weekStart(ctx.day);
    const days = store.allDays();
    r.week.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i);
      const has = days[k] && (days[k].plans.length || days[k].actuals.length);
      return `<button class="wd ${k === ctx.day ? 'is-sel' : ''} ${isToday(k) ? 'is-today' : ''} ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}" data-key="${k}">
        <small>${WEEK[i]}</small><b>${parseKey(k).getDate()}</b><i class="${has ? 'has' : ''}"></i></button>`;
    }).join('');

    const n = pendingCount(ctx.day);
    r.badge.hidden = !n;
    r.badge.textContent = n;
  }

  function renderSummary() {
    const day = store.getDay(ctx.day);
    const s = store.daySummary(day);
    const prev = store.getDay(addDays(ctx.day, -1));
    if (!s.plans && !s.actuals) {
      r.summary.innerHTML = prev.plans.length
        ? `<span class="summary-empty">まだ予定がありません</span><button class="chip-btn" data-act="copyDay">${icons.copy}前日の予定をコピー</button>`
        : `<span class="summary-empty">空いているところをタップして予定を追加</span>`;
      return;
    }
    const pct = s.plans ? Math.round((s.done / s.plans) * 100) : 0;
    r.summary.innerHTML = `
      <span><b>${s.plans}</b>予定</span>
      <span><b>${s.done}</b>完了</span>
      ${s.skipped ? `<span><b>${s.skipped}</b>スキップ</span>` : ''}
      <span class="summary-rec">記録 <b>${fmtDuration(s.recorded)}</b></span>
      <span class="summary-bar" style="--p:${pct}%"></span>`;
  }

  /* タイムライン */
  const isSel = (type, id) => sel && sel.type === type && sel.id === id;

  // 持ち上げたブロックに付ける、上下のつまみとコピー/削除
  const selDecor = (it) => `
    <span class="blk-handle is-top" data-handle="top"><i></i></span>
    <span class="blk-handle is-bottom" data-handle="bottom"><i></i></span>
    <span class="blk-tools glass ${it.start < 90 ? 'is-below' : ''}">
      <button data-act="copy">${icons.copy}コピー</button>
      <button data-act="delete">${icons.trash}削除</button>
    </span>`;

  function renderBlocks() {
    const day = store.getDay(ctx.day);
    if (sel && !store.findItem(ctx.day, sel.type, sel.id)) sel = null;

    r.plan.innerHTML = layout(day.plans)
      .map((o) => {
        const p = o.it;
        const st = store.planStatus(day, p);
        const short = p.end - p.start < 40;
        const on = isSel('plan', p.id);
        return `<div role="button" tabindex="0" class="blk blk-plan is-${st} ${short ? 'is-short' : ''} ${o.lanes > 1 ? 'is-narrow' : ''} ${on ? 'is-sel' : ''}" data-plan="${p.id}" style="${blockStyle(o)}">
          <span class="blk-title">${esc(p.title)}</span>
          <span class="blk-time">${fmtTimeShort(p.start)}${short ? '' : ` – ${fmtTimeShort(p.end)}`}</span>
          <span class="blk-marks">${p.alarm ? icons.bellSmall : ''}${linkUrl(p.link) ? icons.link : ''}${st === 'done' ? icons.check : ''}</span>
          ${on ? selDecor(p) : ''}
        </div>`;
      })
      .join('');

    r.actual.innerHTML = layout(day.actuals)
      .map((o) => {
        const a = o.it;
        const plan = a.planId && day.plans.find((p) => p.id === a.planId);
        const diff = plan ? a.start - plan.start : 0;
        const dev = plan && Math.abs(diff) >= 5 ? `<span class="blk-dev">${diff > 0 ? '+' : '−'}${Math.abs(diff)}分</span>` : '';
        const short = a.end - a.start < 40;
        const on = isSel('actual', a.id);
        return `<div role="button" tabindex="0" class="blk blk-actual ${short ? 'is-short' : ''} ${o.lanes > 1 ? 'is-narrow' : ''} ${plan ? '' : 'is-extra'} ${on ? 'is-sel' : ''}" data-actual="${a.id}" style="${blockStyle(o)}">
          <span class="blk-title">${esc(a.title)}</span>
          <span class="blk-time">${fmtTimeShort(a.start)}${short ? '' : ` – ${fmtTimeShort(a.end)}`}</span>
          ${dev}
          ${on ? selDecor(a) : ''}
        </div>`;
      })
      .join('');

    el.classList.toggle('has-sel', !!sel);
  }

  function renderClip() {
    const c = store.getClip();
    r.clipbar.hidden = !c;
    if (!c) return;
    const it = c.item;
    r.clipbar.innerHTML = `
      <span class="clip-dot" style="--c: var(--c-${it.cat})"></span>
      <span class="clip-text"><b>${esc(it.title)}</b><small>${fmtTimeShort(it.start)} – ${fmtTimeShort(it.end)}・${c.type === 'plan' ? '予定' : '実績'}をコピー中</small></span>
      <button class="clip-paste" data-act="paste">この日に貼り付け</button>
      <button class="clip-x" data-act="clipClear" aria-label="コピーをやめる">${icons.close}</button>`;
  }

  function renderNow() {
    const show = isToday(ctx.day);
    r.now.hidden = !show;
    if (!show) return;
    const m = nowMinutes();
    r.now.style.top = `${blockTop(m)}px`;
    r.nowLabel.textContent = fmtTimeShort(m);
    // 現在時刻のラベルと重なる時刻目盛りは隠す
    el.querySelectorAll('.tl-hour').forEach((hr, i) => hr.classList.toggle('is-near', Math.abs(i * 60 - m) < 16));
  }

  function renderDiaryCard() {
    const d = store.getDay(ctx.day).diary;
    r.diaryCard.innerHTML = d
      ? `<button class="diary-card" data-act="diary">
           <span class="eyebrow">この日の日記</span>
           ${d.title ? `<b>${esc(d.title)}</b>` : ''}
           <p>${esc(d.body)}</p>
         </button>`
      : `<button class="diary-card is-empty" data-act="diary">
           <span class="diary-card-icon">${icons.pen}</span>
           <span><b>一日のおわりに、日記を書く</b><small>予定と実績をふり返りながら書けます</small></span>
         </button>`;
  }

  function scrollToStart() {
    const hour = isToday(ctx.day) ? Math.max(0, nowMinutes() / 60 - 1.5) : store.settings().dayStartHour;
    r.scroll.scrollTop = hour * HOUR;
  }

  function scrollIntoView(start) {
    const top = blockTop(start);
    const s = r.scroll;
    if (top < s.scrollTop + 40 || top > s.scrollTop + s.clientHeight - 160) s.scrollTop = top - 120;
  }

  function refresh() {
    if (shownKey !== ctx.day) sel = null;
    renderHead();
    renderSummary();
    renderBlocks();
    renderClip();
    renderNow();
    renderDiaryCard();
    if (shownKey !== ctx.day) {
      shownKey = ctx.day;
      requestAnimationFrame(scrollToStart);
    }
  }

  function select(next) {
    sel = next;
    renderBlocks();
  }

  // 指が触れたままの要素を作り直すと iOS ではタッチを見失うので、その場で飾りだけ付ける
  function liftInPlace(blk, target) {
    el.querySelectorAll('.blk.is-sel').forEach((b) => {
      b.classList.remove('is-sel');
      b.querySelectorAll('.blk-handle, .blk-tools').forEach((x) => x.remove());
    });
    sel = target;
    blk.classList.add('is-sel');
    blk.insertAdjacentHTML('beforeend', selDecor(store.findItem(ctx.day, target.type, target.id)));
    el.classList.add('has-sel');
  }

  const selMatches = (blk) => {
    const b = blockInfo(blk);
    return isSel(b.type, b.id);
  };

  /* ---------- 長押しで持ち上げて、上下にドラッグ ---------- */

  let press = null; // 長押し待ち
  let drag = null; // ドラッグ中
  let suppressClickUntil = 0;

  const blockInfo = (blk) =>
    blk.dataset.plan ? { type: 'plan', id: blk.dataset.plan } : { type: 'actual', id: blk.dataset.actual };
  const blockEl = ({ type, id }) => r[type].querySelector(`[data-${type}="${id}"]`);

  function beginDrag(target, mode, y, pending) {
    const item = store.findItem(ctx.day, target.type, target.id);
    const blk = blockEl(target);
    if (!item || !blk) return;
    drag = {
      ...target,
      mode,
      blk,
      pending, // 持ち上げ済みのブロックをタップしただけなら詳細を開く
      startY: y,
      lastY: y,
      startScroll: r.scroll.scrollTop,
      origStart: item.start,
      origEnd: item.end,
      start: item.start,
      end: item.end,
    };
    blk.classList.add('is-dragging');
    requestAnimationFrame(autoScroll);
  }

  function applyDrag() {
    const d = drag;
    const dy = d.lastY - d.startY + (r.scroll.scrollTop - d.startScroll);
    const dm = Math.round(((dy / HOUR) * 60) / DRAG_SNAP) * DRAG_SNAP;
    let s = d.origStart;
    let e = d.origEnd;
    if (d.mode === 'move') {
      const len = e - s;
      s = Math.min(Math.max(s + dm, 0), 1440 - len);
      e = s + len;
    } else if (d.mode === 'top') {
      s = Math.min(Math.max(s + dm, 0), e - MIN_LEN);
    } else {
      e = Math.max(Math.min(e + dm, 1440), s + MIN_LEN);
    }
    if (s === d.start && e === d.end) return;
    d.start = s;
    d.end = e;
    d.blk.style.top = `${blockTop(s)}px`;
    d.blk.style.height = `${blockHeight(s, e)}px`;
    d.blk.querySelector('.blk-time').textContent = `${fmtTimeShort(s)} – ${fmtTimeShort(e)}`;
  }

  // 画面の端まで持っていったら自動でスクロール
  function autoScroll() {
    if (!drag) return;
    if (!drag.pending) {
      const rect = r.scroll.getBoundingClientRect();
      const y = drag.lastY;
      let v = 0;
      if (y < rect.top + 56) v = -Math.min(14, (rect.top + 56 - y) / 4 + 2);
      else if (y > rect.bottom - 130) v = Math.min(14, (y - (rect.bottom - 130)) / 4 + 2);
      if (v) {
        r.scroll.scrollTop += v;
        applyDrag();
      }
    }
    requestAnimationFrame(autoScroll);
  }

  r.scroll.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const blk = e.target.closest('.blk');
    if (!blk || e.target.closest('.blk-tools')) return;
    const target = blockInfo(blk);

    if (isSel(target.type, target.id)) {
      const handle = e.target.closest('[data-handle]')?.dataset.handle;
      beginDrag(target, handle || 'move', e.clientY, !handle);
      return;
    }
    const y = e.clientY;
    press = {
      x: e.clientX,
      y,
      timer: setTimeout(() => {
        press = null;
        liftInPlace(blk, target);
        beginDrag(target, 'move', y, false);
        suppressClickUntil = Infinity;
        navigator.vibrate?.(10);
      }, LONG_PRESS),
    };
  });

  window.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
      clearTimeout(press.timer);
      press = null;
    }
    if (!drag) return;
    drag.lastY = e.clientY;
    if (drag.pending && Math.abs(e.clientY - drag.startY) < 5) return;
    drag.pending = false;
    applyDrag();
  });

  function endDrag() {
    if (press) {
      clearTimeout(press.timer);
      press = null;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    d.blk.classList.remove('is-dragging');
    if (d.pending) return;
    suppressClickUntil = Date.now() + 400;
    if (d.start !== d.origStart || d.end !== d.origEnd) store.setTimes(ctx.day, d.type, d.id, d.start, d.end);
    else renderBlocks();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // ドラッグ中は画面をスクロールさせない（iOS は touchmove を止める必要がある）
  r.scroll.addEventListener('touchmove', (e) => {
    if (drag && !drag.pending) e.preventDefault();
  }, { passive: false });
  el.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.blk')) e.preventDefault();
  });

  /* ---------- タップ ---------- */

  el.addEventListener('click', async (e) => {
    if (Date.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      return;
    }
    const t = e.target;
    const act = t.closest('[data-act]')?.dataset.act;

    if (act === 'copy' && sel) {
      store.copyItem(ctx.day, sel.type, sel.id);
      select(null);
      return toast('コピーしました。別の日を開いて貼り付けできます');
    }
    if (act === 'delete' && sel) {
      const item = store.findItem(ctx.day, sel.type, sel.id);
      const ok = await confirmSheet({
        title: sel.type === 'plan' ? '予定を削除' : '記録を削除',
        message: `「${item.title}」を削除します。`,
        okLabel: '削除',
        danger: true,
      });
      if (ok) (sel.type === 'plan' ? store.deletePlan : store.deleteActual)(ctx.day, sel.id);
      return select(null);
    }
    if (act === 'paste') {
      const pasted = store.pasteClip(ctx.day);
      if (pasted) {
        select(pasted);
        scrollIntoView(store.findItem(ctx.day, pasted.type, pasted.id).start);
        toast(`${fmtDateJa(ctx.day)}に貼り付けました`);
      }
      return;
    }
    if (act === 'clipClear') return store.clearClip();

    // 持ち上げ中に別の場所をタップしたら、下ろすだけ
    const blk = t.closest('.blk');
    if (sel && !(blk && selMatches(blk))) {
      if (!t.closest('.clipbar')) return select(null);
    }

    if (act === 'today') return ctx.openDay(dayKey());
    if (act === 'alarm') return openAlarmSheet(ctx.day);
    if (act === 'diary') return openDiaryEditor(ctx.day);
    if (act === 'copyDay') {
      store.copyPlans(addDays(ctx.day, -1), ctx.day);
      return toast('前日の予定をコピーしました');
    }
    const wd = t.closest('[data-key]');
    if (wd) return ctx.openDay(wd.dataset.key);

    const day = store.getDay(ctx.day);
    if (blk?.dataset.plan) return openPlanDetail(ctx.day, day.plans.find((p) => p.id === blk.dataset.plan));
    if (blk?.dataset.actual) return openActualEditor(ctx.day, day.actuals.find((a) => a.id === blk.dataset.actual));

    const col = t.closest('[data-col]');
    if (col) {
      const y = e.clientY - col.getBoundingClientRect().top;
      const start = snap((y / HOUR) * 60);
      if (col.dataset.col === 'plan') openPlanEditor(ctx.day, null, { start });
      else openActualEditor(ctx.day, null, { start });
    }
  });

  // 週の帯を左右にスワイプして週を移動
  let sx = null;
  r.week.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  r.week.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) ctx.openDay(addDays(ctx.day, dx < 0 ? 7 : -7));
  });

  setInterval(renderNow, 30 * 1000);

  return {
    el,
    refresh,
    // 右下の＋ボタン：今日なら次のキリのいい時刻、それ以外は 9:00 に入れる
    add() {
      const start = isToday(ctx.day) ? snap(nowMinutes() + 30) : 9 * 60;
      openPlanEditor(ctx.day, null, { start });
    },
  };
}
