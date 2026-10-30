// 通知とアラーム。Web からは決まった時刻に鳴らせないので、iOS の「ショートカット」に渡す。
// - カレンダー：これから 7 日間の予定を「hibi」カレンダーに入れ、カレンダーアプリが開始前に通知する
// - アラーム：時計アプリにアラームを作る
import * as store from './store.js';
import { h, esc, toast } from './ui.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';
import { fmtTime, isToday, isTomorrow, nowMinutes, fmtDateJa, dayKey, addDays } from './date.js';

const CAL_DAYS = 7;

function runShortcut(name, lines) {
  const text = lines.join('\n');
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
}

/* ---------- カレンダー通知 ---------- */

export const wantsNotify = (p) => p.notify !== false;

// これから 7 日間の、通知オンの予定と、時刻つきのやること
function calItems() {
  const today = dayKey();
  const last = addDays(today, CAL_DAYS - 1);
  const out = [];
  for (let i = 0; i < CAL_DAYS; i++) {
    const key = addDays(today, i);
    store.getDay(key).plans.filter(wantsNotify).forEach((p) => out.push({ key, start: p.start, end: p.end, title: p.title }));
  }
  // やることは期限の時刻に 15 分の枠として入れる（通知は予定と同じく 10 分前）
  store
    .activeTodos()
    .filter((t) => t.due && t.time != null && t.notify !== false && t.due >= today && t.due <= last)
    .forEach((t) => out.push({ key: t.due, start: t.time, end: t.time + 15, title: `やること：${t.title}` }));
  return out;
}

// 反映したときの内容と比べて、変わっていたら「未反映」
function calSignature() {
  const s = calItems().map((x) => `${x.key}${x.start}-${x.end}${x.title}`).join('/');
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  return String(hash);
}

export function calDirty() {
  const last = store.settings().calSync;
  if (!last && !calItems().length) return false;
  return last?.sig !== calSignature();
}

const calStamp = (key, m) => (m >= 1440 ? `${addDays(key, 1)} ${fmtTime(m - 1440)}` : `${key} ${fmtTime(m)}`);

// 「開始|終了|タイトル」を 1 行ずつ。開始済みのものは送らない（ショートカット側は未来の分だけ消して入れ直す）
function calLines() {
  const now = nowMinutes();
  const today = dayKey();
  return calItems()
    .filter((x) => x.key !== today || x.start > now)
    .map((x) => `${calStamp(x.key, x.start)}|${calStamp(x.key, x.end)}|${x.title.replace(/\|/g, '／')}`);
}

function syncCalendar() {
  const lines = calLines();
  store.setSetting('calSync', { sig: calSignature(), at: Date.now() });
  runShortcut(store.settings().calShortcutName, lines);
}

/* ---------- 時計のアラーム ---------- */

function alarmPlans(key) {
  return store.getDay(key).plans.filter((p) => p.alarm);
}

// 時計のアラームには日付がない。今日の過ぎた時刻を入れると明日鳴ってしまう
function isPast(key, p) {
  return isToday(key) && p.start <= nowMinutes();
}

export function unsentAlarms(key) {
  if (!isToday(key) && !isTomorrow(key)) return [];
  return alarmPlans(key).filter((p) => !isPast(key, p) && p.alarmSent !== fmtTime(p.start));
}

// ヘッダーのベルに出す数
export function pendingCount(key) {
  return unsentAlarms(key).length + (calDirty() ? 1 : 0);
}

/* ---------- シート ---------- */

function fmtStamp(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(d.getHours() * 60 + d.getMinutes())}`;
}

export function openAlarmSheet(key) {
  const count = calLines().length;
  const dirty = calDirty();
  const last = store.settings().calSync;

  const plans = alarmPlans(key);
  const reachable = isToday(key) || isTomorrow(key);
  const pending = unsentAlarms(key);
  const rows = plans
    .map((p) => {
      const sent = p.alarmSent === fmtTime(p.start);
      const past = isPast(key, p);
      const state = past ? '時刻を過ぎています' : sent ? '登録済み' : '未登録';
      return `<li class="${sent || past ? 'is-sent' : ''}"><time>${fmtTime(p.start)}</time><b>${esc(p.title)}</b><small>${state}</small></li>`;
    })
    .join('');

  const body = h(`
    <div class="alarm">
      <section class="notify-card">
        <div class="notify-head">
          <span class="notify-icon">${icons.calendar}</span>
          <span><b>開始前の通知</b><small>これから ${CAL_DAYS} 日間の予定と、時刻つきのやることを「hibi」カレンダーに入れ、カレンダーアプリから通知します</small></span>
        </div>
        <p class="notify-state ${dirty ? 'is-dirty' : ''}">
          ${!last ? 'まだ反映していません' : dirty ? '予定が変わっています。反映してください' : `${fmtStamp(last.at)} に反映済み`}
        </p>
        <button class="btn is-primary" data-act="cal">${icons.calendar}カレンダーに反映（${count}件）</button>
        <button class="btn is-plain" data-act="calGuide">カレンダー用ショートカットの作り方</button>
      </section>

      <p class="alarm-section">時計のアラーム・${fmtDateJa(key)}</p>
      ${
        plans.length
          ? `<ul class="alarm-list">${rows}</ul>`
          : `<p class="alarm-empty">アラーム付きの予定はありません。予定の編集画面で「アラーム」をオンにすると、ここに並びます。</p>`
      }
      ${
        reachable
          ? plans.length
            ? `<button class="btn is-primary" data-act="send" ${pending.length ? '' : 'disabled'}>${icons.bell}時計アプリに登録${pending.length ? `（${pending.length}件）` : ''}</button>`
            : ''
          : `<p class="alarm-note">時計アプリのアラームは日付を持たないため、登録できるのは今日と明日の分だけです。</p>`
      }
      <p class="alarm-note">どちらも「ショートカット」アプリが開いて登録します。終わったら左上の「hibi」で戻れます。</p>
      <button class="btn is-plain" data-act="guide">アラーム用ショートカットの作り方</button>
    </div>`);

  const sheet = openSheet({ title: '通知とアラーム', body });
  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cal') {
      sheet.close();
      syncCalendar();
    } else if (act === 'send') {
      pending.forEach((p) => store.savePlan(key, { ...p, alarmSent: fmtTime(p.start) }));
      runShortcut(store.settings().shortcutName, pending.map((p) => fmtTime(p.start)));
      sheet.close();
    } else if (act === 'guide') {
      sheet.close();
      openShortcutGuide();
    } else if (act === 'calGuide') {
      sheet.close();
      openCalendarGuide();
    }
  });
}

export function sendTestAlarm() {
  const m = (nowMinutes() + 2) % 1440;
  runShortcut(store.settings().shortcutName, [fmtTime(m)]);
  toast(`${fmtTime(m)} のアラームを送りました`);
}

/* ---------- 作り方ガイド ---------- */

export function openCalendarGuide() {
  const name = store.settings().calShortcutName;
  const body = h(`
    <div class="guide">
      <p class="guide-lead">最初に一度だけ準備します。10 分ほどかかりますが、あとは「カレンダーに反映」を押すだけで、予定の 10 分前に通知が届くようになります。</p>
      <ol class="steps">
        <li><b>「hibi」カレンダーを作る</b><p>カレンダーアプリの下にある「カレンダー」→「カレンダーを追加」で、名前を <code>hibi</code> にします。普段の予定と混ざらないようにするためです。</p></li>
        <li><b>新しいショートカットを作る</b><p>「ショートカット」アプリの右上の＋をタップ。名前を <code>${esc(name)}</code> にします（設定画面の名前と同じに）。</p></li>
        <li><b>「カレンダーイベントを検索」を追加</b><p>「フィルタを追加」で <code>カレンダー</code> が <code>hibi</code>、もう一つ <code>開始日</code> が <code>次の 8 日以内</code> にします。「制限」はオフに。</p></li>
        <li><b>「イベントを削除」を追加</b><p>前回入れた分を消して、入れ直すためです。hibi カレンダーの中だけが対象なので、普段の予定は消えません。</p></li>
        <li><b>「テキストを分割」を追加</b><p>分割する対象を「ショートカットの入力」、区切りを「改行」にします。</p></li>
        <li><b>「各項目を繰り返す」を追加</b><p>対象が「分割されたテキスト」になっていれば OK です。以下の 7〜9 はこの繰り返しの中に入れます。</p></li>
        <li><b>「テキストを分割」をもう一つ</b><p>分割する対象を「繰り返し項目」、区切りを「カスタム」にして <code>|</code>（縦線）を入れます。</p></li>
        <li><b>「リストから項目を取得」を 3 つ</b><p>1 つ目は「最初の項目」（開始）、2 つ目は「インデックスの項目」で <code>2</code>（終了）、3 つ目は「最後の項目」（タイトル）にします。</p></li>
        <li><b>「カレンダーイベントを追加」</b><p>タイトルに 3 つ目、開始日に 1 つ目、終了日に 2 つ目の結果を入れます。カレンダーは <code>hibi</code>、通知は <code>10 分前</code> に。</p></li>
        <li><b>試す</b><p>hibi で予定を入れ、右上のベル →「カレンダーに反映」。カレンダーアプリの hibi カレンダーに予定が入れば完成です。</p></li>
      </ol>
      <p class="guide-note">通知のタイミングは手順 9 の「通知」で変えられます（5 分前、30 分前など）。予定ややることごとに通知が要らないときは、編集画面で「通知」をオフにすると、カレンダーにも入りません。</p>
      <p class="guide-note">初回や削除のときに「許可しますか」と聞かれたら、「常に許可」を選ぶと次から聞かれなくなります。日付がうまく読み取られない場合は、手順 8 のあとに「入力から日付を取得」を挟んでください。</p>
    </div>`);
  openSheet({ title: 'カレンダー用ショートカット', body, full: true });
}

export function openShortcutGuide() {
  const name = store.settings().shortcutName;
  const body = h(`
    <div class="guide">
      <p class="guide-lead">最初に一度だけ、iPhone の「ショートカット」アプリでアラーム登録用のショートカットを作ります。5 分ほどで終わります。</p>
      <ol class="steps">
        <li><b>新しいショートカットを作る</b><p>「ショートカット」アプリの右上の＋をタップ。名前を <code>${esc(name)}</code> にします（設定画面の名前と同じにしてください）。</p></li>
        <li><b>「テキストを分割」を追加</b><p>検索欄で「分割」と入れて追加。分割する対象を「ショートカットの入力」、区切りを「改行」にします。</p></li>
        <li><b>「各項目を繰り返す」を追加</b><p>対象が「分割されたテキスト」になっていれば OK です。</p></li>
        <li><b>繰り返しの中に「アラームを作成」を追加</b><p>時刻に「繰り返し項目」を入れます。ラベルは「hibi」など、あとで見分けがつく名前に。</p></li>
        <li><b>テストする</b><p>このアプリの設定画面にある「テスト（2 分後に鳴らす）」で、時計アプリにアラームが増えれば完成です。</p></li>
      </ol>
      <p class="guide-note">うまく登録されない場合は、手順 3 と 4 の間に「入力から日付を取得」を挟み、その結果をアラームの時刻に入れてください。iOS のバージョンによってアクション名が少し違うことがあります。</p>
    </div>`);
  openSheet({ title: 'アラーム用ショートカット', body, full: true });
}
