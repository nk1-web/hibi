import * as store from '../store.js';
import { CATS } from '../store.js';
import { h, esc, refs, toast } from '../ui.js';
import { fmtDuration } from '../date.js';
import { icons } from '../icons.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { openShortcutGuide, openCalendarGuide, sendTestAlarm } from '../alarm.js';
import { dayKey } from '../date.js';

export function createSettings() {
  const el = h(`
    <section class="view view-settings">
      <header class="head">
        <div class="head-title">
          <p class="eyebrow">hibi</p>
          <h1>設定</h1>
        </div>
      </header>
      <div class="scroller">
        <p class="group-label">開始前の通知（カレンダー）</p>
        <div class="group">
          <label class="row"><span>ショートカット名</span><input data-ref="calShortcut" autocapitalize="off"></label>
          <button class="row is-nav" data-act="calGuide"><span>ショートカットの作り方</span>${icons.chevronR}</button>
        </div>
        <p class="group-foot">これから 7 日間の予定を iPhone の「hibi」カレンダーに入れ、開始前にカレンダーアプリから通知します。</p>

        <p class="group-label">アラーム（時計）</p>
        <div class="group">
          <label class="row"><span>ショートカット名</span><input data-ref="shortcut" autocapitalize="off"></label>
          <button class="row is-nav" data-act="guide"><span>ショートカットの作り方</span>${icons.chevronR}</button>
          <button class="row is-nav" data-act="test"><span>テスト（2 分後に鳴らす）</span>${icons.chevronR}</button>
        </div>
        <p class="group-foot">予定のアラームは、iPhone の「ショートカット」を通して時計アプリに登録します。</p>

        <p class="group-label">表示</p>
        <div class="group">
          <label class="row"><span>タイムラインの表示開始</span>
            <select data-ref="dayStart">${Array.from({ length: 13 }, (_, i) => `<option value="${i}">${i}:00</option>`).join('')}</select>
          </label>
        </div>

        <p class="group-label">よく使う予定（プリセット）</p>
        <div class="group" data-ref="presets"></div>
        <p class="group-foot">予定を追加するときに選べます。予定の詳細画面の「プリセットに追加」で増やせます。</p>

        <p class="group-label">データ</p>
        <div class="group">
          <button class="row is-nav" data-act="export"><span>バックアップを書き出す</span>${icons.chevronR}</button>
          <label class="row is-nav"><span>バックアップから戻す</span>${icons.chevronR}<input type="file" accept="application/json,.json" data-ref="file" hidden></label>
          <button class="row is-danger" data-act="wipe"><span>すべてのデータを消去</span></button>
        </div>
        <p class="group-foot">データはこの iPhone の中にだけ保存されています。機種変更の前や、ときどきバックアップを書き出しておくと安心です。</p>

        <p class="group-label">このアプリ</p>
        <div class="group">
          <button class="row is-nav" data-act="install"><span>ホーム画面に追加する方法</span>${icons.chevronR}</button>
          <div class="row"><span>バージョン</span><span class="row-value">0.2.0</span></div>
        </div>
      </div>
    </section>`);
  const r = refs(el);

  function refresh() {
    const s = store.settings();
    if (document.activeElement !== r.shortcut) r.shortcut.value = s.shortcutName;
    if (document.activeElement !== r.calShortcut) r.calShortcut.value = s.calShortcutName;
    r.dayStart.value = String(s.dayStartHour);

    const cats = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
    r.presets.innerHTML =
      store
        .presets()
        .map(
          (p) => `<div class="row preset-row" style="--c: var(--c-${p.cat})">
            <span class="row-main"><b><i></i>${esc(p.title)}</b><small>${cats[p.cat]}・${fmtDuration(p.duration)}${p.alarm ? '・アラーム' : ''}</small></span>
            <button class="row-del" data-del-preset="${p.id}" aria-label="${esc(p.title)}を削除">${icons.close}</button>
          </div>`
        )
        .join('') + `<button class="row is-nav" data-act="resetPresets"><span>最初のプリセットに戻す</span>${icons.chevronR}</button>`;
  }

  r.shortcut.addEventListener('change', () => {
    const v = r.shortcut.value.trim();
    if (v) store.setSetting('shortcutName', v);
    else refresh();
  });
  r.calShortcut.addEventListener('change', () => {
    const v = r.calShortcut.value.trim();
    if (v) store.setSetting('calShortcutName', v);
    else refresh();
  });
  r.dayStart.addEventListener('change', () => store.setSetting('dayStartHour', Number(r.dayStart.value)));

  r.file.addEventListener('change', async () => {
    const f = r.file.files[0];
    r.file.value = '';
    if (!f) return;
    const ok = await confirmSheet({
      title: 'バックアップから戻す',
      message: `「${f.name}」の内容で、いまのデータをすべて置き換えます。`,
      okLabel: '置き換える',
      danger: true,
    });
    if (!ok) return;
    try {
      store.importJSON(await f.text());
      toast('バックアップから戻しました');
    } catch (err) {
      toast(err.message || '読み込めませんでした');
    }
  });

  el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-preset]');
    if (del) return store.deletePreset(del.dataset.delPreset);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'resetPresets') {
      const ok = await confirmSheet({
        title: 'プリセットを戻す',
        message: '追加したプリセットは消え、最初から入っていたものに戻ります。',
        okLabel: '戻す',
      });
      if (ok) store.resetPresets();
      return;
    }
    if (act === 'guide') openShortcutGuide();
    else if (act === 'calGuide') openCalendarGuide();
    else if (act === 'test') sendTestAlarm();
    else if (act === 'export') exportBackup();
    else if (act === 'install') openInstallGuide();
    else if (act === 'wipe') {
      const ok = await confirmSheet({
        title: 'すべてのデータを消去',
        message: '予定・実績・日記をすべて消します。元に戻せないので、必要ならさきにバックアップを書き出してください。',
        okLabel: '消去する',
        danger: true,
      });
      if (ok) {
        store.wipe();
        toast('すべてのデータを消去しました');
      }
    }
  });

  return { el, refresh };
}

async function exportBackup() {
  const name = `hibi-${dayKey().replaceAll('-', '')}.json`;
  const file = new File([store.exportJSON()], name, { type: 'application/json' });
  // iPhone では共有シートから「ファイル」に保存できる
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch {}
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openInstallGuide() {
  const body = h(`
    <div class="guide">
      <ol class="steps">
        <li><b>Safari でこのページを開く</b><p>Chrome など他のブラウザでもできますが、Safari がいちばん確実です。</p></li>
        <li><b>共有ボタンをタップ</b><p>画面下（または右上）の四角から矢印が出ているボタンです。</p></li>
        <li><b>「ホーム画面に追加」を選ぶ</b><p>見つからないときは、メニューを下までスクロールしてください。</p></li>
        <li><b>ホーム画面のアイコンから開く</b><p>アプリと同じように全画面で動きます。データはホーム画面のアプリ側に保存されます。</p></li>
      </ol>
    </div>`);
  openSheet({ title: 'ホーム画面に追加', body });
}
