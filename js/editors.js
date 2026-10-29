import * as store from './store.js';
import { CATS } from './store.js';
import { h, esc, refs, toast, haptic } from './ui.js';
import { openSheet, confirmSheet } from './sheet.js';
import { icons } from './icons.js';
import { LINKS, findLink, linkLabel, openLink, linkUrl } from './links.js';
import { fmtTime, parseTime, fmtDuration, fmtDateJa, isToday, nowMinutes } from './date.js';

const catChips = (selected) =>
  `<div class="chips" data-ref="cats">${CATS.map(
    (c) =>
      `<button type="button" class="chip ${c.id === selected ? 'is-on' : ''}" data-cat="${c.id}" style="--c: var(--c-${c.id})"><i></i>${c.label}</button>`
  ).join('')}</div>`;

function bindChips(el, onPick) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    onPick(b.dataset.cat);
  });
}

function readRange(r) {
  const start = parseTime(r.start.value);
  let end = parseTime(r.end.value);
  if (start == null) return null;
  // 終了が開始より前なら 24:00 までの予定として扱う
  if (end == null || end <= start) end = end === 0 ? 1440 : Math.min(start + 30, 1440);
  return { start, end };
}

function shake(el) {
  el.classList.remove('is-shake');
  void el.offsetWidth;
  el.classList.add('is-shake');
  el.focus();
}

/* ---------- 予定の編集 ---------- */

export function openPlanEditor(key, plan, { start = 7 * 60 } = {}) {
  const isNew = !plan;
  const p = plan
    ? { ...plan, link: { ...(plan.link || { kind: 'none', value: '' }) } }
    : { id: store.uid(), title: '', start, end: Math.min(start + 60, 1440), cat: 'life', notify: true, alarm: false, link: { kind: 'none', value: '' }, memo: '' };

  const presets = isNew ? store.presets() : [];
  const body = h(`
    <form class="form" autocomplete="off">
      ${
        presets.length
          ? `<div class="presets">
               <p class="presets-label">よく使う予定から</p>
               <div class="chips" data-ref="presets">${presets
                 .map(
                   (x) =>
                     `<button type="button" class="chip is-preset" data-preset="${x.id}" style="--c: var(--c-${x.cat})"><i></i>${esc(x.title)}<small>${fmtDuration(x.duration)}</small></button>`
                 )
                 .join('')}</div>
             </div>`
          : ''
      }
      <input class="title-input" data-ref="title" placeholder="予定のタイトル" maxlength="40" value="${esc(p.title)}">
      ${catChips(p.cat)}
      <div class="group">
        <label class="row"><span>開始</span><input type="time" data-ref="start" value="${fmtTime(p.start)}"></label>
        <label class="row"><span>終了</span><input type="time" data-ref="end" value="${fmtTime(p.end % 1440)}"></label>
      </div>
      <div class="group">
        <label class="row">
          <span class="row-main"><b>通知</b><small>開始前にカレンダーから知らせる</small></span>
          <input type="checkbox" class="switch" data-ref="notify" ${p.notify !== false ? 'checked' : ''}>
        </label>
        <label class="row">
          <span class="row-main"><b>アラーム</b><small>開始時刻に時計アプリで鳴らす</small></span>
          <input type="checkbox" class="switch" data-ref="alarm" ${p.alarm ? 'checked' : ''}>
        </label>
      </div>
      <div class="group">
        <label class="row"><span>連携するアプリ</span>
          <select data-ref="linkKind">${LINKS.map((l) => `<option value="${l.id}" ${l.id === p.link.kind ? 'selected' : ''}>${l.label}</option>`).join('')}</select>
        </label>
        <label class="row" data-ref="linkRow"><span data-ref="linkField"></span><input data-ref="linkValue" value="${esc(p.link.value)}" autocapitalize="off"></label>
      </div>
      <div class="group">
        <textarea data-ref="memo" rows="3" placeholder="メモ">${esc(p.memo)}</textarea>
      </div>
      ${isNew ? '' : `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}この予定を削除</button>`}
    </form>`);
  const r = refs(body);
  bindChips(r.cats, (c) => (p.cat = c));

  function syncLink() {
    const def = findLink(r.linkKind.value);
    r.linkRow.hidden = !def.field;
    r.linkField.textContent = def.field || '';
    r.linkValue.placeholder = def.id === 'url' ? 'https:// または アプリ名://' : '例：おやすみモード';
  }
  r.linkKind.addEventListener('change', syncLink);
  syncLink();

  // プリセットを選ぶと、タイトル・カテゴリ・長さ・アラーム・連携をまとめて入れる
  r.presets?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const x = presets.find((y) => y.id === b.dataset.preset);
    r.presets.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === b));
    r.title.value = x.title;
    p.cat = x.cat;
    r.cats.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.cat === x.cat));
    const start = parseTime(r.start.value) ?? p.start;
    r.end.value = fmtTime(Math.min(start + x.duration, 1440) % 1440);
    r.alarm.checked = !!x.alarm;
    r.linkKind.value = x.link?.kind || 'none';
    r.linkValue.value = x.link?.value || '';
    syncLink();
  });

  function save() {
    const title = r.title.value.trim();
    if (!title) {
      shake(r.title);
      return false;
    }
    const range = readRange(r);
    if (!range) return false;
    const next = {
      ...p,
      title,
      ...range,
      notify: r.notify.checked,
      alarm: r.alarm.checked,
      link: { kind: r.linkKind.value, value: r.linkValue.value.trim() },
      memo: r.memo.value.trim(),
    };
    // 時刻が変わったアラームは時計アプリへの登録をやり直す
    if (next.alarmSent && next.alarmSent !== fmtTime(next.start)) next.alarmSent = null;
    store.savePlan(key, next);
    haptic();
  }

  body.addEventListener('submit', (e) => e.preventDefault());
  const sheet = openSheet({ title: isNew ? '予定を追加' : '予定を編集', body, confirm: { label: '保存', onConfirm: save } });
  r.del?.addEventListener('click', async () => {
    if (await confirmSheet({ title: '予定を削除', message: `「${p.title}」を削除します。記録した実績は残ります。`, okLabel: '削除', danger: true })) {
      store.deletePlan(key, p.id);
      sheet.close();
    }
  });
  if (isNew) r.title.focus();
}

/* ---------- 予定の詳細（ここから実績を記録する） ---------- */

export function openPlanDetail(key, plan) {
  const day = store.getDay(key);
  const status = store.planStatus(day, plan);
  const actual = day.actuals.find((a) => a.planId === plan.id);
  const cat = CATS.find((c) => c.id === plan.cat);
  const url = linkUrl(plan.link);

  const body = h(`
    <div class="detail" style="--c: var(--c-${plan.cat})">
      <div class="detail-top">
        <span class="detail-cat"><i></i>${cat?.label || ''}</span>
        <h3>${esc(plan.title)}</h3>
        <p class="detail-time">${fmtTime(plan.start)} – ${fmtTime(plan.end)}<span>${fmtDuration(plan.end - plan.start)}</span></p>
        ${plan.notify !== false ? `<p class="detail-note">${icons.calendar}開始前にカレンダーから通知</p>` : ''}
        ${plan.alarm ? `<p class="detail-note">${icons.bellSmall}${plan.alarmSent ? '時計アプリにアラーム登録済み' : 'アラームは未登録'}</p>` : ''}
        ${plan.memo ? `<p class="detail-memo">${esc(plan.memo)}</p>` : ''}
      </div>
      ${url ? `<button class="btn is-link" data-act="link">${icons.arrowUpRight}${esc(linkLabel(plan.link))} を開く</button>` : ''}
      ${
        status === 'done'
          ? `<div class="detail-result">
               <span class="detail-result-label">${icons.checkCircle}実績</span>
               <b>${fmtTime(actual.start)} – ${fmtTime(actual.end)}</b>
               <small>${devText(actual.start - plan.start)}</small>
             </div>
             <div class="detail-actions">
               <button class="action" data-act="editActual">${icons.pen}<span>実績を直す</span></button>
               <button class="action" data-act="undo">${icons.undo}<span>記録を取り消す</span></button>
             </div>`
          : `<div class="detail-actions">
               <button class="action is-main" data-act="done">${icons.check}<span>予定どおり</span></button>
               <button class="action" data-act="record">${icons.pen}<span>時間を変えて記録</span></button>
               <button class="action ${status === 'skipped' ? 'is-on' : ''}" data-act="skip">${icons.skip}<span>${status === 'skipped' ? 'スキップ中' : 'スキップ'}</span></button>
             </div>`
      }
      <div class="detail-foot">
        <button data-act="copy">${icons.copy}コピー</button>
        <button data-act="preset">${icons.plus}プリセットに追加</button>
        <button data-act="edit">${icons.pen}編集</button>
      </div>
      <p class="detail-hint">箱を長押しすると、ドラッグで時間を動かせます</p>
    </div>`);

  const sheet = openSheet({ title: '予定', body });
  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'link') return openLink(plan.link);
    if (act === 'done') {
      store.saveActual(key, { id: store.uid(), planId: plan.id, title: plan.title, start: plan.start, end: plan.end, cat: plan.cat, memo: '' });
      if (plan.skipped) store.savePlan(key, { ...plan, skipped: false });
      haptic();
      toast('予定どおりに記録しました');
      sheet.close();
    } else if (act === 'record') {
      sheet.close();
      let end = plan.end;
      if (isToday(key)) {
        const now = nowMinutes();
        if (now > plan.start && now < plan.end) end = now;
      }
      openActualEditor(key, null, { from: plan, start: plan.start, end });
    } else if (act === 'skip') {
      store.savePlan(key, { ...plan, skipped: !plan.skipped });
      sheet.close();
    } else if (act === 'undo') {
      store.deleteActual(key, actual.id);
      sheet.close();
    } else if (act === 'editActual') {
      sheet.close();
      openActualEditor(key, actual);
    } else if (act === 'edit') {
      sheet.close();
      openPlanEditor(key, plan);
    } else if (act === 'copy') {
      store.copyItem(key, 'plan', plan.id);
      sheet.close();
      toast('コピーしました。別の日を開いて貼り付けできます');
    } else if (act === 'preset') {
      const dup = store.presets().some((x) => x.title === plan.title && x.duration === plan.end - plan.start);
      if (!dup) store.addPreset(plan);
      toast(dup ? 'すでにプリセットにあります' : `「${plan.title}」をプリセットに追加しました`);
    }
  });
}

export function devText(diff) {
  if (Math.abs(diff) < 5) return '予定どおり';
  return diff > 0 ? `${fmtDuration(diff)}遅れて開始` : `${fmtDuration(-diff)}早く開始`;
}

/* ---------- 実績の編集 ---------- */

export function openActualEditor(key, actual, { from, start = 7 * 60, end } = {}) {
  const isNew = !actual;
  const day = store.getDay(key);
  const a = actual
    ? { ...actual }
    : {
        id: store.uid(),
        planId: from?.id || null,
        title: from?.title || '',
        start,
        end: end ?? Math.min(start + 60, 1440),
        cat: from?.cat || 'life',
        memo: '',
      };

  const body = h(`
    <form class="form" autocomplete="off">
      <input class="title-input" data-ref="title" placeholder="実際にしたこと" maxlength="40" value="${esc(a.title)}">
      ${catChips(a.cat)}
      <div class="group">
        <label class="row"><span>開始</span><input type="time" data-ref="start" value="${fmtTime(a.start)}"></label>
        <label class="row"><span>終了</span><input type="time" data-ref="end" value="${fmtTime(a.end % 1440)}"></label>
      </div>
      <div class="group">
        <label class="row"><span>対応する予定</span>
          <select data-ref="plan">
            <option value="">予定外</option>
            ${day.plans.map((p) => `<option value="${p.id}" ${p.id === a.planId ? 'selected' : ''}>${fmtTime(p.start)} ${esc(p.title)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="group">
        <textarea data-ref="memo" rows="3" placeholder="どうだった？">${esc(a.memo)}</textarea>
      </div>
      ${isNew ? '' : `<button type="button" class="btn is-danger-plain" data-ref="del">${icons.trash}この記録を削除</button>`}
    </form>`);
  const r = refs(body);
  bindChips(r.cats, (c) => (a.cat = c));

  // 予定を選んだら、タイトルが空のときだけ引き継ぐ
  r.plan.addEventListener('change', () => {
    const p = day.plans.find((x) => x.id === r.plan.value);
    if (p && !r.title.value.trim()) {
      r.title.value = p.title;
      a.cat = p.cat;
      r.cats.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.cat === p.cat));
    }
  });

  function save() {
    const title = r.title.value.trim();
    if (!title) {
      shake(r.title);
      return false;
    }
    const range = readRange(r);
    if (!range) return false;
    // 1 つの予定につき実績は 1 つ。別の実績が付いていたら外す
    const planId = r.plan.value || null;
    if (planId) {
      day.actuals
        .filter((x) => x.planId === planId && x.id !== a.id)
        .forEach((x) => store.saveActual(key, { ...x, planId: null }));
      const p = day.plans.find((x) => x.id === planId);
      if (p?.skipped) store.savePlan(key, { ...p, skipped: false });
    }
    store.saveActual(key, { ...a, title, ...range, planId, memo: r.memo.value.trim() });
    haptic();
  }

  body.addEventListener('submit', (e) => e.preventDefault());
  const sheet = openSheet({ title: isNew ? '実績を記録' : '実績を編集', body, confirm: { label: '保存', onConfirm: save } });
  r.del?.addEventListener('click', async () => {
    if (await confirmSheet({ title: '記録を削除', message: `「${a.title}」の記録を削除します。`, okLabel: '削除', danger: true })) {
      store.deleteActual(key, a.id);
      sheet.close();
    }
  });
  if (isNew && !from) r.title.focus();
}

/* ---------- 日記 ---------- */

export function openDiaryEditor(key) {
  const day = store.getDay(key);
  const diary = day.diary || { title: '', body: '' };
  const sum = store.daySummary(day);
  const unplanned = day.actuals.filter((a) => !a.planId);

  const recap = day.plans.length || day.actuals.length
    ? `<div class="recap">
        <p class="recap-head">この日の予定と実績<span>${sum.done} / ${sum.plans} 完了</span></p>
        <ul>
          ${day.plans
            .map((p) => {
              const s = store.planStatus(day, p);
              const act = day.actuals.find((x) => x.planId === p.id);
              const upcoming = s === 'todo' && isToday(key) && p.start > nowMinutes();
              const note = s === 'done' ? devText(act.start - p.start) : s === 'skipped' ? 'スキップ' : upcoming ? 'これから' : '未記録';
              return `<li class="is-${upcoming ? 'upcoming' : s}" style="--c: var(--c-${p.cat})"><time>${fmtTime(p.start)}</time><b>${esc(p.title)}</b><small>${note}</small></li>`;
            })
            .join('')}
          ${unplanned
            .map((a) => `<li class="is-extra" style="--c: var(--c-${a.cat})"><time>${fmtTime(a.start)}</time><b>${esc(a.title)}</b><small>予定外</small></li>`)
            .join('')}
        </ul>
      </div>`
    : '';

  const body = h(`
    <div class="diary-edit">
      ${recap}
      <input class="diary-title" data-ref="title" placeholder="ひとことで言うと" maxlength="40" value="${esc(diary.title)}">
      <textarea class="diary-body" data-ref="body" placeholder="今日はどんな一日だった？">${esc(diary.body)}</textarea>
      <p class="diary-saved" data-ref="saved">${diary.updatedAt ? '保存済み' : ''}</p>
    </div>`);
  const r = refs(body);

  let timer;
  function persist() {
    store.setDiary(key, { title: r.title.value, body: r.body.value, updatedAt: Date.now() });
    r.saved.textContent = '保存済み';
  }
  const queue = () => {
    r.saved.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(persist, 500);
  };
  r.title.addEventListener('input', queue);
  r.body.addEventListener('input', queue);

  openSheet({
    title: fmtDateJa(key),
    body,
    full: true,
    confirm: { label: '完了', onConfirm: () => (clearTimeout(timer), persist()) },
    onClose: () => {
      clearTimeout(timer);
      if (r.title.value !== diary.title || r.body.value !== diary.body) persist();
    },
  });
}
