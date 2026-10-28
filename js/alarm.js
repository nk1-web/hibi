// 時計アプリへのアラーム登録。Web からは直接鳴らせないので、
// iOS の「ショートカット」に時刻を渡して時計アプリのアラームを作ってもらう。
import * as store from './store.js';
import { h, esc, toast } from './ui.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';
import { fmtTime, isToday, isTomorrow, nowMinutes, fmtDateJa } from './date.js';

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

export function runShortcut(times) {
  const name = store.settings().shortcutName;
  const text = times.join('\n');
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(text)}`;
}

export function openAlarmSheet(key) {
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
      ${
        plans.length
          ? `<ul class="alarm-list">${rows}</ul>`
          : `<p class="alarm-empty">${fmtDateJa(key)} にはアラーム付きの予定がありません。予定の編集画面で「アラーム」をオンにすると、ここに並びます。</p>`
      }
      ${
        reachable
          ? `<button class="btn is-primary" data-act="send" ${pending.length ? '' : 'disabled'}>${icons.bell}時計アプリに登録${pending.length ? `（${pending.length}件）` : ''}</button>`
          : `<p class="alarm-note">時計アプリのアラームは日付を持たないため、登録できるのは今日と明日の分だけです。</p>`
      }
      <p class="alarm-note">「ショートカット」アプリが開き、時計アプリにアラームが追加されます。終わったら左上の「hibi」で戻れます。</p>
      <button class="btn is-plain" data-act="guide">ショートカットの作り方</button>
    </div>`);

  const sheet = openSheet({ title: 'アラーム', body });
  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'send') {
      pending.forEach((p) => store.savePlan(key, { ...p, alarmSent: fmtTime(p.start) }));
      runShortcut(pending.map((p) => fmtTime(p.start)));
      sheet.close();
    } else if (act === 'guide') {
      sheet.close();
      openShortcutGuide();
    }
  });
}

export function sendTestAlarm() {
  const m = (nowMinutes() + 2) % 1440;
  runShortcut([fmtTime(m)]);
  toast(`${fmtTime(m)} のアラームを送りました`);
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
  openSheet({ title: 'ショートカットの作り方', body, full: true });
}
